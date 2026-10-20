package main

import (
	"browser-mac/internal/spotify"
	"browser-mac/internal/updater"
	"browser-mac/internal/winhost"
	"context"
	"golang.org/x/sys/windows"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

func openFile(path string, reveal bool) error {
	if reveal {
		cmd := exec.Command("explorer.exe", "/select,", filepath.Clean(path))
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		return cmd.Start()
	}
	return openExternal(path)
}
func openExternal(target string) error {
	verb, _ := windows.UTF16PtrFromString("open")
	name, e := windows.UTF16PtrFromString(target)
	if e != nil {
		return e
	}
	return windows.ShellExecute(0, verb, name, nil, nil, windows.SW_SHOWNORMAL)
}
func configurePlatform(a *App) {
	spotify.ConfigurePlayback(func(uri string) error {
		ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
		defer cancel()
		return a.spotifyAPI.PlayURI(ctx, uri)
	})
}
func closePlatform() { winhost.Close() }

func handlePlatformCommand() bool {
	if len(os.Args) != 5 || os.Args[1] != "--apply-update" {
		return false
	}
	pid, err := strconv.Atoi(os.Args[4])
	if err == nil {
		err = updater.Apply(os.Args[2], os.Args[3], pid)
	}
	if err != nil {
		body, _ := windows.UTF16PtrFromString("Update fehlgeschlagen. Die vorherige Version wurde soweit möglich wiederhergestellt.\n" + err.Error())
		title, _ := windows.UTF16PtrFromString("Luna Update")
		windows.MessageBox(0, body, title, windows.MB_ICONERROR)
		os.Exit(1)
	}
	return true
}

func platformTitle() string { return "Luna Browser · Windows-Testversion (instabil)" }
