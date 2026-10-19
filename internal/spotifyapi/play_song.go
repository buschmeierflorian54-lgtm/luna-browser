package spotifyapi

import (
	"context"
	"errors"
	"strings"
	"unicode"
)

// PlaySong resolves a human song request and sends exactly one playback command.
func PlaySong(ctx context.Context, song, artist string, search func(context.Context, string) (*Results, error), play func(string) error) (*Track, error) {
	song = strings.TrimSpace(song)
	artist = strings.TrimSpace(artist)
	if songWords(song) == "" || len(song)+len(artist) > 480 {
		return nil, errors.New("song muss den echten Songtitel enthalten, nicht nur Satzzeichen. Beispiel für die Nutzeranfrage spiele nobodys home von avril lavigne: song=Nobody's Home, artist=Avril Lavigne. Künstler weglassen, wenn unbekannt. Maximal 480 Bytes zusammen. Keine Wiedergabe ausgeführt.")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	query := strings.TrimSpace(song + " " + artist)
	result, err := search(ctx, query)
	if err != nil {
		return nil, err
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	if result == nil {
		return nil, errors.New("Kein passender Spotify-Song gefunden.")
	}
	var chosen *Track
	best := -1
	for _, track := range result.Tracks.Items {
		if !strings.HasPrefix(track.URI, "spotify:track:") {
			continue
		}
		score := 0
		if artist != "" {
			matches := false
			for _, a := range track.Artists {
				if songWords(a.Name) == songWords(artist) {
					matches = true
					break
				}
			}
			if !matches {
				continue
			}
		}
		if songWords(track.Name) == songWords(song) {
			score = 2
		} else if strings.Contains(songWords(track.Name), songWords(song)) {
			score = 1
		}
		if score > best {
			copy := track
			chosen = &copy
			best = score
		}
	}
	if chosen == nil {
		return nil, errors.New("Kein passender Spotify-Song für diesen Titel und Künstler gefunden.")
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	if err = play(chosen.URI); err != nil {
		return nil, err
	}
	return chosen, nil
}
func songWords(s string) string {
	return strings.Join(strings.FieldsFunc(strings.ToLower(s), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) }), " ")
}
