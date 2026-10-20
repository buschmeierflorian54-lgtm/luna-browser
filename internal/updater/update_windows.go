package updater

import (
	"browser-mac/internal/buildinfo"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"golang.org/x/sys/windows"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"syscall"
	"time"
)

var mu sync.Mutex
var state = map[string]any{"ready": true, "phase": "idle", "message": "Windows-Testversion · experimentell / instabil", "canCheck": true, "automatic": true, "pendingVersion": "", "installReady": false}
var nextManifest *Manifest
var started sync.Once

func settingsPath() string {
	d, _ := os.UserConfigDir()
	return filepath.Join(d, "browser-mac", "windows-updates.json")
}
func Status() map[string]any {
	mu.Lock()
	defer mu.Unlock()
	r := map[string]any{}
	for k, v := range state {
		r[k] = v
	}
	r["version"] = buildinfo.Version
	return r
}
func Automatic(on bool) {
	mu.Lock()
	state["automatic"] = on
	mu.Unlock()
	data, _ := json.Marshal(map[string]bool{"automatic": on})
	_ = os.MkdirAll(filepath.Dir(settingsPath()), 0700)
	_ = os.WriteFile(settingsPath(), data, 0600)
}
func Start() {
	started.Do(func() {
		var s struct {
			Automatic bool `json:"automatic"`
		}
		if b, e := os.ReadFile(settingsPath()); e == nil && json.Unmarshal(b, &s) == nil {
			mu.Lock()
			state["automatic"] = s.Automatic
			mu.Unlock()
		}
		go func() {
			for {
				if Status()["automatic"] == true {
					Check()
				}
				time.Sleep(24 * time.Hour)
			}
		}()
	})
}

var errNoRelease = errors.New("Noch kein Windows-Update veröffentlicht. Diese Testversion ist experimentell / instabil.")

var client = &http.Client{Timeout: 3 * time.Minute}

func get(url string, limit int64) ([]byte, error) {
	res, e := client.Get(url)
	if e != nil {
		return nil, e
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound {
		return nil, errNoRelease
	}
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("Update-Kanal meldet HTTP %d", res.StatusCode)
	}
	b, e := io.ReadAll(io.LimitReader(res.Body, limit+1))
	if int64(len(b)) > limit {
		return nil, errors.New("Update-Datei zu groß")
	}
	return b, e
}
func Check() {
	mu.Lock()
	if state["canCheck"] == false {
		mu.Unlock()
		return
	}
	state["canCheck"] = false
	state["phase"] = "checking"
	mu.Unlock()
	defer func() { mu.Lock(); state["canCheck"] = true; state["lastCheck"] = time.Now().Unix(); mu.Unlock() }()
	raw, e := get(Repository+"/releases/latest/download/windows-update.json", 16384)
	if errors.Is(e, errNoRelease) {
		mu.Lock()
		state["phase"] = "idle"
		state["message"] = e.Error()
		mu.Unlock()
		return
	}
	if e != nil {
		fail(e)
		return
	}
	sig, e := get(Repository+"/releases/latest/download/windows-update.sig", 1024)
	if e != nil {
		fail(e)
		return
	}
	key, _ := base64.StdEncoding.DecodeString(PublicKey)
	m, e := VerifyManifest(raw, string(sig), key)
	if e != nil {
		fail(e)
		return
	}
	mu.Lock()
	defer mu.Unlock()
	if !Newer(m.Version, buildinfo.Version) {
		state["phase"] = "current"
		state["message"] = "Kein neueres Windows-Update verfügbar."
		return
	}
	nextManifest = &m
	state["phase"] = "available"
	state["pendingVersion"] = m.Version
	state["installReady"] = true
	state["message"] = "Version " + m.Version + " ist verfügbar. Windows bleibt experimentell / instabil."
}
func fail(e error) { mu.Lock(); state["phase"] = "error"; state["message"] = e.Error(); mu.Unlock() }
func Install() {
	mu.Lock()
	if nextManifest == nil || state["canCheck"] == false {
		mu.Unlock()
		return
	}
	m := *nextManifest
	state["canCheck"] = false
	state["phase"] = "downloading"
	mu.Unlock()
	if e := prepare(m); e != nil {
		fail(e)
		mu.Lock()
		state["canCheck"] = true
		mu.Unlock()
	}
}
func prepare(m Manifest) error {
	root, e := os.MkdirTemp("", "luna-update-")
	if e != nil {
		return e
	}
	ok := false
	defer func() {
		if !ok {
			os.RemoveAll(root)
		}
	}()
	data, e := get(m.URL, m.Size)
	if e != nil {
		return e
	}
	archive := filepath.Join(root, "update.zip")
	if e = os.WriteFile(archive, data, 0600); e != nil {
		return e
	}
	if e = VerifyArchive(archive, m); e != nil {
		return e
	}
	stage := filepath.Join(root, "stage")
	if e = Extract(archive, stage); e != nil {
		return e
	}
	exe, e := os.Executable()
	if e != nil {
		return e
	}
	exe, e = filepath.EvalSymlinks(exe)
	if e != nil {
		return e
	}
	dest := filepath.Dir(exe)
	if _, e = os.Stat(filepath.Join(dest, "luna-package.json")); e != nil {
		return errors.New("Bitte die vollständige Windows-ZIP in einen eigenen Ordner entpacken, bevor Updates installiert werden.")
	}
	helper := filepath.Join(root, "luna-updater.exe")
	if e = copyFile(exe, helper); e != nil {
		return e
	}
	cmd := exec.Command(helper, "--apply-update", stage, dest, strconv.Itoa(os.Getpid()))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if e = cmd.Start(); e != nil {
		return e
	}
	ok = true
	os.Exit(0)
	return nil
}
func copyFile(src, dst string) error {
	in, e := os.Open(src)
	if e != nil {
		return e
	}
	defer in.Close()
	out, e := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	_, e = io.Copy(out, in)
	ce := out.Close()
	if e != nil {
		return e
	}
	return ce
}

// Apply runs from a temporary copy after the app exits. Only package files are replaced; failures restore backups.
func Apply(stage, dest string, pid int) error {
	if !filepath.IsAbs(stage) || !filepath.IsAbs(dest) || stage == dest {
		return errors.New("Ungültiges Update-Ziel")
	}
	if _, e := os.Stat(filepath.Join(stage, "luna-package.json")); e != nil {
		return e
	}
	if _, e := os.Stat(filepath.Join(dest, "luna-package.json")); e != nil {
		return e
	}
	process, e := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if e == nil {
		result, err := windows.WaitForSingleObject(process, 60000)
		windows.CloseHandle(process)
		if err != nil || result != windows.WAIT_OBJECT_0 {
			return errors.New("Luna wurde nicht beendet")
		}
	}
	time.Sleep(2 * time.Second) // child host observes the parent exit before native files are replaced
	backup := filepath.Join(filepath.Dir(stage), "backup")
	var changed []string
	rollback := func() {
		for i := len(changed) - 1; i >= 0; i-- {
			name := changed[i]
			_ = os.Remove(filepath.Join(dest, name))
			if _, e := os.Stat(filepath.Join(backup, name)); e == nil {
				_ = os.Rename(filepath.Join(backup, name), filepath.Join(dest, name))
			}
		}
	}
	e = filepath.WalkDir(stage, func(path string, d os.DirEntry, e error) error {
		if e != nil {
			return e
		}
		if d.IsDir() {
			return nil
		}
		name, e := filepath.Rel(stage, path)
		if e != nil {
			return e
		}
		target := filepath.Join(dest, name)
		saved := filepath.Join(backup, name)
		if e = os.MkdirAll(filepath.Dir(target), 0700); e != nil {
			return e
		}
		if _, e = os.Stat(target); e == nil {
			if e = os.MkdirAll(filepath.Dir(saved), 0700); e != nil {
				return e
			}
			for i := 0; i < 30; i++ {
				e = os.Rename(target, saved)
				if e == nil {
					break
				}
				time.Sleep(500 * time.Millisecond)
			}
			if e != nil {
				return e
			}
		}
		changed = append(changed, name)
		return copyFile(path, target)
	})
	if e != nil {
		rollback()
		return e
	}
	cmd := exec.Command(filepath.Join(dest, "Luna Browser.exe"))
	cmd.Dir = dest
	if e = cmd.Start(); e != nil {
		rollback()
		return e
	}
	return nil
}
