package spotify

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

const originalURI = "spotify:track:0123456789012345678901"
const wantedURI = "spotify:track:1234567890123456789012"
const skippedURI = "spotify:track:2345678901234567890123"

func TestNextTriggers(t *testing.T) {
	original := State{Status: "playing", URI: originalURI, Duration: 200, Position: 40}
	cases := []struct {
		name    string
		current State
		want    bool
	}{
		{"middle", original, false},
		{"one second before end", State{Status: "playing", URI: originalURI, Duration: 200, Position: 199}, true},
		{"pause near end", State{Status: "paused", URI: originalURI, Duration: 200, Position: 199}, false},
		{"skip early", State{Status: "playing", URI: skippedURI, Duration: 220, Position: 0}, true},
		{"paused new track", State{Status: "paused", URI: skippedURI, Duration: 220}, false},
		{"unknown id", State{Status: "playing", Duration: 220}, false},
		{"stopped after playing", State{Status: "stopped"}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := shouldStartNext(original, original, c.current); got != c.want {
				t.Fatalf("got %v want %v", got, c.want)
			}
		})
	}
	nearEnd := original
	nearEnd.Position = 198
	repeated := original
	repeated.Position = 0
	if !shouldStartNext(original, nearEnd, repeated) {
		t.Fatal("missed repeat/position wrap")
	}
}

func TestAutoNextOneShot(t *testing.T) {
	for _, mode := range []string{"skip", "end", "already playing", "play error", "cancel", "pause then skip", "status failure", "replace"} {
		t.Run(mode, func(t *testing.T) {
			var mu sync.Mutex
			current := State{Status: "playing", URI: originalURI, Duration: 200, Position: 40}
			calls := make(chan string, 5)
			events := make(chan NextStatus, 5)
			m := NewAutoNext(func(s NextStatus) { events <- s })
			m.interval = 5 * time.Millisecond
			m.read = func() State { mu.Lock(); defer mu.Unlock(); return current }
			m.play = func(uri string) error {
				calls <- uri
				if mode == "play error" {
					return errors.New("failed")
				}
				return nil
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			defer m.Cancel()
			if err := m.Schedule(ctx, wantedURI, "Wanted"); err != nil {
				t.Fatal(err)
			}
			set := func(s State) { mu.Lock(); current = s; mu.Unlock() }
			if mode == "pause then skip" {
				set(State{Status: "paused", URI: originalURI, Duration: 200, Position: 199})
				select {
				case <-calls:
					t.Fatal("played during pause")
				case <-time.After(25 * time.Millisecond):
				}
			}
			if mode == "cancel" {
				m.Cancel()
			}
			target := wantedURI
			if mode == "replace" {
				target = skippedURI
				if err := m.Schedule(ctx, target, "Replacement"); err != nil {
					t.Fatal(err)
				}
			}
			switch mode {
			case "end":
				set(State{Status: "playing", URI: originalURI, Duration: 200, Position: 199})
			case "already playing":
				set(State{Status: "playing", URI: wantedURI, Duration: 200})
			case "status failure":
				set(State{Status: "error"})
			default:
				set(State{Status: "playing", URI: skippedURI, Duration: 200, Position: 0})
			}
			if mode == "replace" {
				set(State{Status: "playing", URI: originalURI, Duration: 200, Position: 199})
			}
			if mode == "cancel" {
				select {
				case <-calls:
					t.Fatal("played after cancellation")
				case <-time.After(25 * time.Millisecond):
				}
				return
			}
			select {
			case event := <-events:
				want := "started"
				if mode == "play error" || mode == "status failure" {
					want = "error"
				}
				if event.Status != want {
					t.Fatalf("event %+v", event)
				}
			case <-time.After(time.Second):
				t.Fatal("missing completion")
			}
			if mode != "already playing" && mode != "status failure" {
				select {
				case uri := <-calls:
					if uri != target {
						t.Fatal("wrong target", uri)
					}
				default:
					t.Fatal("no play command")
				}
			}
			select {
			case <-calls:
				t.Fatal("duplicate/unexpected play")
			case <-time.After(20 * time.Millisecond):
			}
		})
	}
}

func TestAutoNextRequiresReadableAppleScriptState(t *testing.T) {
	m := NewAutoNext(nil)
	m.read = func() State { return State{Status: "playing", Duration: 100} }
	if m.Schedule(context.Background(), wantedURI, "Wanted") == nil {
		t.Fatal("accepted missing track ID")
	}
	if m.Schedule(context.Background(), "spotify:album:1234567890123456789012", "Album") == nil {
		t.Fatal("accepted album")
	}
}

func TestNextButtonConsumesReservation(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(map[bool]string{false: "success", true: "failure"}[fail], func(t *testing.T) {
			var events []NextStatus
			m := NewAutoNext(func(s NextStatus) { events = append(events, s) })
			m.interval = time.Hour // The button must not wait for a polling tick.
			m.read = func() State { return State{Status: "paused", URI: originalURI, Duration: 200, Position: 40} }
			var played []string
			m.play = func(uri string) error {
				played = append(played, uri)
				if fail {
					return errors.New("AppleScript failed")
				}
				return nil
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			defer m.Cancel()
			if err := m.Schedule(ctx, wantedURI, "Wanted"); err != nil {
				t.Fatal(err)
			}
			skips := 0
			next := func() error { skips++; return nil }
			err := m.Next(next)
			if (err != nil) != fail {
				t.Fatalf("unexpected error: %v", err)
			}
			if skips != 0 || len(played) != 1 || played[0] != wantedURI {
				t.Fatalf("skips %d plays %v", skips, played)
			}
			if m.Status().Status == "waiting" || len(events) != 1 {
				t.Fatal("reservation was not consumed/notified")
			}
			if m.cancel != nil {
				t.Fatal("polling was not cancelled")
			}
			if err := m.Next(next); err != nil || skips != 1 || len(played) != 1 {
				t.Fatal("normal skip without reservation failed")
			}
		})
	}
}
