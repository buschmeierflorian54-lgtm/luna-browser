package main

import "browser-mac/internal/web"

// Only clipboard metadata is returned. The clipboard's contents are never read.
func (a *App) OnboardingClipboard(tab int, provider string) string {
	return web.OnboardingClipboard(tab, provider)
}

// The account authorization page stays inside Luna during onboarding.
func (a *App) OnboardingSpotifyConnect(tab int) error {
	return a.spotifyAPI.Connect(func(url string) error { web.Load(tab, url); return nil })
}
