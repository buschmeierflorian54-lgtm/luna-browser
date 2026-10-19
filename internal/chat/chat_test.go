package chat

import (
	"browser-mac/internal/secret"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestStreamContract(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("missing auth")
		}
		var req struct {
			Model    string    `json:"model"`
			Max      int       `json:"max_tokens"`
			Stream   bool      `json:"stream"`
			Messages []Message `json:"messages"`
		}
		if json.NewDecoder(r.Body).Decode(&req) != nil {
			t.Error("bad JSON")
		}
		if req.Messages[0].Provider != "" || req.Messages[0].Model != "" {
			t.Error("local provenance sent to provider")
		}
		if req.Model != Model || req.Max != 30000 || !req.Stream || req.Messages[0].Content != "Hallo" {
			t.Error("request contract", req)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, ": OPENROUTER PROCESSING\n\ndata: {\ndata: \"choices\":[{\"delta\":{\"content\":\"Grüße 🌙\"}}]\ndata: }\n\ndata: {\"choices\":[{\"delta\":{\"content\":\" aus Luna\"},\"finish_reason\":\"length\"}]}\n\ndata: {\"usage\":{\"completion_tokens\":30000},\"choices\":[]}\n\ndata: [DONE]\n\n")
	}))
	defer srv.Close()
	c := NewClient()
	c.Endpoint = srv.URL
	var text string
	finish, err := c.Stream(context.Background(), "test-key", []Message{{Role: "user", Content: "Hallo", Provider: "apple", Model: "apple-local"}}, func(s string) { text += s })
	if err != nil || finish != "length" || text != "Grüße 🌙 aus Luna" {
		t.Fatal(text, finish, err)
	}
}
func TestStreamFailures(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		status     int
	}{{"credits", "secret must not be echoed", 402}, {"auth", "secret must not be echoed", 401}, {"midstream", "data: {\"error\":{\"message\":\"secret must not be echoed\"}}\n\n", 200}, {"truncated", "data: {\"choices\":[{\"delta\":{\"content\":\"Partial\"}}]}\n\n", 200}, {"empty", "data: [DONE]\n\n", 200}} {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(tc.status); fmt.Fprint(w, tc.body) }))
			defer srv.Close()
			c := NewClient()
			c.Endpoint = srv.URL
			_, err := c.Stream(context.Background(), "test-key", nil, func(string) {})
			if err == nil || strings.Contains(err.Error(), "secret must") {
				t.Fatal("unsafe or missing error", err)
			}
		})
	}
}
func waitDone(t *testing.T, s *Service, id string) Conversation {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		c, e := s.Get(id)
		if e != nil {
			t.Fatal(e)
		}
		if c.Status != "streaming" {
			return c
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("chat did not finish")
	return Conversation{}
}
func TestServiceHistoryAndCancel(t *testing.T) {
	dir := t.TempDir()
	keys := secret.New(dir)
	if err := keys.Set(KeyName, "fake-key"); err != nil {
		t.Fatal(err)
	}
	s := New(dir, keys, nil)
	defer s.Close()
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Antwort\"}}]}\n\n")
		w.(http.Flusher).Flush()
		if calls == 1 {
			fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
		} else {
			<-r.Context().Done()
		}
	}))
	defer srv.Close()
	s.client.Endpoint = srv.URL
	c, err := s.Create()
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Send(context.Background(), c.ID, "Meine Idee"); err != nil {
		t.Fatal(err)
	}
	done := waitDone(t, s, c.ID)
	if done.Status != "done" || len(done.Messages) != 2 || done.Messages[1].Content != "Antwort" {
		t.Fatal(done)
	}
	restored := New(dir, keys, nil)
	defer restored.Close()
	saved, _ := restored.Get(c.ID)
	if saved.Title != "Meine Idee" || len(saved.Messages) != 2 {
		t.Fatal(saved)
	}
	info, _ := os.Stat(filepath.Join(dir, "chats.json"))
	if info.Mode().Perm() != 0600 {
		t.Fatal("unsafe permissions")
	}
	if _, err = s.Send(context.Background(), c.ID, "Noch eine Frage"); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Send(context.Background(), c.ID, "Doppelt"); err == nil {
		t.Fatal("duplicate generation accepted")
	}
	if err = s.Delete(c.ID); err == nil {
		t.Fatal("deleted running conversation")
	}
	_ = s.Cancel(c.ID)
	done = waitDone(t, s, c.ID)
	if done.Status != "stopped" {
		t.Fatal(done.Status, done.Error)
	}
	if err = s.Delete(c.ID); err != nil {
		t.Fatal(err)
	}
	list, _ := s.List()
	if len(list) != 0 {
		t.Fatal(list)
	}
}
func TestNoKeyAndCorruptHistory(t *testing.T) {
	dir := t.TempDir()
	keys := secret.New(dir)
	s := New(dir, keys, nil)
	defer s.Close()
	c, _ := s.Create()
	if _, err := s.Send(context.Background(), c.ID, "Hi"); err == nil {
		t.Fatal("allowed missing key")
	}
	c, _ = s.Get(c.ID)
	if len(c.Messages) != 0 {
		t.Fatal("mutated on validation failure")
	}
	_ = os.WriteFile(filepath.Join(dir, "chats.json"), []byte("corrupt"), 0600)
	bad := New(dir, keys, nil)
	defer bad.Close()
	if _, err := bad.Create(); err == nil {
		t.Fatal("overwrote corrupt data")
	}
	raw, _ := os.ReadFile(filepath.Join(dir, "chats.json"))
	if string(raw) != "corrupt" {
		t.Fatal("data overwritten")
	}
}

func TestBrowserToolRoundTrip(t *testing.T) {
	dir := t.TempDir()
	keys := secret.New(dir)
	keys.Set(KeyName, "fake-key")
	s := New(dir, keys, nil)
	defer s.Close()
	dispatched := make(chan string, 4)
	s.ToolFactory = func(ctx context.Context) (*BrowserTools, error) {
		return ConnectTools(ctx, func(ctx context.Context, name string, args map[string]any) (any, error) {
			dispatched <- name
			return map[string]any{"active_tab": 7}, nil
		})
	}
	count := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count++
		var req struct {
			Messages []Message        `json:"messages"`
			Tools    []map[string]any `json:"tools"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if len(req.Tools) < 10 {
			t.Error("MCP tools missing", len(req.Tools))
		}
		w.Header().Set("Content-Type", "text/event-stream")
		if count == 1 {
			fmt.Fprint(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"browser_","arguments":"{"}}]}}]}`+"\n\n")
			fmt.Fprint(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"state","arguments":"}"}}]},"finish_reason":"tool_calls"}]}`+"\n\ndata: [DONE]\n\n")
		} else {
			last := req.Messages[len(req.Messages)-1]
			if last.Role != "tool" || last.ToolCallID != "call_1" || !strings.Contains(last.Content, "active_tab") {
				t.Error("tool response missing", last)
			}
			fmt.Fprint(w, `data: {"choices":[{"delta":{"content":"Tab 7 ist aktiv."},"finish_reason":"stop"}]}`+"\n\ndata: [DONE]\n\n")
		}
	}))
	defer srv.Close()
	s.client.Endpoint = srv.URL
	c, _ := s.Create()
	s.Send(context.Background(), c.ID, "Was ist offen?")
	done := waitDone(t, s, c.ID)
	if done.Status != "done" || len(done.Messages) != 4 || done.Messages[3].Content != "Tab 7 ist aktiv." {
		t.Fatal(done)
	}
	select {
	case name := <-dispatched:
		if name != "browser_state" {
			t.Fatal(name)
		}
	default:
		t.Fatal("not dispatched")
	}
	restored := New(dir, keys, nil)
	defer restored.Close()
	saved, _ := restored.Get(c.ID)
	if len(saved.Messages[1].ToolCalls) != 1 || saved.Messages[2].ToolCallID != "call_1" {
		t.Fatal("lost protocol history")
	}
}
func TestBrowserToolsValidateAndCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	dispatched := false
	b, err := ConnectTools(ctx, func(ctx context.Context, name string, args map[string]any) (any, error) {
		dispatched = true
		return nil, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	call := ToolCall{ID: "bad", Type: "function"}
	call.Function.Name = "browser_state"
	call.Function.Arguments = `{"unknown":true}`
	if result := b.Call(ctx, call); !strings.Contains(result, "isError") || dispatched {
		t.Fatal(result, dispatched)
	}
	call.Function.Arguments = `{}`
	cancel()
	if result := b.Call(ctx, call); !strings.Contains(result, "isError") || dispatched {
		t.Fatal("cancel allowed dispatch", result)
	}
}

func TestMessageOriginSurvivesReload(t *testing.T) {
	dir := t.TempDir()
	keys := secret.New(t.TempDir())
	s := New(dir, keys, nil)
	c, err := s.Create()
	if err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	s.chats[c.ID].Messages = []Message{{Role: "assistant", Content: "Hallo", Provider: "apple", Model: "apple-local"}, {Role: "assistant", Content: "Hi", Provider: "groq", Model: "test"}}
	err = s.persistLocked()
	s.mu.Unlock()
	s.Close()
	if err != nil {
		t.Fatal(err)
	}
	restored := New(dir, keys, nil)
	defer restored.Close()
	got, err := restored.Get(c.ID)
	if err != nil || got.Messages[0].Provider != "apple" || got.Messages[0].Model != "apple-local" || got.Messages[1].Provider != "groq" {
		t.Fatal(got, err)
	}
}
