package secret

import (
	"os"
	"runtime"
	"testing"
)

func TestStore(t *testing.T) {
	s := New(t.TempDir() + "/sub")
	if _, ok, err := s.Get("k"); ok || err != nil {
		t.Fatal(ok, err)
	}
	if err := s.Set("k", "geheim-äöü"); err != nil {
		t.Fatal(err)
	}
	if v, ok, _ := s.Get("k"); !ok || v != "geheim-äöü" {
		t.Fatalf("%q", v)
	}
	st, _ := os.Stat(s.Dir + "/k")
	if runtime.GOOS != "windows" && st.Mode().Perm() != 0o600 {
		t.Fatalf("Datei-Rechte %v", st.Mode().Perm())
	}
	dst, _ := os.Stat(s.Dir)
	if runtime.GOOS != "windows" && dst.Mode().Perm() != 0o700 {
		t.Fatalf("Ordner-Rechte %v", dst.Mode().Perm())
	}
	_ = s.Set("k", "neu")
	if v, _, _ := s.Get("k"); v != "neu" {
		t.Fatal(v)
	}
	if err := s.Delete("k"); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := s.Get("k"); ok {
		t.Fatal("noch da")
	}
	if err := s.Delete("k"); err != nil {
		t.Fatal("Delete ohne Datei darf nicht fehlschlagen")
	}
}
