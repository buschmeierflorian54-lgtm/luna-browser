package store

import (
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

type GestureBinding struct {
	Action string `json:"action"`
	Value  string `json:"value,omitempty"`
}

const GestureLetters = "CDHIJLOPQSVWZ"

var GestureActions = []string{"none", "notes", "screenshot", "music", "settings", "new_tab", "close_tab", "back", "forward", "reload", "bookmarks", "history", "downloads", "open_url"}

func defaultGestures() map[string]GestureBinding {
	return map[string]GestureBinding{"O": {Action: "notes"}, "S": {Action: "screenshot"}}
}
func (s *Store) gesturesLocked() map[string]GestureBinding {
	result := defaultGestures()
	raw, err := os.ReadFile(filepath.Join(s.dir, "gestures.json"))
	if err == nil {
		var saved map[string]GestureBinding
		if json.Unmarshal(raw, &saved) == nil && saved != nil {
			result = saved
		}
	}
	for letter := range result {
		if len(letter) != 1 || !strings.Contains(GestureLetters, letter) {
			delete(result, letter)
		}
	}
	return result
}
func (s *Store) Gestures() map[string]GestureBinding {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.gesturesLocked()
}
func (s *Store) SetGestureBinding(letter, action, value string) (map[string]GestureBinding, error) {
	letter = strings.ToUpper(strings.TrimSpace(letter))
	value = strings.TrimSpace(value)
	if len(letter) != 1 || !strings.Contains(GestureLetters, letter) {
		return nil, errors.New("Erlaubte Gesten: C, D, H, I, J, L, O, P, Q, S, V, W, Z.")
	}
	valid := false
	for _, a := range GestureActions {
		if action == a {
			valid = true
		}
	}
	if !valid {
		return nil, errors.New("Unbekannte Gestenaktion.")
	}
	if action == "open_url" {
		u, e := url.Parse(value)
		if e != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" || u.User != nil || len(value) > 2048 {
			return nil, errors.New("Bitte eine gültige HTTP- oder HTTPS-Adresse ohne Zugangsdaten angeben.")
		}
	} else {
		value = ""
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	bindings := s.gesturesLocked()
	bindings[letter] = GestureBinding{action, value}
	return s.saveGesturesLocked(bindings)
}
func (s *Store) ResetGestures() (map[string]GestureBinding, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.saveGesturesLocked(defaultGestures())
}
func (s *Store) saveGesturesLocked(bindings map[string]GestureBinding) (map[string]GestureBinding, error) {
	raw, err := json.Marshal(bindings)
	if err != nil {
		return nil, err
	}
	dst := filepath.Join(s.dir, "gestures.json")
	if err = os.WriteFile(dst+".tmp", raw, 0600); err != nil {
		return nil, err
	}
	if err = os.Rename(dst+".tmp", dst); err != nil {
		return nil, err
	}
	return bindings, nil
}
