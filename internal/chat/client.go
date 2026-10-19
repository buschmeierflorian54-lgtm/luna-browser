package chat

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const Model = "anthropic/claude-sonnet-4.5"
const MaxTokens = 30000
const KeyName = "openrouter-api-key"

type Message struct {
	Provider   string     `json:"provider,omitempty"`
	Model      string     `json:"model,omitempty"`
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}
type Client struct {
	appleCommand     string
	appleRespond     func(context.Context, map[string]any) (string, error)
	appleFormatRetry bool
	appleFormatError string
	Provider         string
	Apple            bool
	ContextPass      int
	OnResize         func(string)
	HTTP             *http.Client
	Endpoint         string
	ModelID          string
	TokenLimit       int
	Groq             bool
	OnWait           func(time.Duration)
	waitRetry        func(context.Context, time.Duration) error
}

func NewClient() *Client {
	return &Client{HTTP: &http.Client{Timeout: 20 * time.Minute}, Endpoint: "https://openrouter.ai/api/v1/chat/completions"}
}
func (c *Client) Stream(ctx context.Context, key string, messages []Message, delta func(string)) (string, error) {
	finish, _, err := c.StreamTools(ctx, key, messages, nil, delta)
	return finish, err
}
func (c *Client) StreamTools(ctx context.Context, key string, messages []Message, tools []map[string]any, delta func(string)) (finishResult string, calls []ToolCall, returnErr error) {
	if c.Apple {
		return c.streamApple(ctx, messages, tools, delta)
	}
	messages = append([]Message(nil), messages...)
	for i := range messages {
		messages[i].Provider = ""
		messages[i].Model = ""
		messages[i].ToolCalls = append([]ToolCall(nil), messages[i].ToolCalls...)
		for j := range messages[i].ToolCalls {
			messages[i].ToolCalls[j].Trace = nil
		}
	}
	model := c.ModelID
	if model == "" {
		model = Model
	}
	limit := c.TokenLimit
	if limit <= 0 || limit > MaxTokens {
		limit = MaxTokens
	}
	payload := map[string]any{"model": model, "messages": messages, "stream": true}
	if c.Groq {
		payload["max_completion_tokens"] = limit
	} else {
		payload["max_tokens"] = limit
	}
	if len(tools) > 0 {
		payload["tools"] = tools
		payload["parallel_tool_calls"] = false
	}
	var resp *http.Response
	var err error
	startPass := c.ContextPass
	for pass := startPass; pass < 3; pass++ {
		if pass > 0 {
			payload["messages"] = smallerContext(messages, pass)
			if pass > startPass {
				limit = min(limit/2, 8192)
				if pass == 2 {
					limit = min(limit, 2048)
				}
				limit = max(limit, 1)
				c.TokenLimit = limit
			}
			c.ContextPass = pass
			if c.Groq {
				payload["max_completion_tokens"] = limit
			} else {
				payload["max_tokens"] = limit
			}
			if c.OnResize != nil && pass > startPass {
				c.OnResize(fmt.Sprintf("Anfrage verkleinert: Älterer Verlauf und lange Werkzeugergebnisse werden für diese Antwort gekürzt; Ausgabelimit %d Tokens. Deine aktuelle Nachricht und der gespeicherte Verlauf bleiben vollständig.", limit))
			}
		}
		body, _ := json.Marshal(payload)
		req, e := http.NewRequestWithContext(ctx, http.MethodPost, c.Endpoint, bytes.NewReader(body))
		if e != nil {
			return "", nil, e
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+key)
		req.Header.Set("X-Title", "Luna Browser")
		resp, err = c.doRequest(req)
		if err != nil || resp.StatusCode != http.StatusRequestEntityTooLarge || pass == 2 {
			break
		}
		io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		resp.Body.Close()
	}
	if err != nil {
		if ctx.Err() != nil {
			return "", nil, ctx.Err()
		}
		return "", nil, errors.New("Der KI-Anbieter ist gerade nicht erreichbar. Bitte prüfe deine Verbindung.")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		switch resp.StatusCode {
		case 401, 403:
			return "", nil, errors.New("Der KI-Anbieter hat den Zugriff abgelehnt. Prüfe deinen API-Schlüssel und dessen Berechtigungen.")
		case 402:
			return "", nil, errors.New("Dein Guthaben beim KI-Anbieter reicht für diese Anfrage nicht aus.")
		case 413:
			return "", nil, errors.New("Die Anfrage ist trotz Verkleinerung zu groß (HTTP 413). Bitte beginne einen neuen Chat, kürze die aktuelle Nachricht oder wähle ein Modell mit höherem Anfragelimit.")
		case 429:
			if resp.Header.Get("Retry-After") == "" {
				return "", nil, errors.New("Der KI-Anbieter begrenzt die Anfragen (HTTP 429). Auch nach zwei Wiederholungen besteht das Limit. Bitte warte oder prüfe dein Kontingent beim Anbieter.")
			}
			delay := retryDelay(resp.Header.Get("Retry-After"), 0)
			return "", nil, fmt.Errorf("Der KI-Anbieter begrenzt die Anfragen (HTTP 429). Bitte in etwa %d Sekunden erneut versuchen. Falls es weiterhin auftritt, prüfe dein Kontingent oder wähle ein anderes Modell.", int(delay.Seconds())+1)
		case 400:
			return "", nil, errors.New("Der KI-Anbieter hat die Anfrage abgelehnt. Prüfe, ob das Modell diesen Chat, die Werkzeuge und die Ausgabelänge unterstützt; versuche gegebenenfalls ein anderes Modell oder einen neuen Chat.")
		}
		return "", nil, fmt.Errorf("KI-Anfrage fehlgeschlagen (HTTP %d).", resp.StatusCode)
	}
	scanner := bufio.NewScanner(io.LimitReader(resp.Body, 16<<20))
	scanner.Buffer(make([]byte, 4096), 1<<20)
	var data []string
	finish := ""
	done := false
	size := 0
	consume := func() error {
		if len(data) == 0 {
			return nil
		}
		raw := strings.Join(data, "\n")
		data = nil
		if raw == "[DONE]" {
			done = true
			return nil
		}
		var chunk struct {
			Error   json.RawMessage `json:"error"`
			Choices []struct {
				Delta struct {
					Content   string `json:"content"`
					ToolCalls []struct {
						Index int `json:"index"`
						ToolCall
					} `json:"tool_calls"`
				} `json:"delta"`
				Finish string `json:"finish_reason"`
			} `json:"choices"`
		}
		if json.Unmarshal([]byte(raw), &chunk) != nil {
			return errors.New("Die Antwort von Der KI-Anbieter konnte nicht gelesen werden.")
		}
		if len(chunk.Error) > 0 && string(chunk.Error) != "null" {
			return errors.New("Der Anbieter hat die Antwort abgebrochen. Bereits empfangener Text bleibt erhalten.")
		}
		if len(chunk.Choices) > 0 {
			ch := chunk.Choices[0]
			for _, part := range ch.Delta.ToolCalls {
				if part.Index < 0 || part.Index > 15 {
					return errors.New("Too many tool calls")
				}
				for len(calls) <= part.Index {
					calls = append(calls, ToolCall{Type: "function"})
				}
				call := &calls[part.Index]
				call.ID += part.ID
				call.Function.Name += part.Function.Name
				call.Function.Arguments += part.Function.Arguments
				if len(call.Function.Arguments) > 100000 {
					return errors.New("Tool arguments too large")
				}
			}
			if ch.Finish != "" {
				finish = ch.Finish
			}
			if ch.Delta.Content != "" {
				size += len(ch.Delta.Content)
				if size > 2<<20 {
					return errors.New("Die Antwort ist zu groß.")
				}
				delta(ch.Delta.Content)
			}
		}
		return nil
	}
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if err := consume(); err != nil {
				return finish, calls, err
			}
			if done {
				break
			}
		} else if strings.HasPrefix(line, "data:") {
			data = append(data, strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
		}
	}
	if err := scanner.Err(); err != nil {
		if ctx.Err() != nil {
			return finish, calls, ctx.Err()
		}
		return finish, calls, errors.New("Die Verbindung wurde während der Antwort unterbrochen.")
	}
	if err := consume(); err != nil {
		return finish, calls, err
	}
	if ctx.Err() != nil {
		return finish, calls, ctx.Err()
	}
	if finish == "error" {
		return finish, calls, errors.New("Der Anbieter hat die Antwort abgebrochen.")
	}
	if (!done && finish == "") || (size == 0 && len(calls) == 0) {
		return finish, calls, errors.New("Der KI-Anbieter hat keine vollständige Antwort geliefert.")
	}
	seen := map[string]bool{}
	for _, call := range calls {
		if call.ID == "" || call.Function.Name == "" || seen[call.ID] {
			return finish, nil, errors.New("Ungültiger Werkzeugaufruf; keine Aktion ausgeführt.")
		}
		seen[call.ID] = true
	}
	return finish, calls, nil
}
