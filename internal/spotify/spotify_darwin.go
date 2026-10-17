// Package spotify steuert die Spotify-Desktop-App über AppleScript (osascript).
// Spotify wird nie unbeabsichtigt gestartet: Abfragen prüfen zuerst, ob es läuft.
package spotify

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// State ist der Wiedergabezustand für die Oberfläche.
type State struct {
	Status   string `json:"status"` // off | stopped | playing | paused | denied | error
	Message  string `json:"message,omitempty"`
	Title    string `json:"title,omitempty"`
	Artist   string `json:"artist,omitempty"`
	Album    string `json:"album,omitempty"`
	Duration int    `json:"duration"` // Sekunden
	Position int    `json:"position"` // Sekunden
	Artwork  string `json:"artwork,omitempty"`
	Volume   int    `json:"volume"`
	Shuffle  bool   `json:"shuffle"`
	Repeat   bool   `json:"repeat"`
}

func run(script string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "osascript", "-e", script).CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

const stateScript = `
if application "Spotify" is not running then return "off"
tell application "Spotify"
	set pState to (player state as text)
	if pState is "stopped" then return "stopped"
	set sep to (character id 31)
	set nm to "" 
	set ar to ""
	set al to ""
	set du to 0
	set pos to 0
	set art to ""
	set vol to 0
	set sh to "false"
	set rp to "false"
	try
		set trk to current track
		set nm to (name of trk)
		set ar to (artist of trk)
		set al to (album of trk)
		set du to ((duration of trk) as integer)
		set art to (artwork url of trk)
	end try
	try
		set pos to ((player position) as integer)
	end try
	try
		set vol to ((sound volume) as integer)
	end try
	try
		set sh to (shuffling as text)
		set rp to (repeating as text)
	end try
	return pState & sep & nm & sep & ar & sep & al & sep & du & sep & pos & sep & art & sep & vol & sep & sh & sep & rp
end tell`

// Get liest den aktuellen Zustand.
func Get() State {
	out, err := run(stateScript)
	if err != nil {
		if strings.Contains(out, "-1743") || strings.Contains(strings.ToLower(out), "not authorized") {
			return State{Status: "denied", Message: "Zugriff auf Spotify nicht erlaubt. Systemeinstellungen → Datenschutz & Sicherheit → Automation: diese App für „Spotify“ aktivieren."}
		}
		return State{Status: "error", Message: out}
	}
	switch out {
	case "off", "stopped":
		return State{Status: out}
	}
	f := strings.Split(out, "\x1f")
	if len(f) < 10 {
		return State{Status: "error", Message: "Unerwartete Antwort von Spotify."}
	}
	atoi := func(s string) int { n, _ := strconv.Atoi(strings.TrimSpace(s)); return n }
	return State{
		Status: f[0], Title: f[1], Artist: f[2], Album: f[3],
		Duration: atoi(f[4]) / 1000, Position: atoi(f[5]), Artwork: f[6],
		Volume: atoi(f[7]), Shuffle: f[8] == "true", Repeat: f[9] == "true",
	}
}

// Command führt einen Befehl aus. arg: Sekunden (seek), Prozent 0–100 (volume).
func Command(cmd string, arg float64) error {
	var body string
	switch cmd {
	case "open":
		_, err := run(`tell application "Spotify" to activate`)
		return err
	case "playpause":
		body = "playpause"
	case "next":
		body = "next track"
	case "previous":
		body = "previous track"
	case "seek":
		body = fmt.Sprintf("set player position to %d", int(arg))
	case "volume":
		v := int(arg)
		if v < 0 {
			v = 0
		} else if v > 100 {
			v = 100
		}
		body = fmt.Sprintf("set sound volume to %d", v)
	case "shuffle":
		body = "set shuffling to (not shuffling)"
	case "repeat":
		body = "set repeating to (not repeating)"
	default:
		return errors.New("unbekannter Befehl")
	}
	// Befehle starten Spotify nicht: läuft es nicht, passiert nichts.
	out, err := run(`if application "Spotify" is running then
	tell application "Spotify" to ` + body + `
end if`)
	if err != nil {
		return errors.New(out)
	}
	return nil
}
