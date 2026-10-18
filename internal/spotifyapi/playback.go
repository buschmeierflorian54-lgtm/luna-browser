package spotifyapi

import "context"

type Playback struct {
	Device struct {
		Name string `json:"name"`
		Type string `json:"type"`
	} `json:"device"`
	Item *Track `json:"item"`
}

// Playback identifies the actual target; volume-sync selections are unrelated.
func (c *Client) Playback(ctx context.Context) (*Playback, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.authorize(ctx); err != nil {
		return nil, err
	}
	var p Playback
	if err := c.get(ctx, "/me/player", &p); err != nil {
		return nil, err
	}
	return &p, nil
}
