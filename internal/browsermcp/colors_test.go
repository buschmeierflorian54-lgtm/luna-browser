package browsermcp

import (
	"context"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"testing"
)

func TestColorNamesSelectExistingThemes(t *testing.T) {
	ctx := context.Background()
	calls := 0
	got := ""
	server := NewServer(func(_ context.Context, _ string, args map[string]any) (any, error) {
		calls++
		got, _ = args["color_theme"].(string)
		if _, ok := args["color"]; ok {
			t.Error("alias not translated")
		}
		return args, nil
	})
	st, ct := mcp.NewInMemoryTransports()
	ss, err := server.Connect(ctx, st, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ss.Close()
	cs, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, ct, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cs.Close()
	for color, id := range colorNames {
		r, e := cs.CallTool(ctx, &mcp.CallToolParams{Name: "browser_customize", Arguments: map[string]any{"color": color}})
		if e != nil || r.IsError || got != id {
			t.Fatal(color, id, got, r, e)
		}
	}
	before := calls
	r, e := cs.CallTool(ctx, &mcp.CallToolParams{Name: "browser_customize", Arguments: map[string]any{"show_color_picker": true}})
	if e != nil || r.IsError || calls != before {
		t.Fatal("picker changed settings", r, e)
	}

	for _, args := range []map[string]any{{"color": "#ff0000"}, {"color": "blau", "color_theme": "mint"}, {"color": "blau", "reset_colors": true}} {
		r, e := cs.CallTool(ctx, &mcp.CallToolParams{Name: "browser_customize", Arguments: args})
		if e != nil || !r.IsError || calls != before {
			t.Fatal("invalid color executed", r, e)
		}
	}
}
