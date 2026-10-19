import { $ } from './ui.js';

// Wie ein Foto aus einer alten Sofortbildkamera: Blitz, dann springt das Bild als Polaroid aus der Seite in die Ecke,
// wackelt kurz nach, entwickelt sich aus einem blassen Sepia-Ton und rutscht danach wieder hinaus.
// page: Rechteck, über dem geblitzt wird (Seitenbereich); zIndex hebt die Ebene über Dialoge (Einrichtung).
export async function playPolaroid(src, page, zIndex) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let layer = $('#shotLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'shotLayer';
    document.body.appendChild(layer);
  }
  layer.style.zIndex = zIndex ? String(zIndex) : '';
  layer.innerHTML = '';
  const place = (el, r) => {
    el.style.left = r.left + 'px';
    el.style.top = r.top + 'px';
    el.style.width = r.width + 'px';
    el.style.height = r.height + 'px';
  };
  const FRAME = 12,
    CAPTION = 34;
  const tw = Math.min(280, page.width * 0.32),
    imgH = Math.min(200, (tw * page.height) / page.width),
    th = imgH + FRAME + CAPTION;
  const target = {
    left: page.right - tw - 28,
    top: page.bottom - th - 40,
    width: tw,
    height: th,
  };
  const flash = document.createElement('div');
  flash.className = 'shot-flash';
  place(flash, page);
  const card = document.createElement('div');
  card.className = 'shot-polaroid';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  const caption = document.createElement('div');
  caption.className = 'shot-caption';
  caption.textContent = 'Kopiert ✓';
  card.append(img, caption);
  place(card, reduce ? target : page);
  layer.append(card, flash);
  if (!reduce) {
    // 1) Blitz mit hellem Zentrum, das Bild zuckt kurz zusammen
    flash.animate([{ opacity: 1 }, { opacity: 0.35, offset: 0.3 }, { opacity: 0 }], {
      duration: 260,
      easing: 'ease-out',
      fill: 'forwards',
    });
    await card
      .animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(.975)', offset: 0.4 },
          { transform: 'scale(1)' },
        ],
        { duration: 120 },
      )
      .finished.catch(() => {});
    // 2) Das Bild bekommt seinen weißen Rahmen und springt als Polaroid in die Ecke (mit Überschwingen)
    const developing = 'sepia(1) brightness(1.9) contrast(.5) saturate(.3) blur(3px)';
    img.animate([{ filter: developing }, { filter: developing }], {
      duration: 560,
      fill: 'forwards',
    });
    caption.animate(
      [
        { height: '0px', opacity: 0 },
        { height: CAPTION + 'px', opacity: 1 },
      ],
      {
        duration: 420,
        easing: 'ease-out',
        fill: 'forwards',
      },
    );
    await card
      .animate(
        [
          {
            left: page.left + 'px',
            top: page.top + 'px',
            width: page.width + 'px',
            height: page.height + 'px',
            padding: '0px',
            borderRadius: '12px',
            transform: 'rotate(0deg)',
            boxShadow: '0 0 0 rgba(0,0,0,0)',
          },
          {
            left: target.left + 'px',
            top: target.top + 'px',
            width: tw + 'px',
            height: th + 'px',
            padding: `${FRAME}px ${FRAME}px 0px`,
            borderRadius: '4px',
            transform: 'rotate(-5deg)',
            boxShadow: '0 22px 50px rgba(0,0,0,.5)',
          },
        ],
        { duration: 560, easing: 'cubic-bezier(.3,1.35,.45,1)', fill: 'forwards' },
      )
      .finished.catch(() => {});
    // 3) Kurzes Nachwackeln, während sich das Bild entwickelt
    card.animate(
      [
        { transform: 'rotate(-5deg)' },
        { transform: 'rotate(-3deg) translateY(-3px)', offset: 0.3 },
        { transform: 'rotate(-6deg)', offset: 0.6 },
        { transform: 'rotate(-4.5deg)' },
      ],
      { duration: 520, easing: 'ease-in-out', fill: 'forwards' },
    );
    await img
      .animate(
        [
          { filter: developing },
          {
            filter: 'sepia(.6) brightness(1.25) contrast(.8) saturate(.6) blur(1px)',
            offset: 0.55,
          },
          { filter: 'none' },
        ],
        { duration: 1500, easing: 'ease-out', fill: 'forwards' },
      )
      .finished.catch(() => {});
    await new Promise((r) => setTimeout(r, 900));
    // 4) Das Foto rutscht nach rechts unten wieder hinaus
    await card
      .animate(
        [
          { opacity: 1, transform: 'rotate(-4.5deg)' },
          { opacity: 0, transform: 'translate(60px, 40px) rotate(8deg) scale(.92)' },
        ],
        { duration: 280, easing: 'ease-in', fill: 'forwards' },
      )
      .finished.catch(() => {});
  } else {
    await new Promise((r) => setTimeout(r, 900));
  }
  layer.innerHTML = '';
}
