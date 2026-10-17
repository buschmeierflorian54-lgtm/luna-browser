// Package search ist die eigene Suchmaschine des Browsers: Sie fragt die Brave-Search-API ab und liefert
// bereinigte Daten an die Oberfläche, die die Ergebnisse selbst darstellt (als Teil des Browsers, nicht als
// Webseite). Der API-Schlüssel verlässt dieses Paket nie.
package search

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"html/template"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const braveEndpoint = "https://api.search.brave.com/res/v1/web/search"

// ErrNoKey: es ist kein API-Schlüssel hinterlegt.
var ErrNoKey = errors.New("Kein Brave-API-Schlüssel hinterlegt.")

type Result struct {
	Title   string          `json:"title"`
	URL     string          `json:"url"`
	Host    string          `json:"host"`
	Path    string          `json:"path"`
	Favicon string          `json:"favicon"`
	Desc    template.HTML   `json:"desc"` // bereinigt: nur <strong> bleibt erhalten
	Extra   []template.HTML `json:"extra"`
	Age     string          `json:"age"`
	Thumb   string          `json:"thumb"`
}

type Info struct {
	Title string        `json:"title"`
	URL   string        `json:"url"`
	Thumb string        `json:"thumb"`
	Host  string        `json:"host"`
	Desc  template.HTML `json:"desc"`
	Attrs [][2]string   `json:"attrs"`
}

type News struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Host    string `json:"host"`
	Age     string `json:"age"`
	Thumb   string `json:"thumb"`
	Favicon string `json:"favicon"`
}
type Video struct {
	Title    string `json:"title"`
	URL      string `json:"url"`
	Host     string `json:"host"`
	Age      string `json:"age"`
	Thumb    string `json:"thumb"`
	Duration string `json:"duration"`
}
type FAQ struct {
	Q   string `json:"q"`
	A   string `json:"a"`
	URL string `json:"url"`
}

type Page struct {
	Query   string   `json:"query"`
	Altered string   `json:"altered"` // von Brave korrigierte Schreibweise
	Results []Result `json:"results"`
	Info    *Info    `json:"info"`
	News    []News   `json:"news"`
	Videos  []Video  `json:"videos"`
	FAQ     []FAQ    `json:"faq"`
	More    bool     `json:"more"`
	Millis  int64    `json:"millis"`
}

// Client fragt Brave ab. Key liefert den Schlüssel bei jeder Anfrage frisch (Schlüsselbund).
type Client struct {
	Key      func() (string, error)
	Endpoint string // nur für Tests; leer = Brave
	HTTP     *http.Client
}

func NewClient(key func() (string, error)) *Client {
	return &Client{Key: key, Endpoint: braveEndpoint, HTTP: &http.Client{Timeout: 10 * time.Second}}
}

const perPage = 20

type meta struct {
	Host    string `json:"hostname"`
	Path    string `json:"path"`
	Favicon string `json:"favicon"`
}
type thumb struct {
	Src string `json:"src"`
}
type braveResp struct {
	Query struct {
		Altered string `json:"altered"`
		More    bool   `json:"more_results_available"`
	} `json:"query"`
	Web struct {
		Results []struct {
			Title       string   `json:"title"`
			URL         string   `json:"url"`
			Description string   `json:"description"`
			Age         string   `json:"age"`
			Extra       []string `json:"extra_snippets"`
			Meta        meta     `json:"meta_url"`
			Thumbnail   thumb    `json:"thumbnail"`
		} `json:"results"`
	} `json:"web"`
	Infobox struct {
		Results []struct {
			Title    string     `json:"title"`
			Label    string     `json:"label"`
			Desc     string     `json:"description"`
			LongDesc string     `json:"long_desc"`
			URL      string     `json:"url"`
			Website  string     `json:"website_url"`
			Thumb    thumb      `json:"thumbnail"`
			Attrs    [][]string `json:"attributes"`
		} `json:"results"`
	} `json:"infobox"`
	News struct {
		Results []struct {
			Title string `json:"title"`
			URL   string `json:"url"`
			Age   string `json:"age"`
			Meta  meta   `json:"meta_url"`
			Thumb thumb  `json:"thumbnail"`
		} `json:"results"`
	} `json:"news"`
	Videos struct {
		Results []struct {
			Title string `json:"title"`
			URL   string `json:"url"`
			Age   string `json:"age"`
			Meta  meta   `json:"meta_url"`
			Thumb thumb  `json:"thumbnail"`
			Video struct {
				Duration string `json:"duration"`
			} `json:"video"`
		} `json:"results"`
	} `json:"videos"`
	FAQ struct {
		Results []struct {
			Question string `json:"question"`
			Answer   string `json:"answer"`
			URL      string `json:"url"`
		} `json:"results"`
	} `json:"faq"`
}

// plain: HTML-Entities auflösen (Brave liefert z. B. &#x27;); das Escapen übernimmt das Template.
func plain(s string) string { return html.UnescapeString(s) }

// sanitize macht aus Brave-Text sicheres HTML: Entities auflösen, alles escapen, nur <strong> erhalten.
func sanitize(s string) template.HTML {
	const o, c = "\uE000", "\uE001"
	s = strings.ReplaceAll(strings.ReplaceAll(s, "<strong>", o), "</strong>", c)
	s = html.UnescapeString(s)
	e := template.HTMLEscapeString(s)
	e = strings.ReplaceAll(strings.ReplaceAll(e, o, "<strong>"), c, "</strong>")
	return template.HTML(e)
}

// safeImg lässt nur https-Bilder zu.
func safeImg(u string) string {
	if strings.HasPrefix(u, "https://") {
		return u
	}
	return ""
}

func hostOf(h, raw string) string {
	if h == "" {
		if u, err := url.Parse(raw); err == nil {
			h = u.Hostname()
		}
	}
	return strings.TrimPrefix(h, "www.")
}

// crumb macht aus "/wiki/Berlin" ein "› wiki › Berlin".
func crumb(p string) string {
	parts := strings.FieldsFunc(plain(p), func(r rune) bool { return r == '/' })
	if len(parts) > 3 {
		parts = append(parts[:2], "…", parts[len(parts)-1])
	}
	if len(parts) == 0 {
		return ""
	}
	return "› " + strings.Join(parts, " › ")
}

// Search holt Seite page (0-basiert) der Ergebnisse.
func (c *Client) Search(ctx context.Context, q string, page int) (*Page, error) {
	key, err := c.Key()
	if err != nil {
		return nil, err
	}
	if key == "" {
		return nil, ErrNoKey
	}
	if page < 0 || page > 9 {
		page = 0
	}
	v := url.Values{}
	v.Set("q", q)
	v.Set("count", strconv.Itoa(perPage))
	v.Set("offset", strconv.Itoa(page))
	v.Set("country", "DE")
	v.Set("search_lang", "de")
	v.Set("ui_lang", "de-DE")
	v.Set("safesearch", "moderate")
	v.Set("spellcheck", "1")
	v.Set("extra_snippets", "true")
	v.Set("text_decorations", "true")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.Endpoint+"?"+v.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Subscription-Token", key)
	t0 := time.Now()
	resp, err := c.HTTP.Do(req)
	if err == nil && resp.StatusCode == 429 { // Free-Plan: 1 Anfrage/s – einmal kurz warten und erneut versuchen
		resp.Body.Close()
		select {
		case <-time.After(1100 * time.Millisecond):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		resp, err = c.HTTP.Do(req.Clone(ctx))
	}
	if err != nil {
		return nil, fmt.Errorf("Brave ist nicht erreichbar: %w", errors.Unwrap(err))
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	switch {
	case resp.StatusCode == 401 || resp.StatusCode == 403 || resp.StatusCode == 422:
		return nil, errors.New("Der API-Schlüssel wurde von Brave abgelehnt. Bitte in den Einstellungen prüfen.")
	case resp.StatusCode == 429:
		return nil, errors.New("Brave-Limit erreicht (Free-Plan: 1 Anfrage pro Sekunde, begrenzte Anfragen pro Monat). Bitte kurz warten.")
	case resp.StatusCode >= 400:
		return nil, fmt.Errorf("Brave antwortete mit Fehler %d.", resp.StatusCode)
	}
	var br braveResp
	if err := json.Unmarshal(body, &br); err != nil {
		return nil, errors.New("Unerwartete Antwort von Brave.")
	}
	p := &Page{Query: q, More: br.Query.More, Millis: time.Since(t0).Milliseconds()}
	if br.Query.Altered != "" && !strings.EqualFold(br.Query.Altered, q) {
		p.Altered = plain(br.Query.Altered)
	}
	for _, r := range br.Web.Results {
		res := Result{Title: plain(r.Title), URL: r.URL, Host: hostOf(r.Meta.Host, r.URL), Path: crumb(r.Meta.Path),
			Favicon: safeImg(r.Meta.Favicon), Desc: sanitize(r.Description), Age: plain(r.Age), Thumb: safeImg(r.Thumbnail.Src)}
		for i, x := range r.Extra {
			if i >= 2 {
				break
			}
			res.Extra = append(res.Extra, sanitize(x))
		}
		p.Results = append(p.Results, res)
	}
	if len(br.Infobox.Results) > 0 {
		i := br.Infobox.Results[0]
		in := &Info{Title: plain(firstNonEmpty(i.Title, i.Label)), URL: firstNonEmpty(i.URL, i.Website), Thumb: safeImg(i.Thumb.Src),
			Desc: sanitize(firstNonEmpty(i.LongDesc, i.Desc))}
		in.Host = hostOf("", in.URL)
		for _, a := range i.Attrs {
			if len(a) >= 2 && len(in.Attrs) < 6 {
				in.Attrs = append(in.Attrs, [2]string{plain(a[0]), plain(a[1])})
			}
		}
		if in.Title != "" && (in.Desc != "" || in.Thumb != "") {
			p.Info = in
		}
	}
	for i, n := range br.News.Results {
		if i >= 6 {
			break
		}
		p.News = append(p.News, News{Title: plain(n.Title), URL: n.URL, Host: hostOf(n.Meta.Host, n.URL), Age: plain(n.Age), Thumb: safeImg(n.Thumb.Src), Favicon: safeImg(n.Meta.Favicon)})
	}
	for i, vd := range br.Videos.Results {
		if i >= 6 {
			break
		}
		p.Videos = append(p.Videos, Video{Title: plain(vd.Title), URL: vd.URL, Host: hostOf(vd.Meta.Host, vd.URL), Age: plain(vd.Age), Thumb: safeImg(vd.Thumb.Src), Duration: vd.Video.Duration})
	}
	for i, f := range br.FAQ.Results {
		if i >= 4 {
			break
		}
		p.FAQ = append(p.FAQ, FAQ{Q: plain(f.Question), A: plain(f.Answer), URL: f.URL})
	}
	return p, nil
}

func firstNonEmpty(s ...string) string {
	for _, x := range s {
		if strings.TrimSpace(x) != "" {
			return x
		}
	}
	return ""
}

// Test prüft den Schlüssel mit einer minimalen Anfrage.
func (c *Client) Test(ctx context.Context) error {
	_, err := c.Search(ctx, "test", 0)
	return err
}

/* ---------- Lokaler Server ---------- */
