package macvolume

import (
	"browser-mac/internal/winhost"
	"hash/fnv"
)

func Read() (int, uint32) {
	var r struct {
		Volume int    `json:"volume"`
		Device string `json:"device"`
	}
	if winhost.Call("volume", nil, &r) != nil {
		return -1, 0
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(r.Device))
	return r.Volume, h.Sum32()
}
