package browsermcp

import (
	"browser-mac/internal/store"
	"context"
	"encoding/json"
	"github.com/google/jsonschema-go/jsonschema"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func prop(t string) map[string]any { return map[string]any{"type": t} }
func choices(values ...string) map[string]any {
	return map[string]any{"type": "string", "enum": values}
}
func NewServer(dispatch Dispatch) *mcp.Server {
	s := mcp.NewServer(&mcp.Implementation{Name: "luna-browser", Version: "1.0.0"}, &mcp.ServerOptions{Instructions: ToolInstructions})
	add := func(name, desc string, properties map[string]any, required ...string) {
		desc = explainTool(name, desc, properties)
		schema := map[string]any{"type": "object", "properties": properties, "additionalProperties": false}
		if len(required) > 0 {
			schema["required"] = required
		}
		raw, _ := json.Marshal(schema)
		var typed jsonschema.Schema
		if err := json.Unmarshal(raw, &typed); err != nil {
			panic(err)
		}
		resolved, err := typed.Resolve(nil)
		if err != nil {
			panic(err)
		}
		s.AddTool(&mcp.Tool{Name: name, Description: desc, InputSchema: schema}, func(ctx context.Context, r *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			args := map[string]any{}
			if len(r.Params.Arguments) > 0 {
				if err := json.Unmarshal(r.Params.Arguments, &args); err != nil {
					return nil, err
				}
			}
			if err := resolved.Validate(args); err != nil {
				return &mcp.CallToolResult{IsError: true, Content: []mcp.Content{&mcp.TextContent{Text: "Ungültige Parameter für " + name + ": " + err.Error() + ". Keine Aktion ausgeführt. Korrigiere die Werte anhand der Nutzeranfrage. Formatbeispiel (nicht blind kopieren): " + toolExamples[name]}}}, nil
			}
			if name == "browser_customize" {
				if args["show_color_picker"] == true {
					if len(args) != 1 {
						return &mcp.CallToolResult{IsError: true, Content: []mcp.Content{&mcp.TextContent{Text: "Für die Theme-Auswahl nur show_color_picker:true senden. Keine Farbe wurde geändert."}}}, nil
					}
					return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: `{"show_color_picker":true,"message":"Die Theme-Auswahl wird im Chat angezeigt. Der Nutzer wählt selbst; noch keine Farbe geändert."}`}}}, nil
				}
				delete(args, "show_color_picker")
				if color, ok := args["color"].(string); ok {
					id := colorNames[color]
					if existing, ok := args["color_theme"].(string); (ok && existing != id) || args["reset_colors"] == true {
						return &mcp.CallToolResult{IsError: true, Content: []mcp.Content{&mcp.TextContent{Text: "Widersprüchliche Farben. Verwende nur color mit dem gewünschten Farbnamen; keine Aktion ausgeführt."}}}, nil
					}
					args["color_theme"] = id
					delete(args, "color")
				}
			}
			result, err := dispatch(ctx, name, args)
			if err != nil {
				return &mcp.CallToolResult{IsError: true, Content: []mcp.Content{&mcp.TextContent{Text: err.Error()}}}, nil
			}
			if direct, ok := result.(*mcp.CallToolResult); ok {
				return direct, nil
			}
			b, err := json.Marshal(result)
			if err != nil {
				return nil, err
			}
			return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: string(b)}}}, nil
		})
	}
	add("browser_state", "Read open tabs, active tab, appearance, preferences and sidebar layout. No keys or cookies.", map[string]any{})
	add("browser_tab", "Manage tabs. close with domain closes all tabs on that domain and its subdomains; omit tab_id. URLs must be http(s), about:blank, chat:, search:QUERY or spotify-search:QUERY. Navigation is asynchronous; use browser_page wait_ready then read.", map[string]any{"action": choices("open", "navigate", "activate", "close", "back", "forward", "reload", "stop", "zoom"), "tab_id": prop("integer"), "domain": prop("string"), "url": prop("string"), "background": prop("boolean"), "zoom": map[string]any{"type": "number", "minimum": 0.5, "maximum": 3}}, "action")
	add("browser_tab_group", "Create, rename, assign, collapse or dissolve a tab group. Dissolve keeps tabs open. Create assigns tab_id (active tab when omitted).", map[string]any{"action": choices("create", "rename", "assign", "toggle", "remove"), "group_id": prop("string"), "tab_id": prop("integer"), "title": prop("string")}, "action")
	add("browser_tab_move", "Move a tab before another tab or to the end. group_id assigns a group; omit it to ungroup. Order and groups persist when restoreSession is enabled.", map[string]any{"tab_id": prop("integer"), "before_tab_id": prop("integer"), "group_id": prop("string")}, "tab_id")
	add("browser_page", "Read visible text/elements (not password values), click or fill an element, scroll, find text or wait for load. Use CSS selector returned by read; select a specific tab. Cross-origin frames and closed shadow roots are not accessible. Never fill password/file fields. Click may submit forms; follow user authorization.", map[string]any{"action": choices("read", "click", "fill", "select", "scroll", "find", "wait_ready"), "tab_id": prop("integer"), "selector": prop("string"), "text": prop("string"), "value": prop("string"), "x": prop("number"), "y": prop("number")}, "action")
	add("browser_customize", "Persist Luna theme and sidebar customization. color_theme must be one of the ten built-in palette IDs; arbitrary colors are forbidden. Theme auto/light/dark; settings are showBookmarkBar, restoreSession, circleGesture. Sidebar actions: create_group(title), rename_group(id,title), delete_group(id), assign(id,parent), hide/show(id), move(id,direction=-1 or 1), open(id), close, reset. Return resulting state.", map[string]any{"theme": choices("auto", "light", "dark"), "show_color_picker": prop("boolean"), "color": choices("rosa", "lila", "blau", "mintgrün", "grün", "gelb", "orange", "rot", "türkis", "grau"), "color_theme": choices("luna", "lavender", "ocean", "mint", "forest", "sand", "peach", "cherry", "arctic", "graphite"), "reset_colors": prop("boolean"), "sidebar_width": map[string]any{"type": "integer", "minimum": 260, "maximum": 560}, "preferences": map[string]any{"type": "object", "additionalProperties": false, "properties": map[string]any{"showBookmarkBar": prop("boolean"), "restoreSession": prop("boolean"), "circleGesture": prop("boolean")}}, "panel_action": choices("create_group", "rename_group", "delete_group", "assign", "hide", "show", "move", "open", "close", "reset"), "id": prop("string"), "parent": prop("string"), "title": prop("string"), "direction": map[string]any{"type": "integer", "enum": []int{-1, 1}}})
	add("browser_gestures", "Read or persist mouse-letter bindings CDHIJLOPQSVWZ. action=list returns bindings and available actions. action=set requires letter and binding; open_url also requires value (HTTP/HTTPS). none disables one letter. reset restores O=notes, S=screenshot. Does not execute the gesture. Draw uppercase letters in one stroke using the settings preview. Global enable switch is browser_customize preferences.circleGesture.", map[string]any{"action": choices("list", "set", "reset"), "letter": map[string]any{"type": "string", "pattern": "^[CDHIJLOPQSVWZcdhijlopqsvwz]$"}, "binding": choices(store.GestureActions...), "value": prop("string")}, "action")
	add("browser_settings", "Open a settings chapter. MCP enable/disable and secret management remain in the local UI.", map[string]any{"section": choices("look", "bm", "panels", "start", "gestures", "search", "spotify", "chat", "mcp", "updates", "data")}, "section")
	add("browser_bookmarks", "List, add, edit or remove a bookmark. Removing requires user authorization.", map[string]any{"action": choices("list", "add", "edit", "remove"), "url": prop("string"), "old_url": prop("string"), "title": prop("string")}, "action")
	add("browser_notes", "List or save per-page notes; key is a URL or a custom note ID. Empty text deletes that note.", map[string]any{"action": choices("list", "save"), "key": prop("string"), "title": prop("string"), "text": prop("string")}, "action")
	add("browser_history", "Query or remove browser history. Clear/remove only when authorized.", map[string]any{"action": choices("list", "remove", "clear"), "query": prop("string"), "url": prop("string"), "limit": map[string]any{"type": "integer", "minimum": 1, "maximum": 200}}, "action")
	add("browser_downloads", "Read download list or clear the list (does not delete files).", map[string]any{"action": choices("list", "clear")}, "action")
	add("browser_search", "Search using Luna Search or Spotify API. Requires the user's existing configured service. Optionally show results in a new tab.", map[string]any{"provider": choices("luna", "spotify"), "query": prop("string"), "open_results": prop("boolean")}, "provider", "query")
	add("browser_play_song", "Play a requested song immediately in the installed Spotify app. Provide only song title and optionally artist; this tool searches Spotify, chooses the best matching track and starts playback through AppleScript. Prefer this tool for requests to play a named song; no manual search or URI lookup needed. Requires a connected Spotify account. Returns the chosen track after the playback command succeeds, not independently verified audible playback.", map[string]any{"song": map[string]any{"type": "string", "minLength": 1, "maxLength": 240}, "artist": map[string]any{"type": "string", "maxLength": 240}}, "song")
	add("browser_spotify", "Read player/account status or control the installed Spotify app. Does not expose credentials. play_uri needs spotify:track/album/artist:ID.", map[string]any{"action": choices("status", "open", "playpause", "next", "previous", "seek", "volume", "shuffle", "repeat", "play_uri"), "value": prop("number"), "uri": prop("string")}, "action")
	add("browser_sonos", "Read discovered Sonos devices or configure Mac-volume sync for selected IDs. Does not change volume on enable.", map[string]any{"action": choices("status", "configure"), "enabled": prop("boolean"), "selected": map[string]any{"type": "array", "items": prop("string")}}, "action")
	add("browser_screenshot", "Capture the selected tab and return a JPEG image. This also copies the screenshot to the Mac clipboard.", map[string]any{"tab_id": prop("integer")})
	return s
}
