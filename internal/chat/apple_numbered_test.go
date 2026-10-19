package chat

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestSiraNumberedParameterDialogue(t *testing.T) {
	defs := []map[string]any{{"function": map[string]any{"name": "browser_customize", "description": "Farbe wählen", "parameters": map[string]any{"type": "object", "properties": map[string]any{"color": map[string]any{"type": "string", "enum": []string{"blau", "grün"}}}, "required": []string{"color"}, "additionalProperties": false}}}}
	responses := []string{"6", `{"color":"ungültig"}`, `{"color":"blau"}`}
	index := 0
	c := NewClient()
	c.Apple = true
	c.appleRespond = func(ctx context.Context, r map[string]any) (string, error) {
		if index == 0 && !strings.Contains(r["catalog"].(string), "6: browser_customize") {
			t.Fatal("number missing")
		}
		if index == 2 && !strings.Contains(r["feedback"].(string), "abgelehnt") {
			t.Fatal("no rejection feedback")
		}
		if index == 3 && r["accepted"] != `{"color":"blau"}` {
			t.Fatal(r)
		}
		if index >= len(responses) {
			t.Fatal("unexpected request")
		}
		answer := responses[index]
		index++
		return answer, nil
	}
	var text strings.Builder
	finish, calls, err := c.StreamTools(context.Background(), "", []Message{{Role: "system"}, {Role: "user", Content: "blau"}}, defs, func(s string) { text.WriteString(s) })
	if err != nil || finish != "tool_calls" || len(calls) != 1 || calls[0].Function.Arguments != `{"color":"blau"}` || text.Len() != 0 || index != 3 || len(calls[0].Trace) < 4 {
		t.Fatal(finish, calls, err, text.String())
	}
}
func TestSiraNumberedBoundaries(t *testing.T) {
	for _, response := range []string{"999", "6", "browser_customize {}"} {
		c := NewClient()
		c.Apple = true
		c.appleRespond = func(context.Context, map[string]any) (string, error) { return response, nil }
		_, calls, err := c.StreamTools(context.Background(), "", []Message{{Role: "system"}, {Role: "user", Content: "blau"}}, nil, func(string) { t.Fatal("technical output displayed") })
		if err == nil || len(calls) > 0 {
			t.Fatal(response, calls, err)
		}
	}
	c := NewClient()
	c.Apple = true
	c.appleRespond = func(context.Context, map[string]any) (string, error) { return "Hallo, ich bin Sira.", nil }
	var output string
	_, calls, err := c.StreamTools(context.Background(), "", []Message{{Role: "system"}, {Role: "user", Content: "Hallo"}}, nil, func(s string) { output += s })
	if err != nil || len(calls) > 0 || output != "Hallo, ich bin Sira." {
		t.Fatal(calls, err, output)
	}
	c.appleRespond = func(ctx context.Context, _ map[string]any) (string, error) { return "", ctx.Err() }
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, calls, err = c.StreamTools(ctx, "", []Message{{Role: "system"}, {Role: "user", Content: "blau"}}, nil, func(string) { t.Fatal("cancel output") })
	if !errors.Is(err, context.Canceled) || len(calls) > 0 {
		t.Fatal(calls, err)
	}
}

func TestSiraCollectsParametersSeparately(t *testing.T) {
	defs := []map[string]any{{"function": map[string]any{"name": "browser_tab", "parameters": map[string]any{"type": "object", "properties": map[string]any{"action": map[string]any{"type": "string", "enum": []string{"open"}}, "url": map[string]any{"type": "string"}}, "required": []string{"action", "url"}, "additionalProperties": false}}}}
	replies := []string{"2", `{"action":"open"}`, "url", `{"url":"https://example.com"}`, "FERTIG"}
	index := 0
	c := NewClient()
	c.Apple = true
	c.appleRespond = func(_ context.Context, r map[string]any) (string, error) {
		if index >= len(replies) {
			t.Fatal("extra round")
		}
		out := replies[index]
		index++
		return out, nil
	}
	_, calls, err := c.StreamTools(context.Background(), "", []Message{{Role: "system"}, {Role: "user", Content: "Öffne example.com"}}, defs, func(string) { t.Fatal("technical text leaked") })
	if err != nil || len(calls) != 1 || index != len(replies) || calls[0].Function.Arguments != `{"action":"open","url":"https://example.com"}` {
		t.Fatal(calls, err, index)
	}
}

func TestSiraToolNumberInAnswer(t *testing.T) {
	for _, response := range []string{"14", "ANTWORT: 14", "ANTWORT: \n14\n"} {
		t.Run(response, func(t *testing.T) {
			c := NewClient()
			c.Apple = true
			c.appleRespond = func(context.Context, map[string]any) (string, error) { return response, nil }
			defs := []map[string]any{{"function": map[string]any{"name": "browser_play_song", "parameters": map[string]any{"type": "object", "properties": map[string]any{}}}}}
			_, calls, err := c.StreamTools(context.Background(), "", []Message{{Role: "system"}, {Role: "user", Content: "Spiele Musik"}}, defs, func(string) { t.Fatal("tool number leaked into chat") })
			if err != nil || len(calls) != 1 || calls[0].Function.Name != "browser_play_song" {
				t.Fatal(calls, err)
			}
		})
	}
	for _, response := range []string{"ANTWORT: Es sind 14 Tabs.", "ANTWORT: Das Ergebnis ist 14."} {
		c := NewClient()
		c.Apple = true
		c.appleRespond = func(context.Context, map[string]any) (string, error) { return response, nil }
		var output string
		_, calls, err := c.StreamTools(context.Background(), "", []Message{{Role: "system"}, {Role: "user", Content: "Wie viele?"}}, nil, func(s string) { output += s })
		if err != nil || len(calls) != 0 || output != strings.TrimPrefix(response, "ANTWORT: ") {
			t.Fatal(calls, err, output)
		}
	}
}

func TestSiraPlayShortcut(t *testing.T) {
	defs := []map[string]any{{"function": map[string]any{"name": "browser_play_song", "parameters": map[string]any{"type": "object", "properties": map[string]any{"song": map[string]any{"type": "string", "minLength": 1, "maxLength": 240}}, "required": []string{"song"}}}}}
	for _, response := range []string{"play Applaus Applaus Sportfreunde Stiller", "ANTWORT: play Applaus Applaus Sportfreunde Stiller"} {
		c := NewClient()
		c.Apple = true
		c.appleRespond = func(context.Context, map[string]any) (string, error) { return response, nil }
		_, calls, err := c.StreamTools(context.Background(), "", []Message{{Role: "system"}, {Role: "user", Content: "Spiele Applaus Applaus"}}, defs, func(string) { t.Fatal("command leaked") })
		if err != nil || len(calls) != 1 || calls[0].Function.Name != "browser_play_song" || calls[0].Function.Arguments != `{"song":"Applaus Applaus Sportfreunde Stiller"}` {
			t.Fatal(calls, err)
		}
		_, calls, err = c.StreamTools(context.Background(), "", []Message{{Role: "system"}, {Role: "user", Content: "Musik"}}, nil, func(string) { t.Fatal("disabled command leaked") })
		if err == nil || len(calls) != 0 {
			t.Fatal("tool gate bypassed")
		}
	}
	for _, response := range []string{"play", "play Song\nErklärung", "play " + strings.Repeat("a", 241)} {
		c := NewClient()
		c.Apple = true
		c.appleRespond = func(context.Context, map[string]any) (string, error) { return response, nil }
		_, calls, err := c.StreamTools(context.Background(), "", []Message{{Role: "system"}, {Role: "user", Content: "Musik"}}, defs, func(string) { t.Fatal("invalid command leaked") })
		if err == nil || len(calls) != 0 {
			t.Fatal(response, calls, err)
		}
	}
}
