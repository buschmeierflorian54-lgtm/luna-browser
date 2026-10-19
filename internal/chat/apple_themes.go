package chat

import (
	"errors"
	"strings"
)

var siraThemes = []struct{ ID, Name, Color string }{
	{"luna", "Luna Rosé", "rosa"}, {"lavender", "Lavendel", "lila"},
	{"ocean", "Ozean", "blau"}, {"mint", "Minze", "mintgrün"},
	{"forest", "Wald", "grün"}, {"sand", "Sand", "gelb"},
	{"peach", "Pfirsich", "orange"}, {"cherry", "Kirschblüte", "rot"},
	{"arctic", "Arktis", "türkis"}, {"graphite", "Graphit", "grau"},
}

func siraThemeOptions() string {
	var options []string
	for _, theme := range siraThemes {
		options = append(options, theme.Name+" ("+theme.Color+")")
	}
	return "Verfügbare Themes: " + strings.Join(options, ", ") + ". Wähle für den Nutzerauftrag das passende oder farblich nächstliegende Theme. Antworte ausschließlich: themeselect THEMENAME. Beispiel: themeselect Ozean. Noch wurde keine Farbe geändert. Wenn der Nutzer nur die Optionen sehen wollte, nenne sie normal und ändere nichts."
}

func siraThemeCommand(response string, definitions map[string]string) (*ToolCall, bool, error) {
	normalized := strings.ToLower(strings.Join(strings.Fields(response), " "))
	options := normalized == "farbe optionen" || normalized == "farbe optionenen"
	selectTheme := normalized == "themeselect" || strings.HasPrefix(normalized, "themeselect ")
	if !options && !selectTheme {
		return nil, false, nil
	}
	if _, enabled := definitions["browser_customize"]; !enabled {
		return nil, true, errors.New("Theme-Werkzeuge sind nicht freigegeben.")
	}
	name := "browser_customize"
	args := map[string]any{}
	if options {
		name = "browser_state"
		if _, enabled := definitions[name]; !enabled {
			return nil, true, errors.New("Browserzustand ist nicht freigegeben.")
		}
	} else {
		selected := strings.TrimSpace(strings.TrimPrefix(normalized, "themeselect"))
		selected = strings.Trim(selected, "()\"'")
		for _, theme := range siraThemes {
			if strings.EqualFold(selected, theme.Name) || selected == theme.ID {
				args["color_theme"] = theme.ID
				break
			}
		}
		if len(args) == 0 {
			return nil, true, errors.New("Unbekanntes Theme. " + siraThemeOptions())
		}
	}
	call, err := parseSiraText(name+" "+mustJSON(args), map[string]bool{name: true})
	if err == nil {
		err = validateSiraCall(call, definitions)
	}
	if err != nil {
		return nil, true, err
	}
	call.Trace = []string{"Sira: " + response}
	if options {
		call.Trace = append(call.Trace, "Farboptionen angefordert")
	}
	return call, true, nil
}
