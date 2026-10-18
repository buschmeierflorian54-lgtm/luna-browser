package sonos

import (
	"browser-mac/internal/spotifyapi"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestQueueFallbackSOAP(t *testing.T) {
	const uri = "spotify:track:0123456789012345678901"
	for _, mode := range []string{"success", "inactive", "fault", "wrong-track", "ambiguous"} {
		t.Run(mode, func(t *testing.T) {
			writes := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				data, _ := io.ReadAll(r.Body)
				request, err := parseQueueXML(string(data))
				if err != nil {
					t.Fatal(err)
				}
				action := strings.TrimSuffix(strings.Split(r.Header.Get("SOAPACTION"), "#")[1], `"`)
				var result string
				switch action {
				case "GetZoneGroupState":
					group := `<ZoneGroup Coordinator="RINCON_A"><ZoneGroupMember UUID="RINCON_A" ZoneName="Küche" Location="http://192.168.1.2:1400/xml/device_description.xml"/><ZoneGroupMember UUID="RINCON_B" ZoneName="Wohnzimmer" Location="http://192.168.1.3:1400/xml/device_description.xml"/></ZoneGroup>`
					if mode == "ambiguous" {
						group += group
					}
					result = "<ZoneGroupState>" + escapeXML("<ZoneGroups>"+group+"</ZoneGroups>") + "</ZoneGroupState>"
				case "GetMediaInfo":
					source := "x-rincon-queue:RINCON_A#0"
					if mode == "inactive" {
						source = "x-sonos-vli:spotify"
					}
					result = "<CurrentURI>" + source + "</CurrentURI>"
				case "GetPositionInfo":
					track := uri
					if mode == "wrong-track" {
						track = "spotify:track:other"
					}
					result = "<Track>1</Track><TrackURI>" + track + "</TrackURI>"
				case "ListAvailableServices":
					result = "<AvailableServiceDescriptorList>" + escapeXML(`<Services><Service Id="9" Name="Spotify"/></Services>`) + "</AvailableServiceDescriptorList>"
				case "AddURIToQueue":
					writes++
					if request.value("EnqueuedURI") != "spotify%3atrack%3a0123456789012345678901" || request.value("DesiredFirstTrackNumberEnqueued") != "0" || request.value("EnqueueAsNext") != "0" {
						t.Errorf("bad enqueue payload: %s", data)
					}
					metadata, e := parseQueueXML(request.value("EnqueuedURIMetaData"))
					if e != nil || !strings.Contains(metadata.value("desc"), "SA_RINCON2311") {
						t.Errorf("bad metadata %v", e)
					}
					if mode == "fault" {
						w.WriteHeader(500)
						result = "<Fault><errorCode>800</errorCode></Fault>"
					} else {
						result = "<FirstTrackNumberEnqueued>2</FirstTrackNumberEnqueued>"
					}
				case "Browse":
					if request.value("StartingIndex") != "0" {
						t.Error("wrong current track index")
					}
					result = "<Result>" + escapeXML(`<DIDL-Lite><item><title>Current</title><res>`+uri+`</res></item><item><title>Next</title><creator>Artist</creator><res>`+uri+`</res></item></DIDL-Lite>`) + "</Result>"
				default:
					t.Errorf("unexpected/mutating action %s", action)
				}
				fmt.Fprint(w, "<Envelope><Body>"+result+"</Body></Envelope>")
			}))
			defer server.Close()
			m := &Manager{http: &http.Client{Transport: rewriteTransport{server.URL, http.DefaultTransport}}, state: Status{Devices: []Device{{Name: "Küche", IP: "192.168.1.2", Online: true}}}}
			playback := &spotifyapi.Playback{Item: &spotifyapi.Track{URI: uri}}
			playback.Device.Name = "Wohnzimmer"
			err := m.AddToQueue(context.Background(), uri, playback)
			if (err == nil) != (mode == "success") {
				t.Fatalf("mode %s error %v", mode, err)
			}
			expected := 0
			if mode == "success" || mode == "fault" {
				expected = 1
			}
			if writes != expected {
				t.Errorf("%d queue writes, expected %d", writes, expected)
			}
			if mode == "success" {
				q, err := m.Queue(context.Background(), playback)
				if err != nil || q.Current == nil || q.Current.Name != "Current" || len(q.Items) != 1 || q.Items[0].URI != uri {
					t.Fatalf("queue %+v %v", q, err)
				}
			}
		})
	}
}
