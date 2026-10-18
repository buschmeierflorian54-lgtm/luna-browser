package musicqueue

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
)

func TestSessionFallback(t *testing.T) {
	var r Router
	var calls []string
	failSpotify, failSonos := false, false
	provider := func(name string, fail *bool) Add {
		return func(ctx context.Context, uri string) error {
			calls = append(calls, name)
			if _, ok := ctx.Deadline(); !ok {
				t.Fatal("missing per-provider timeout")
			}
			if *fail {
				return errors.New(name + " failed")
			}
			return nil
		}
	}
	spotify, sonos := provider("spotify", &failSpotify), provider("sonos", &failSonos)
	cases := []struct {
		s, n                bool
		want                []string
		preferredSonos, err bool
	}{
		{false, false, []string{"spotify"}, false, false},
		{true, false, []string{"spotify", "sonos"}, true, false},
		{false, false, []string{"sonos"}, true, false},
		{false, true, []string{"sonos", "spotify"}, false, false},
		{true, true, []string{"spotify", "sonos"}, false, true},
		{true, false, []string{"spotify", "sonos"}, true, false},
		{true, true, []string{"sonos", "spotify"}, false, true},
	}
	for _, c := range cases {
		failSpotify, failSonos = c.s, c.n
		calls = nil
		err := r.Add(context.Background(), "track", spotify, sonos)
		if !reflect.DeepEqual(calls, c.want) || r.UsesSonos() != c.preferredSonos || (err != nil) != c.err {
			t.Fatalf("calls %v preferred %v error %v", calls, r.UsesSonos(), err)
		}
		if err != nil && (!strings.Contains(err.Error(), "spotify failed") || !strings.Contains(err.Error(), "sonos failed")) {
			t.Fatal("must return both errors")
		}
	}
	var restarted Router
	if restarted.UsesSonos() {
		t.Fatal("preference must not survive restart")
	}
}
