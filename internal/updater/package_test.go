package updater

import (
	"archive/zip"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestManifestAuthentication(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	m := Manifest{Version: "1.2.0", URL: Repository + "/releases/download/v1.2.0/Luna-Browser-1.2.0-windows-amd64.zip", Size: 1, SHA256: strings.Repeat("a", 64), Experimental: true}
	raw, _ := json.Marshal(m)
	sig := base64.StdEncoding.EncodeToString(ed25519.Sign(priv, raw))
	if _, e := VerifyManifest(raw, sig, pub); e != nil {
		t.Fatal(e)
	}
	raw[0] ^= 1
	if _, e := VerifyManifest(raw, sig, pub); e == nil {
		t.Fatal("tampered manifest accepted")
	}
	m.URL = "https://example.com/update.zip"
	raw, _ = json.Marshal(m)
	sig = base64.StdEncoding.EncodeToString(ed25519.Sign(priv, raw))
	if _, e := VerifyManifest(raw, sig, pub); e == nil {
		t.Fatal("unexpected download host accepted")
	}
}
func TestNoDowngrade(t *testing.T) {
	for _, pair := range [][2]string{{"1.2.0", "1.2.0"}, {"1.1.99", "1.2.0"}, {"garbage", "1.2.0"}} {
		if Newer(pair[0], pair[1]) {
			t.Fatal(pair)
		}
	}
	if !Newer("1.10.0", "1.9.9") {
		t.Fatal("numeric version comparison failed")
	}
}
func TestRejectArchiveTraversal(t *testing.T) {
	for _, name := range []string{"../escape", "/absolute", "C:/escape", "native/../../escape", "native\\..\\..\\escape", "native/file:stream"} {
		t.Run(name, func(t *testing.T) {
			root := t.TempDir()
			file := filepath.Join(root, "bad.zip")
			f, _ := os.Create(file)
			z := zip.NewWriter(f)
			w, _ := z.Create(name)
			w.Write([]byte("bad"))
			z.Close()
			f.Close()
			if e := Extract(file, filepath.Join(root, "out")); e == nil {
				t.Fatal("unsafe archive accepted")
			}
			if _, e := os.Stat(filepath.Join(root, "escape")); !os.IsNotExist(e) {
				t.Fatal("archive escaped")
			}
		})
	}
}
