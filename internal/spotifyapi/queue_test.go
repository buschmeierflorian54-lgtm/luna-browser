package spotifyapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestQueue(t *testing.T) {
	const uri = "spotify:track:1234567890123456789012"
	calls := 0
	status := 204
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != "POST" || r.URL.Path != "/me/player/queue" || r.URL.Query().Get("uri") != uri || r.Header.Get("Authorization") != "Bearer test" {
			t.Error("invalid queue request")
		}
		w.WriteHeader(status)
	}))
	defer srv.Close()
	c := &Client{HTTP: srv.Client(), API: srv.URL, c: credentials{Access: "test", Refresh: "test", Expires: time.Now().Unix() + 3600, Scope: "user-modify-playback-state"}}
	if err := c.AddToQueue(context.Background(), uri); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatal("not queued exactly once")
	}
	status = 200
	if err := c.AddToQueue(context.Background(), uri); err != nil {
		t.Fatalf("HTTP 200 must succeed: %v", err)
	}
	if calls != 2 {
		t.Fatal("successful request retried")
	}
	status = 404
	if err := c.AddToQueue(context.Background(), uri); err == nil || !strings.Contains(err.Error(), "aktives") {
		t.Fatal("missing device error")
	}
	status = 403
	if err := c.AddToQueue(context.Background(), uri); err == nil || !strings.Contains(err.Error(), "Premium") {
		t.Fatal("missing permission error")
	}
	c.c.Scope = "user-read-private"
	before := calls
	if err := c.AddToQueue(context.Background(), uri); err == nil {
		t.Fatal("old grant accepted")
	}
	if err := c.AddToQueue(context.Background(), "spotify:album:123"); err == nil {
		t.Fatal("invalid track accepted")
	}
	if calls != before {
		t.Fatal("invalid request was sent")
	}
}

func TestReadQueue(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != "GET" || r.URL.Path != "/me/player/queue" {
			t.Error("wrong request")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"currently_playing":null,"queue":[{"name":"Next song","uri":"spotify:track:1234567890123456789012"}]}`))
	}))
	defer srv.Close()
	c := &Client{HTTP: srv.Client(), API: srv.URL, c: credentials{Access: "test", Refresh: "test", Expires: time.Now().Unix() + 3600, Scope: "user-modify-playback-state"}}
	if _, err := c.Queue(context.Background()); err == nil || calls != 0 {
		t.Fatal("missing read scope was not handled")
	}
	c.c.Scope += " user-read-playback-state"
	q, err := c.Queue(context.Background())
	if err != nil || len(q.Items) != 1 || q.Items[0].Name != "Next song" {
		t.Fatal("queue response failed", err)
	}
}

func TestRestrictedSpeakerQueueError(t *testing.T) {
	posts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			posts++
			w.WriteHeader(403)
			return
		}
		if r.URL.Path != "/me/player" {
			t.Error("unexpected diagnostic request")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"device":{"name":"Wohnzimmer","is_restricted":true}}`))
	}))
	defer srv.Close()
	c := &Client{HTTP: srv.Client(), API: srv.URL, c: credentials{Access: "test", Refresh: "test", Expires: time.Now().Unix() + 3600, Scope: "user-modify-playback-state user-read-playback-state"}}
	err := c.AddToQueue(context.Background(), "spotify:track:1234567890123456789012")
	if err == nil || !strings.Contains(err.Error(), "Wohnzimmer") || !strings.Contains(err.Error(), "Connect") {
		t.Fatal("missing device explanation", err)
	}
	if posts != 1 {
		t.Fatal("queue request must not be retried")
	}
}
