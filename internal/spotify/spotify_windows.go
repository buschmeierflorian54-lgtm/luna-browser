package spotify

import (
	"browser-mac/internal/winhost"
	"errors"
	"golang.org/x/sys/windows"
)

var play func(string) error

func ConfigurePlayback(f func(string) error) { play = f }
func Get() State {
	var s State
	if e := winhost.Call("spotifyState", nil, &s); e != nil {
		return State{Status: "error", Message: e.Error()}
	}
	return s
}
func Command(cmd string, arg float64) error {
	if cmd == "open" {
		verb, _ := windows.UTF16PtrFromString("open")
		uri, _ := windows.UTF16PtrFromString("spotify:")
		return windows.ShellExecute(0, verb, uri, nil, nil, windows.SW_SHOWNORMAL)
	}
	return winhost.Call("spotifyCommand", map[string]any{"command": cmd, "value": arg}, nil)
}
func PlayURI(uri string) error {
	if !validURI(uri) {
		return errors.New("Ungültiger Spotify-Titel.")
	}
	if play == nil {
		return errors.New("Spotify-Konto unter Einstellungen → Spotify verbinden.")
	}
	return play(uri)
}

// Windows media sessions do not expose a reliable Spotify track URI. Fail closed instead of skipping the wrong song.
func PlayScheduledURI(uri string) error {
	return errors.New("Die lokale Nächster-Song-Vormerkung ist unter Windows noch nicht verfügbar. Verwende die Spotify-Warteschlange.")
}
