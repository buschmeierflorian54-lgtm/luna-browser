package chat

import (
	"strings"
	"testing"
)

func TestSiraFollowup(t *testing.T) {
	call := ToolCall{ID: "call1"}
	call.Function.Name = "browser_customize"
	call.Function.Arguments = `{"color":"rot"}`
	messages := []Message{{Role: "user", Content: "Mach blau"}, {Role: "assistant", ToolCalls: []ToolCall{call}}, {Role: "tool", ToolCallID: "call1", Content: `{"content":[{"text":"{\"color_theme\":\"ocean\"}"}]}`}}
	if got := siraFollowup(messages); !strings.Contains(got, "auf Blau gestellt") || strings.Contains(got, "auf Rot gestellt") {
		t.Fatal(got)
	}
	messages[2].Content = `{"isError":true,"content":[{"text":"failed"}]}`
	if got := siraFollowup(messages); !strings.Contains(got, "fehlgeschlagen") || strings.Contains(got, "gestellt") {
		t.Fatal(got)
	}
	messages[2].Content = `{"content":[{"text":"{}"}]}`
	messages[1].ToolCalls[0].Function.Arguments = `{"show_color_picker":true}`
	if got := siraFollowup(messages); !strings.Contains(got, "keine Farbe geändert") {
		t.Fatal(got)
	}
	messages = append(messages, Message{Role: "user", Content: "Hallo"})
	if got := siraFollowup(messages); got != "" {
		t.Fatal(got)
	}
}
