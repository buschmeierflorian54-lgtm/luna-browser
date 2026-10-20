package main

import "browser-mac/internal/web"

func (a *App) UpdateStatus() map[string]any     { return web.UpdateStatus() }
func (a *App) CheckUpdates()                    { web.CheckUpdates() }
func (a *App) InstallUpdate()                   { web.InstallUpdate() }
func (a *App) SetAutomaticUpdates(enabled bool) { web.SetAutomaticUpdates(enabled) }
