//go:build !windows

package main

import "fmt"

func startWindowsRemoval() error { return fmt.Errorf("Windows removal is unavailable") }
