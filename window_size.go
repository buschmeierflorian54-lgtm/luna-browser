package main

// Work-area dimensions are physical pixels; Wails SetSize takes logical pixels.
// Keep a visible margin on every edge, including at 150/200% scaling.
func windowSizeForWorkArea(width, height, dpi int) (int, int) {
	if dpi < 96 {
		dpi = 96
	}
	width = max(1, width*96/dpi-32)
	height = max(1, height*96/dpi-32)
	return min(1280, width), min(820, height)
}
