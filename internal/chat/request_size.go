package chat

import "encoding/json"

// Keep the current user turn and all its tool call/result pairs together.
// Only the provider request is shortened; saved history is left untouched.
func smallerContext(messages []Message, pass int) []Message {
	starts := []int{}
	for i, m := range messages {
		if m.Role == "user" {
			starts = append(starts, i)
		}
	}
	first := 0
	if len(starts) > 1 {
		if pass == 1 {
			first = starts[len(starts)/2]
		} else {
			first = starts[len(starts)-1]
		}
	}
	out := []Message{}
	for i, m := range messages {
		if i < first && m.Role != "system" {
			continue
		}
		if m.Role == "tool" {
			max := 4000
			if pass > 1 {
				max = 1000
			}
			r := []rune(m.Content)
			if len(r) > max {
				raw, _ := json.Marshal(map[string]any{"truncated": true, "excerpt": string(r[:max]), "note": "Tool result shortened to fit the provider request. Read a smaller page section if more detail is needed."})
				m.Content = string(raw)
			}
		}
		out = append(out, m)
	}
	return out
}
