package spotify

import "testing"

func TestPlayURIValidation(t *testing.T) {
	for _, s := range []string{"spotify:track:1234567890123456789012", "spotify:album:abcdefghijklmnopqrstuv", "spotify:artist:ABCDEFGHIJKLMNOPQRSTUV"} {
		if !validURI(s) {
			t.Fatal(s)
		}
	}
	for _, s := range []string{"spotify:track:x", `spotify:track:1234567890123456789012" & do shell script "bad`, "https://open.spotify.com/track/1234567890123456789012", "spotify:playlist:1234567890123456789012"} {
		if validURI(s) {
			t.Fatal("unsafe URI")
		}
	}
}
