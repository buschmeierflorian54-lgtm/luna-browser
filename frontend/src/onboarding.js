import { createLoadWatchdog, showSlowSetup, slowSetupVisible } from './slow-setup.js';
import { WINDOWS, shortcut } from './platform.js';
import './gesture-core.js';
import * as api from './api.js';
import { esc } from './ui.js';
import { playPolaroid } from './polaroid.js';
import { lunaWordmark, practiceWordmark } from './branding.js';
import './styles/onboarding.css';

const SERVICES = [
  {
    id: 'brave',
    name: 'Luna Search',
    label: 'Brave-API-Key',
    url: 'https://api-dashboard.search.brave.com/app/keys',
    title: 'Deine Suche. Direkt in Luna.',
    text: 'Ohne Brave-API-Key ergibt Luna Search wenig Sinn: Die integrierten Suchergebnisse brauchen diesen Zugang. Du kannst stattdessen Google ohne API-Key nutzen.',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    label: 'Spotify Client ID',
    url: 'https://developer.spotify.com/dashboard',
    title: 'Deine Musik zieht mit ein.',
    text: 'Die Spotify API ist die offizielle Schnittstelle, über die Luna mit Spotify spricht. Luna nutzt sie für die Suche nach Songs, Künstlern und Alben sowie für Wiedergabeinformationen und die Warteschlange. Abgespielt wird über deine installierte Spotify-App, die Luna per AppleScript steuert.',
  },
  {
    id: 'screenshot',
    name: 'Screenshot',
  },
  {
    id: 'groq',
    name: 'Groq',
    label: 'Groq-API-Key',
    url: 'https://console.groq.com/keys',
    title: 'Noch eine Stimme für Luna.',
    text: 'Groq ist ein weiterer optionaler Anbieter für Luna Chat. Du kannst beide Anbieter hinterlegen und zwischen deinen Modellen wechseln.',
  },
];
const PROGRESS_KEY = 'luna-onboarding-step';
const DEMO_DRAW_MS = 2400;
export function createOnboarding({ onFinish, refreshSearch }) {
  let root,
    step = -1,
    active = false,
    view = 'form',
    busy = false,
    timer,
    polling = false,
    generation = 0;
  let currentID = 0,
    lastCount = null,
    copied = false,
    saved = false,
    configured = {},
    connected = false,
    linkingSpotify = false,
    suspended = false;
  let slowNotice = false;
  const braveWatchdog = createLoadWatchdog(2000, () => {
    if (!active || service()?.id !== 'brave') return;
    showSlowSetup({
      hideNative() {
        slowNotice = true;
        api.show(-1);
        api.focusUI();
      },
      resume() {
        slowNotice = false;
        showNative();
      },
    });
  });
  let practiceTimer, detachPractice, demoTimer, demoTick, demoWriting;
  // Stoppt die Maus-Demo samt Tönen (beim Zeichnen des Nutzers, bei Schrittwechsel und beim Beenden).
  function stopDemo() {
    clearTimeout(demoTimer);
    clearInterval(demoTick);
    demoTimer = demoTick = undefined;
    if (demoWriting) api.gestureWriteSound(false);
    demoWriting = false;
  }
  const drafts = new Map();
  const tabs = new Map(),
    owned = new Set(),
    parents = new Map();
  let previousFocus;
  const service = () => SERVICES[step];
  const btn = (action, label, cls = '') =>
    `<button type="button" data-setup="${action}" class="${cls}">${label}</button>`;
  const message = (text) => {
    const el = root?.querySelector('[data-message]');
    if (el) el.textContent = text;
  };
  function storeStep() {
    try {
      localStorage.setItem(PROGRESS_KEY, String(step));
    } catch {}
  }
  function showNative() {
    if (!active) return;
    if (slowSetupVisible()) {
      api.show(-1);
      return;
    }
    if (
      (view === 'portal' || view === 'split') &&
      currentID &&
      !suspended &&
      !slowNotice &&
      !slowSetupVisible()
    ) {
      const r = root.querySelector('.setup-web')?.getBoundingClientRect();
      if (r)
        api.setFrame(
          Math.round(r.left),
          Math.round(r.top),
          Math.round(r.width),
          Math.round(r.height),
        );
      api.show(currentID);
    } else api.show(-1);
  }
  function render() {
    if (!root) return;
    if (service()?.id !== 'brave' || view === 'form') braveWatchdog.stop();
    clearTimeout(practiceTimer);
    stopDemo();
    detachPractice?.();
    detachPractice = null;
    root.onpointerdown = null;
    const s = service();
    root.className = `setup ${view}${step === 2 ? ' setup-gesture-stage' : ''}`;
    root.innerHTML = `<header class="setup-head"><span class="setup-brand">${lunaWordmark}</span><span>DEIN START MIT LUNA</span>${btn('later', 'Später fortsetzen', 'setup-quiet')}</header><div class="setup-progress" aria-label="Einrichtungsschritte">${['Willkommen', 'Suche', 'Musik', 'Screenshot', 'Groq', 'Bereit'].map((name, i) => `<span class="${i === step + 1 ? 'current' : ''} ${i < step + 1 ? 'done' : ''}">${i + 1}<b>${name}</b></span>`).join('')}</div><div class="setup-layout">
      ${view === 'portal' || view === 'split' ? `<section class="setup-provider"><div class="setup-webbar">${btn('webback', '←')}${btn('webreload', '↻')}<span data-host>${esc(new URL(s.url).host)}</span>${btn('form', 'Key eingeben')}</div><div class="setup-web" aria-label="Anbieterseite in Luna"></div><p class="setup-webhint">${esc(s.name)} ist in Luna geöffnet. Kopiere deinen ${esc(s.label)}. Ein frisch kopierter Key wird ins Eingabefeld übernommen. Du entscheidest, wann es weitergeht.</p></section>` : ''}
      <section class="setup-card">${
        step === -1
          ? `<span class="setup-eyebrow">HALLO. ICH BIN LUNA.</span><h1>Mach es dir<br>im Web gemütlich.</h1><p>Deine Farben, deine Musik und deine Werkzeuge. Lass uns Luna kurz auf dich einstellen.</p><div class="setup-features"><article><b>Dein Look</b><span>Zehn Farbwelten, flexible Seitenmenüs und Mausgesten.</span></article><article><b>Deine Suche & Musik</b><span>Luna Search oder Google. Spotify-Suche, Wiedergabe und Warteschlange.</span></article><article><b>Deine KI</b><span>Luna Chat mit OpenRouter oder Groq. ${WINDOWS ? 'Windows-Testversion: experimentell und instabil. Apple Intelligence ist nur auf dem Mac verfügbar.' : 'Sira nutzt Apple Intelligence auf unterstützten Macs, ohne API-Key.'}</span></article></div><p class="setup-note">Du entscheidest, was du verbindest. Dienste sind optional; alle Einstellungen kannst du später ändern.</p>${btn('next', 'Luna kennenlernen →', 'setup-primary')}`
          : step === 4
            ? `<span class="setup-eyebrow">ALLES AN DEINEM PLATZ</span><h1>Deine Luna<br>ist bereit.</h1><p>${configured.google ? 'Google ist deine Standardsuche.' : 'Luna Search ist eingerichtet.'} Musik und KI kannst du jederzeit in den Einstellungen ergänzen.</p><div class="setup-features"><article><b>Musik</b><span>Tippe „spotify“ für Luna Music oder „play“ mit einem Songtitel.</span></article><article><b>Chat & Modelle</b><span>Tippe „chat“. Modelle wählst du in KI & MCP. Browser-Werkzeuge aktivierst du dort ausdrücklich über MCP.</span></article></div><p class="setup-note">Zugangsdaten bleiben im geschützten App-Speicher. Sie werden nur für den jeweiligen Dienst verwendet.</p>${btn('finish', 'Los geht’s', 'setup-primary')}`
            : step === 2
              ? `<span class="setup-eyebrow">EINE GESTE. EIN BILD.</span><h1>Zeichne ein S.<br>Halte den Moment fest.</h1><div class="setup-practice-prompt" hidden aria-live="polite">${practiceWordmark}</div><div class="setup-gesture-demo"><svg viewBox="0 0 160 160" role="img" aria-label="S-Geste: oben rechts beginnen und ein S bis unten links zeichnen"><path class="setup-gesture-guide" d="M125 35 C25 -15 5 80 80 80 C155 80 135 175 35 125"/><path class="setup-gesture-line" pathLength="1" d="M125 35 C25 -15 5 80 80 80 C155 80 135 175 35 125"/><circle cx="125" cy="35" r="5"/><g class="setup-mouse"><circle class="setup-click-ring" cx="0" cy="0" r="0"/><g class="setup-mouse-body"><rect x="-11" y="-8" width="22" height="34" rx="11"/><path class="setup-mouse-button" d="M-11 10 V3 A11 11 0 0 1 0 -8 V10 Z"/><path d="M-11 10 H11 M0 -8 V10"/></g></g></svg><span>Hier starten · oben rechts</span></div><ol class="setup-gesture-steps"><li><b>Linke Maustaste halten</b><span>Beginne auf einer freien Stelle der Seite, außerhalb eines Eingabefelds.</span></li><li><b>Ein großes S zeichnen</b><span>Zeichne den Buchstaben in einem Zug – wie in der Vorlage.</span></li><li><b>Loslassen. Screenshot kopiert.</b><span>Die Zeichnung verschwindet vor der Aufnahme. Luna bestätigt den Screenshot; mit ${shortcut('⌘ V')} fügst du ihn ein.</span></li></ol><p class="setup-note">Das ist die Standardbelegung. Unter Einstellungen → Mausgesten kannst du Gesten einschalten und die Belegung ändern. Bestehende Anpassungen bleiben erhalten.</p><p class="setup-note">OpenRouter kannst du später unter Einstellungen → KI & MCP verbinden.</p>${btn('next', 'Weiter →', 'setup-primary')}`
              : `<span class="setup-eyebrow">${step === 0 ? 'DEINE STANDARDSUCHE' : 'FREIWILLIG · ' + esc(s.name.toUpperCase())}</span><h1>${view === 'split' && copied ? 'Oh, Entschuldigung!' : copied ? 'Schon kopiert?' : esc(s.title)}</h1><p>${view === 'split' && copied ? 'Ich war zu aufgeregt. Mach links in Ruhe weiter. Gib hier deinen Key ein und klicke dann auf „Fertig“.' : copied ? 'Ich habe eine Kopieraktion bemerkt. Dein kopierter Key steht im Feld. Prüfe ihn und klicke auf „Speichern & weiter“. Deine Anbieterseite bleibt im Hintergrund geöffnet.' : esc(s.text)}</p>
      ${step === 0 ? `<div class="setup-choice">${btn('luna', 'Luna Search', !configured.google ? 'selected' : '')}${btn('google', 'Google · ohne Key', configured.google ? 'selected' : '')}</div>` : ''}
      ${
        step === 0 && configured.google
          ? `<p>Google funktioniert ohne Brave-Key. Deine Suchbegriffe werden an Google gesendet.</p>${btn('next', 'Mit Google weiter →', 'setup-primary')}`
          : `
      ${step === 1 ? `<div class="setup-spotify-guide"><h2>So verbindest du Spotify</h2><ol><li><b>Dashboard öffnen.</b> Melde dich mit deinem Spotify-Konto an und wähle „Create app“.</li><li><b>App anlegen.</b> Gib ihr einen Namen, zum Beispiel „Meine Luna“, und eine kurze Beschreibung. Wähle „Web API“, falls Spotify nach der verwendeten API fragt.</li><li><b>Rücksprungadresse eintragen.</b> Hinterlege unter „Redirect URIs“ genau <code>http://127.0.0.1:8888/callback</code> und speichere die App. Dorthin kehrt Spotify nach deiner Zustimmung zurück.</li><li><b>Client ID kopieren.</b> Du findest sie in den App-Einstellungen. Sie identifiziert deine App. Füge sie unten ein und bestätige sie. Luna benötigt kein Client Secret.</li><li><b>Konto verknüpfen.</b> Klicke auf „Speichern & weiter“ und bestätige bei Spotify die angezeigten Berechtigungen. Nach erfolgreicher Anmeldung geht Luna automatisch weiter.</li></ol><p class="setup-note">Spotify ist freiwillig. Für die Wiedergabe muss die Spotify-App auf diesem Mac installiert sein. Spotify kann je nach Konto und Entwicklungsmodus weitere Voraussetzungen verlangen.</p></div>` : ''}
      ${configured[s.id] || saved ? `<p class="setup-saved">✓ ${step === 1 ? 'Client ID' : 'Key'} ist gespeichert${step === 1 && connected ? ' · Konto verbunden' : ''}.</p>` : ''}
      <div class="setup-actions">${view === 'form' ? btn('portal', tabs.has(s.id) ? 'Anbieterseite wieder anzeigen' : `${esc(s.name)} öffnen & ${step === 1 ? 'Client ID' : 'Key'} holen`) : ''}${step !== 0 ? btn('skip', 'Überspringen', 'setup-quiet') : ''}</div>
      <form class="setup-keyform" autocomplete="off"><label for="setupKey">${esc(s.label)}</label><div><input id="setupKey" type="password" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Hier selbst einfügen" ${busy ? 'disabled' : ''}><button class="setup-primary" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Speichert …' : view === 'split' && step !== 1 ? 'Fertig' : 'Speichern & weiter'}</button></div></form>
      ${copied && view === 'form' ? btn('notdone', 'Hey, ich war noch nicht fertig', 'setup-quiet') : ''}
      ${step !== 1 && (configured[s.id] || saved) ? btn('next', 'Weiter →', 'setup-primary') : ''}
      ${step === 0 && !configured.google ? '<p class="setup-note">Keinen Brave-Key? Wähle oben Google – damit geht es sofort weiter.</p>' : ''}`
      }
      <p class="setup-note">Nur neue Kopien auf der geöffneten Key-Seite werden ins Feld übernommen. Gespeichert wird erst mit deinem Klick oder Enter.</p>`
      }
      <p data-message role="status" class="setup-message"></p>${step >= 0 ? btn('back', '← Zurück', 'setup-quiet') : ''}</section></div>`;
    if (step === 2) {
      detachPractice = window.__fmCircle({
        target: root,
        enabled: () => active && step === 2,
        onDraw: (on) => api.gestureWriteSound(on),
        onLetter: async (letter) => {
          if (letter !== 'S') {
            message('Versuche ein großes S in einem Zug.');
            return;
          }
          try {
            const preview = await api.screenshot(-1);
            if (active && step === 2)
              message(
                `Geschafft! Dein Screenshot ist kopiert. Mit ${shortcut('⌘ V')} kannst du ihn einfügen.`,
              );
            if (preview && active && step === 2)
              await playPolaroid(
                'data:image/jpeg;base64,' + preview,
                root.getBoundingClientRect(),
                20001,
              );
          } catch {
            if (active && step === 2)
              message('S erkannt. Der Screenshot konnte nicht kopiert werden. Versuche es erneut.');
          }
        },
      });
      const prompt = root.querySelector('.setup-practice-prompt');
      let started = false;
      const reveal = () => {
        if (active && step === 2 && !started && prompt.isConnected) {
          stopDemo();
          root.classList.remove('practice-intro', 'demo-run');
          root.classList.add('practice-ready');
          prompt.hidden = false;
        }
      };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        practiceTimer = setTimeout(reveal, 800);
      } else {
        // 1) „Probier es selber“ steht 2 Sekunden, 2) eine Maus klickt und zeichnet ein S, 3) der Nutzer ist dran.
        const line = root.querySelector('.setup-gesture-line');
        const mouse = root.querySelector('.setup-mouse');
        const length = line.getTotalLength();
        const place = (progress) => {
          const point = line.getPointAtLength(length * progress);
          mouse.setAttribute('transform', `translate(${point.x + 12} ${point.y + 16})`);
        };
        line.style.strokeDashoffset = '1';
        place(0);
        root.classList.add('practice-intro');
        prompt.hidden = false;
        demoTimer = setTimeout(() => {
          if (!active || step !== 2 || started) return;
          root.classList.remove('practice-intro');
          root.classList.add('demo-run');
          prompt.hidden = true;
          demoTimer = setTimeout(() => {
            mouse.classList.add('pressed');
            api.playClick();
            demoTimer = setTimeout(() => {
              const t0 = Date.now();
              demoWriting = true;
              api.gestureWriteSound(true);
              demoTick = setInterval(() => {
                const t = Math.min(1, (Date.now() - t0) / DEMO_DRAW_MS);
                const progress = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
                line.style.strokeDashoffset = String(1 - progress);
                place(progress);
                if (t < 1) return;
                clearInterval(demoTick);
                demoTick = undefined;
                demoWriting = false;
                api.gestureWriteSound(false);
                mouse.classList.remove('pressed');
                demoTimer = setTimeout(reveal, 900);
              }, 16);
            }, 350);
          }, 600);
        }, 2000);
      }
      root.onpointerdown = (event) => {
        if (
          step !== 2 ||
          event.button !== 0 ||
          event.target.closest('button,input,a,select,textarea')
        )
          return;
        started = true;
        stopDemo();
        root.classList.remove('practice-intro', 'demo-run');
        root.classList.add('practice-ready', 'practice-drawing');
        prompt.hidden = true;
        clearTimeout(practiceTimer);
        root.onpointerdown = null;
      };
    }
    root.querySelector('.setup-keyform')?.addEventListener('submit', saveKey);
    const field = root.querySelector('#setupKey');
    if (field) {
      field.value = drafts.get(s.id) || '';
      field.addEventListener('input', () => drafts.set(s.id, field.value));
    }
    requestAnimationFrame(() => {
      showNative();
      if (view === 'form') api.focusUI();
      if (view === 'form' && copied) root.querySelector('#setupKey')?.focus();
    });
  }
  async function start() {
    if (active) return;
    previousFocus = document.activeElement;
    const prefs = await api.prefs();
    const [key, spotify, chat] = await Promise.all([
      api.keyStatus(),
      api.spotifyAPIStatus(),
      api.chatStatus(),
    ]);
    configured = {
      brave: !!key,
      spotify: !!spotify?.configured,
      ...chat?.providers,
      google: !!prefs.googleSearch,
    };
    connected = !!spotify?.connected;
    let resume = -1;
    try {
      resume = Number(localStorage.getItem(PROGRESS_KEY) ?? -1);
    } catch {}
    step = Number.isInteger(resume) && resume >= -1 && resume <= 4 ? resume : -1;
    // An unfinished Brave step must never be bypassed by stale progress.
    if (step > 0 && !configured.google && !configured.brave) step = 0;
    active = true;
    view = 'form';
    copied = false;
    saved = false;
    root = document.createElement('div');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Luna einrichten');
    root.setAttribute('aria-modal', 'true');
    document.body.append(root);
    for (const el of document.body.children)
      if (el !== root && !el.matches('.slow-setup') && !['SCRIPT', 'STYLE'].includes(el.tagName)) {
        el.dataset.setupInert = el.inert ? 'kept' : 'added';
        el.inert = true;
      }
    root.addEventListener('click', (e) => {
      const action = e.target.closest('[data-setup]')?.dataset.setup;
      if (action) {
        e.preventDefault();
        act(action).catch((error) => message(String(error)));
      }
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        act('later').catch((error) => message(String(error)));
      }
      if (e.key === 'Tab' && view === 'form') {
        const items = [...root.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });
    render();
    root.querySelector('button')?.focus();
    timer = setInterval(poll, 400);
  }
  async function close(complete) {
    if (busy) return;
    if (complete) {
      await api.setPref('onboardingComplete', true);
      try {
        localStorage.removeItem(PROGRESS_KEY);
      } catch {}
    }
    active = false;
    braveWatchdog.stop();
    drafts.clear();
    linkingSpotify = false;
    generation++;
    clearInterval(timer);
    clearTimeout(practiceTimer);
    stopDemo();
    detachPractice?.();
    detachPractice = null;
    // Closing the setup UI must not wait for a cold or stalled native host.
    api.show(-1);
    for (const id of owned) api.close(id).catch(() => {});
    tabs.clear();
    owned.clear();
    parents.clear();
    currentID = 0;
    root.remove();
    root = null;
    for (const el of document.querySelectorAll('[data-setup-inert]')) {
      if (el.dataset.setupInert === 'added') el.inert = false;
      delete el.dataset.setupInert;
    }
    previousFocus?.focus?.();
    onFinish();
  }
  async function openPortal(split = false) {
    const s = service();
    if (!s) return;
    if (s.id === 'brave') braveWatchdog.start();
    const token = ++generation;
    lastCount = null;
    suspended = false;
    const fresh = !tabs.has(s.id);
    if (fresh) {
      const id = 910000 + step;
      tabs.set(s.id, id);
      owned.add(id);
    }
    currentID = tabs.get(s.id);
    const id = currentID;
    // Render controls before waiting for WebView2's first cold start.
    view = split ? 'split' : 'portal';
    render();
    if (fresh) await api.load(id, s.url);
    if (!active || token !== generation) return;
    const baseline = await api.onboardingClipboard(id, s.id);
    if (!active || token !== generation) return;
    lastCount = baseline?.count ?? null;
    if (s.id === 'brave' && baseline?.loading === false) braveWatchdog.stop();
    showNative();
  }
  async function saveKey(event) {
    event.preventDefault();
    if (busy) return;
    const input = root.querySelector('#setupKey'),
      key = input.value.trim(),
      s = service();
    if (!key && !(s.id === 'spotify' && configured.spotify)) {
      message('Bitte füge zuerst deinen Key ein.');
      input.focus();
      return;
    }
    busy = true;
    for (const b of root.querySelectorAll('button')) b.disabled = true;
    try {
      if (s.id === 'brave') {
        await api.keySet(key);
        await api.setPref('googleSearch', false);
        configured.google = false;
        await refreshSearch();
      } else if (s.id === 'spotify') {
        if (key) await api.spotifyAPIConfigure(key);
        connected = !!(await api.spotifyAPIStatus()).connected;
      } else await api.chatProviderKey(s.id, key);
      input.value = '';
      drafts.delete(s.id);
      configured[s.id] = true;
      saved = true;
      view = 'form';
      copied = false;
      if (s.id !== 'spotify') {
        step++;
        saved = false;
        currentID = 0;
        storeStep();
      }
      generation++;
      render();
      if (s.id === 'spotify') {
        await openPortal(true);
        await api.onboardingSpotifyConnect(currentID);
        linkingSpotify = true;
        message('Bestätige die Anmeldung links bei Spotify. Danach geht Luna automatisch weiter.');
        return;
      }
      message(
        s.id === 'brave'
          ? 'Gespeichert. Luna Search ist ausgewählt.'
          : s.id === 'spotify'
            ? 'Client ID gespeichert. Jetzt kannst du dein Konto verknüpfen.'
            : 'Key gespeichert. Dein Modell wählst du anschließend unter KI & MCP.',
      );
    } catch (error) {
      message(String(error));
    } finally {
      busy = false;
      for (const b of root?.querySelectorAll('button') || []) b.disabled = false;
      const submit = root?.querySelector('[type=submit]');
      if (submit)
        submit.textContent = view === 'split' && step !== 1 ? 'Fertig' : 'Speichern & weiter';
      const field = root?.querySelector('#setupKey');
      if (field) field.disabled = false;
    }
  }
  async function act(action) {
    if (busy) return;
    if (action === 'later') return close(false);
    if (action === 'finish') return close(true);
    if (action === 'portal') return openPortal(false);
    if (action === 'notdone') return openPortal(true);
    if (action === 'form') {
      view = 'form';
      generation++;
      render();
      return;
    }
    if (action === 'webback') return api.back(currentID);
    if (action === 'webreload') return api.reload(currentID);
    if (action === 'google' || action === 'luna') {
      configured.google = action === 'google';
      await api.setPref('googleSearch', configured.google);
      await refreshSearch();
      render();
      return;
    }
    if (action === 'next' && service() && drafts.get(service().id)?.trim()) {
      await saveKey({ preventDefault() {} });
      return;
    }
    if (action === 'next' || action === 'skip' || action === 'back') {
      if (step === 0 && action !== 'back' && !configured.google && !configured.brave) {
        message('Speichere deinen Brave-Key oder wähle Google.');
        return;
      }
      linkingSpotify = false;
      step += action === 'back' ? -1 : 1;
      view = 'form';
      copied = false;
      saved = false;
      currentID = 0;
      generation++;
      storeStep();
      render();
    }
  }
  async function poll() {
    if (!active || polling || !currentID || !service() || (view === 'form' && !linkingSpotify))
      return;
    polling = true;
    const token = generation,
      s = service();
    try {
      const state = await api.onboardingClipboard(currentID, s.id, lastCount ?? -1);
      if (!active || token !== generation) return;
      if (s.id === 'brave' && state.loading === false) braveWatchdog.stop();
      const host = root.querySelector('[data-host]');
      if (host && state.host) host.textContent = state.host;
      if (state.error)
        message(
          'Die Anbieterseite konnte nicht geladen werden. Du kannst erneut laden oder deinen vorhandenen Key eingeben.',
        );
      if (
        !busy &&
        state.eligible &&
        lastCount !== null &&
        state.count !== lastCount &&
        typeof state.text === 'string' &&
        state.text.trim()
      ) {
        drafts.set(s.id, state.text.trim());
        copied = true;
        if (view === 'portal') view = 'form';
        generation++;
        render();
        message('Key eingefügt. Prüfe ihn – erst dein Klick speichert ihn.');
      }
      lastCount = state.count;
      if (s.id === 'spotify' && (configured.spotify || saved)) {
        const status = await api.spotifyAPIStatus();
        if (!active || token !== generation) return;
        if (
          linkingSpotify &&
          status.connected &&
          !status.pending &&
          status.message === 'Spotify ist verknüpft.'
        ) {
          connected = true;
          linkingSpotify = false;
          view = 'form';
          copied = false;
          saved = false;
          currentID = 0;
          step = 2;
          generation++;
          storeStep();
          render();
          message('Spotify ist verbunden. Deine Musik ist bereit.');
        } else {
          const el = root.querySelector('[data-connection]');
          if (el && status.message) el.textContent = status.message;
        }
      }
    } catch {
      /* A transient bridge failure must not close the provider or expose a key. */
    } finally {
      polling = false;
    }
  }
  window.addEventListener('resize', () => {
    if (active) showNative();
  });
  function handleWeb(e) {
    if (!active) return false;
    if (owned.has(e.tab) && service()?.id === 'brave') {
      if (e.t === 'loaded' || (e.t === 'state' && e.loading === false)) braveWatchdog.stop();
      else if (e.t === 'state' && e.loading && (view === 'portal' || view === 'split'))
        braveWatchdog.start();
    }
    if (e.t === 'popup' && owned.has(e.opener)) {
      owned.add(e.tab);
      parents.set(e.tab, e.opener);
      currentID = e.tab;
      tabs.set(service().id, e.tab);
      lastCount = null;
      showNative();
      return true;
    }
    if (e.t === 'newtab' && owned.has(e.opener)) {
      api.load(currentID, e.url);
      return true;
    }
    if (e.t === 'close' && owned.has(e.tab)) {
      api.close(e.tab);
      owned.delete(e.tab);
      if (currentID === e.tab) {
        const parent = parents.get(e.tab);
        parents.delete(e.tab);
        if (parent && owned.has(parent)) {
          currentID = parent;
          tabs.set(service().id, parent);
          showNative();
        } else {
          tabs.delete(service().id);
          currentID = 0;
          view = 'form';
          render();
        }
      }
      return true;
    }
    return owned.has(e.tab);
  }
  return {
    start,
    handleWeb,
    get active() {
      return active;
    },
    layout: showNative,
    suspend(on) {
      suspended = on;
      if (active) showNative();
    },
  };
}
