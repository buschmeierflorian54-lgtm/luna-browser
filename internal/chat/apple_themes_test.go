package chat

import (
	"strings"
	"testing"
)

func TestSiraThemeShortcuts(t *testing.T) {
	defs := map[string]string{"browser_state": `{"parameters":{"type":"object","properties":{}}}`, "browser_customize": `{"parameters":{"type":"object","properties":{"color_theme":{"type":"string","enum":["ocean"]}},"additionalProperties":false}}`}
	call, ok, err := siraThemeCommand("farbe optionen", defs)
	if err != nil || !ok || call.Function.Name != "browser_state" {
		t.Fatal(call, ok, err)
	}
	messages := []Message{{Role: "user", Content: "Mach blau"}, {Role: "assistant", ToolCalls: []ToolCall{*call}}, {Role: "tool", ToolCallID: call.ID, Content: `{"content":[{"text":"{}"}]}`}}
	if hint := siraFollowup(messages); !strings.Contains(hint, "Ozean (blau)") || !strings.Contains(hint, "themeselect") {
		t.Fatal(hint)
	}
	for _, command := range []string{"themeselect Ozean", "themeselect (Ozean)"} {
		call, ok, err = siraThemeCommand(command, defs)
		if err != nil || !ok || call.Function.Arguments != `{"color_theme":"ocean"}` {
			t.Fatal(call, ok, err)
		}
	}
	if _, _, err = siraThemeCommand("themeselect Neon", defs); err == nil {
		t.Fatal("unknown theme accepted")
	}
	if _, _, err = siraThemeCommand("themeselect Ozean", nil); err == nil {
		t.Fatal("gate bypassed")
	}
	if _, ok, _ = siraThemeCommand("Ich erkläre themeselect Ozean.", defs); ok {
		t.Fatal("prose interpreted")
	}
}
