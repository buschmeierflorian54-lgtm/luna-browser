package chat

import (
	"encoding/json"
	"strings"
)

// Local guidance is separate from untrusted tool content and only applies to
// the latest completed call in this user turn.
func siraFollowup(messages []Message) string {
	if len(messages) == 0 || messages[len(messages)-1].Role != "tool" {
		return ""
	}
	m := messages[len(messages)-1]
	var result struct {
		IsError bool   `json:"isError"`
		Error   string `json:"error"`
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if json.Unmarshal([]byte(m.Content), &result) != nil {
		return "Der Ausgang ist unklar. Bestätige keinen Erfolg; prüfe erst den Zustand."
	}
	if result.IsError || result.Error != "" {
		return "Der Aufruf ist fehlgeschlagen. Bestätige keinen Erfolg. Erkläre den Fehler oder korrigiere ungültige Parameter, soweit der Nutzerauftrag das erlaubt."
	}
	if len(result.Content) == 0 {
		return "Kein bestätigtes Ergebnis vorhanden. Behaupte keinen Erfolg."
	}
	var call *ToolCall
	for i := len(messages) - 2; i >= 0 && messages[i].Role != "user"; i-- {
		for j := range messages[i].ToolCalls {
			if messages[i].ToolCalls[j].ID == m.ToolCallID {
				call = &messages[i].ToolCalls[j]
				break
			}
		}
		if call != nil {
			break
		}
	}
	if call == nil {
		return ""
	}
	for _, entry := range call.Trace {
		if entry == "Farboptionen angefordert" {
			return siraThemeOptions()
		}
	}
	hint := "Der Werkzeugaufruf ist abgeschlossen. Wiederhole ihn nicht. Wenn der Nutzerauftrag damit erfüllt ist, antworte jetzt mit ANTWORT: und bestätige kurz das tatsächliche Ergebnis. Sind weitere ausdrücklich gewünschte Schritte offen, wähle dafür das nächste Werkzeug."
	if call.Function.Name == "browser_customize" {
		var args map[string]any
		json.Unmarshal([]byte(call.Function.Arguments), &args)
		if args["show_color_picker"] == true {
			return "Die Theme-Auswahl wurde angezeigt, aber keine Farbe geändert. Antworte: ANTWORT: Wähle hier deine gewünschte Farbe. Warte dann auf den Nutzer."
		}
		colors := map[string]string{"luna": "Rosa", "lavender": "Lila", "ocean": "Blau", "mint": "Mintgrün", "forest": "Grün", "sand": "Gelb", "peach": "Orange", "cherry": "Rot", "arctic": "Türkis", "graphite": "Grau"}
		if args["color"] != nil || args["color_theme"] != nil || args["reset_colors"] == true {
			for _, p := range result.Content {
				var state struct {
					ColorTheme string `json:"color_theme"`
				}
				if json.Unmarshal([]byte(p.Text), &state) == nil {
					if color := colors[state.ColorTheme]; color != "" {
						return hint + " Passender Antwortvorschlag aus dem bestätigten Browserzustand: ANTWORT: Ich habe die Farbe auf " + color + " gestellt."
					}
				}
			}
		}
	}
	if strings.HasSuffix(call.Function.Name, "state") || call.Function.Name == "browser_search" || call.Function.Name == "browser_page" {
		hint += " Bei Lese- und Suchergebnissen beantworte die Nutzerfrage anhand der Daten; behaupte keine Änderung."
	}
	return hint
}
