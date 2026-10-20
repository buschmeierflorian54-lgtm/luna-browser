// Package updater verifies signed Windows releases. macOS continues to use Sparkle.
package updater

import (
	"archive/zip"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const PublicKey = "BeP9pRxpsVP/tRcegOtIg/3cmerQikSUDv2F2fU19Yw="
const Repository = "https://github.com/fcore247/luna-browser"

type Manifest struct {
	Version      string `json:"version"`
	URL          string `json:"url"`
	SHA256       string `json:"sha256"`
	Size         int64  `json:"size"`
	Experimental bool   `json:"experimental"`
}

func VerifyManifest(data []byte, signature string, key []byte) (Manifest, error) {
	var m Manifest
	s, e := base64.StdEncoding.DecodeString(strings.TrimSpace(signature))
	if e != nil || len(key) != ed25519.PublicKeySize || !ed25519.Verify(key, data, s) {
		return m, errors.New("Update-Signatur ungültig")
	}
	if e = json.Unmarshal(data, &m); e != nil {
		return m, e
	}
	if !validVersion(m.Version) || m.Size <= 0 || m.Size > 512<<20 || len(m.SHA256) != 64 {
		return m, errors.New("Ungültige Update-Metadaten")
	}
	if _, e = hex.DecodeString(m.SHA256); e != nil {
		return m, e
	}
	expected := Repository + "/releases/download/v" + m.Version + "/Luna-Browser-" + m.Version + "-windows-amd64.zip"
	if m.URL != expected {
		return m, errors.New("Unzulässige Update-Adresse")
	}
	return m, nil
}
func validVersion(v string) bool {
	p := strings.Split(v, ".")
	if len(p) != 3 {
		return false
	}
	for _, s := range p {
		n, e := strconv.Atoi(s)
		if e != nil || n < 0 || strconv.Itoa(n) != s {
			return false
		}
	}
	return true
}
func Newer(candidate, current string) bool {
	if !validVersion(candidate) || !validVersion(current) {
		return false
	}
	a := strings.Split(candidate, ".")
	b := strings.Split(current, ".")
	for i := range a {
		x, _ := strconv.Atoi(a[i])
		y, _ := strconv.Atoi(b[i])
		if x != y {
			return x > y
		}
	}
	return false
}
func VerifyArchive(path string, m Manifest) error {
	f, e := os.Open(path)
	if e != nil {
		return e
	}
	defer f.Close()
	h := sha256.New()
	n, e := io.Copy(h, io.LimitReader(f, m.Size+1))
	if e != nil {
		return e
	}
	if n != m.Size || hex.EncodeToString(h.Sum(nil)) != m.SHA256 {
		return errors.New("Update-Prüfsumme stimmt nicht")
	}
	return nil
}
func Extract(path, dest string) error {
	r, e := zip.OpenReader(path)
	if e != nil {
		return e
	}
	defer r.Close()
	var total uint64
	for _, f := range r.File {
		name := strings.ReplaceAll(f.Name, "\\", "/")
		if strings.HasPrefix(name, "/") || strings.Contains(name, ":") || f.Mode()&os.ModeSymlink != 0 {
			return errors.New("Unsicherer Archivpfad")
		}
		for _, part := range strings.Split(name, "/") {
			if part == ".." || strings.HasSuffix(part, ".") || strings.HasSuffix(part, " ") {
				return errors.New("Unsicherer Archivpfad")
			}
		}
		target := filepath.Join(dest, filepath.FromSlash(name))
		rel, e := filepath.Rel(dest, target)
		if e != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			return errors.New("Archiv verlässt Zielordner")
		}
		total += f.UncompressedSize64
		if total > 2<<30 {
			return errors.New("Update-Archiv zu groß")
		}
		if f.FileInfo().IsDir() {
			if e = os.MkdirAll(target, 0700); e != nil {
				return e
			}
			continue
		}
		if e = os.MkdirAll(filepath.Dir(target), 0700); e != nil {
			return e
		}
		src, e := f.Open()
		if e != nil {
			return e
		}
		dst, e := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if e != nil {
			src.Close()
			return e
		}
		_, e = io.Copy(dst, io.LimitReader(src, int64(f.UncompressedSize64)+1))
		closeErr := dst.Close()
		src.Close()
		if e != nil {
			return e
		}
		if closeErr != nil {
			return closeErr
		}
	}
	for _, name := range []string{"Luna Browser.exe", "native/Luna.Windows.exe", "luna-package.json"} {
		if _, e = os.Stat(filepath.Join(dest, filepath.FromSlash(name))); e != nil {
			return fmt.Errorf("Update unvollständig: %s", name)
		}
	}
	return nil
}
