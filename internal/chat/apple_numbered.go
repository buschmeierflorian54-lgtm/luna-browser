package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Permanent numbers: append new tools, never renumber existing entries.
var siraToolNames = []string{"browser_state", "browser_tab", "browser_tab_group", "browser_tab_move", "browser_page", "browser_customize", "browser_gestures", "browser_settings", "browser_bookmarks", "browser_notes", "browser_history", "browser_downloads", "browser_search", "browser_play_song", "browser_spotify", "browser_sonos", "browser_screenshot"}

func (c *Client) streamApple(ctx context.Context, messages []Message, tools []map[string]any, delta func(string)) (string, []ToolCall, error) {
	prompt, shortened, err := applePrompt(messages)
	if err != nil {
		return "", nil, err
	}
	if shortened && c.OnResize != nil {
		c.OnResize("Sira nutzt für diese Anfrage einen gekürzten Verlauf. Der gespeicherte Chat bleibt vollständig.")
	}
	definitions := map[string]string{}
	catalog := []string{}
	byNumber := map[int]string{}
	for _, t := range tools {
		f, ok := t["function"].(map[string]any)
		if !ok {
			continue
		}
		name, _ := f["name"].(string)
		definitions[name] = mustJSON(f)
	}
	for i, name := range siraToolNames {
		if raw, ok := definitions[name]; ok {
			var f struct {
				Description string `json:"description"`
			}
			json.Unmarshal([]byte(raw), &f)
			desc := strings.SplitN(f.Description, ".", 2)[0]
			r := []rune(desc)
			if len(r) > 120 {
				desc = string(r[:120])
			}
			byNumber[i+1] = name
			catalog = append(catalog, fmt.Sprintf("%d: %s — %s", i+1, name, desc))
		}
	}
	request := map[string]any{"phase": "choose", "prompt": prompt, "catalog": strings.Join(catalog, "\n"), "followup": siraFollowup(messages)}
	response, err := c.appleExchange(ctx, request)
	if err != nil {
		return "", nil, err
	}
	response = strings.TrimSpace(response)
	// A misplaced answer prefix must not leak a tool selection into the chat.
	// Only a whole numeric response is a selection; numbers within prose stay text.
	response = strings.TrimSpace(strings.TrimPrefix(response, "ANTWORT:"))
	if ctx.Err() != nil {
		return "", nil, ctx.Err()
	}
	if call, recognized, err := siraThemeCommand(response, definitions); recognized {
		if err != nil {
			return "", nil, err
		}
		return "tool_calls", []ToolCall{*call}, nil
	}
	if call, recognized, err := siraTabCommand(response, definitions); recognized {
		if err != nil {
			return "", nil, err
		}
		return "tool_calls", []ToolCall{*call}, nil
	}
	// A single-line play command is a short form of the existing gated song tool.
	parts := strings.SplitN(response, " ", 2)
	if strings.EqualFold(parts[0], "play") {
		if ctx.Err() != nil {
			return "", nil, ctx.Err()
		}
		if len(parts) != 2 || strings.TrimSpace(parts[1]) == "" || strings.ContainsAny(response, "\r\n") {
			return "", nil, errors.New("Sira muss nach play den Song nennen. Keine Wiedergabe ausgeführt.")
		}
		const tool = "browser_play_song"
		if _, enabled := definitions[tool]; !enabled {
			return "", nil, errors.New("Musikwiedergabe per Werkzeug ist nicht freigegeben.")
		}
		call, err := parseSiraText(tool+" "+mustJSON(map[string]any{"song": strings.TrimSpace(parts[1])}), map[string]bool{tool: true})
		if err == nil {
			err = validateSiraCall(call, definitions)
		}
		if err != nil {
			return "", nil, err
		}
		call.Trace = []string{"Sira: " + response, "Browser: Play-Kurzbefehl als browser_play_song ausführen."}
		return "tool_calls", []ToolCall{*call}, nil
	}
	number, numberErr := strconv.Atoi(response)
	if numberErr != nil {
		if response == "" {
			return "", nil, errors.New("Sira hat keine Antwort geliefert.")
		}
		if strings.HasPrefix(response, "browser_") || strings.Contains(response, "SIRA_TOOL") {
			return "", nil, errors.New("Sira muss zuerst nur die Werkzeugnummer nennen. Keine Aktion ausgeführt.")
		}
		delta(response)
		return "stop", nil, nil
	}
	name, ok := byNumber[number]
	if !ok {
		return "", nil, errors.New("Diese Werkzeugnummer ist nicht verfügbar. Keine Aktion ausgeführt.")
	}
	var definition struct {
		Description string `json:"description"`
		Parameters  struct {
			Properties map[string]json.RawMessage `json:"properties"`
			Required   []string                   `json:"required"`
		} `json:"parameters"`
	}
	if json.Unmarshal([]byte(definitions[name]), &definition) != nil {
		return "", nil, errors.New("Werkzeugbeschreibung konnte nicht gelesen werden.")
	}
	args := map[string]any{}
	feedback := ""
	trace := []string{fmt.Sprintf("Sira wählt Werkzeug %d: %s", number, name)}
	trace = append(trace, "Browser: "+definitions[name])
	// No-parameter tools can proceed immediately after their empty schema is checked.
	for step := 0; step < 24; step++ {
		if ctx.Err() != nil {
			return "", nil, ctx.Err()
		}
		_, hasColor := args["color"]
		_, hasPalette := args["color_theme"]
		// A color choice or picker request is a complete operation by itself.
		// Further requested changes can be made in the next tool round.
		colorComplete := name == "browser_customize" && (hasColor || hasPalette || args["show_color_picker"] == true)
		if len(definition.Parameters.Properties) == 0 || colorComplete {
			response = "FERTIG"
		} else {
			if len(args) > 0 && feedback != "" {
				remaining := map[string]json.RawMessage{}
				for key, property := range definition.Parameters.Properties {
					if _, set := args[key]; !set {
						remaining[key] = property
					}
				}
				next, e := c.appleExchange(ctx, map[string]any{"phase": "next", "prompt": prompt, "accepted": mustJSON(args), "remaining": mustJSON(remaining), "required": mustJSON(definition.Parameters.Required)})
				if e != nil {
					return "", nil, e
				}
				trace = append(trace, "Browser: Welche Angaben fehlen noch?", "Sira: "+next)
				if strings.TrimSpace(next) == "FERTIG" {
					response = "FERTIG"
				} else {
					response = ""
				}
			} else {
				response = ""
			}
			if response != "FERTIG" {
				request = map[string]any{"phase": "parameter", "prompt": prompt, "definition": definitions[name], "accepted": mustJSON(args), "feedback": feedback}
				response, err = c.appleExchange(ctx, request)
				if err != nil {
					return "", nil, err
				}
				response = strings.TrimSpace(response)
				trace = append(trace, "Sira: "+response)
			}
		}
		if response == "ABBRECHEN" {
			delta("Bitte ergänze die fehlenden Angaben zu deinem Auftrag.")
			return "stop", nil, nil
		}
		if response == "FERTIG" {
			call, parseErr := parseSiraText(name+" "+mustJSON(args), map[string]bool{name: true})
			if parseErr == nil {
				parseErr = validateSiraCall(call, definitions)
			}
			if parseErr == nil {
				call.Trace = trace
				return "tool_calls", []ToolCall{*call}, nil
			}
			feedback = "Noch nicht ausführbar: " + parseErr.Error()
			trace = append(trace, "Browser: "+feedback)
			continue
		}
		var field map[string]json.RawMessage
		if json.Unmarshal([]byte(response), &field) != nil || len(field) != 1 {
			feedback = "Gib genau EIN Feld als JSON-Objekt an, z.B. {\"color\":\"blau\"}. Oder FERTIG, wenn alles gesetzt ist."
			continue
		}
		keys := []string{}
		for k := range field {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		key := keys[0]
		property, exists := definition.Parameters.Properties[key]
		if !exists {
			feedback = "Unbekannter Parameter " + key + ". Verwende nur die Felder aus properties."
			continue
		}
		var value any
		json.Unmarshal(field[key], &value)
		// Validate each individual value, then validate the complete request on FERTIG.
		schema := map[string]any{"type": "object", "properties": map[string]any{key: json.RawMessage(property)}, "required": []string{key}, "additionalProperties": false}
		temporary := map[string]string{name: mustJSON(map[string]any{"parameters": schema})}
		candidate := &ToolCall{Function: ToolFunction{Name: name, Arguments: mustJSON(map[string]any{key: value})}}
		if e := validateSiraCall(candidate, temporary); e != nil {
			feedback = "Wert abgelehnt: " + e.Error()
			trace = append(trace, "Browser: "+feedback)
			continue
		}
		args[key] = value
		feedback = "Parameter " + key + " akzeptiert. Gib den nächsten benötigten Parameter einzeln an oder FERTIG. Optionale Felder ohne Nutzerauftrag weglassen."
		trace = append(trace, "Browser: "+feedback)
	}
	return "", nil, errors.New("Sira konnte die Parameter nicht vollständig übergeben. Keine Aktion ausgeführt.")
}
