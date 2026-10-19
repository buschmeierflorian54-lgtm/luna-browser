package store

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGesturePersistenceAndValidation(t *testing.T) {
	dir := t.TempDir()
	s, _ := New(dir)
	if s.Gestures()["S"].Action != "screenshot" {
		t.Fatal("default lost")
	}
	if _, err := s.SetGestureBinding("v", "music", ""); err != nil {
		t.Fatal(err)
	}
	next, _ := New(dir)
	if next.Gestures()["V"].Action != "music" {
		t.Fatal("not persisted")
	}
	for _, tc := range [][3]string{{"AA", "music", ""}, {"S", "execute", ""}, {"L", "open_url", "javascript:alert(1)"}, {"L", "open_url", "https://user:pass@example.com"}} {
		if _, err := s.SetGestureBinding(tc[0], tc[1], tc[2]); err == nil {
			t.Fatal("invalid accepted", tc)
		}
	}
	if _, err := s.SetGestureBinding("L", "open_url", "https://example.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetGestureBinding("S", "none", ""); err != nil {
		t.Fatal(err)
	}
	next, _ = New(dir)
	if next.Gestures()["S"].Action != "none" {
		t.Fatal("disabled not persisted")
	}
	if _, err := s.ResetGestures(); err != nil {
		t.Fatal(err)
	}
	next, _ = New(dir)
	if len(next.Gestures()) != 2 {
		t.Fatal("reset not persisted")
	}
}

func TestExcludedGestures(t *testing.T) {
	dir := t.TempDir()
	s, _ := New(dir)
	for _, letter := range "ABEFGKMNRTUXY" {
		if _, err := s.SetGestureBinding(string(letter), "music", ""); err == nil {
			t.Fatalf("accepted %c", letter)
		}
	}
	if err := os.WriteFile(filepath.Join(dir, "gestures.json"), []byte(`{"M":{"action":"music"},"S":{"action":"screenshot"}}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Gestures()["M"]; ok {
		t.Fatal("legacy binding still exposed")
	}
	if s.Gestures()["S"].Action != "screenshot" {
		t.Fatal("allowed binding lost")
	}
}
