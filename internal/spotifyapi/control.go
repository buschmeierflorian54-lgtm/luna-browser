package spotifyapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
)

var playableURI = regexp.MustCompile(`^spotify:(track|album|artist):[A-Za-z0-9]{22}$`)

type device struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	Restricted bool   `json:"is_restricted"`
	Active     bool   `json:"is_active"`
}

// PlayURI uses the authenticated Spotify playback API on Windows. Spotify requires Premium and a device.
// Without an active device Spotify answers 404; then the first usable device (this PC preferred) is woken up.
func (c *Client) PlayURI(ctx context.Context, uri string) error {
	if !playableURI.MatchString(uri) {
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
	status, reason, retry, err := c.play(ctx, "", body)
	if err != nil {
		return err
	}
	if status == http.StatusNotFound {
		id, derr := c.pickDevice(ctx)
		if derr != nil {
			return derr
		}
		if id == "" {
			return errors.New("Kein Spotify-Gerät gefunden. Öffne Spotify auf diesem PC (und melde dich an), dann erneut versuchen.")
		}
		if status, reason, retry, err = c.play(ctx, id, body); err != nil {
			return err
		}
	}
	return playError(status, reason, retry)
}

func (c *Client) play(ctx context.Context, deviceID string, body []byte) (int, string, string, error) {
	endpoint := c.API + "/me/player/play"
	if deviceID != "" {
		endpoint += "?device_id=" + url.QueryEscape(deviceID)
	}
	req, err := http.NewRequestWithContext(ctx, "PUT", endpoint, bytes.NewReader(body))
	if err != nil {
		return 0, "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.c.Access)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return 0, "", "", errors.New("Spotify-Wiedergabe konnte nicht bestätigt werden.")
	}
	defer res.Body.Close()
	var e struct {
		Error struct {
			Reason string `json:"reason"`
		} `json:"error"`
	}
	_ = json.NewDecoder(io.LimitReader(res.Body, 1<<16)).Decode(&e)
	return res.StatusCode, e.Error.Reason, res.Header.Get("Retry-After"), nil
}

func (c *Client) pickDevice(ctx context.Context) (string, error) {
	var list struct {
		Devices []device `json:"devices"`
	}
	if err := c.get(ctx, "/me/player/devices", &list); err != nil {
		return "", err
	}
	best := ""
	for _, d := range list.Devices {
		if d.ID == "" || d.Restricted {
			continue
		}
		if d.Type == "Computer" {
			return d.ID, nil
		}
		if best == "" {
			best = d.ID
		}
	}
	return best, nil
}

func playError(status int, reason, retryAfter string) error {
	switch {
	case status == http.StatusNoContent || status == http.StatusOK || status == http.StatusAccepted:
		return nil
	case status == http.StatusNotFound:
		return errors.New("Starte zuerst einen Titel auf deinem gewünschten Spotify-Gerät.")
	case status == http.StatusForbidden && reason == "PREMIUM_REQUIRED":
		return errors.New("Für die Wiedergabe über Luna braucht Spotify ein Premium-Konto.")
	case status == http.StatusForbidden:
		return errors.New("Spotify verweigert die Wiedergabe. Prüfe Premium-Status und freigeschaltete Nutzer deiner Developer-App.")
	case status == http.StatusTooManyRequests:
		if s, err := strconv.Atoi(retryAfter); err == nil && s > 0 {
			return errors.New("Spotify-Limit erreicht. Bitte in " + strconv.Itoa(s) + " Sekunden erneut versuchen.")
		}
		return apiError(status)
	}
	return apiError(status)
}
