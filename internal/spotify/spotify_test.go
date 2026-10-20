package spotify

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// Läuft nur sinnvoll auf macOS; prüft, dass die Abfrage ohne Absturz einen gültigen Status liefert.
func TestGet(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("Windows media session is exercised by native host smoke test")
	}
	home, _ := os.UserHomeDir()
	if _, e := os.Stat("/Applications/Spotify.app"); e != nil {
		if _, e = os.Stat(filepath.Join(home, "Applications", "Spotify.app")); e != nil {
			t.Skip("Spotify desktop is not installed on this runner")
		}
	}
	s := Get()
	switch s.Status {
	case "off", "stopped", "playing", "paused", "denied":
		t.Logf("Status: %+v", s)
	default:
		t.Fatalf("unerwarteter Status: %+v", s)
	}
}
