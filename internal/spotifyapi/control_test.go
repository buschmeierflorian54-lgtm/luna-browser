package spotifyapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWindowsPlaybackContract(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if r.Method != "PUT" || r.URL.Path != "/me/player/play" || r.Header.Get("Authorization") != "Bearer test-access" {
			t.Errorf("wrong playback request: %s %s", r.Method, r.URL.Path)
		}
		var body struct {
			URIs []string `json:"uris"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.URIs) != 1 || body.URIs[0] != "spotify:track:1234567890123456789012" {
			t.Errorf("invalid body: %+v (%v)", body, err)
		}
		w.WriteHeader(204)
	}))
	defer server.Close()
	c := &Client{HTTP: server.Client(), API: server.URL, c: credentials{Access: "test-access", Refresh: "test-refresh", Expires: time.Now().Add(time.Hour).Unix()}}
	if e := c.PlayURI(context.Background(), "spotify:track:1234567890123456789012"); e != nil {
		t.Fatal(e)
	}
	if e := c.PlayURI(context.Background(), "spotify:track:bad\";launch"); e == nil {
		t.Fatal("invalid URI accepted")
	}
	if requests != 1 {
		t.Fatalf("%d playback requests; expected exactly one", requests)
	}
}
