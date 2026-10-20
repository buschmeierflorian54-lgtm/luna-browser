package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	wr "github.com/wailsapp/wails/v2/pkg/runtime"
)

// RemoveLuna moves only the running application bundle to the user's Trash.
// Browser data is deliberately preserved; development binaries are never removed.
func (a *App) RemoveLuna() (string, error) {
	if runtime.GOOS == "windows" {
		if err := startWindowsRemoval(); err != nil {
			return "", err
		}
		go func() { time.Sleep(300 * time.Millisecond); wr.Quit(a.ctx) }()
		return "Luna wird beendet und in den Papierkorb verschoben. Deine Browserdaten bleiben erhalten.", nil
	}
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("Bitte beende Luna und entferne den entpackten Luna-Ordner im Explorer. Deine Browserdaten bleiben erhalten.")
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return "", err
	}
	bundle, err := removableBundle(exe)
	if err != nil {
		return "", err
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	if err := trashBundle(bundle, filepath.Join(home, ".Trash")); err != nil {
		return "", err
	}
	go func() { time.Sleep(300 * time.Millisecond); wr.Quit(a.ctx) }()
	return "Luna wurde in den Papierkorb verschoben. Deine Browserdaten bleiben erhalten.", nil
}

func removableBundle(exe string) (string, error) {
	bundle := filepath.Dir(filepath.Dir(filepath.Dir(exe)))
	if filepath.Base(filepath.Dir(exe)) != "MacOS" || filepath.Base(filepath.Dir(filepath.Dir(exe))) != "Contents" || !strings.HasSuffix(bundle, ".app") || filepath.Base(exe) != "Luna Browser" {
		return "", fmt.Errorf("Diese Entwicklungsversion kann nicht automatisch entfernt werden.")
	}
	return bundle, nil
}

func trashBundle(bundle, trash string) error {
	if err := os.MkdirAll(trash, 0700); err != nil {
		return err
	}
	// A unique directory prevents overwriting another item already in Trash.
	target, err := os.MkdirTemp(trash, "Luna-entfernt-")
	if err != nil {
		return err
	}
	if err = os.Rename(bundle, filepath.Join(target, filepath.Base(bundle))); err != nil {
		os.Remove(target)
		return fmt.Errorf("Verschiebe Luna im Finder in den Papierkorb (die App liegt möglicherweise auf einem schreibgeschützten Laufwerk): %w", err)
	}
	return nil
}
