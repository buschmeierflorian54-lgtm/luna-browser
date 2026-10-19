package chat

import (
	"browser-mac/internal/browsermcp"
	"context"
	"encoding/json"
	"errors"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"time"
)

type ToolFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}
type ToolCall struct {
	Trace    []string     `json:"trace,omitempty"`
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Function ToolFunction `json:"function"`
}
type BrowserTools struct {
	session     *mcp.ClientSession
	server      *mcp.ServerSession
	Definitions []map[string]any
}

func ConnectTools(ctx context.Context, dispatch browsermcp.Dispatch) (*BrowserTools, error) {
	st, ct := mcp.NewInMemoryTransports()
	server, err := browsermcp.NewServer(dispatch).Connect(ctx, st, nil)
	if err != nil {
		return nil, err
	}
	session, err := mcp.NewClient(&mcp.Implementation{Name: "luna-chat", Version: "1.0.0"}, nil).Connect(ctx, ct, nil)
	if err != nil {
		server.Close()
		return nil, err
	}
	b := &BrowserTools{session: session, server: server}
	for t, err := range session.Tools(ctx, nil) {
		if err != nil {
			b.Close()
			return nil, err
		}
		b.Definitions = append(b.Definitions, map[string]any{"type": "function", "function": map[string]any{"name": t.Name, "description": t.Description, "parameters": t.InputSchema}})
	}
	return b, nil
}
func (b *BrowserTools) Close() { b.session.Close(); b.server.Close() }
func (b *BrowserTools) Call(ctx context.Context, call ToolCall) string {
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	if ctx.Err() != nil {
		return `{"isError":true,"error":"Cancelled before execution"}`
	}
	var args map[string]any
	if json.Unmarshal([]byte(call.Function.Arguments), &args) != nil || args == nil {
		return `{"isError":true,"error":"Invalid JSON arguments"}`
	}
	result, err := b.session.CallTool(ctx, &mcp.CallToolParams{Name: call.Function.Name, Arguments: args})
	if err != nil {
		raw, _ := json.Marshal(map[string]any{"isError": true, "error": err.Error()})
		return string(raw)
	}
	// Keep binary payloads out of the text context. Capture metadata remains available.
	for i, c := range result.Content {
		if _, ok := c.(*mcp.ImageContent); ok {
			result.Content[i] = &mcp.TextContent{Text: "Screenshot captured. Image pixels are not included in this text tool result."}
		}
	}
	raw, err := json.Marshal(result)
	if err != nil {
		return errors.New("Tool result could not be encoded").Error()
	}
	if len(raw) > 100000 {
		return `{"isError":true,"error":"Result too large. Request a smaller page section or fewer items."}`
	}
	return string(raw)
}
