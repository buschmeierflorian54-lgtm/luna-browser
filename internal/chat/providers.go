package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

type ModelInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Creator   string `json:"creator"`
	Provider  string `json:"provider"`
	MaxTokens int    `json:"max_tokens"`
	Chat      bool   `json:"chat"`
	Tools     bool   `json:"tools"`
}
type Config struct {
	Apple      AppleStatus     `json:"apple"`
	LocalModel ModelInfo       `json:"local_model"`
	Providers  map[string]bool `json:"providers"`
	Favorites  []ModelInfo     `json:"favorites"`
	Selected   int             `json:"selected"`
	Configured bool            `json:"configured"`
	Model      string          `json:"model"`
	MaxTokens  int             `json:"max_tokens"`
}

func providerURL(provider string) (string, error) {
	switch provider {
	case "openrouter":
		return "https://openrouter.ai/api/v1", nil
	case "groq":
		return "https://api.groq.com/openai/v1", nil
	}
	return "", errors.New("Unbekannter Anbieter.")
}
func providerKey(p string) string { return p + "-api-key" }
func (s *Service) configLocked() (Config, error) {
	c := Config{Favorites: []ModelInfo{}, Providers: map[string]bool{}, MaxTokens: MaxTokens}
	raw, exists, err := s.secrets.Get("chat-models.json")
	if err != nil {
		return c, err
	}
	if exists {
		if json.Unmarshal([]byte(raw), &c) != nil {
			return c, errors.New("Modellauswahl konnte nicht gelesen werden.")
		}
	}
	c.Providers = map[string]bool{}
	for _, p := range []string{"openrouter", "groq"} {
		_, ok, e := s.secrets.Get(providerKey(p))
		if e != nil {
			return c, e
		}
		c.Providers[p] = ok
	}
	if !exists && c.Providers["openrouter"] {
		c.Favorites = []ModelInfo{{ID: Model, Name: "Claude Sonnet 4.5", Creator: "anthropic", Provider: "openrouter", MaxTokens: MaxTokens, Chat: true, Tools: true}}
	}
	c.Apple = appleProbe()
	c.LocalModel = appleModel()
	c.Providers["apple"] = c.Apple.Available
	c.Configured = false
	c.Model = ""
	c.MaxTokens = MaxTokens
	if c.Selected == 2 {
		c.Model = c.LocalModel.ID
		c.MaxTokens = c.LocalModel.MaxTokens
		c.Configured = c.Apple.Available
	} else if c.Selected >= 0 && c.Selected < len(c.Favorites) {
		m := c.Favorites[c.Selected]
		c.Model = m.ID
		c.MaxTokens = m.MaxTokens
		c.Configured = c.Providers[m.Provider]
	}
	return c, nil
}
func (s *Service) Config() (Config, error) {
	s.configMu.Lock()
	defer s.configMu.Unlock()
	return s.configLocked()
}
func (s *Service) SetProviderKey(p, key string) (Config, error) {
	if _, err := providerURL(p); err != nil {
		return Config{}, err
	}
	key = strings.TrimSpace(key)
	if len(key) < 10 || len(key) > 4096 || strings.ContainsAny(key, "\r\n\t ") {
		return Config{}, errors.New("Bitte einen gültigen API-Schlüssel eingeben.")
	}
	s.configMu.Lock()
	defer s.configMu.Unlock()
	// Persist an empty initial selection before the first key; legacy installs retain Sonnet.
	c, err := s.configLocked()
	if err != nil {
		return c, err
	}
	raw, _ := json.Marshal(c)
	if err = s.secrets.Set("chat-models.json", string(raw)); err != nil {
		return c, err
	}
	if err = s.secrets.Set(providerKey(p), key); err != nil {
		return c, err
	}
	delete(s.catalog, p)
	return s.configLocked()
}
func (s *Service) ClearProviderKey(p string) (Config, error) {
	if _, err := providerURL(p); err != nil {
		return Config{}, err
	}
	s.configMu.Lock()
	defer s.configMu.Unlock()
	if err := s.secrets.Delete(providerKey(p)); err != nil {
		return Config{}, err
	}
	delete(s.catalog, p)
	return s.configLocked()
}
func (s *Service) Models(ctx context.Context, p string) ([]ModelInfo, error) {
	base, err := providerURL(p)
	if err != nil {
		return nil, err
	}
	s.configMu.Lock()
	key, ok, err := s.secrets.Get(providerKey(p))
	s.configMu.Unlock()
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("Bitte zuerst den API-Schlüssel dieses Anbieters speichern.")
	}
	endpoint := base + "/models"
	if p == "openrouter" {
		endpoint += "/user"
	}
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	req.Header.Set("Authorization", "Bearer "+key)
	client := s.CatalogHTTP
	if client == nil {
		client = &http.Client{Timeout: 25 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.New("Modellliste konnte nicht geladen werden. Bitte erneut versuchen.")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Modellliste nicht verfügbar (HTTP %d). Prüfe Schlüssel, Kontozugriff und Anfragelimit.", resp.StatusCode)
	}
	var data struct {
		Data []struct {
			ID           string `json:"id"`
			Name         string `json:"name"`
			Owner        string `json:"owned_by"`
			Active       *bool  `json:"active"`
			Max          int    `json:"max_completion_tokens"`
			Context      int    `json:"context_window"`
			Architecture struct {
				Output []string `json:"output_modalities"`
			} `json:"architecture"`
			Top struct {
				Max int `json:"max_completion_tokens"`
			} `json:"top_provider"`
			Supported []string `json:"supported_parameters"`
		} `json:"data"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 12<<20)).Decode(&data) != nil || data.Data == nil {
		return nil, errors.New("Ungültige Modellliste vom Anbieter.")
	}
	models := []ModelInfo{}
	for _, v := range data.Data {
		if v.ID == "" || (v.Active != nil && !*v.Active) {
			continue
		}
		m := ModelInfo{ID: v.ID, Name: v.Name, Creator: v.Owner, Provider: p, MaxTokens: MaxTokens, Chat: true, Tools: true}
		if m.Name == "" {
			m.Name = v.ID
		}
		if m.Creator == "" {
			m.Creator = strings.Split(v.ID, "/")[0]
			if !strings.Contains(v.ID, "/") {
				m.Creator = "Unbekannt"
			}
		}
		if p == "openrouter" {
			m.Creator = strings.Split(v.ID, "/")[0]
			m.Tools = false
			for _, param := range v.Supported {
				if param == "tools" {
					m.Tools = true
				}
			}
			if len(v.Architecture.Output) > 0 {
				m.Chat = false
				for _, out := range v.Architecture.Output {
					if out == "text" {
						m.Chat = true
					}
				}
			}
		}
		lower := strings.ToLower(v.ID)
		if p == "groq" && strings.Contains(lower, "compound") {
			m.Tools = false
		}
		if p == "groq" && (strings.Contains(lower, "whisper") || strings.Contains(lower, "orpheus") || strings.Contains(lower, "guard")) {
			m.Chat = false
			m.Tools = false
		}
		max := v.Max
		if max == 0 {
			max = v.Top.Max
		}
		if max == 0 && v.Context > 0 {
			max = v.Context / 2
		}
		if max > 0 && max < m.MaxTokens {
			m.MaxTokens = max
		}
		models = append(models, m)
	}
	sort.Slice(models, func(i, j int) bool { return strings.ToLower(models[i].Name) < strings.ToLower(models[j].Name) })
	s.configMu.Lock()
	defer s.configMu.Unlock()
	current, ok, _ := s.secrets.Get(providerKey(p))
	if !ok || current != key {
		return nil, errors.New("Der Schlüssel wurde geändert. Modelle bitte neu laden.")
	}
	if s.catalog == nil {
		s.catalog = map[string][]ModelInfo{}
	}
	s.catalog[p] = models
	return models, nil
}

// Empty model ID removes a slot. Slots are 0 and 1.
func (s *Service) SaveModel(slot int, p, id string) (Config, error) {
	s.configMu.Lock()
	defer s.configMu.Unlock()
	c, err := s.configLocked()
	if err != nil {
		return c, err
	}
	if slot < 0 || slot > 1 || slot > len(c.Favorites) {
		return c, errors.New("Bitte Modellplatz 1 oder 2 wählen.")
	}
	if id == "" {
		if slot < len(c.Favorites) {
			c.Favorites = append(c.Favorites[:slot], c.Favorites[slot+1:]...)
			if c.Selected != 2 && c.Selected >= len(c.Favorites) {
				c.Selected = 0
			}
		}
	} else {
		if !c.Providers[p] {
			return c, errors.New("API-Schlüssel fehlt.")
		}
		var chosen *ModelInfo
		for _, m := range s.catalog[p] {
			if m.ID == id {
				v := m
				chosen = &v
				break
			}
		}
		if chosen == nil {
			return c, errors.New("Bitte die Modellliste neu laden und daraus auswählen.")
		}
		if !chosen.Chat {
			return c, errors.New("Dieses Modell unterstützt keinen Textchat.")
		}
		for i, m := range c.Favorites {
			if i != slot && m.Provider == p && m.ID == id {
				return c, errors.New("Dieses Modell ist bereits hinzugefügt.")
			}
		}
		if slot == len(c.Favorites) {
			c.Favorites = append(c.Favorites, *chosen)
		} else {
			c.Favorites[slot] = *chosen
		}
	}
	raw, _ := json.Marshal(c)
	if err = s.secrets.Set("chat-models.json", string(raw)); err != nil {
		return c, err
	}
	return s.configLocked()
}
func (s *Service) SelectModel(slot int) (Config, error) {
	s.configMu.Lock()
	defer s.configMu.Unlock()
	c, err := s.configLocked()
	if err != nil {
		return c, err
	}
	if slot == 2 {
		if !c.Apple.Available {
			return c, errors.New(c.Apple.Reason)
		}
		c.Selected = 2
		raw, _ := json.Marshal(c)
		if err = s.secrets.Set("chat-models.json", string(raw)); err != nil {
			return c, err
		}
		return s.configLocked()
	}
	if slot < 0 || slot >= len(c.Favorites) {
		return c, errors.New("Modellplatz ist leer.")
	}
	if !c.Providers[c.Favorites[slot].Provider] {
		return c, errors.New("API-Schlüssel dieses Anbieters fehlt.")
	}
	c.Selected = slot
	raw, _ := json.Marshal(c)
	if err = s.secrets.Set("chat-models.json", string(raw)); err != nil {
		return c, err
	}
	return s.configLocked()
}
func (s *Service) requestConfig() (ModelInfo, string, error) {
	s.configMu.Lock()
	defer s.configMu.Unlock()
	c, err := s.configLocked()
	if err != nil {
		return ModelInfo{}, "", err
	}
	if c.Selected == 2 && !c.Apple.Available {
		return ModelInfo{}, "", errors.New(c.Apple.Reason)
	}
	if !c.Configured {
		return ModelInfo{}, "", errors.New("Bitte unter KI & MCP einen Anbieter verbinden und ein Modell auswählen.")
	}
	if c.Selected == 2 {
		return appleModel(), "", nil
	}
	m := c.Favorites[c.Selected]
	key, _, err := s.secrets.Get(providerKey(m.Provider))
	return m, key, err
}
