package spotifyapi

import (
	"context"
	"errors"
	"testing"
)

func TestPlaySong(t *testing.T) {
	result := &Results{Tracks: TrackPage{Items: []Track{{Name: "Lovely remix", URI: "spotify:track:remix", Artists: []Artist{{Name: "Billie Eilish"}}}, {Name: "Lovely", URI: "spotify:track:cover", Artists: []Artist{{Name: "Cover Artist"}}}, {Name: "lovely", URI: "spotify:track:original", Artists: []Artist{{Name: "Billie Eilish"}}}}}}
	calls := 0
	search := func(ctx context.Context, q string) (*Results, error) {
		if q != "Lovely Billie Eilish" && q != "Lovely" {
			t.Fatal(q)
		}
		return result, nil
	}
	play := func(uri string) error {
		calls++
		if uri != "spotify:track:original" {
			t.Fatal(uri)
		}
		return nil
	}
	track, err := PlaySong(context.Background(), " Lovely ", "Billie Eilish", search, play)
	if err != nil || track.Name != "lovely" || calls != 1 {
		t.Fatal(track, err, calls)
	}
	// Without artist, preserve Spotify ranking among exact title matches.
	track, err = PlaySong(context.Background(), "Lovely", "", search, func(uri string) error {
		if uri != "spotify:track:cover" {
			t.Fatal(uri)
		}
		return nil
	})
	if err != nil || track == nil {
		t.Fatal(err)
	}
}
func TestPlaySongNoUnwantedPlayback(t *testing.T) {
	for _, kind := range []string{"empty", "punctuation", "none", "artist", "search-error", "cancelled"} {
		t.Run(kind, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			song, artist := "Song", ""
			if kind == "punctuation" {
				song = ", "
			}
			if kind == "empty" {
				song = " "
			}
			if kind == "artist" {
				artist = "Other"
			}
			search := func(context.Context, string) (*Results, error) {
				if kind == "search-error" {
					return nil, errors.New("offline")
				}
				if kind == "cancelled" {
					cancel()
				}
				r := &Results{}
				if kind != "none" {
					r.Tracks.Items = []Track{{Name: "Song", URI: "spotify:track:test", Artists: []Artist{{Name: "Artist"}}}}
				}
				return r, nil
			}
			_, err := PlaySong(ctx, song, artist, search, func(string) error { t.Fatal("unexpected playback"); return nil })
			if err == nil {
				t.Fatal("expected error")
			}
		})
	}
}
