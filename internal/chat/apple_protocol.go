package chat

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/google/jsonschema-go/jsonschema"
	"io"
	"strings"
)

// Interpret only a complete, standalone envelope from the current model response.
// Nothing is rendered or dispatched before generation and validation complete.
func parseSiraText(text string, allowed map[string]bool) (*ToolCall, error) {
	text = strings.TrimSpace(strings.ReplaceAll(text, "\r\n", "\n"))
	// Compact text form: exact tool name followed by one complete JSON object.
	if parts := strings.SplitN(text, "{", 2); len(parts) == 2 {
		name := strings.TrimSpace(parts[0])
		if allowed[name] || strings.HasPrefix(name, "browser_") || name == "tool_details" {
			if !strings.ContainsAny(name, " \n\t`") {
				encoded, _ := json.Marshal(name)
				text = "SIRA_TOOL\n{\"tool\":" + string(encoded) + ",\"arguments\":{" + parts[1] + "}\nEND_SIRA_TOOL"
			}
		}
	}
	if !strings.Contains(text, "SIRA_TOOL") {
		return nil, nil
	}
	fail := errors.New("Siras Aktionsformat ist ungültig. Keine Aktion ausgeführt.")
	if !strings.HasPrefix(text, "SIRA_TOOL\n") || !strings.HasSuffix(text, "\nEND_SIRA_TOOL") {
		return nil, fail
	}
	raw := strings.TrimSuffix(strings.TrimPrefix(text, "SIRA_TOOL\n"), "\nEND_SIRA_TOOL")
	if len(raw) > 100000 {
		return nil, fail
	}
	var envelope struct {
		Tool      string         `json:"tool"`
		Arguments map[string]any `json:"arguments"`
	}
	d := json.NewDecoder(strings.NewReader(raw))
	d.DisallowUnknownFields()
	if d.Decode(&envelope) != nil || envelope.Arguments == nil || envelope.Tool == "" {
		return nil, fail
	}
	if d.Decode(new(any)) != io.EOF {
		return nil, fail
	}
	if !allowed[envelope.Tool] {
		return nil, errors.New("Sira hat ein nicht verfügbares Werkzeug angefordert. Keine Aktion ausgeführt.")
	}
	args, _ := json.Marshal(envelope.Arguments)
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return &ToolCall{ID: "sira-" + hex.EncodeToString(nonce), Type: "function", Function: ToolFunction{Name: envelope.Tool, Arguments: string(args)}}, nil
}
func appleToolDetails(definitions []map[string]any, raw string) string {
	var args struct {
		Name string `json:"name"`
	}
	d := json.NewDecoder(bytes.NewBufferString(raw))
	d.DisallowUnknownFields()
	if d.Decode(&args) != nil || d.Decode(new(any)) != io.EOF {
		return `{"isError":true,"error":"tool_details benötigt genau name."}`
	}
	for _, tool := range definitions {
		f, ok := tool["function"].(map[string]any)
		if ok && f["name"] == args.Name {
			encoded, _ := json.Marshal(map[string]any{"content": []map[string]string{{"type": "text", "text": mustJSON(f)}}})
			return string(encoded)
		}
	}
	return `{"isError":true,"error":"Unbekanntes Werkzeug; keine Aktion ausgeführt."}`
}
func mustJSON(v any) string { raw, _ := json.Marshal(v); return string(raw) }

// Validate the same advertised schema before turning text into an executable call.
func validateSiraCall(call *ToolCall, definitions map[string]string) error {
	if call.Function.Name == "tool_details" {
		var args map[string]any
		if json.Unmarshal([]byte(call.Function.Arguments), &args) != nil || len(args) != 1 {
			return errors.New("tool_details benötigt nur name.")
		}
		name, ok := args["name"].(string)
		if !ok || definitions[name] == "" {
			return errors.New("tool_details benötigt einen verfügbaren Werkzeugnamen.")
		}
		return nil
	}
	var definition struct {
		Parameters jsonschema.Schema `json:"parameters"`
	}
	if json.Unmarshal([]byte(definitions[call.Function.Name]), &definition) != nil {
		return errors.New("Werkzeugschema konnte nicht gelesen werden.")
	}
	resolved, err := definition.Parameters.Resolve(nil)
	if err != nil {
		return err
	}
	var args map[string]any
	if err = json.Unmarshal([]byte(call.Function.Arguments), &args); err != nil {
		return err
	}
	return resolved.Validate(args)
}
