import { watchStartVisibility } from './personalization.js';
import { COLOR_THEMES, colorTheme } from './color-themes.js';
export const startBackgroundHTML = `<div class="st-bg" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="a4"></i><canvas class="st-waves"></canvas></div>`;
export function startWaves(canvas, host, still) {
  const ctx = canvas.getContext('2d');
  let w = 0,
    h = 0,
    raf = 0,
    mx = 0,
    my = 0,
    tx = 0,
    ty = 0;
  const L = [
    { b: 0.58, a: 38, k: 1.0, s: 0.16, p: 0.0, l: ['255,159,207', 0.34], d: ['196,72,152', 0.3] },
    { b: 0.67, a: 46, k: 0.7, s: -0.12, p: 2.1, l: ['183,156,242', 0.34], d: ['96,76,214', 0.32] },
    { b: 0.76, a: 34, k: 1.3, s: 0.2, p: 4.0, l: ['255,208,166', 0.38], d: ['160,70,104', 0.3] },
    { b: 0.85, a: 28, k: 0.9, s: -0.18, p: 1.2, l: ['159,216,255', 0.32], d: ['54,116,190', 0.3] },
    { b: 0.93, a: 22, k: 1.6, s: 0.24, p: 3.1, l: ['255,176,214', 0.34], d: ['140,60,130', 0.3] },
  ];
  const resize = () => {
    const r = host.getBoundingClientRect(),
      dpr = Math.min(2, devicePixelRatio || 1);
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (still) draw(0);
  };
  const draw = (t) => {
    const dark = document.documentElement.dataset.theme === 'dark';
    mx += (tx - mx) * 0.04;
    my += (ty - my) * 0.04; // weiches Nachziehen der Mausposition
    ctx.clearRect(0, 0, w, h);
    L.forEach((ly, i) => {
      const [rgb, al] = dark ? ly.d : ly.l;
      const palette = COLOR_THEMES.find((p) => p[0] === colorTheme());
      const waveColor = (alpha) =>
        palette[0] === 'luna'
          ? `rgba(${rgb},${alpha})`
          : `hsla(${palette[2] + i * 10},${palette[3]}%,${dark ? 40 : 72}%,${alpha})`;
      const base = h * ly.b + my * 22 * (i + 1) * 0.5;
      const ph = ly.p + t * ly.s * 6.283 + mx * 1.4 * (i % 2 ? -1 : 1);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) {
        const u = (x / w) * 6.283;
        const y =
          base +
          Math.sin(u * ly.k * 1.3 + ph) * ly.a +
          Math.sin(u * ly.k * 2.7 - t * 0.55 + i * 1.7) * ly.a * 0.38 +
          Math.sin(u * 0.6 + t * 0.2 + i) * ly.a * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - ly.a, 0, h);
      g.addColorStop(0, waveColor(al));
      g.addColorStop(1, waveColor(al * 0.15));
      ctx.fillStyle = g;
      ctx.fill();
    });
  };
  let visible = false,
    lastFrame = -Infinity;
  const t0 = performance.now();
  const loop = (now) => {
    if (!visible || still) {
      raf = 0;
      return;
    }
    if (now - lastFrame >= 1000 / 30) {
      draw((now - t0) / 1000);
      lastFrame = now;
    }
    raf = requestAnimationFrame(loop);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  host.parentElement.addEventListener('pointermove', onMove);
  const unwatch = watchStartVisibility(host.parentElement, (active) => {
    visible = active;
    host.parentElement.classList.toggle('start-motion-paused', !active || still);
    if (active && !still && !raf) raf = requestAnimationFrame(loop);
    else if (!active) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    unwatch();
    host.parentElement?.removeEventListener('pointermove', onMove);
  };
}
