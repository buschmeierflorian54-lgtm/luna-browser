package chat

import (
	"testing"
)

func TestSiraTextProtocol(t *testing.T) {
	allowed := map[string]bool{"browser_customize": true}
	for _, tc := range []struct {
		text       string
		call, fail bool
	}{
		{"Hallo, ich bin Sira.", false, false},
		{"Theme Widget", false, false},
		{`browser_customize {"color":"blau"}`, true, false},
		{`browser_state {}`, false, true},
		{`browser_customize {"color":"blau"} erledigt`, false, true},
		{"SIRA_TOOL\n{\"tool\":\"browser_customize\",\"arguments\":{\"color\":\"blau\"}}\nEND_SIRA_TOOL", true, false},
		{"Hier ein Beispiel: SIRA_TOOL\n{}\nEND_SIRA_TOOL", false, true},
		{"SIRA_TOOL\n{\"tool\":\"browser_customize\",\"arguments\":\"{}\"}\nEND_SIRA_TOOL", false, true},
		{"SIRA_TOOL\n{\"tool\":\"browser_customize\",\"arguments\":{}}", false, true},
		{"SIRA_TOOL\n{\"tool\":\"shell\",\"arguments\":{}}\nEND_SIRA_TOOL", false, true},
		{"SIRA_TOOL\n{\"tool\":\"browser_customize\",\"arguments\":{},\"extra\":true}\nEND_SIRA_TOOL", false, true},
	} {
		call, err := parseSiraText(tc.text, allowed)
		if (call != nil) != tc.call || (err != nil) != tc.fail {
			t.Fatalf("%q: %+v %v", tc.text, call, err)
		}
	}
	if _, err := parseSiraText("SIRA_TOOL\n{\"tool\":\"browser_customize\",\"arguments\":{}}\nEND_SIRA_TOOL", nil); err == nil {
		t.Fatal("disabled tool accepted")
	}
}
