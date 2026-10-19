package chat

import (
	"browser-mac/internal/secret"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestProvidersCatalogAndSlots(t *testing.T) {
	s := New(t.TempDir(), secret.New(t.TempDir()), nil)
	defer s.Close()
	calls := 0
	s.CatalogHTTP = &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		body := `{"data":[{"id":"anthropic/test","name":"Test Claude","supported_parameters":["tools"],"architecture":{"output_modalities":["text"]},"top_provider":{"max_completion_tokens":8192}},{"id":"image/only","architecture":{"output_modalities":["image"]}}]}`
		if r.URL.Host == "api.groq.com" {
			if r.Header.Get("Authorization") != "Bearer groq-test-key" {
				t.Error("wrong Groq key")
			}
			body = `{"data":[{"id":"openai/test","owned_by":"OpenAI","active":true,"max_completion_tokens":16384},{"id":"whisper-large-v3","owned_by":"OpenAI"}]}`
		} else if r.URL.Path != "/api/v1/models/user" || r.Header.Get("Authorization") != "Bearer router-test-key" {
			t.Error("wrong OpenRouter request")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
	if _, err := s.Models(context.Background(), "groq"); err == nil || calls != 0 {
		t.Fatal("catalog before key")
	}
	s.SetProviderKey("openrouter", "router-test-key")
	s.SetProviderKey("groq", "groq-test-key")
	or, err := s.Models(context.Background(), "openrouter")
	if err != nil || len(or) != 2 {
		t.Fatal(or, err)
	}
	if _, err = s.SaveModel(0, "openrouter", "image/only"); err == nil {
		t.Fatal("image selected")
	}
	if _, err = s.SaveModel(0, "openrouter", "anthropic/test"); err != nil {
		t.Fatal(err)
	}
	s.Models(context.Background(), "groq")
	if _, err = s.SaveModel(1, "groq", "openai/test"); err != nil {
		t.Fatal(err)
	}
	if _, err = s.SaveModel(2, "groq", "openai/test"); err == nil {
		t.Fatal("third slot")
	}
	c, err := s.SelectModel(1)
	if err != nil || c.MaxTokens != 16384 || len(c.Favorites) != 2 {
		t.Fatal(c, err)
	}
	m, key, err := s.requestConfig()
	if err != nil || m.Provider != "groq" || key != "groq-test-key" {
		t.Fatal("incorrect request config")
	}
	raw, _ := json.Marshal(c)
	if strings.Contains(string(raw), "test-key") {
		t.Fatal("key exposed")
	}
	restored := New(s.dir, s.secrets, nil)
	defer restored.Close()
	c, _ = restored.Config()
	if c.Selected != 1 || c.Model != "openai/test" {
		t.Fatal(c)
	}
	s.ClearProviderKey("groq")
	if _, _, err = s.requestConfig(); err == nil {
		t.Fatal("removed key still usable")
	}
	if _, err = s.Models(context.Background(), "other"); err == nil {
		t.Fatal("unknown provider")
	}
}
func TestGroqRequestContract(t *testing.T) {
	c := NewClient()
	c.Groq = true
	c.ModelID = "chosen-model"
	c.TokenLimit = 8192
	c.HTTP = &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["model"] != "chosen-model" || body["max_completion_tokens"] != float64(8192) || body["max_tokens"] != nil {
			t.Error(body)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("data: {\"choices\":[{\"delta\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n"))}, nil
	})}
	if _, err := c.Stream(context.Background(), "test", nil, func(string) {}); err != nil {
		t.Fatal(err)
	}
}
