package chat

import (
	"browser-mac/internal/secret"
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestAppleSlotAndAvailability(t *testing.T) {
	old := appleProbe
	defer func() { appleProbe = old }()
	appleProbe = func() AppleStatus { return AppleStatus{Available: true, Reason: "ready"} }
	s := New(t.TempDir(), secret.New(t.TempDir()), nil)
	defer s.Close()
	c, err := s.SelectModel(2)
	if err != nil || !c.Configured || c.Model != "apple-local" || len(c.Favorites) != 0 {
		t.Fatal(c, err)
	}
	m, key, err := s.requestConfig()
	if err != nil || m.Provider != "apple" || key != "" {
		t.Fatal(m, key, err)
	}
	if _, err = s.SaveModel(2, "groq", "other"); err == nil {
		t.Fatal("local slot overwritten")
	}
	s2 := New(s.dir, s.secrets, nil)
	defer s2.Close()
	c, _ = s2.Config()
	if c.Selected != 2 {
		t.Fatal("selection lost")
	}
	appleProbe = func() AppleStatus { return AppleStatus{Reason: "disabled"} }
	c, _ = s.Config()
	if c.Configured {
		t.Fatal("unavailable still configured")
	}
	if _, err = s.SelectModel(2); err == nil {
		t.Fatal("unavailable selected")
	}
	if _, _, err = s.requestConfig(); err == nil {
		t.Fatal("unavailable request accepted")
	}
}
func TestAppleContextKeepsCurrentRequest(t *testing.T) {
	current := "Meine aktuelle Frage"
	messages := []Message{{Role: "system", Content: "system"}, {Role: "user", Content: strings.Repeat("old", 10000)}, {Role: "assistant", Content: "old response"}, {Role: "user", Content: current}}
	prompt, short, err := applePrompt(messages)
	if err != nil || !short || !strings.Contains(prompt, current) || len(prompt) > 7500 {
		t.Fatal(short, err, len(prompt))
	}
	if len(messages[1].Content) != 30000 {
		t.Fatal("stored history changed")
	}
	_, _, err = applePrompt([]Message{{Role: "system"}, {Role: "user", Content: strings.Repeat("a", 5001)}})
	if err == nil {
		t.Fatal("oversized user message accepted")
	}
}

// Opt-in native integration: no cloud requests and no browser side effects.
func TestAppleNative(t *testing.T) {
	path := os.Getenv("LUNA_TEST_APPLE_HELPER")
	if path == "" {
		t.Skip("native helper not requested")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	browser, err := ConnectTools(ctx, func(context.Context, string, map[string]any) (any, error) {
		return map[string]any{"tabs": []any{}, "activeTabId": ""}, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	defer browser.Close()
	c := NewClient()
	c.Apple = true
	c.appleCommand = path
	messages := []Message{{Role: "system", Content: "Luna"}, {Role: "user", Content: "Prüfe mit browser_state den Browserstatus und sage mir, wie viele Tabs offen sind."}}
	var answer strings.Builder
	_, calls, err := c.StreamTools(ctx, "", messages, browser.Definitions, func(s string) { answer.WriteString(s) })
	if err != nil {
		t.Fatal(err)
	}
	if len(calls) == 1 && calls[0].Function.Name == "tool_details" {
		result := appleToolDetails(browser.Definitions, calls[0].Function.Arguments)
		messages = append(messages, Message{Role: "assistant", ToolCalls: calls}, Message{Role: "tool", ToolCallID: calls[0].ID, Content: result})
		_, calls, err = c.StreamTools(ctx, "", messages, browser.Definitions, func(s string) { answer.WriteString(s) })
		if err != nil {
			t.Fatal(err)
		}
	}
	if len(calls) != 1 || calls[0].Function.Name != "browser_state" {
		t.Fatalf("expected browser_state, got %+v / %s", calls, answer.String())
	}
	result := browser.Call(ctx, calls[0])
	messages = append(messages, Message{Role: "assistant", ToolCalls: calls}, Message{Role: "tool", Content: result, ToolCallID: calls[0].ID})
	answer.Reset()
	_, calls, err = c.StreamTools(ctx, "", messages, browser.Definitions, func(s string) { answer.WriteString(s) })
	if err != nil || len(calls) != 0 || answer.Len() == 0 {
		t.Fatalf("resume failed: calls=%+v answer=%s err=%v", calls, answer.String(), err)
	}
	t.Log(answer.String())
}

func TestAppleNativeColor(t *testing.T) {
	path := os.Getenv("LUNA_TEST_APPLE_HELPER")
	if path == "" {
		t.Skip("native helper not requested")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	got := ""
	browser, err := ConnectTools(ctx, func(_ context.Context, name string, args map[string]any) (any, error) {
		if name == "browser_customize" {
			got, _ = args["color_theme"].(string)
		}
		return args, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	defer browser.Close()
	c := NewClient()
	c.Apple = true
	c.appleCommand = path
	c.appleRespond = func(ctx context.Context, r map[string]any) (string, error) {
		base := *c
		base.appleRespond = nil
		out, e := base.appleExchange(ctx, r)
		t.Log("phase", r["phase"], "response", out)
		return out, e
	}

	_, calls, err := c.StreamTools(ctx, "", []Message{{Role: "system"}, {Role: "user", Content: "mach browser blua"}}, browser.Definitions, func(string) {})
	if err != nil || len(calls) != 1 || calls[0].Function.Name != "browser_customize" {
		t.Fatalf("color request: %+v %v", calls, err)
	}
	browser.Call(ctx, calls[0])
	if got != "ocean" {
		t.Fatalf("expected ocean, got %q, call=%+v", got, calls)
	}
}

func TestAppleNativeThemePicker(t *testing.T) {
	path := os.Getenv("LUNA_TEST_APPLE_HELPER")
	if path == "" {
		t.Skip("native helper not requested")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	browser, err := ConnectTools(ctx, func(context.Context, string, map[string]any) (any, error) {
		t.Error("picker must not modify browser")
		return nil, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	defer browser.Close()
	c := NewClient()
	c.Apple = true
	c.appleCommand = path
	var answer strings.Builder
	_, calls, err := c.StreamTools(ctx, "", []Message{{Role: "system"}, {Role: "user", Content: "Mach den Browser holografisch regenbogenfarben. Wenn es kein passendes Theme gibt, möchte ich selbst im Chat wählen."}}, browser.Definitions, func(s string) { answer.WriteString(s) })
	if err == nil && len(calls) == 0 && strings.Contains(strings.ToLower(answer.String()), "theme widget") {
		return
	}
	if err != nil || len(calls) != 1 || calls[0].Function.Name != "browser_customize" {
		t.Fatalf("picker request: %+v %v text=%s", calls, err, answer.String())
	}
	t.Logf("picker call: %+v", calls[0])
	result := browser.Call(ctx, calls[0])
	if !strings.Contains(result, `show_color_picker`) {
		t.Fatalf("picker missing: %s", result)
	}
}
