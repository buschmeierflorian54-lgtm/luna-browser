package search

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const fake = `{"query":{"altered":"golang","more_results_available":true},"web":{"results":[
 {"title":"Go &amp; <script>x</script>","url":"https://go.dev/","description":"Die <strong>Go</strong> Sprache&#x27;s <img src=x onerror=1>","age":"vor 2 Tagen","extra_snippets":["Mehr <strong>Go</strong>"],"meta_url":{"hostname":"www.go.dev","path":"/doc/tutorial","favicon":"https://imgs.search.brave.com/f.png"},"thumbnail":{"src":"https://imgs.search.brave.com/t.png"}},
 {"title":"Bad","url":"javascript:alert(1)","description":"x","thumbnail":{"src":"javascript:evil"}}]},
 "infobox":{"results":[{"title":"Go","long_desc":"Programmiersprache","website_url":"https://go.dev","attributes":[["Entwickler","Google"]]}]},
 "news":{"results":[{"title":"Go 1.30","url":"https://n.de/1","age":"1 Std.","meta_url":{"hostname":"n.de"}}]},
 "videos":{"results":[{"title":"Go Tour","url":"https://v.de/1","video":{"duration":"12:30"},"meta_url":{"hostname":"v.de"}}]},
 "faq":{"results":[{"question":"Was ist Go?","answer":"Eine Sprache.","url":"https://go.dev"}]}}`

func brave(t *testing.T, throttleFirst bool) (*Client, *int) {
	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		if r.Header.Get("X-Subscription-Token") != "KEY" {
			w.WriteHeader(401)
			return
		}
		if throttleFirst && hits == 1 {
			w.WriteHeader(429)
			return
		}
		io.WriteString(w, fake)
	}))
	t.Cleanup(srv.Close)
	c := NewClient(func() (string, error) { return "KEY", nil })
	c.Endpoint = srv.URL
	return c, &hits
}

func TestSearchData(t *testing.T) {
	c, _ := brave(t, false)
	p, err := c.Search(context.Background(), "golng", 0)
	if err != nil || len(p.Results) != 2 || !p.More || p.Results[0].Host != "go.dev" || p.Altered != "golang" {
		t.Fatalf("%+v %v", p, err)
	}
	if p.Info == nil || len(p.News) != 1 || len(p.Videos) != 1 || len(p.FAQ) != 1 {
		t.Fatalf("Zusatzblöcke fehlen: %+v", p)
	}
	var back Page // JSON-Rundlauf wie zum Frontend
	raw, _ := json.Marshal(p)
	if err := json.Unmarshal(raw, &back); err != nil || back.Results[0].Path != "› doc › tutorial" || back.Videos[0].Duration != "12:30" {
		t.Fatalf("JSON: %v %+v", err, back)
	}
	// Titel kommen als Klartext (Entities aufgelöst); das Escapen macht die Oberfläche
	if p.Results[0].Title != "Go & <script>x</script>" {
		t.Errorf("Titel: %q", p.Results[0].Title)
	}
	// Beschreibung ist HTML: alles außer <strong> muss escaped sein
	d := string(p.Results[0].Desc)
	if strings.Contains(d, "<img") || strings.Contains(d, "<script") || !strings.Contains(d, "<strong>Go</strong>") || !strings.Contains(d, "Sprache&#39;s") {
		t.Errorf("Desc unsicher: %s", d)
	}
	// Nicht-https-Bilder werden verworfen
	if p.Results[1].Thumb != "" {
		t.Error("javascript:-Thumb nicht verworfen")
	}
}

func TestErrorsAndRetry(t *testing.T) {
	c, _ := brave(t, false)
	c.Key = func() (string, error) { return "", nil }
	if _, err := c.Search(context.Background(), "x", 0); err != ErrNoKey {
		t.Fatal(err)
	}
	c.Key = func() (string, error) { return "falsch", nil }
	if _, err := c.Search(context.Background(), "x", 0); err == nil || !strings.Contains(err.Error(), "abgelehnt") {
		t.Fatalf("401: %v", err)
	}
	c2, hits := brave(t, true)
	if _, err := c2.Search(context.Background(), "x", 0); err != nil || *hits != 2 {
		t.Fatalf("429-Retry: hits=%d err=%v", *hits, err)
	}
}
