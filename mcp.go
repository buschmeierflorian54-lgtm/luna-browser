package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"

	"browser-mac/internal/browsermcp"
	"browser-mac/internal/web"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	wr "github.com/wailsapp/wails/v2/pkg/runtime"
)

type mcpResponse struct {
	value json.RawMessage
	err   string
}
type mcpPending struct {
	ctx context.Context
	ch  chan mcpResponse
}
type mcpBridge struct {
	mu      sync.Mutex
	next    atomic.Uint64
	pending map[string]mcpPending
}

func (a *App) MCPStatus() browsermcp.Status { return a.mcpServer.Status() }
func (a *App) MCPConfigure(on bool) (browsermcp.Status, error) {
	err := a.mcpServer.Configure(on)
	return a.mcpServer.Status(), err
}
func (a *App) MCPCopySetup() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	return wr.ClipboardSetText(a.ctx, browsermcp.SetupPrompt(exe))
}
func (a *App) MCPSetupPrompt() string { exe, _ := os.Executable(); return browsermcp.SetupPrompt(exe) }
func (a *App) MCPCommandActive(id string) bool {
	a.mcpBridge.mu.Lock()
	defer a.mcpBridge.mu.Unlock()
	p, ok := a.mcpBridge.pending[id]
	return ok && p.ctx.Err() == nil
}
func (a *App) MCPReply(id, result, message string) {
	a.mcpBridge.mu.Lock()
	p, ok := a.mcpBridge.pending[id]
	a.mcpBridge.mu.Unlock()
	if ok {
		select {
		case p.ch <- mcpResponse{json.RawMessage(result), message}:
		default:
		}
	}
}
func (a *App) mcpUI(ctx context.Context, name string, args map[string]any) (any, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	id := fmt.Sprint(a.mcpBridge.next.Add(1))
	ch := make(chan mcpResponse, 1)
	a.mcpBridge.mu.Lock()
	a.mcpBridge.pending[id] = mcpPending{ctx, ch}
	a.mcpBridge.mu.Unlock()
	defer func() { a.mcpBridge.mu.Lock(); delete(a.mcpBridge.pending, id); a.mcpBridge.mu.Unlock() }()
	event, _ := json.Marshal(map[string]any{"id": id, "name": name, "args": args})
	a.emit("mcp-command", string(event))
	select {
	case <-ctx.Done():
		return nil, errors.New("Browser nicht bereit oder MCP wurde deaktiviert. Aktion nicht automatisch wiederholen; Zustand zuerst prüfen.")
	case r := <-ch:
		if r.err != "" {
			return nil, errors.New(r.err)
		}
		var value any
		err := json.Unmarshal(r.value, &value)
		return value, err
	}
}
func (a *App) mcpDispatch(ctx context.Context, name string, args map[string]any) (any, error) {
	switch name {
	case "browser_spotify":
		action, _ := args["action"].(string)
		value, _ := args["value"].(float64)
		if action == "status" {
			return map[string]any{"player": a.SpotifyState(), "account": a.SpotifyAPIStatus()}, nil
		}
		if action == "play_uri" {
			uri, _ := args["uri"].(string)
			return map[string]bool{"ok": true}, a.SpotifyPlay(uri)
		}
		return map[string]bool{"ok": true}, a.SpotifyCommand(action, value)
	case "browser_sonos":
		if args["action"] == "status" {
			return a.SonosStatus(), nil
		}
		enabled, ok := args["enabled"].(bool)
		if !ok {
			return nil, errors.New("enabled ist erforderlich")
		}
		raw, ok := args["selected"].([]any)
		if !ok {
			return nil, errors.New("selected ist erforderlich")
		}
		ids := []string{}
		for _, id := range raw {
			v, ok := id.(string)
			if !ok {
				return nil, errors.New("Ungültige Geräte-ID")
			}
			ids = append(ids, v)
		}
		return a.SonosConfigure(enabled, ids)
	case "browser_screenshot":
		target, err := a.mcpUI(ctx, "capture_target", args)
		if err != nil {
			return nil, err
		}
		obj, ok := target.(map[string]any)
		if !ok {
			return nil, errors.New("Kein Aufnahmeziel")
		}
		id, ok := obj["id"].(float64)
		if !ok {
			return nil, errors.New("Ungültiges Aufnahmeziel")
		}
		b64, err := a.Screenshot(int(id))
		if err != nil {
			return nil, err
		}
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.ImageContent{Data: mustDecodeImage(b64), MIMEType: "image/jpeg"}}}, nil
	}
	return a.mcpUI(ctx, name, args)
}
func (a *App) MCPPage(tab int, params string) (any, error) {
	if len(params) > 65536 {
		return nil, errors.New("Anfrage zu groß")
	}
	var args map[string]any
	if json.Unmarshal([]byte(params), &args) != nil {
		return nil, errors.New("Ungültige Parameter")
	}
	action, _ := args["action"].(string)
	switch action {
	case "read", "click", "fill", "select", "scroll":
	default:
		return nil, errors.New("Ungültige Aktion")
	}
	payload, _ := json.Marshal(args)
	script := strings.Replace(pageControl, "export function", "function", 1) + "\nJSON.stringify(lunaPageAction(" + string(payload) + "));"
	result, err := web.Evaluate(tab, script)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err = json.Unmarshal([]byte(result), &out); err != nil {
		return nil, err
	}
	if message, ok := out["error"].(string); ok {
		return nil, errors.New(message)
	}
	return out, nil
}

func mustDecodeImage(s string) []byte { b, _ := base64.StdEncoding.DecodeString(s); return b }
