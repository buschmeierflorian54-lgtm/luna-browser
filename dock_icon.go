package main

import (
	"browser-mac/internal/web"
	"bytes"
	"encoding/base64"
	"errors"
	"image/png"
)

// SetDockIcon persists a Finder custom icon on the app bundle and updates the running Dock icon.
func (a *App) SetDockIcon(encoded string) error {
	if len(encoded) > 2*1024*1024 {
		return errors.New("Symbol ist zu groß")
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return errors.New("Ungültiges Symbol")
	}
	cfg, err := png.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width != 1024 || cfg.Height != 1024 {
		return errors.New("Symbol muss ein PNG mit 1024 × 1024 Pixeln sein")
	}
	if !web.SetDockIcon(data) {
		return errors.New("App-Symbol konnte nicht dauerhaft gespeichert werden. Der App-Ordner muss beschreibbar sein.")
	}
	return nil
}
