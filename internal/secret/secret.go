// Package secret legt Geheimnisse (API-Schlüssel) in einer Datei ab, die nur der eigene Benutzer lesen kann
// (Ordner 0700, Datei 0600). Das ist bewusst kein Schlüsselbund: Der fragt bei nicht signierten Apps
// nach jedem Neubau neu nach. Die Werte werden nie ans Frontend zurückgegeben.
package secret

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

type Store struct{ Dir string }

func New(dir string) *Store { return &Store{Dir: dir} }

func (s *Store) path(name string) string { return filepath.Join(s.Dir, name) }

// Set speichert atomar mit Rechten 0600.
func (s *Store) Set(name, value string) error {
	if err := os.MkdirAll(s.Dir, 0o700); err != nil {
		return err
	}
	_ = os.Chmod(s.Dir, 0o700)
	encoded, err := protect([]byte(value))
	if err != nil {
		return err
	}
	tmp := s.path(name + ".tmp")
	if err := os.WriteFile(tmp, encoded, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path(name))
}

// Get liest ein Geheimnis; ok ist false, wenn keines gespeichert ist.
func (s *Store) Get(name string) (string, bool, error) {
	b, err := os.ReadFile(s.path(name))
	if errors.Is(err, fs.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	b, err = unprotect(b)
	if err != nil {
		return "", false, err
	}
	v := strings.TrimSpace(string(b))
	return v, v != "", nil
}

func (s *Store) Delete(name string) error {
	if err := os.Remove(s.path(name)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return nil
}
