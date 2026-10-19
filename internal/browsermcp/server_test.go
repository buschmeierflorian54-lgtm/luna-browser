package browsermcp

import (
	"browser-mac/internal/secret"
	"context"
	"encoding/json"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type testAuth struct {
	base  http.RoundTripper
	token string
}

func (t testAuth) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Host = Address
	r.Header.Set("Authorization", "Bearer "+t.token)
	return t.base.RoundTrip(r)
}
func TestMCPProtocolAndValidation(t *testing.T) {
	var calls atomic.Int32
	s := NewServer(func(ctx context.Context, name string, args map[string]any) (any, error) {
		calls.Add(1)
		return map[string]any{"tool": name, "ready": true}, nil
	})
	h := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return s }, &mcp.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	server := httptest.NewServer(Protect("test-token", h))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{Endpoint: server.URL + "/mcp", HTTPClient: &http.Client{Transport: testAuth{http.DefaultTransport, "test-token"}}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	list, err := session.ListTools(ctx, nil)
	if err != nil || len(list.Tools) != 17 {
		t.Fatalf("tools: %v %v", list, err)
	}

	for _, tool := range list.Tools {
		if !strings.Contains(tool.Description, "Beispiel:") {
			t.Errorf("missing example: %s", tool.Name)
		}
		if !json.Valid([]byte(toolExamples[tool.Name])) {
			t.Errorf("invalid example: %s", tool.Name)
		}
		raw, _ := json.Marshal(tool.InputSchema)
		var schema struct {
			Properties map[string]struct {
				Description string `json:"description"`
			} `json:"properties"`
		}
		json.Unmarshal(raw, &schema)
		for field, prop := range schema.Properties {
			if prop.Description == "" {
				t.Errorf("missing parameter help: %s.%s", tool.Name, field)
			}
		}
	}
	r, err := session.CallTool(ctx, &mcp.CallToolParams{Name: "browser_state", Arguments: map[string]any{}})
	if err != nil || r.IsError {
		t.Fatal("state", r, err)
	}
	r, err = session.CallTool(ctx, &mcp.CallToolParams{Name: "browser_customize", Arguments: map[string]any{"theme": "invalid"}})
	if err != nil || !r.IsError || calls.Load() != 1 {
		t.Fatal("invalid schema reached dispatcher", r, err, calls.Load())
	}
	r, err = session.CallTool(ctx, &mcp.CallToolParams{Name: "browser_tab", Arguments: map[string]any{"action": "open", "execute": "rm"}})
	if err != nil || !r.IsError || calls.Load() != 1 {
		t.Fatal("extra properties allowed", r, err)
	}
	for _, args := range []map[string]any{{"colors": map[string]any{"accent": "#123456"}}, {"color_theme": "custom"}, {"color_theme": "#ff0000"}} {
		r, err = session.CallTool(ctx, &mcp.CallToolParams{Name: "browser_customize", Arguments: args})
		if err != nil || !r.IsError || calls.Load() != 1 {
			t.Fatal("custom colors reached dispatcher", r, err)
		}
	}
	for _, id := range []string{"luna", "lavender", "ocean", "mint", "forest", "sand", "peach", "cherry", "arctic", "graphite"} {
		r, err = session.CallTool(ctx, &mcp.CallToolParams{Name: "browser_customize", Arguments: map[string]any{"color_theme": id}})
		if err != nil || r.IsError {
			t.Fatal("built-in palette rejected", id, r, err)
		}
	}

}
func TestLocalAuth(t *testing.T) {
	handler := Protect("test-token", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	for _, tc := range []struct {
		host, origin, auth string
		want               int
	}{{Address, "", "Bearer test-token", 204}, {Address, "", "", 401}, {"evil.example", "", "Bearer test-token", 403}, {Address, "http://evil.example", "Bearer test-token", 403}} {
		r := httptest.NewRequest("POST", Endpoint, strings.NewReader(`{}`))
		r.Host = tc.host
		r.Header.Set("Origin", tc.origin)
		r.Header.Set("Authorization", tc.auth)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Fatal(tc, w.Code)
		}
	}
}
func TestLifecycle(t *testing.T) {
	dir := t.TempDir()
	m := New(secret.New(dir), func(context.Context, string, map[string]any) (any, error) { return nil, nil })
	defer m.Close()
	if m.Status().Running || m.Status().Enabled {
		t.Fatal("enabled by default")
	}
	if err := m.Configure(true); err != nil {
		t.Fatal(err)
	}
	if !m.Status().Running {
		t.Fatal("not started")
	}
	info, err := os.Stat(filepath.Join(dir, configFile))
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("unsafe file permissions", err)
	}
	if err := m.Configure(false); err != nil {
		t.Fatal(err)
	}
	if m.Status().Running || m.Status().Enabled {
		t.Fatal("not stopped")
	}
	if err := m.Configure(true); err != nil {
		t.Fatal("restart", err)
	}
}
func TestSetupDoesNotIncludeSecrets(t *testing.T) {
	p := SetupPrompt("/Applications/Luna Browser.app/Contents/MacOS/browser-mac")
	if !strings.Contains(p, "--mcp") || strings.Contains(p, "{{CONFIG}}") || strings.Contains(p, "Bearer ") {
		t.Fatal(p)
	}
}
