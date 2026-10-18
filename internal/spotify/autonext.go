package spotify

import (
	"context"
	"errors"
	"sync"
	"time"
)

type NextStatus struct {
	URI     string `json:"uri"`
	Title   string `json:"title"`
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

// AutoNext is a one-shot, process-local AppleScript fallback. Polling continues
// while the web UI is hidden. All control operations are serialized.
type AutoNext struct {
	mu         sync.Mutex
	generation uint64
	status     NextStatus
	cancel     context.CancelFunc
	read       func() State
	play       func(string) error
	notify     func(NextStatus)
	interval   time.Duration
}

func NewAutoNext(notify func(NextStatus)) *AutoNext {
	return &AutoNext{read: Get, play: PlayScheduledURI, notify: notify, interval: time.Second}
}

func (m *AutoNext) Status() NextStatus { m.mu.Lock(); defer m.mu.Unlock(); return m.status }
func (m *AutoNext) Cancel() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.generation++
	if m.cancel != nil {
		m.cancel()
		m.cancel = nil
	}
	m.status = NextStatus{Status: "cancelled"}
}

// Next consumes the reservation directly instead of briefly playing Spotify's
// next queued track. Sharing the watcher lock prevents two play commands.
func (m *AutoNext) Next(fallback func() error) error {
	m.mu.Lock()
	if m.status.Status != "waiting" {
		defer m.mu.Unlock()
		return fallback()
	}
	m.generation++
	if m.cancel != nil {
		m.cancel()
		m.cancel = nil
	}
	err := m.play(m.status.URI)
	m.status.Status = "started"
	m.status.Message = ""
	if err != nil {
		m.status.Status = "error"
		m.status.Message = err.Error()
	}
	event := m.status
	m.mu.Unlock()
	if m.notify != nil {
		m.notify(event)
	}
	// A failed direct start must never fall through to a normal skip.
	return err
}

func (m *AutoNext) Schedule(ctx context.Context, uri, title string) error {
	if !validURI(uri) || len(uri) < 14 || uri[:14] != "spotify:track:" {
		return errors.New("Ungültiger Spotify-Titel.")
	}
	current := m.read()
	if (current.Status != "playing" && current.Status != "paused") || !validURI(current.URI) || current.Duration <= 1 {
		return errors.New("Spotify liefert über AppleScript keinen verlässlichen laufenden Song. Öffne Spotify auf diesem Mac und starte dort die Wiedergabe.")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if m.cancel != nil {
		m.cancel()
	}
	m.generation++
	generation := m.generation
	watch, cancel := context.WithCancel(ctx)
	m.cancel = cancel
	m.status = NextStatus{URI: uri, Title: title, Status: "waiting"}
	go m.watch(watch, generation, current)
	return nil
}

// A paused track never triggers playback. A skip/transition to a different ID
// does, even early in a song. A restarted/repeated track is detected by position.
func shouldStartNext(original, previous, current State) bool {
	if current.Status == "stopped" {
		return previous.Status == "playing"
	}
	if current.Status != "playing" || current.URI == "" {
		return false
	}
	if current.URI != original.URI {
		return true
	}
	if current.Duration > 1 && current.Position >= current.Duration-1 {
		return true
	}
	return previous.Status == "playing" && previous.Position >= previous.Duration-2 && current.Position < previous.Position-2
}

func (m *AutoNext) watch(ctx context.Context, generation uint64, original State) {
	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()
	previous := original
	failures := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		current := m.read()
		m.mu.Lock()
		if ctx.Err() != nil || m.generation != generation {
			m.mu.Unlock()
			return
		}
		finish := func(status, message string) {
			m.status.Status = status
			m.status.Message = message
			if m.cancel != nil {
				m.cancel()
				m.cancel = nil
			}
			event := m.status
			m.mu.Unlock()
			if m.notify != nil {
				m.notify(event)
			}
		}
		if current.Status == "off" || current.Status == "denied" {
			finish("error", "Vormerkung beendet: Die lokale Spotify-App ist nicht erreichbar oder AppleScript ist nicht erlaubt.")
			return
		}
		if current.Status == "error" || ((current.Status == "playing" || current.Status == "paused") && current.URI == "") {
			failures++
			if failures >= 3 {
				finish("error", "Vormerkung beendet: Spotify liefert keinen zuverlässigen AppleScript-Status mehr.")
				return
			}
			m.mu.Unlock()
			continue
		}
		failures = 0
		if shouldStartNext(original, previous, current) {
			// A natural transition may already have reached the requested song.
			var err error
			if current.URI != m.status.URI || current.URI == original.URI {
				err = m.play(m.status.URI)
			}
			if err != nil {
				finish("error", err.Error())
			} else {
				finish("started", "")
			}
			return
		}
		previous = current
		m.mu.Unlock()
	}
}
