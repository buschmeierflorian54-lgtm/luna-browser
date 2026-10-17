package search

import (
	"context"
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

func brave(t *testing.T) *Client {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Subscription-Token") != "KEY" {
			w.WriteHeader(401)
			return
		}
		io.WriteString(w, fake)
	}))
	t.Cleanup(srv.Close)
	c := NewClient(func() (string, error) { return "KEY", nil })
	c.Endpoint = srv.URL
	return c
}

func TestSearchAndRender(t *testing.T) {
	c := brave(t)
	p, err := c.Search(context.Background(), "golng", 0)
	if err != nil || len(p.Results) != 2 || !p.More || p.Results[0].Host != "go.dev" || p.Altered != "golang" {
		t.Fatalf("%+v %v", p, err)
	}
	if p.Info == nil || len(p.News) != 1 || len(p.Videos) != 1 || len(p.FAQ) != 1 {
		t.Fatalf("Zusatzblöcke fehlen: %+v", p)
	}
	h := httptest.NewServer(Handler(c, "tok"))
	defer h.Close()
	resp, _ := http.Get(h.URL + "/search/tok?q=golng")
	b, _ := io.ReadAll(resp.Body)
	s := string(b)
	for _, want := range []string{"<strong>Go</strong>", "Sprache&#39;s", "Go &amp; ", "Nachrichten", "Videos", "12:30", "Häufige Fragen", "Meintest du", "Programmiersprache", "nonce="} {
		if !strings.Contains(s, want) {
			t.Errorf("fehlt: %q", want)
		}
	}
	for _, bad := range []string{"<script>x", "<img src=x", "javascript:alert", "javascript:evil", "&amp;#"} {
		if strings.Contains(s, bad) {
			t.Fatalf("unsicher/kaputt: %s", bad)
		}
	}
	if r2, _ := http.Get(h.URL + "/search/falsch?q=x"); r2.StatusCode != 404 {
		t.Fatal("Token wird nicht geprüft")
	}
	if csp := resp.Header.Get("Content-Security-Policy"); !strings.Contains(csp, "default-src 'none'") {
		t.Fatal("CSP fehlt")
	}
}

func TestErrors(t *testing.T) {
	c := brave(t)
	c.Key = func() (string, error) { return "", nil }
	if _, err := c.Search(context.Background(), "x", 0); err != ErrNoKey {
		t.Fatal(err)
	}
	c.Key = func() (string, error) { return "falsch", nil }
	if _, err := c.Search(context.Background(), "x", 0); err == nil || !strings.Contains(err.Error(), "abgelehnt") {
		t.Fatalf("401: %v", err)
	}
}
