package spotifyapi

import (
	"browser-mac/internal/secret"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestOAuthSearchRefreshDisconnect(t *testing.T) {
	var verifier, challenge string
	refreshCount := 0
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/token":
			_ = r.ParseForm()
			if r.Form.Get("grant_type") == "authorization_code" {
				verifier = r.Form.Get("code_verifier")
				if verifier == "" || r.Form.Get("redirect_uri") != Redirect {
					t.Error("missing PKCE or redirect")
				}
			} else {
				refreshCount++
				if r.Form.Get("refresh_token") != "refresh" {
					t.Error("refresh missing")
				}
			}
			w.Write([]byte(`{"access_token":"access","refresh_token":"refresh","expires_in":3600}`))
		case "/me":
			w.Write([]byte(`{"display_name":"Testkonto"}`))
		case "/search":
			if r.Header.Get("Authorization") != "Bearer access" || r.URL.Query().Get("q") != "Björk & friends" {
				t.Error("bad search request")
			}
			w.Write([]byte(`{"tracks":{"items":[{"name":"Song","uri":"spotify:track:1234567890123456789012","album":{"images":[]}}]},"artists":{"items":[]},"albums":{"items":[]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer fake.Close()
	dir := t.TempDir()
	c := New(secret.New(dir))
	c.API = fake.URL
	c.Accounts = fake.URL
	if err := c.Configure(strings.Repeat("a", 32)); err != nil {
		t.Fatal(err)
	}
	var auth *url.URL
	if err := c.Connect(func(u string) error { auth, _ = url.Parse(u); return nil }); err != nil {
		t.Fatal(err)
	}
	defer c.Disconnect()
	challenge = auth.Query().Get("code_challenge")
	if len(challenge) < 40 || auth.Query().Get("code_challenge_method") != "S256" {
		t.Fatal("PKCE challenge missing")
	}
	resp, err := http.Get(Redirect + "?state=wrong&code=bad")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 400 || !c.Status().Pending {
		t.Fatal("CSRF state not rejected")
	}
	resp, err = http.Get(Redirect + "?state=" + url.QueryEscape(auth.Query().Get("state")) + "&code=test")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatal(resp.Status)
	}
	if verifier == "" || !c.Status().Connected || c.Status().Name != "Testkonto" {
		t.Fatal("not connected")
	}
	c.mu.Lock()
	c.c.Expires = time.Now().Unix() - 1
	c.mu.Unlock()
	result, err := c.Search(context.Background(), "Björk & friends")
	if err != nil || len(result.Tracks.Items) != 1 || refreshCount != 1 {
		t.Fatalf("search/refresh: %v", err)
	}
	raw, _ := json.Marshal(c.Status())
	if strings.Contains(string(raw), "access_token") || strings.Contains(string(raw), "refresh_token") {
		t.Fatal("token exposed")
	}
	info, _ := os.Stat(filepath.Join(dir, credentialFile))
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0600 {
		t.Fatal("file permissions")
	}
	restored := New(secret.New(dir))
	if !restored.Status().Connected {
		t.Fatal("token persistence")
	}
	if err := c.Disconnect(); err != nil {
		t.Fatal(err)
	}
	if New(secret.New(dir)).Status().Connected {
		t.Fatal("disconnect not persisted")
	}
}
func TestNoAccountAndErrors(t *testing.T) {
	c := New(secret.New(t.TempDir()))
	if _, err := c.Search(context.Background(), "ABBA"); err == nil {
		t.Fatal("requires account")
	}
	if c.Configure("bad") == nil {
		t.Fatal("invalid client ID")
	}
	for _, n := range []int{401, 403, 429, 500} {
		if apiError(n) == nil {
			t.Fatal(n)
		}
	}
}
