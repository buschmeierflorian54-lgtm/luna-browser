package main

import "browser-mac/internal/web"

// Newly copied keys are returned only while the trusted provider page is active.
func (a *App) OnboardingClipboard(tab int, provider string, previousCount int) string {
	return web.OnboardingClipboard(tab, provider, previousCount)
}

// The account authorization page stays inside Luna during onboarding.
func (a *App) OnboardingSpotifyConnect(tab int) error {
	return a.spotifyAPI.Connect(func(url string) error { web.Load(tab, url); return nil })
}
