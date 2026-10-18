// Package musicqueue remembers a working queue provider for this process only.
package musicqueue

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Add func(context.Context, string) error

type Router struct {
	mu    sync.Mutex
	sonos bool
}

// Add serializes additions, including the fallback, so concurrent UI requests
// cannot race the session preference. Each provider gets its own time budget.
func (r *Router) Add(ctx context.Context, uri string, spotify, sonos Add) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	providers := []Add{spotify, sonos}
	first := 0
	if r.sonos {
		first = 1
	}
	var failures [2]error
	for _, index := range []int{first, 1 - first} {
		attempt, cancel := context.WithTimeout(ctx, 20*time.Second)
		failures[index] = providers[index](attempt, uri)
		cancel()
		if failures[index] == nil {
			r.sonos = index == 1
			return nil
		}
	}
	r.sonos = false // Both failed: start with Spotify again next time.
	return fmt.Errorf("Titel konnte nicht hinzugefügt werden. Spotify: %v Sonos: %v", failures[0], failures[1])
}

func (r *Router) UsesSonos() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.sonos
}
