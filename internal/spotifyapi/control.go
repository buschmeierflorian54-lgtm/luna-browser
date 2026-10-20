package spotifyapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
)

// PlayURI uses the authenticated Spotify playback API on Windows. Spotify requires Premium and an active device.
func (c *Client) PlayURI(ctx context.Context, uri string) error {
	if !regexp.MustCompile(`^spotify:(track|album|artist):[A-Za-z0-9]{22}$`).MatchString(uri) {
		return errors.New("Ungültiger Spotify-Inhalt.")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.authorize(ctx); err != nil {
		return err
	}
	payload := map[string]any{"context_uri": uri}
	if len(uri) > 14 && uri[:14] == "spotify:track:" {
		payload = map[string]any{"uris": []string{uri}}
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "PUT", c.API+"/me/player/play", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.c.Access)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return errors.New("Spotify-Wiedergabe konnte nicht bestätigt werden.")
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNoContent {
		return nil
	}
	if res.StatusCode == 404 {
		return errors.New("Starte zuerst einen Titel auf deinem gewünschten Spotify-Gerät.")
	}
	return apiError(res.StatusCode)
}
