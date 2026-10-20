package web

import "browser-mac/internal/updater"

func StartUpdates()                { updater.Start() }
func CheckUpdates()                { go updater.Check() }
func InstallUpdate()               { go updater.Install() }
func SetAutomaticUpdates(on bool)  { updater.Automatic(on) }
func UpdateStatus() map[string]any { return updater.Status() }
