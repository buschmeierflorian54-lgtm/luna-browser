// Package spotifyapi implements desktop OAuth with PKCE. Tokens never leave Go.
package spotifyapi

import (
	"browser-mac/internal/secret"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

const Redirect = "http://127.0.0.1:8888/callback"
const credentialFile = "spotify-account.json"

type credentials struct {
	ClientID string `json:"client_id"`
	Access   string `json:"access_token"`
	Refresh  string `json:"refresh_token"`
	Expires  int64  `json:"expires"`
	Name     string `json:"name"`
	Scope    string `json:"scope"`
}
type Status struct {
	Configured bool   `json:"configured"`
	Connected  bool   `json:"connected"`
	Pending    bool   `json:"pending"`
	Name       string `json:"name"`
	Message    string `json:"message"`
	Redirect   string `json:"redirect"`
}
type Client struct {
	mu            sync.Mutex
	store         *secret.Store
	c             credentials
	pending       bool
	message       string
	server        *http.Server
	HTTP          *http.Client
	API, Accounts string
}

func New(s *secret.Store) *Client {
	c := &Client{store: s, HTTP: &http.Client{Timeout: 15 * time.Second}, API: "https://api.spotify.com/v1", Accounts: "https://accounts.spotify.com"}
	raw, _, _ := s.Get(credentialFile)
	_ = json.Unmarshal([]byte(raw), &c.c)
	return c
}
func (c *Client) save() error {
	b, e := json.Marshal(c.c)
	if e != nil {
		return e
	}
	return c.store.Set(credentialFile, string(b))
}
func (c *Client) Status() Status {
	c.mu.Lock()
	defer c.mu.Unlock()
	return Status{c.c.ClientID != "", c.c.Refresh != "", c.pending, c.c.Name, c.message, Redirect}
}

var clientIDPattern = regexp.MustCompile(`^[a-fA-F0-9]{32}$`)

func (c *Client) Configure(id string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	id = strings.TrimSpace(id)
	if !clientIDPattern.MatchString(id) {
		return errors.New("Bitte eine gültige Spotify Client ID (32 Zeichen) eingeben.")
	}
	c.cancel()
	if id != c.c.ClientID {
		c.c = credentials{ClientID: id}
	}
	c.message = "Client ID gespeichert. Konto kann verknüpft werden."
	return c.save()
}
func (c *Client) cancel() {
	if c.server != nil {
		_ = c.server.Close()
		c.server = nil
	}
	c.pending = false
}
func (c *Client) Disconnect() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cancel()
	c.c = credentials{ClientID: c.c.ClientID}
	c.message = "Konto getrennt."
	return c.save()
}
func randomString() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func (c *Client) Connect(open func(string) error) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.c.ClientID == "" {
		return errors.New("Bitte zuerst die Client ID speichern.")
	}
	c.cancel()
	listener, err := net.Listen("tcp", "127.0.0.1:8888")
	if err != nil {
		return errors.New("Der Anmelde-Port 8888 ist belegt. Schließe weitere Luna-Browser-Instanzen und versuche es erneut.")
	}
	state, verifier := randomString(), randomString()
	hash := sha256.Sum256([]byte(verifier))
	id := c.c.ClientID
	mux := http.NewServeMux()
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	c.server = server
	c.pending = true
	c.message = "Bitte die Anmeldung im geöffneten Browser abschließen."
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if r.Method != "GET" || subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("state")), []byte(state)) != 1 {
			http.Error(w, "Ungültige Anmeldung.", http.StatusBadRequest)
			return
		}
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.server != server || !c.pending {
			http.Error(w, "Anmeldung abgelaufen.", 400)
			return
		}
		defer func() {
			c.pending = false
			c.server = nil
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), time.Second)
				defer cancel()
				_ = server.Shutdown(ctx)
			}()
		}()
		if r.URL.Query().Get("error") != "" {
			c.message = "Anmeldung abgebrochen. Du kannst es erneut versuchen."
			http.Error(w, c.message, 400)
			return
		}
		code := r.URL.Query().Get("code")
		if code == "" {
			c.message = "Spotify hat keinen Anmeldecode geliefert."
			http.Error(w, c.message, 400)
			return
		}
		old := c.c
		err := c.token(r.Context(), url.Values{"grant_type": {"authorization_code"}, "client_id": {id}, "code": {code}, "redirect_uri": {Redirect}, "code_verifier": {verifier}})
		if err == nil {
			var profile struct {
				Name string `json:"display_name"`
				ID   string `json:"id"`
			}
			err = c.get(r.Context(), "/me", &profile)
			if err == nil {
				c.c.Name = profile.Name
				if c.c.Name == "" {
					c.c.Name = profile.ID
				}
				err = c.save()
			}
		}
		if err != nil {
			c.c = old
			c.message = err.Error()
			http.Error(w, c.message, 400)
			return
		}
		c.message = "Spotify ist verknüpft."
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, `<!doctype html><meta charset="utf-8"><title>Spotify verbunden</title><body style="background:#171c19;color:#ecfff2;font:18px system-ui;display:grid;place-content:center;min-height:90vh;text-align:center"><h1>Alles verbunden.</h1><p>Zurück zu Luna Browser – deine Musik wartet.</p><p>Dieses Fenster kannst du schließen.</p>`)
	})
	go func() { _ = server.Serve(listener) }()
	time.AfterFunc(5*time.Minute, func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.server == server {
			c.cancel()
			c.message = "Anmeldung abgelaufen. Bitte erneut verbinden."
		}
	})
	q := url.Values{"client_id": {id}, "response_type": {"code"}, "redirect_uri": {Redirect}, "state": {state}, "code_challenge_method": {"S256"}, "code_challenge": {base64.RawURLEncoding.EncodeToString(hash[:])}, "scope": {"user-read-private user-modify-playback-state user-read-playback-state user-read-currently-playing"}, "show_dialog": {"true"}}
	if err = open(c.Accounts + "/authorize?" + q.Encode()); err != nil {
		c.cancel()
		c.message = "Anmeldefenster konnte nicht geöffnet werden."
		return errors.New(c.message)
	}
	return nil
}
func apiError(status int) error {
	switch status {
	case 401:
		return errors.New("Spotify-Anmeldung abgelaufen. Bitte das Konto erneut verknüpfen.")
	case 403:
		return errors.New("Spotify verweigert den API-Zugriff. Prüfe Premium-Status und freigeschaltete Nutzer deiner Developer-App.")
	case 429:
		return errors.New("Zu viele Spotify-Anfragen. Bitte kurz warten und erneut suchen.")
	}
	return fmt.Errorf("Spotify-Anfrage fehlgeschlagen (HTTP %d).", status)
}
func (c *Client) token(ctx context.Context, form url.Values) error {
	req, err := http.NewRequestWithContext(ctx, "POST", c.Accounts+"/api/token", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return errors.New("Spotify ist nicht erreichbar. Bitte die Verbindung prüfen.")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return apiError(res.StatusCode)
	}
	var t struct {
		Scope   *string `json:"scope"`
		Access  string  `json:"access_token"`
		Refresh string  `json:"refresh_token"`
		Expires int64   `json:"expires_in"`
	}
	if json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&t) != nil || t.Access == "" {
		return errors.New("Ungültige Antwort von Spotify.")
	}
	c.c.Access = t.Access
	if t.Scope != nil {
		c.c.Scope = *t.Scope
	}
	if t.Refresh != "" {
		c.c.Refresh = t.Refresh
	}
	c.c.Expires = time.Now().Unix() + t.Expires
	return nil
}
func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.API+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.c.Access)
	res, err := c.HTTP.Do(req)
	if err != nil {
		return errors.New("Spotify ist nicht erreichbar. Bitte erneut versuchen.")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		if res.StatusCode == 401 {
			c.c.Expires = 0
		}
		return apiError(res.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(res.Body, 4<<20)).Decode(out)
}
func (c *Client) authorize(ctx context.Context) error {
	if c.c.Refresh == "" {
		return errors.New("Verbinde dein Spotify-Konto unter Einstellungen → Spotify.")
	}
	if time.Now().Unix()+60 < c.c.Expires {
		return nil
	}
	if err := c.token(ctx, url.Values{"grant_type": {"refresh_token"}, "refresh_token": {c.c.Refresh}, "client_id": {c.c.ClientID}}); err != nil {
		return err
	}
	return c.save()
}

type Image struct {
	URL string `json:"url"`
}
type Artist struct {
	Name   string  `json:"name"`
	URI    string  `json:"uri"`
	Images []Image `json:"images"`
}
type Album struct {
	Name    string   `json:"name"`
	URI     string   `json:"uri"`
	Images  []Image  `json:"images"`
	Artists []Artist `json:"artists"`
	Year    string   `json:"release_date"`
}
type Track struct {
	Name     string   `json:"name"`
	URI      string   `json:"uri"`
	Artists  []Artist `json:"artists"`
	Album    Album    `json:"album"`
	Duration int      `json:"duration_ms"`
	Explicit bool     `json:"explicit"`
}
type TrackPage struct {
	Items []Track `json:"items"`
	Next  string  `json:"next"`
}
type ArtistPage struct {
	Items []Artist `json:"items"`
}
type AlbumPage struct {
	Items []Album `json:"items"`
}
type Results struct {
	Tracks  TrackPage  `json:"tracks"`
	Artists ArtistPage `json:"artists"`
	Albums  AlbumPage  `json:"albums"`
}

func (c *Client) Search(ctx context.Context, q string) (*Results, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	q = strings.TrimSpace(q)
	if q == "" || len(q) > 500 {
		return nil, errors.New("Bitte einen Suchbegriff mit höchstens 500 Zeichen eingeben.")
	}
	if err := c.authorize(ctx); err != nil {
		return nil, err
	}
	var result Results
	err := c.get(ctx, "/search?"+url.Values{"q": {q}, "type": {"track,artist,album"}, "limit": {"10"}}.Encode(), &result)
	return &result, err
}

// AddToQueue targets Spotify's active playback device; never auto-retry a POST.
func (c *Client) AddToQueue(ctx context.Context, uri string) error {
	if !regexp.MustCompile(`^spotify:track:[A-Za-z0-9]{22}$`).MatchString(uri) {
		return errors.New("Bitte einen Spotify-Song in die Warteschlange ziehen.")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.authorize(ctx); err != nil {
		return err
	}
	if !strings.Contains(" "+c.c.Scope+" ", " user-modify-playback-state ") {
		return errors.New("Für die Warteschlange bitte unter Einstellungen → Spotify das Konto erneut verbinden und die Wiedergabe-Steuerung erlauben.")
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.API+"/me/player/queue?"+url.Values{"uri": {uri}}.Encode(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.c.Access)
	res, err := c.HTTP.Do(req)
	if err != nil {
		return errors.New("Spotify hat nicht geantwortet. Prüfe die Warteschlange vor einem erneuten Versuch.")
	}
	defer res.Body.Close()
	// Spotify also returns 200 for successful queue additions.
	switch res.StatusCode {
	case http.StatusOK, http.StatusNoContent:
		return nil
	case 404:
		return errors.New("Kein aktives Spotify-Gerät. Starte zunächst einen Song in Spotify.")
	case 403:
		// Connect speakers can expose their queue while rejecting writes.
		// Diagnose only; never transfer playback or repeat the queue POST.
		if strings.Contains(" "+c.c.Scope+" ", " user-read-playback-state ") {
			var playback struct {
				Device struct {
					Name       string `json:"name"`
					Restricted bool   `json:"is_restricted"`
				} `json:"device"`
			}
			if c.get(ctx, "/me/player", &playback) == nil && playback.Device.Restricted {
				name := strings.TrimSpace(playback.Device.Name)
				if name == "" {
					name = "dem aktiven Lautsprecher"
				}
				return fmt.Errorf("Spotify blockiert das Hinzufügen auf %s (eingeschränktes Connect-Gerät). Wähle in Spotify diesen Computer als Wiedergabegerät oder verwalte die Warteschlange in der Lautsprecher-App.", name)
			}
		}
		return errors.New("Spotify erlaubt die Warteschlange nicht. Dafür sind Premium und die Berechtigung zur Wiedergabe-Steuerung erforderlich. Verbinde dein Konto gegebenenfalls erneut.")
	case 401:
		c.c.Expires = 0
	}
	return apiError(res.StatusCode)
}

type Queue struct {
	Current *Track  `json:"currently_playing"`
	Items   []Track `json:"queue"`
}

func (c *Client) Queue(ctx context.Context) (*Queue, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.authorize(ctx); err != nil {
		return nil, err
	}
	if !strings.Contains(" "+c.c.Scope+" ", " user-read-playback-state ") {
		return nil, errors.New("Zum Anzeigen der Warteschlange bitte dein Spotify-Konto erneut verbinden und die Wiedergabe-Berechtigungen erlauben.")
	}
	var q Queue
	if err := c.get(ctx, "/me/player/queue", &q); err != nil {
		return nil, err
	}
	return &q, nil
}
