package sonos

import (
	"browser-mac/internal/secret"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDescription(t *testing.T) {
	d, err := parseDevice([]byte(`<root><device><manufacturer>Sonos, Inc.</manufacturer><roomName>Wohnzimmer</roomName><friendlyName>192.168.1.4 - Sonos</friendlyName><modelName>Sonos Era 100</modelName><UDN>uuid:RINCON_123</UDN></device></root>`), "192.168.1.4")
	if err != nil || d.Name != "Wohnzimmer" || d.Model != "Sonos Era 100" || d.ID != "uuid:RINCON_123" {
		t.Fatalf("description: %+v %v", d, err)
	}
	if _, err := parseDevice([]byte(`<root><device><manufacturer>Other</manufacturer></device></root>`), ""); err == nil {
		t.Fatal("accepted unrelated device")
	}
}
func TestVolumeSOAP(t *testing.T) {
	for _, tc := range []struct {
		value int
		want  string
	}{{120, "100"}, {-3, "0"}, {42, "42"}} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			b, _ := io.ReadAll(r.Body)
			if r.Method != "POST" || r.URL.Path != "/MediaRenderer/RenderingControl/Control" || r.Header.Get("SOAPACTION") != `"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume"` || !strings.Contains(string(b), "<DesiredVolume>"+tc.want+"</DesiredVolume>") {
				t.Errorf("invalid request %s", b)
			}
		}))
		m := Manager{http: &http.Client{Transport: rewriteTransport{server.URL, http.DefaultTransport}}}
		if err := m.setVolume(context.Background(), "127.0.0.1", tc.value); err != nil {
			t.Fatal(err)
		}
		server.Close()
	}
}

type rewriteTransport struct {
	url  string
	base http.RoundTripper
}

func (r rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.URL.Host = strings.TrimPrefix(r.url, "http://")
	return r.base.RoundTrip(req)
}
func TestPreferences(t *testing.T) {
	store := secret.New(t.TempDir())
	m := &Manager{wake: make(chan struct{}, 1), store: store, state: Status{Devices: []Device{{ID: "one"}}}}
	if s, err := m.Configure(true, []string{"unknown"}); err != nil || !s.Enabled || len(s.Selected) != 0 {
		t.Fatal("must allow activation before discovery", err)
	}
	select {
	case <-m.wake:
	default:
		t.Fatal("activation did not schedule discovery")
	}
	s, err := m.Configure(true, []string{"one", "one", "unknown"})
	if err != nil || len(s.Selected) != 1 || !s.Enabled || m.baseline != -1 {
		t.Fatal("invalid configuration", s, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	n := New(ctx, store)
	if !n.Status().Enabled || len(n.Status().Selected) != 1 {
		t.Fatal("settings not restored")
	}
}

func TestSyncOnlyOnChangesAndSelectedSpeakers(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls++ }))
	defer server.Close()
	m := &Manager{baseline: -1, http: &http.Client{Transport: rewriteTransport{server.URL, http.DefaultTransport}}, state: Status{Enabled: true, Selected: []string{"one"}, Devices: []Device{{ID: "one", IP: "127.0.0.1", Online: true}, {ID: "two", IP: "127.0.0.1", Online: true}}}}
	ctx := context.Background()
	m.syncVolume(ctx, 40, 1)
	m.syncVolume(ctx, 40, 1)
	if calls != 0 {
		t.Fatal("volume changed on enable or unchanged value")
	}
	m.syncVolume(ctx, 45, 1)
	if calls != 1 {
		t.Fatal("selected speaker not updated exactly once", calls)
	}
	m.syncVolume(ctx, 80, 2)
	if calls != 1 {
		t.Fatal("volume jumped on output device change")
	}
	m.state.Enabled = false
	m.syncVolume(ctx, 90, 2)
	if calls != 1 {
		t.Fatal("disabled sync wrote volume")
	}
	m.state.Enabled = true
	m.syncVolume(ctx, -1, 2)
	m.syncVolume(ctx, 30, 2)
	if calls != 1 {
		t.Fatal("unavailable device changed volume")
	}
}

func TestAvailabilityOfflineRecoveryAndDisabled(t *testing.T) {
	online := true
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if !online {
			w.WriteHeader(503)
			return
		}
		io.WriteString(w, `<root><device><manufacturer>Sonos</manufacturer><UDN>one</UDN></device></root>`)
	}))
	defer server.Close()
	m := &Manager{http: &http.Client{Transport: rewriteTransport{server.URL, http.DefaultTransport}}, state: Status{Enabled: true, Devices: []Device{{ID: "one", IP: "127.0.0.1"}}}}
	m.checkAvailability(context.Background())
	if !m.Status().Devices[0].Online {
		t.Fatal("online device not recognized")
	}
	online = false
	m.checkAvailability(context.Background())
	if m.Status().Devices[0].Online {
		t.Fatal("offline device still online")
	}
	online = true
	m.checkAvailability(context.Background())
	if !m.Status().Devices[0].Online {
		t.Fatal("reconnected device not recognized")
	}
	m.state.Enabled = false
	m.checkAvailability(context.Background())
	if calls != 3 {
		t.Fatal("disabled manager pinged", calls)
	}
}
