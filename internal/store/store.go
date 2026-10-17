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
}

const maxHistory = 5000

func New(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	s := &Store{dir: dir, bookmarks: []Bookmark{}, history: []Visit{}, downloads: []Download{}}
	s.read("bookmarks.json", &s.bookmarks)
	s.read("history.json", &s.history)
	s.read("downloads.json", &s.downloads)
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
