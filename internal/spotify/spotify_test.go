package spotify

import "testing"

// Läuft nur sinnvoll auf macOS; prüft, dass die Abfrage ohne Absturz einen gültigen Status liefert.
func TestGet(t *testing.T) {
	s := Get()
	switch s.Status {
	case "off", "stopped", "playing", "paused", "denied":
		t.Logf("Status: %+v", s)
	default:
		t.Fatalf("unerwarteter Status: %+v", s)
	}
}
