// Package web steuert native Browser-Tabs (WKWebView), die als Unteransichten im Fenster liegen.
// Die Oberfläche (Tabs, Adressleiste …) bleibt HTML im Wails-Webview; hier läuft nur das Rendern der Seiten.
package web

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework Cocoa -framework WebKit
#include <stdlib.h>
#include "web_darwin.h"
*/
import "C"

import (
	"errors"
	"sync"
	"time"
	"unsafe"
)

var (
	emitFn func(string)
	snapMu sync.Mutex
	snaps  = map[int]chan string{}
	snapID int
)

// SetEmitter legt fest, wohin Ereignisse der Tabs (JSON) gehen.
func SetEmitter(f func(string)) { emitFn = f }

//export goWebEvent
func goWebEvent(j *C.char) {
	if emitFn != nil {
		emitFn(C.GoString(j))
	}
}

//export goSnapshotDone
func goSnapshotDone(req C.int, b64 *C.char) {
	snapMu.Lock()
	ch := snaps[int(req)]
	snapMu.Unlock()
	if ch != nil {
		ch <- C.GoString(b64)
	}
}

func Load(id int, url string) {
	c := C.CString(url)
	defer C.free(unsafe.Pointer(c))
	C.fmwLoad(C.int(id), c)
}

func Back(id int)    { C.fmwHistory(C.int(id), 0) }
func Forward(id int) { C.fmwHistory(C.int(id), 1) }
func Reload(id int)  { C.fmwHistory(C.int(id), 2) }
func Stop(id int)    { C.fmwHistory(C.int(id), 3) }

func SetFrame(x, y, w, h float64) { C.fmwSetFrame(C.double(x), C.double(y), C.double(w), C.double(h)) }
func Show(id int)                 { C.fmwShow(C.int(id)) }
func Close(id int)                { C.fmwClose(C.int(id)) }
func Zoom(id int, f float64)      { C.fmwZoom(C.int(id), C.double(f)) }
func FocusUI()                    { C.fmwFocusUI() }

func Find(id int, text string, forward bool) {
	c := C.CString(text)
	defer C.free(unsafe.Pointer(c))
	f := 0
	if forward {
		f = 1
	}
	C.fmwFind(C.int(id), c, C.int(f))
}

// Snapshot liefert ein JPEG der Seite als data-URL (damit die Oberfläche kurz über der Seite zeichnen kann).
func Snapshot(id int) (string, error) {
	snapMu.Lock()
	snapID++
	req := snapID
	ch := make(chan string, 1)
	snaps[req] = ch
	snapMu.Unlock()
	defer func() { snapMu.Lock(); delete(snaps, req); snapMu.Unlock() }()
	C.fmwSnapshot(C.int(id), C.int(req))
	select {
	case b := <-ch:
		if b == "" {
			return "", errors.New("kein Bild")
		}
		return "data:image/jpeg;base64," + b, nil
	case <-time.After(4 * time.Second):
		return "", errors.New("Zeitüberschreitung")
	}
}
