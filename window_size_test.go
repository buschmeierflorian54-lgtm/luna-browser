package main

import "testing"

func TestWindowSizeFitsWorkArea(t *testing.T) {
	for _, area := range [][2]int{{1024, 728}, {1366, 728}, {1920, 1040}, {800, 560}, {1200, 800}} {
		for _, dpi := range []int{96, 120, 144, 192} {
			w, h := windowSizeForWorkArea(area[0], area[1], dpi)
			if w*dpi/96 >= area[0] || h*dpi/96 >= area[1] {
				t.Fatalf("%v @ %d DPI: %dx%d does not fit", area, dpi, w, h)
			}
			if w > 1280 || h > 820 || w <= 0 || h <= 0 {
				t.Fatalf("bad size %dx%d", w, h)
			}
		}
	}
	w, h := windowSizeForWorkArea(1366, 728, 144)
	if w != 878 || h != 453 {
		t.Fatalf("150%% laptop: got %dx%d", w, h)
	}
}
