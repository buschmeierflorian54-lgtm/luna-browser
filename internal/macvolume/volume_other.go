//go:build !darwin && !windows

package macvolume

func Read() (int, uint32) { return -1, 0 }
