package chat

import (
	"errors"
	"net/url"
	"strconv"
	"strings"
)

// Parse only a complete model command, never commands embedded in prose.
func siraTabCommand(text string, definitions map[string]string) (*ToolCall, bool, error) {
	fields := strings.Fields(text)
	if len(fields) == 0 || !strings.EqualFold(fields[0], "tab") {
		return nil, false, nil
	}
	fail := errors.New("Ungültiger Tab-Befehl. Nutze tab list, tab open URL, tab navigate URL [ID], tab activate ID, tab close/back/forward/reload/stop [ID] oder tab zoom PROZENT [ID].")
	if len(fields) < 2 || strings.ContainsAny(text, "\r\n") {
		return nil, true, fail
	}
	action := strings.ToLower(fields[1])
	args := map[string]any{"action": action}
	name := "browser_tab"
	values := fields[2:]
	idAt := -1
	switch action {
	case "list":
		if len(values) != 0 {
			return nil, true, fail
		}
		name = "browser_state"
		args = map[string]any{}
	case "open", "navigate":
		if len(values) == 0 && action == "open" {
			break
		}
		max := 1
		if action == "navigate" {
			max = 2
		}
		if len(values) < 1 || len(values) > max {
			return nil, true, fail
		}
		address := values[0]
		if address != "about:blank" {
			if !strings.Contains(address, "://") {
				address = "https://" + address
			}
			u, err := url.Parse(address)
			if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" || u.User != nil || (!strings.Contains(u.Hostname(), ".") && u.Hostname() != "localhost") {
				return nil, true, fail
			}
		}
		args["url"] = address
		if len(values) == 2 {
			idAt = 1
		}
	case "activate":
		if len(values) != 1 {
			return nil, true, fail
		}
		idAt = 0
	case "close", "back", "forward", "reload", "stop":
		if action == "close" && len(values) == 1 {
			if _, err := strconv.Atoi(values[0]); err != nil {
				address := values[0]
				if !strings.Contains(address, "://") {
					address = "https://" + address
				}
				u, err := url.Parse(address)
				if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil {
					return nil, true, fail
				}
				host := strings.TrimPrefix(strings.TrimSuffix(strings.ToLower(u.Hostname()), "."), "www.")
				if !strings.Contains(host, ".") && host != "localhost" {
					return nil, true, fail
				}
				args["domain"] = host
				break
			}
		}
		if len(values) > 1 {
			return nil, true, fail
		}
		if len(values) == 1 {
			idAt = 0
		}
	case "zoom":
		if len(values) < 1 || len(values) > 2 {
			return nil, true, fail
		}
		percent, err := strconv.Atoi(strings.TrimSuffix(values[0], "%"))
		if err != nil || percent < 50 || percent > 300 {
			return nil, true, fail
		}
		args["zoom"] = float64(percent) / 100
		if len(values) == 2 {
			idAt = 1
		}
	default:
		return nil, true, fail
	}
	if idAt >= 0 {
		id, err := strconv.Atoi(values[idAt])
		if err != nil || id < 0 {
			return nil, true, fail
		}
		args["tab_id"] = id
	}
	if _, ok := definitions[name]; !ok {
		return nil, true, errors.New("Tab-Werkzeug ist nicht freigegeben.")
	}
	call, err := parseSiraText(name+" "+mustJSON(args), map[string]bool{name: true})
	if err == nil {
		err = validateSiraCall(call, definitions)
	}
	if err != nil {
		return nil, true, err
	}
	call.Trace = []string{"Sira: " + text}
	return call, true, nil
}
