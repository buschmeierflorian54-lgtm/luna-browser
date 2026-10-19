// Package store speichert Lesezeichen, Verlauf, Downloads und die letzte Sitzung als JSON-Dateien
// unter ~/Library/Application Support/browser-mac.
package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type Bookmark struct {
	URL   string `json:"url"`
	Title string `json:"title"`
	Added int64  `json:"added"`
}

type Visit struct {
	URL    string `json:"url"`
	Title  string `json:"title"`
	Last   int64  `json:"last"` // Unix-ms
	Visits int    `json:"visits"`
}

// Note ist ein Notizzettel zu einer Seite (Schlüssel = Adresse ohne #Anker, bei Suchen "search:<Begriff>").
type Note struct {
	Key     string `json:"key"`
	Title   string `json:"title"`
	Text    string `json:"text"`
	Updated int64  `json:"updated"`
}

type Download struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Time int64  `json:"time"`
}

type Store struct {
	mu        sync.Mutex
	dir       string
	bookmarks []Bookmark
	history   []Visit
	downloads []Download
	prefs     map[string]bool
	notes     []Note
}

const maxHistory = 5000

func New(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	s := &Store{dir: dir, bookmarks: []Bookmark{}, history: []Visit{}, downloads: []Download{}, prefs: map[string]bool{}}
	s.read("bookmarks.json", &s.bookmarks)
	s.read("history.json", &s.history)
	s.read("downloads.json", &s.downloads)
	s.read("prefs.json", &s.prefs)
	s.read("notes.json", &s.notes)
	if s.prefs == nil {
		s.prefs = map[string]bool{}
	}
	return s, nil
}

func (s *Store) read(name string, v any) {
	if b, err := os.ReadFile(filepath.Join(s.dir, name)); err == nil {
		_ = json.Unmarshal(b, v)
	}
}

func (s *Store) write(name string, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	tmp := filepath.Join(s.dir, name+".tmp")
	if os.WriteFile(tmp, b, 0o600) == nil {
		_ = os.Rename(tmp, filepath.Join(s.dir, name))
	}
}

/* Lesezeichen */

func (s *Store) Bookmarks() []Bookmark {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Bookmark{}, s.bookmarks...)
}

// SetBookmark fügt hinzu (on) oder entfernt (off) und gibt die neue Liste zurück.
func (s *Store) SetBookmark(url, title string, on bool) []Bookmark {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := s.bookmarks[:0:0]
	for _, b := range s.bookmarks {
		if b.URL != url {
			out = append(out, b)
		}
	}
	if on {
		if title == "" {
			title = url
		}
		out = append(out, Bookmark{URL: url, Title: title, Added: time.Now().UnixMilli()})
	}
	s.bookmarks = out
	s.write("bookmarks.json", s.bookmarks)
	return append([]Bookmark{}, out...)
}

// EditBookmark ändert Adresse und Titel eines Lesezeichens und behält seine Position.
// Gibt es oldURL nicht, wird neu angelegt. Ein anderes Lesezeichen mit der neuen Adresse wird ersetzt (keine Doppelten).
func (s *Store) EditBookmark(oldURL, url, title string) []Bookmark {
	s.mu.Lock()
	defer s.mu.Unlock()
	if title == "" {
		title = url
	}
	out := make([]Bookmark, 0, len(s.bookmarks)+1)
	placed := false
	for _, b := range s.bookmarks {
		switch {
		case b.URL == oldURL:
			b.URL, b.Title = url, title
			out = append(out, b)
			placed = true
		case b.URL == url:
			// Duplikat der neuen Adresse: entfernen (das bearbeitete bleibt)
		default:
			out = append(out, b)
		}
	}
	if !placed {
		out = append(out, Bookmark{URL: url, Title: title, Added: time.Now().UnixMilli()})
	}
	s.bookmarks = out
	s.write("bookmarks.json", s.bookmarks)
	return append([]Bookmark{}, out...)
}

/* Verlauf */

func (s *Store) HistoryAdd(url, title string) {
	if url == "" || strings.HasPrefix(url, "about:") || strings.HasPrefix(url, "data:") {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UnixMilli()
	for i := range s.history {
		if s.history[i].URL == url {
			s.history[i].Last, s.history[i].Visits = now, s.history[i].Visits+1
			if title != "" {
				s.history[i].Title = title
			}
			s.write("history.json", s.history)
			return
		}
	}
	s.history = append(s.history, Visit{URL: url, Title: title, Last: now, Visits: 1})
	if len(s.history) > maxHistory {
		sort.Slice(s.history, func(i, j int) bool { return s.history[i].Last > s.history[j].Last })
		s.history = s.history[:maxHistory]
	}
	s.write("history.json", s.history)
}

// History liefert die neuesten Einträge, optional gefiltert nach Titel/URL.
func (s *Store) History(query string, limit int) []Visit {
	s.mu.Lock()
	defer s.mu.Unlock()
	q := strings.ToLower(strings.TrimSpace(query))
	out := []Visit{}
	for _, v := range s.history {
		if q == "" || strings.Contains(strings.ToLower(v.Title), q) || strings.Contains(strings.ToLower(v.URL), q) {
			out = append(out, v)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Last > out[j].Last })
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out
}

func (s *Store) HistoryRemove(url string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := s.history[:0:0]
	for _, v := range s.history {
		if v.URL != url {
			out = append(out, v)
		}
	}
	s.history = out
	s.write("history.json", s.history)
}

func (s *Store) HistoryClear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.history = []Visit{}
	s.write("history.json", s.history)
}

/* Downloads */

func (s *Store) Downloads() []Download {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Download{}, s.downloads...)
}

func (s *Store) DownloadAdd(name, path string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.downloads = append(s.downloads, Download{Name: name, Path: path, Time: time.Now().UnixMilli()})
	if len(s.downloads) > 200 {
		s.downloads = s.downloads[len(s.downloads)-200:]
	}
	s.write("downloads.json", s.downloads)
}

func (s *Store) DownloadsClear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.downloads = []Download{}
	s.write("downloads.json", s.downloads)
}

/* Sitzung: offene Tabs als JSON-Text (vom Frontend gepflegt) */

func (s *Store) SessionSave(js string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = os.WriteFile(filepath.Join(s.dir, "session.json"), []byte(js), 0o600)
}

func (s *Store) SessionLoad() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, err := os.ReadFile(filepath.Join(s.dir, "session.json"))
	if err != nil {
		return ""
	}
	return string(b)
}

/* Einstellungen (Ein/Aus-Schalter) */

// PrefKeys sind die erlaubten Schlüssel; unbekannte werden abgelehnt.
var PrefKeys = map[string]bool{"restoreSession": true, "showBookmarkBar": true, "circleGesture": true, "spotifyAutoNextAlways": true, "googleSearch": true, "onboardingComplete": true}

func (s *Store) Prefs() map[string]bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[string]bool, len(s.prefs))
	for k, v := range s.prefs {
		out[k] = v
	}
	return out
}

// SetPref setzt einen Schalter und gibt alle Einstellungen zurück.
func (s *Store) SetPref(key string, v bool) map[string]bool {
	if PrefKeys[key] {
		s.mu.Lock()
		s.prefs[key] = v
		s.write("prefs.json", s.prefs)
		s.mu.Unlock()
	}
	return s.Prefs()
}

/* Notizzettel (seitenbasiert) */

const maxNote = 20000

func (s *Store) Notes() []Note {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Note, 0, len(s.notes))
	for i := len(s.notes) - 1; i >= 0; i-- { // neueste zuerst; bei gleicher Zeit gewinnt die später gespeicherte
		out = append(out, s.notes[i])
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Updated > out[j].Updated })
	return out
}

// SetNote speichert die Notiz zu key; leerer Text löscht sie. Gibt alle Notizen zurück (neueste zuerst).
func (s *Store) SetNote(key, title, text string) []Note {
	if key != "" {
		if r := []rune(text); len(r) > maxNote {
			text = string(r[:maxNote])
		}
		s.mu.Lock()
		out := s.notes[:0:0]
		for _, n := range s.notes {
			if n.Key != key {
				out = append(out, n)
			}
		}
		if strings.TrimSpace(text) != "" {
			out = append(out, Note{Key: key, Title: title, Text: text, Updated: time.Now().UnixMilli()})
		}
		s.notes = out
		s.write("notes.json", s.notes)
		s.mu.Unlock()
	}
	return s.Notes()
}

// ResetSettings restores browser preferences and gestures without deleting personal data.
func (s *Store) ResetSettings() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Write preferences first; report filesystem failures instead of claiming success.
	dst := filepath.Join(s.dir, "prefs.json")
	if err := os.WriteFile(dst+".tmp", []byte("{}"), 0600); err != nil {
		return err
	}
	if err := os.Rename(dst+".tmp", dst); err != nil {
		return err
	}
	s.prefs = map[string]bool{}
	_, err := s.saveGesturesLocked(defaultGestures())
	return err
}
