package secret

import (
	"bytes"
	"os"
	"testing"
)

func TestWindowsSecretsEncrypted(t *testing.T) {
	s := New(t.TempDir())
	if e := s.Set("key", "private-test-value"); e != nil {
		t.Fatal(e)
	}
	raw, e := os.ReadFile(s.path("key"))
	if e != nil {
		t.Fatal(e)
	}
	if bytes.Contains(raw, []byte("private-test-value")) {
		t.Fatal("plaintext secret on disk")
	}
	raw[0] ^= 0xff
	if _, e = unprotect(raw); e == nil {
		t.Fatal("corrupted DPAPI data accepted")
	}
}
