package search

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const pageCSS = `
:root{--bg:#fbf2f7;--card:#fff;--ink:#3a2433;--ink2:#4a3042;--mute:#8a6c7e;--line:#ecd3e2;--head:#f3e1ec;--link:#8e3d72;--visited:#6b4a85;--acc:#a24d84;--chip:#f7e9f1}
@media (prefers-color-scheme:dark){:root{--bg:#1d1219;--card:#2a1a24;--ink:#fbeef6;--ink2:#e8d3e0;--mute:#b497a8;--line:#43283a;--head:#241520;--link:#f2a6d3;--visited:#c9a3e6;--acc:#d27cb0;--chip:#35202d}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,"SF Pro Text","Helvetica Neue",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
header{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--head) 88%,transparent);backdrop-filter:saturate(1.6) blur(18px);-webkit-backdrop-filter:saturate(1.6) blur(18px);border-bottom:1px solid var(--line)}
.hin{max-width:1120px;margin:0 auto;padding:12px 28px;display:flex;align-items:center;gap:22px}
.logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:19px;letter-spacing:-.01em;text-decoration:none;flex-shrink:0}
.logo i{width:26px;height:26px;border-radius:9px;background:linear-gradient(135deg,#d27cb0,#8e3d72);display:block;position:relative}
.logo i:after{content:"";position:absolute;left:6px;top:6px;width:8px;height:8px;border:2.4px solid #fff;border-radius:50%}
.logo i:before{content:"";position:absolute;left:16px;top:16px;width:6px;height:2.6px;background:#fff;border-radius:2px;transform:rotate(45deg);transform-origin:left center}
form{flex:1;max-width:680px;position:relative}
form svg{position:absolute;left:16px;top:50%;margin-top:-9px;color:var(--mute);pointer-events:none}
input[name=q]{width:100%;height:46px;border-radius:23px;border:1px solid var(--line);background:var(--card);padding:0 20px 0 46px;font:600 16px inherit;font-family:inherit;color:var(--ink);outline:none;box-shadow:0 1px 6px rgba(58,36,51,.06);transition:box-shadow .15s,border-color .15s}
input[name=q]:focus{border-color:var(--acc);box-shadow:0 2px 14px rgba(162,77,132,.22)}
.attr{margin-left:auto;font-size:12px;font-weight:700;color:var(--mute);white-space:nowrap}
main{max-width:1120px;margin:0 auto;padding:18px 28px 70px;display:grid;grid-template-columns:minmax(0,680px) minmax(0,330px);gap:48px;align-items:start}
main.one{grid-template-columns:minmax(0,680px)}
.meta{font-size:13px;color:var(--mute);margin:0 0 16px;font-weight:600}
.alt{margin:0 0 16px;padding:12px 16px;border-radius:14px;background:var(--chip);color:var(--ink2)}.alt a{color:var(--link);font-weight:800;text-decoration:none}
.r{display:flex;gap:16px;margin:0 0 26px;animation:in .35s ease both}
@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.r .c{flex:1;min-width:0}
.site{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--ink2);margin-bottom:3px;min-width:0}
.site img,.site .fb{width:20px;height:20px;border-radius:50%;background:var(--chip);flex-shrink:0;object-fit:cover}
.site .fb{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--acc)}
.site b{font-weight:700;white-space:nowrap}.site span{color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.t{display:inline-block;font-size:20px;font-weight:700;line-height:1.3;color:var(--link);text-decoration:none;letter-spacing:-.005em}
.t:hover{text-decoration:underline;text-underline-offset:3px}.t:visited{color:var(--visited)}
.age{font-size:13px;color:var(--mute);font-weight:600}
.d{margin:4px 0 0;color:var(--ink2)}.d strong{color:var(--ink);font-weight:800}
.x{margin:6px 0 0;padding-left:12px;border-left:2px solid var(--line);color:var(--mute);font-size:14px}.x strong{color:var(--ink2)}
.th{width:112px;height:84px;border-radius:12px;object-fit:cover;background:var(--chip);flex-shrink:0;border:1px solid var(--line)}
h2.sec{margin:6px 0 12px;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.strip{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 14px;margin:0 -2px 18px;scroll-snap-type:x proximity}
.strip::-webkit-scrollbar{height:6px}.strip::-webkit-scrollbar-thumb{background:var(--line);border-radius:6px}
.card{flex:0 0 220px;scroll-snap-align:start;background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;text-decoration:none;transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(58,36,51,.14)}
.card .im{position:relative;aspect-ratio:16/9;background:var(--chip)}.card .im img{width:100%;height:100%;object-fit:cover;display:block}
.card .du{position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.72);color:#fff;font-size:11px;font-weight:700;padding:1px 7px;border-radius:7px}
.card .cb{padding:10px 12px 12px}.card .ct{font-weight:700;font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card .cm{margin-top:6px;font-size:12px;color:var(--mute);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
details{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:0 0 8px;overflow:hidden}
summary{cursor:pointer;padding:13px 16px;font-weight:700;list-style:none;display:flex;justify-content:space-between;gap:12px}
summary::-webkit-details-marker{display:none}summary:after{content:"+";color:var(--acc);font-weight:800}details[open] summary:after{content:"–"}
details p{margin:0;padding:0 16px 14px;color:var(--ink2)}
.faq{margin-bottom:26px}
aside{position:sticky;top:84px}
.info{background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:0 4px 18px rgba(58,36,51,.07);animation:in .4s ease both}
.info img{width:100%;max-height:220px;object-fit:cover;display:block}
.info .ib{padding:16px 18px 18px}.info h3{margin:0 0 6px;font-size:21px;line-height:1.25}
.info p{margin:0;color:var(--ink2);font-size:14px;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
.info dl{margin:14px 0 0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px}
.info dt{color:var(--mute);font-weight:700}.info dd{margin:0;font-weight:600;overflow-wrap:anywhere}
.info a.go{display:inline-block;margin-top:14px;font-weight:800;color:var(--link);text-decoration:none;font-size:13px}
.pg{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}
.pg a,.pg span{min-width:42px;height:42px;padding:0 14px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:var(--card);border:1px solid var(--line);font-weight:700;text-decoration:none;color:var(--ink)}
.pg a:hover{background:var(--chip)}.pg span.cur{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.msg{padding:28px;border-radius:20px;background:var(--card);border:1px solid var(--line);max-width:560px}
.msg h2{margin:0 0 6px;font-size:20px}.msg p{margin:0;color:var(--ink2)}
.hero{text-align:center;padding:90px 20px;color:var(--mute);font-weight:600}
.kbd{display:inline-block;padding:0 7px;border:1px solid var(--line);border-bottom-width:2px;border-radius:6px;font-size:12px;font-weight:700;color:var(--ink2);background:var(--card)}
@media (max-width:900px){main{grid-template-columns:minmax(0,1fr);gap:20px}aside{position:static;order:-1}.attr{display:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`

const pageJS = `
addEventListener('keydown',function(e){var i=document.querySelector('input[name=q]');
if(e.key==='/'&&document.activeElement!==i){e.preventDefault();i.focus();i.select()}
else if(e.key==='Escape'&&document.activeElement===i){i.blur()}});
document.querySelectorAll('.site img').forEach(function(im){im.addEventListener('error',function(){im.remove()})});
document.querySelectorAll('.th,.im img,.info img').forEach(function(im){im.addEventListener('error',function(){im.style.display='none'})});
`

var funcs = template.FuncMap{
	"inc":     func(i int) int { return i + 1 },
	"dec":     func(i int) int { return i - 1 },
	"pages":   func(more bool, cur int) []int { return pageList(more, cur) },
	"initial": func(s string) string { return strings.ToUpper(firstRune(s)) },
	"secs":    func(d time.Duration) string { return strings.Replace(fmt.Sprintf("%.2f", d.Seconds()), ".", ",", 1) },
}

func firstRune(s string) string {
	for _, r := range s {
		return string(r)
	}
	return "?"
}

// pageList: Seitenzahlen 0-basiert; zeigt bis zur aktuellen Seite plus eine weitere, falls Brave mehr hat.
func pageList(more bool, cur int) []int {
	last := cur
	if more && cur < 9 {
		last = cur + 1
	}
	start := 0
	if last > 6 {
		start = last - 6
	}
	var out []int
	for i := start; i <= last; i++ {
		out = append(out, i)
	}
	return out
}

const iconSearch = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`

var pageTmpl = template.Must(template.New("p").Funcs(funcs).Parse(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light dark"><title>{{if .Query}}{{.Query}} – {{end}}Suche</title>
<style>` + pageCSS + `</style></head><body>
<header><div class="hin"><a class="logo" href="{{.Action}}"><i></i>Suche</a>
<form action="{{.Action}}" method="get">` + iconSearch + `<input name="q" value="{{.Query}}" autocomplete="off" spellcheck="false" aria-label="Suche" placeholder="Im Web suchen" {{if not .Query}}autofocus{{end}}></form>
<span class="attr">Ergebnisse von Brave</span></div></header>
{{if .Err}}<main class="one"><div class="msg"><h2>{{.ErrTitle}}</h2><p>{{.Err}}</p></div></main>
{{else if not .Query}}<main class="one"><div class="hero">Gib oben einen Suchbegriff ein.<br><br>Mit <span class="kbd">/</span> springst du jederzeit ins Suchfeld.</div></main>
{{else}}{{$p := .Page}}<main class="{{if not $p.Info}}one{{end}}"><section>
<p class="meta">Seite {{inc .PageNo}} · {{secs $p.Took}} s</p>
{{if $p.Altered}}<div class="alt">Meintest du <a href="{{.Action}}?q={{.AltEsc}}">{{$p.Altered}}</a>?</div>{{end}}
{{if not $p.Results}}<div class="msg"><h2>Keine Treffer</h2><p>Zu „{{.Query}}“ hat Brave nichts gefunden.</p></div>{{end}}
{{range .Head}}{{template "res" .}}{{end}}
{{if .News}}<h2 class="sec">Nachrichten</h2><div class="strip">{{range .News}}<a class="card" href="{{.URL}}" rel="noopener noreferrer"><div class="im">{{if .Thumb}}<img src="{{.Thumb}}" alt="" loading="lazy">{{end}}</div><div class="cb"><div class="ct">{{.Title}}</div><div class="cm">{{.Host}}{{if .Age}} · {{.Age}}{{end}}</div></div></a>{{end}}</div>{{end}}
{{if .Videos}}<h2 class="sec">Videos</h2><div class="strip">{{range .Videos}}<a class="card" href="{{.URL}}" rel="noopener noreferrer"><div class="im">{{if .Thumb}}<img src="{{.Thumb}}" alt="" loading="lazy">{{end}}{{if .Duration}}<span class="du">{{.Duration}}</span>{{end}}</div><div class="cb"><div class="ct">{{.Title}}</div><div class="cm">{{.Host}}{{if .Age}} · {{.Age}}{{end}}</div></div></a>{{end}}</div>{{end}}
{{if $p.FAQ}}<div class="faq"><h2 class="sec">Häufige Fragen</h2>{{range $p.FAQ}}<details><summary>{{.Q}}</summary><p>{{.A}}</p></details>{{end}}</div>{{end}}
{{range .Tail}}{{template "res" .}}{{end}}
<nav class="pg" aria-label="Seiten">{{if gt .PageNo 0}}<a href="{{.Action}}?q={{.QEsc}}&p={{dec .PageNo}}">←</a>{{end}}{{$cur := .PageNo}}{{$a := .Action}}{{$q := .QEsc}}{{range pages $p.More .PageNo}}{{if eq . $cur}}<span class="cur">{{inc .}}</span>{{else}}<a href="{{$a}}?q={{$q}}&p={{.}}">{{inc .}}</a>{{end}}{{end}}{{if and $p.More (lt .PageNo 9)}}<a href="{{.Action}}?q={{.QEsc}}&p={{inc .PageNo}}">→</a>{{end}}</nav>
</section>
{{with $p.Info}}<aside><div class="info">{{if .Thumb}}<img src="{{.Thumb}}" alt="">{{end}}<div class="ib"><h3>{{.Title}}</h3>{{if .Desc}}<p>{{.Desc}}</p>{{end}}{{if .Attrs}}<dl>{{range .Attrs}}<dt>{{index . 0}}</dt><dd>{{index . 1}}</dd>{{end}}</dl>{{end}}{{if .URL}}<a class="go" href="{{.URL}}" rel="noopener noreferrer">{{.Host}} ↗</a>{{end}}</div></div></aside>{{end}}
</main>{{end}}
<script nonce="{{.Nonce}}">` + pageJS + `</script></body></html>
{{define "res"}}<article class="r"><div class="c"><div class="site">{{if .Favicon}}<img src="{{.Favicon}}" alt="" width="20" height="20">{{else}}<span class="fb">{{initial .Host}}</span>{{end}}<b>{{.Host}}</b><span>{{.Path}}</span></div>
<a class="t" href="{{.URL}}" rel="noopener noreferrer">{{.Title}}</a>{{if .Age}} <span class="age">· {{.Age}}</span>{{end}}
<p class="d">{{.Desc}}</p>{{range .Extra}}<div class="x">{{.}}</div>{{end}}</div>{{if .Thumb}}<img class="th" src="{{.Thumb}}" alt="" loading="lazy">{{end}}</article>{{end}}`))

type pageData struct {
	Query, Action, QEsc, AltEsc string
	PageNo                      int
	Page                        *Page
	Head, Tail                  []Result
	News                        []News
	Videos                      []Video
	Err, ErrTitle, Nonce        string
}

// Handler liefert die Ergebnisseite unter /search/<token>.
func Handler(c *Client, token string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/search/"+token, func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		pn, _ := strconv.Atoi(r.URL.Query().Get("p"))
		if pn < 0 || pn > 9 {
			pn = 0
		}
		nb := make([]byte, 12)
		_, _ = rand.Read(nb)
		d := pageData{Query: q, Action: "/search/" + token, QEsc: url.QueryEscape(q), PageNo: pn, Nonce: hex.EncodeToString(nb)}
		if q != "" {
			ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
			defer cancel()
			page, err := c.Search(ctx, q, pn)
			if err != nil {
				d.Err, d.ErrTitle = err.Error(), "Suche nicht möglich"
				if errors.Is(err, ErrNoKey) {
					d.ErrTitle = "Brave-API-Schlüssel fehlt"
					d.Err = "Hinterlege deinen Schlüssel in den Einstellungen (⌘,). Einen bekommst du auf brave.com/search/api."
				}
			} else {
				d.Page, d.News, d.Videos = page, page.News, page.Videos
				d.AltEsc = url.QueryEscape(page.Altered)
				n := 3
				if n > len(page.Results) {
					n = len(page.Results)
				}
				d.Head, d.Tail = page.Results[:n], page.Results[n:]
				if pn > 0 { // Zusatzblöcke nur auf der ersten Seite
					d.News, d.Videos, d.Page.FAQ, d.Page.Info = nil, nil, nil, nil
				}
			}
		}
		h := w.Header()
		h.Set("Content-Type", "text/html; charset=utf-8")
		h.Set("Cache-Control", "no-store")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; script-src 'nonce-"+d.Nonce+"'; form-action 'self'; base-uri 'none'")
		_ = pageTmpl.Execute(w, d)
	})
	return mux
}
