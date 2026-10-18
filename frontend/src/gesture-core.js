// Mausgeste: Kreis mit gedrückter linker Maustaste.
// Klassisches Skript (kein Modul), damit dieselbe Datei sowohl in der Oberfläche als auch – von Go – in jede Webseite
// eingeschleust werden kann. Definiert window.__fmCircle({ target, onCircle, enabled }) und gibt eine Abmelde-Funktion zurück.
(function () {
  if (window.__fmCircle) return;

  window.__fmCircle = function (opts) {
    var target = opts.target || window;
    var onCircle = opts.onCircle || function () {};
    var onS = opts.onS || function () {};
    var enabled = opts.enabled || function () { return window.__fmGesture !== false; };
    var ACCENT = '#d27cb0';

    var pts = null, fired = false, swallow = 0, canvas = null, ctx = null, raf = 0, fade = null, shotTimer = 0;

    function skip(el) {
      if (!el || !el.closest) return false;
      return !!el.closest('input,textarea,select,option,[contenteditable],video,audio,object,embed');
    }

    /* ---------- Spur ---------- */
    function ensureCanvas() {
      if (canvas) return;
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      var s = canvas.style;
      s.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;';
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr);
      ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      (document.documentElement || document.body).appendChild(canvas);
    }
    function removeCanvas() { cancelAnimationFrame(raf); fade = null; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); canvas = ctx = null; }
    function drawTrail(alpha, ring) {
      if (!ctx) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (pts && pts.length > 1) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (var i = 1; i < pts.length; i++) {            // Spur wird zum Ende hin kräftiger
          var a = alpha * (0.15 + 0.85 * i / pts.length);
          ctx.strokeStyle = 'rgba(210,124,176,' + a.toFixed(3) + ')';
          ctx.lineWidth = 2 + 3.5 * i / pts.length;
          ctx.shadowColor = 'rgba(210,124,176,' + (a * 0.8).toFixed(3) + ')'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
        }
      }
      if (ring) {
        ctx.shadowBlur = 0; ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(210,124,176,' + (ring.a).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, 6.2832); ctx.stroke();
      }
    }
    function fadeOut(ring0) {                              // Spur (und Ring bei Erfolg) blenden aus
      var t0 = performance.now(), dur = ring0 ? 520 : 260;
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        drawTrail(1 - k, ring0 ? { x: ring0.x, y: ring0.y, r: ring0.r * (1 + 0.45 * k), a: (1 - k) * 0.9 } : null);
        if (k < 1) raf = requestAnimationFrame(step); else removeCanvas();
      })(t0);
    }

    /* ---------- Erkennung ---------- */
    function analyze() {
      var now = pts[pts.length - 1].t, i0 = 0;
      while (i0 < pts.length - 1 && now - pts[i0].t > 3500) i0++;   // nur die letzten 3,5 s zählen
      var p = pts.slice(i0);
      if (p.length < 14) return null;
      var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, cx = 0, cy = 0, i;
      for (i = 0; i < p.length; i++) {
        minx = Math.min(minx, p[i].x); maxx = Math.max(maxx, p[i].x); miny = Math.min(miny, p[i].y); maxy = Math.max(maxy, p[i].y);
        cx += p[i].x; cy += p[i].y;
      }
      var w = maxx - minx, h = maxy - miny, big = Math.max(w, h), small = Math.min(w, h);
      if (big < 44 || small / big < 0.45) return null;               // zu klein oder eher eine Linie
      cx /= p.length; cy /= p.length;
      var sum = 0, sq = 0, r = [];
      for (i = 0; i < p.length; i++) { var d = Math.hypot(p[i].x - cx, p[i].y - cy); r.push(d); sum += d; }
      var mean = sum / p.length;
      for (i = 0; i < r.length; i++) sq += (r[i] - mean) * (r[i] - mean);
      if (Math.sqrt(sq / r.length) / mean > 0.36) return null;       // Abstand zur Mitte muss fast konstant sein
      var sweep = 0, prev = Math.atan2(p[0].y - cy, p[0].x - cx);
      for (i = 1; i < p.length; i++) {
        var a = Math.atan2(p[i].y - cy, p[i].x - cx), da = a - prev;
        while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
        sweep += da; prev = a;
      }
      if (Math.abs(sweep) < 5.7) return null;                        // ≥ ca. 327° gedreht
      return { dir: sweep > 0 ? 'cw' : 'ccw', x: cx, y: cy, r: mean };
    }

    /* ---------- S-Erkennung (Vorlagenvergleich, ähnlich dem $1-Erkenner) ---------- */
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function resample(p, n) {
      var L = 0, i; for (i = 1; i < p.length; i++) L += dist(p[i - 1], p[i]);
      if (L < 1) return null;
      var step = L / (n - 1), acc = 0, out = [{ x: p[0].x, y: p[0].y }], q = p.slice();
      for (i = 1; i < q.length; i++) {
        var d = dist(q[i - 1], q[i]);
        if (acc + d >= step) {
          var t = (step - acc) / d, m = { x: q[i - 1].x + t * (q[i].x - q[i - 1].x), y: q[i - 1].y + t * (q[i].y - q[i - 1].y) };
          out.push(m); q.splice(i, 0, m); acc = 0;
        } else acc += d;
      }
      while (out.length < n) out.push({ x: q[q.length - 1].x, y: q[q.length - 1].y });
      return out.slice(0, n);
    }
    function normalize(p) {                         // Bounding-Box auf 0..1 (je Achse), damit nur die Form zählt
      var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, i;
      for (i = 0; i < p.length; i++) { minx = Math.min(minx, p[i].x); maxx = Math.max(maxx, p[i].x); miny = Math.min(miny, p[i].y); maxy = Math.max(maxy, p[i].y); }
      var w = maxx - minx || 1, h = maxy - miny || 1;
      return p.map(function (q) { return { x: (q.x - minx) / w, y: (q.y - miny) / h }; });
    }
    var N = 48, TPL = (function () {                // ein "S": oberer Bogen gegen den Uhrzeigersinn, unterer im Uhrzeigersinn
      var pts = [], i, a;
      for (i = 0; i <= 40; i++) { a = (-30 - 240 * i / 40) * Math.PI / 180; pts.push({ x: Math.cos(a) * 0.5, y: -0.5 + Math.sin(a) * 0.5 }); }
      for (i = 1; i <= 40; i++) { a = (-90 + 240 * i / 40) * Math.PI / 180; pts.push({ x: Math.cos(a) * 0.5, y: 0.5 + Math.sin(a) * 0.5 }); }
      return normalize(resample(pts, N));
    })();
    var TPL_REV = TPL.slice().reverse();
    function meanDist(a, b) { var s = 0, i; for (i = 0; i < a.length; i++) s += dist(a[i], b[i]); return s / a.length; }
    function analyzeS(path) {
      var now = path[path.length - 1].t, i0 = 0;
      while (i0 < path.length - 1 && now - path[i0].t > 4000) i0++;
      var p = path.slice(i0);
      if (p.length < 18) return null;
      var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, i;
      for (i = 0; i < p.length; i++) { minx = Math.min(minx, p[i].x); maxx = Math.max(maxx, p[i].x); miny = Math.min(miny, p[i].y); maxy = Math.max(maxy, p[i].y); }
      var w = maxx - minx, h = maxy - miny;
      if (h < 70 || w < 28 || h / w < 0.8 || h / w > 4) return null;   // groß genug und etwa so hoch wie breit oder höher
      var rs = resample(p, N); if (!rs) return null;
      var n = normalize(rs), d = Math.min(meanDist(n, TPL), meanDist(n, TPL_REV));   // von oben nach unten oder umgekehrt gezeichnet
      return d <= S_MAX ? { d: d } : null;
    }
    var S_MAX = (opts.sThreshold || 0.2);

    /* ---------- Ereignisse ---------- */
    function end() {
      var had = pts && pts.length > 1;
      if (pts && !fired && pts.length >= 18 && enabled()) {            // beim Loslassen: war es ein S?
        var s = analyzeS(pts);
        if (s) {
          fired = true;
          try { var sel = window.getSelection && window.getSelection(); if (sel) sel.removeAllRanges(); } catch (x) { /* egal */ }
          var mx = 0, my = 0; for (var k = 0; k < pts.length; k++) { mx += pts[k].x; my += pts[k].y; }
          var shotPoint = { x: mx / pts.length, y: my / pts.length };
          removeCanvas();
          // WKWebView kann Animationsframes pausieren. Ein kurzer Timer lässt die
          // entfernte Spur verschwinden, ohne die Aufnahme an rAF zu koppeln.
          shotTimer = setTimeout(function () {
            shotTimer = 0;
            try { onS(shotPoint); } catch (x) { /* nie die Seite stören */ }
          }, 120);
          pts = null; swallow = Date.now() + 450; fired = false; return true;
        }
      }
      if (!fired && canvas) fadeOut(null);
      pts = null;
      if (fired) { swallow = Date.now() + 450; }
      fired = false;
      return had;
    }
    function down(e) {
      if (shotTimer) return;
      if (e.button !== 0 || e.detail > 1 || e.metaKey || e.ctrlKey || e.altKey || !enabled() || skip(e.target)) { pts = null; return; }
      pts = [{ x: e.clientX, y: e.clientY, t: Date.now() }]; fired = false;
    }
    function move(e) {
      if (!pts) return;
      if (!(e.buttons & 1)) { end(); return; }
      var l = pts[pts.length - 1];
      if (Math.hypot(e.clientX - l.x, e.clientY - l.y) < 4) return;
      pts.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      if (pts.length > 400) pts.shift();
      if (fired) return;
      if (pts.length > 10) { ensureCanvas(); drawTrail(1, null); }    // erst bei echter Bewegung: einfache Klicks bleiben unberührt
      if (pts.length >= 14 && pts.length % 2 === 0) {
        var res = analyze();
        if (res) {
          fired = true;
          try { var sel = window.getSelection && window.getSelection(); if (sel) sel.removeAllRanges(); } catch (x) { /* egal */ }
          if (canvas) { cancelAnimationFrame(raf); fadeOut(res); }
          try { onCircle(res); } catch (x) { /* Handler darf die Seite nie stören */ }
        }
      }
    }
    function click(e) {                                    // der Klick, der auf die Geste folgen würde, wird verworfen
      if (swallow && Date.now() < swallow) { swallow = 0; e.stopPropagation(); e.preventDefault(); }
    }

    target.addEventListener('mousedown', down, true);
    target.addEventListener('mousemove', move, true);
    target.addEventListener('mouseup', end, true);
    target.addEventListener('click', click, true);
    window.addEventListener('blur', end);
    return function detach() {
      target.removeEventListener('mousedown', down, true); target.removeEventListener('mousemove', move, true);
      target.removeEventListener('mouseup', end, true); target.removeEventListener('click', click, true);
      window.removeEventListener('blur', end); clearTimeout(shotTimer); shotTimer = 0; removeCanvas();
    };
  };
})();
