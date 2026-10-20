// Package winhost connects Go to Luna's isolated native Windows host over inherited pipes.
package winhost

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

var mu sync.Mutex
var writeMu sync.Mutex
var input io.WriteCloser
var child *exec.Cmd
var pending = map[int64]chan response{}
var next atomic.Int64
var emitter func(string)

type response struct {
	ID     int64           `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  string          `json:"error"`
	Event  json.RawMessage `json:"event"`
}

func SetEmitter(f func(string)) { mu.Lock(); emitter = f; mu.Unlock() }
func start() error {
	if input != nil {
		return nil
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	child = exec.Command(filepath.Join(filepath.Dir(exe), "native", "Luna.Windows.exe"), fmt.Sprint(os.Getpid()))
	child.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := child.StdoutPipe()
	if err != nil {
		return err
	}
	input, err = child.StdinPipe()
	if err != nil {
		return err
	}
	if err = child.Start(); err != nil {
		input = nil
		return fmt.Errorf("Windows-Komponente konnte nicht starten: %w", err)
	}
	go func(cmd *exec.Cmd) {
		scanner := bufio.NewScanner(out)
		scanner.Buffer(make([]byte, 65536), 32<<20)
		for scanner.Scan() {
			var r response
			if json.Unmarshal(scanner.Bytes(), &r) != nil {
				continue
			}
			mu.Lock()
			ch := pending[r.ID]
			f := emitter
			mu.Unlock()
			if len(r.Event) > 0 && f != nil {
				f(string(r.Event))
			}
			if ch != nil {
				select {
				case ch <- r:
				default:
				}
			}
		}
		_ = cmd.Wait()
		mu.Lock()
		input = nil
		for _, ch := range pending {
			select {
			case ch <- response{Error: "Windows-Komponente wurde beendet."}:
			default:
			}
		}
		mu.Unlock()
	}(child)
	return nil
}
func Call(op string, args any, dst any) error {
	id := next.Add(1)
	ch := make(chan response, 1)
	mu.Lock()
	if err := start(); err != nil {
		mu.Unlock()
		return err
	}
	pending[id] = ch
	w := input
	mu.Unlock()
	defer func() { mu.Lock(); delete(pending, id); mu.Unlock() }()
	b, err := json.Marshal(map[string]any{"id": id, "op": op, "args": args})
	if err != nil {
		return err
	}
	writeMu.Lock()
	_, err = w.Write(append(b, '\n'))
	writeMu.Unlock()
	if err != nil {
		return err
	}
	select {
	case r := <-ch:
		if r.Error != "" {
			return errors.New(r.Error)
		}
		if dst != nil {
			return json.Unmarshal(r.Result, dst)
		}
		return nil
	case <-time.After(60 * time.Second):
		return fmt.Errorf("Windows-Anfrage %s: Zeitüberschreitung", op)
	}
}
func Close() {
	mu.Lock()
	if input != nil {
		_ = input.Close()
	}
	mu.Unlock()
}
