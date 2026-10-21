package main

import (
	"os/exec"
)

func openFile(path string, reveal bool) error {
	args := []string{path}
	if reveal {
		args = []string{"-R", path}
	}
	return exec.Command("open", args...).Run()
}
func openExternal(url string) error { return exec.Command("open", url).Run() }
func configurePlatform(a *App)      {}
func closePlatform()                {}

func handlePlatformCommand() bool { return false }

func platformTitle() string { return "Luna Browser" }

func platformWindowSize() (int, int) { return 1280, 820 }
