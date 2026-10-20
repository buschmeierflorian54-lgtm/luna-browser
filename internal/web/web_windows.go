package web

import (
	"browser-mac/internal/winhost"
	"encoding/base64"
	"encoding/json"
	"errors"
)

var emitFn func(string)

func SetEmitter(f func(string)) { emitFn = f; winhost.SetEmitter(f) }
func send(op string, args any) {
	if err := winhost.Call(op, args, nil); err != nil && emitFn != nil {
		b, _ := json.Marshal(map[string]any{"t": "error", "tab": tabID(args), "message": err.Error()})
		emitFn(string(b))
	}
}
func tabID(a any) int {
	if m, ok := a.(map[string]any); ok {
		if id, ok := m["tab"].(int); ok {
			return id
		}
	}
	return -1
}
func Load(id int, url string)  { send("load", map[string]any{"tab": id, "url": url}) }
func action(op string, id int) { send(op, map[string]any{"tab": id}) }
func Back(id int)              { action("back", id) }
func Forward(id int)           { action("forward", id) }
func Reload(id int)            { action("reload", id) }
func Stop(id int)              { action("stop", id) }
func Show(id int)              { action("show", id) }
func Close(id int)             { action("close", id) }
func SetFrame(x, y, w, h float64) {
	send("frame", map[string]any{"x": x, "y": y, "width": w, "height": h})
}
func Zoom(id int, f float64)    { send("zoom", map[string]any{"tab": id, "factor": f}) }
func FocusUI()                  { send("focus", nil) }
func SetAppearance(mode string) { send("appearance", map[string]any{"mode": mode}) }
func Find(id int, text string, forward bool) {
	send("find", map[string]any{"tab": id, "text": text, "forward": forward})
}
func image(op string, id int) (string, error) {
	var s string
	e := winhost.Call(op, map[string]any{"tab": id}, &s)
	return s, e
}
func Snapshot(id int) (string, error) {
	s, e := image("snapshot", id)
	return "data:image/jpeg;base64," + s, e
}
func Screenshot(id int) (string, error) { return image("screenshot", id) }
func PlaySound(data []byte) {
	send("sound", map[string]any{"data": base64.StdEncoding.EncodeToString(data)})
}
func SetWriteSound(data []byte) {
	send("writeSoundData", map[string]any{"data": base64.StdEncoding.EncodeToString(data)})
}
func WriteSound(on bool)                   { send("writeSound", map[string]any{"on": on}) }
func ConfigureGesture(src string, on bool) { send("gesture", map[string]any{"source": src, "on": on}) }
func Evaluate(id int, script string) (string, error) {
	var s string
	e := winhost.Call("evaluate", map[string]any{"tab": id, "source": script}, &s)
	return s, e
}

var ErrAuthUnavailable = errors.New("Windows Hello ist nicht eingerichtet. Richte unter Einstellungen → Konten → Anmeldeoptionen eine PIN oder Biometrie ein.")

func Authenticate(reason string) (bool, error) {
	var result string
	e := winhost.Call("authenticate", map[string]any{"reason": reason}, &result)
	if e != nil {
		return false, e
	}
	if result == "unavailable" {
		return false, ErrAuthUnavailable
	}
	return result == "verified", nil
}
func SetDockIcon(data []byte) bool {
	var ok bool
	return winhost.Call("icon", map[string]any{"data": base64.StdEncoding.EncodeToString(data)}, &ok) == nil && ok
}
func SetErrorPalette(palette string) { send("palette", map[string]any{"palette": palette}) }
func OnboardingClipboard(tab int, provider string, previousCount int) string {
	var result json.RawMessage
	if winhost.Call("clipboard", map[string]any{"tab": tab, "provider": provider, "previousCount": previousCount}, &result) != nil {
		return "{}"
	}
	return string(result)
}
