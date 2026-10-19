package chat

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestRequestTooLargeRecovery(t *testing.T) {
	c := NewClient()
	attempt := 0
	noticed := false
	c.OnResize = func(s string) { noticed = true }
	call := ToolCall{ID: "call-1", Type: "function"}
	call.Function.Name = "browser_page"
	call.Function.Arguments = `{}`
	messages := []Message{{Role: "system", Content: "System"}, {Role: "user", Content: strings.Repeat("Old", 10000)}, {Role: "assistant", Content: "Old answer"}, {Role: "user", Content: "Keep my complete question"}, {Role: "assistant", ToolCalls: []ToolCall{call}}, {Role: "tool", ToolCallID: "call-1", Content: strings.Repeat("Data", 10000)}}
	c.HTTP = &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		attempt++
		var payload struct {
			Messages []Message `json:"messages"`
			Max      int       `json:"max_tokens"`
		}
		json.NewDecoder(r.Body).Decode(&payload)
		if attempt == 1 {
			return &http.Response{StatusCode: 413, Body: io.NopCloser(strings.NewReader("too large"))}, nil
		}
		if payload.Max > 8192 || len(payload.Messages) != 4 || payload.Messages[1].Content != "Keep my complete question" || payload.Messages[2].ToolCalls[0].ID != payload.Messages[3].ToolCallID || len(payload.Messages[3].Content) > 5000 {
			t.Errorf("bad reduced request: max=%d messages=%d", payload.Max, len(payload.Messages))
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("data: {\"choices\":[{\"delta\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n"))}, nil
	})}
	if _, err := c.Stream(context.Background(), "test", messages, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if attempt != 2 || !noticed || len(messages[5].Content) != 40000 {
		t.Fatal("history changed or recovery missing")
	}
	// A subsequent tool round reuses the reduced budget without shrinking again.
	if _, err := c.Stream(context.Background(), "test", messages, func(string) {}); err != nil {
		t.Fatal(err)
	}
	if c.TokenLimit != 8192 {
		t.Fatal("budget shrank repeatedly", c.TokenLimit)
	}
}
func TestRateLimitWaitAndCancellation(t *testing.T) {
	c := NewClient()
	attempt := 0
	waited := time.Duration(0)
	c.waitRetry = func(ctx context.Context, d time.Duration) error { waited += d; return nil }
	c.HTTP = &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		attempt++
		return &http.Response{StatusCode: 429, Header: http.Header{"Retry-After": []string{"3"}}, Body: io.NopCloser(strings.NewReader("private response not exposed"))}, nil
	})}
	_, err := c.Stream(context.Background(), "test", nil, func(string) {})
	if err == nil || attempt != 3 || waited != 6*time.Second || strings.Contains(err.Error(), "private") {
		t.Fatal(attempt, waited, err)
	}
	attempt = 0
	c.waitRetry = func(ctx context.Context, d time.Duration) error { return context.Canceled }
	_, err = c.Stream(context.Background(), "test", nil, func(string) {})
	if err == nil || attempt != 1 {
		t.Fatal("retry after cancellation", attempt, err)
	}
}
