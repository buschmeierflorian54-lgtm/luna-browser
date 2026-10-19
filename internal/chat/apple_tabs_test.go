package chat

import "testing"

func TestSiraTabCommands(t *testing.T) {
	defs := map[string]string{"browser_tab": `{"parameters":{"type":"object","properties":{"action":{"type":"string"},"domain":{"type":"string"},"url":{"type":"string"},"tab_id":{"type":"integer"},"zoom":{"type":"number"}},"required":["action"],"additionalProperties":false}}`, "browser_state": `{"parameters":{"type":"object","properties":{}}}`}
	for command, want := range map[string]string{"tab open youtube.com": `{"action":"open","url":"https://youtube.com"}`, "tab close youtube.com": `{"action":"close","domain":"youtube.com"}`, "tab close https://www.youtube.com/watch?v=1": `{"action":"close","domain":"youtube.com"}`, "tab close": `{"action":"close"}`, "tab activate 3": `{"action":"activate","tab_id":3}`, "tab navigate example.com 2": `{"action":"navigate","tab_id":2,"url":"https://example.com"}`, "tab zoom 125%": `{"action":"zoom","zoom":1.25}`, "tab list": `{}`} {
		call, ok, err := siraTabCommand(command, defs)
		if err != nil || !ok || call.Function.Arguments != want {
			t.Fatal(command, call, err)
		}
	}
	for _, command := range []string{"tab close all", "tab open javascript:alert(1)", "tab activate abc", "tab close 2\ntab close 3", "tab zoom 301", "tab navigate", "tab unknown"} {
		if _, ok, err := siraTabCommand(command, defs); !ok || err == nil {
			t.Fatal(command)
		}
	}
	if _, _, err := siraTabCommand("tab close", nil); err == nil {
		t.Fatal("gate bypass")
	}
	if _, ok, _ := siraTabCommand("Benutze tab close", defs); ok {
		t.Fatal("prose interpreted")
	}
}
