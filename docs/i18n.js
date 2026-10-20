/* Browser language: German, with English as the fallback. */
(() => {
  'use strict';
  const language = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase().split('-')[0] === 'de' ? 'de' : 'en';
  const translations = {
    'Luna Browser – Mach es dir im Web gemütlich': 'Luna Browser – Make yourself at home on the web',
    'Farbwelten': 'Color themes', 'Für Apple-Silicon-Macs · macOS 13+': 'For Apple Silicon Macs · macOS 13+',
    'Mach es dir im Web': 'Make yourself at home', 'gemütlich.': 'on the web.',
    'Luna ist ein Browser für den Mac, der sich nach dir richtet: mit deinen Farben, deiner Musik, Mausgesten und einer KI, die auf Wunsch mitdenkt.': 'Luna is a browser for Mac that adapts to you: your colors, your music, mouse gestures, and AI when you want a helping hand.',
    'Luna installieren': 'Install Luna', 'Trailer ansehen': 'Watch the trailer', 'Probier’s aus – wähl deine Farbwelt:': 'Try it out – choose your color theme:',
    'Neuer Tab': 'New tab', 'Suchen oder Adresse eingeben': 'Search or enter an address', 'Keine Wiedergabe': 'Not playing',
    'Mit Luna Search suchen oder Adresse eingeben': 'Search with Luna Search or enter an address',
    '☆ Lesezeichen': '☆ Bookmarks', '◷ Verlauf': '◷ History', '☾ Erscheinungsbild': '☾ Appearance', '⚙ Einstellungen': '⚙ Settings',
    'Was Luna besonders macht': 'What makes Luna special', 'Ruhig, weil Luna dich nicht': 'A calm space, without the', 'zuschüttet.': 'clutter.',
    'Alles andere richtest du dir selbst ein, in deinem Tempo und mit deinen Farben.': 'Make everything else your own, at your own pace and in your own colors.',
    '01 · Farbwelten': '01 · Color themes', 'Zehn Looks. Ein Klick.': 'Ten looks. One click.',
    'Luna Rosé, Lavendel, Ozean, Minze und mehr – jede passt sich an Hell und Dunkel an, sogar das Icon im Dock färbt sich mit. Probier es gleich hier aus.': 'Luna Rosé, Lavender, Ocean, Mint and more – each adapts to light and dark mode, and even the Dock icon changes color. Try it right here.',
    '02 · Befehle': '02 · Commands', 'Tippen statt klicken.': 'Type instead of clicking.', 'Viele Befehle starten sofort, ganz ohne Enter.': 'Many commands run instantly, without pressing Enter.',
    '03 · Mausgesten': '03 · Mouse gestures', 'Mal einen Buchstaben.': 'Draw a letter.',
    'Maustaste halten und in die Luft zeichnen. Ein': 'Hold the mouse button and draw. An', 'macht einen Screenshot, ein Kreis öffnet deinen Notizzettel. Zeichne es gleich selbst:': 'takes a screenshot; a circle opens your notes. Give it a try:',
    'Halte die Maustaste und zeichne': 'Hold the mouse button and draw',
    '04 · Musik': '04 · Music', 'Musik, die mitkommt.': 'Music that stays with you.',
    'Spotify direkt in Luna: Suche, Warteschlange und Wiedergabe. Auf Wunsch gleicht Luna die Lautstärke mit deinen Sonos-Lautsprechern ab.': 'Spotify right inside Luna: search, queue and playback. Luna can also synchronize the volume with your Sonos speakers.',
    'Wohnzimmer · synchron': 'Living room · synchronized', '05 · KI': '05 · AI', 'KI, wenn du sie willst.': 'AI when you want it.',
    'läuft komplett auf deinem Mac mit Apples eigener KI, ohne Konto und ohne Schlüssel.': 'runs entirely on your Mac using Apple’s own AI, with no account or API key.',
    'Sira · läuft lokal auf deinem Mac': 'Sira · runs locally on your Mac',
    '06 · Privatsphäre': '06 · Privacy', 'Deine Daten bleiben bei dir.': 'Your data stays with you.',
    'Lesezeichen, Verlauf, Notizen und Chats liegen lokal auf deinem Mac.': 'Bookmarks, history, notes and chats are stored locally on your Mac.',
    'API-Schlüssel werden nie in der Oberfläche angezeigt.': 'API keys are never displayed in the interface.',
    'Der KI-Zugriff für andere Apps ist standardmäßig aus und braucht Touch ID.': 'AI access for other apps is off by default and requires Touch ID.',
    'Updates kommen signiert direkt in der App an.': 'Signed updates arrive directly in the app.',
    'Tabs & Tabgruppen': 'Tabs & tab groups', 'Lesezeichen & Verlauf': 'Bookmarks & history', 'Suche auf der Seite': 'Find on page', 'Sitzung wiederherstellen': 'Restore session',
    'In 30 Sekunden': 'In 30 seconds', 'Luna im': 'Luna at a', 'Schnelldurchlauf.': 'glance.',
    'So sieht es aus': 'Take a look', 'Dein neues': 'Your new', 'Zuhause': 'home', 'im Web.': 'on the web.', 'Startseite': 'Start page', 'Befehle': 'Commands',
    'Apple-Silicon-Mac (M1 oder neuer) · macOS 13 oder neuer · Updates kommen direkt in Luna an': 'Apple Silicon Mac (M1 or later) · macOS 13 or later · Updates arrive directly in Luna',
    'Luna Browser · Ein unabhängiges macOS-Projekt.': 'Luna Browser · An independent macOS project.', 'Quellcode & Releases ↗': 'Source code & releases ↗',
    'Hallo,': 'Hello,', 'Füge diesen Befehl ins Terminal ein und drücke Enter.': 'Paste this command into Terminal and press Enter.', 'Befehl kopieren': 'Copy command', 'Gut zu wissen': 'Good to know',
    'Apple Silicon (M1 oder neuer), macOS 13+. Die App ist noch nicht Apple-notarisiert. Falls macOS den ersten Start blockiert, prüfe die Meldung unter Systemeinstellungen → Datenschutz & Sicherheit. Der Installer verändert keine Sicherheitseinstellungen. Beende eine bereits laufende Luna-Version vorher.': 'Apple Silicon (M1 or later), macOS 13+. The app is not yet notarized by Apple. If macOS blocks the first launch, check the message in System Settings → Privacy & Security. The installer does not change security settings. Quit any running version of Luna first.',
    'Bitte nicht die DMG-Datei einzeln laden.': 'Please do not download the DMG separately.',
    'Luna ist noch nicht von Apple notarisiert: Eine im Browser geladene DMG löst eine Sicherheitsmeldung aus. Der Befehl oben lädt Luna ohne diese Markierung.': 'Luna is not yet notarized by Apple: downloading the DMG in a browser triggers a security warning. The command above downloads Luna without that flag.',
    'Installationsskript ansehen ↗': 'View installation script ↗',
    'Hell oder Dunkel wechseln': 'Toggle light or dark mode', 'Hell / Dunkel': 'Light / Dark', 'Farbwelt': 'Color theme', 'Weiter nach unten': 'Scroll down', 'Illustration der Luna-Startseite': 'Illustration of the Luna start page',
    'Trailer abspielen': 'Play trailer', 'Sprache': 'Language', 'Anleitung schließen': 'Close instructions',
    'Die Startseite von Luna mit Uhr, Suche und Musik': 'Luna’s start page with a clock, search and music',
    'Die Adressleiste klappt nach unten auf und zeigt alle zehn Farbwelten': 'The address bar expands to show all ten color themes',
    'Die Befehlsseite mit Karten, die jeden Befehl erklären': 'The commands page with cards explaining each command',
    'Lavendel': 'Lavender', 'Ozean': 'Ocean', 'Minze': 'Mint', 'Wald': 'Forest', 'Pfirsich': 'Peach', 'Kirschblüte': 'Cherry blossom', 'Arktis': 'Arctic', 'Graphit': 'Graphite',
    'Gute Nacht': 'Good night', 'Guten Morgen': 'Good morning', 'Guten Tag': 'Good afternoon', 'Guten Abend': 'Good evening',
    'Farbwelt wählen': 'Choose a color theme', 'Wiedergabe an Spotify übergeben': 'Play in Spotify', 'Luna Chat geöffnet': 'Luna Chat opened',
    'Fasse diese Seite kurz zusammen': 'Summarize this page briefly',
    'Das ist Lunas Startseite: Uhr, Suche und deine Musik, alles ruhig an einem Ort. Ich laufe lokal auf deinem Mac, ganz ohne Konto.': 'This is Luna’s start page: a clock, search and your music, all in one calm space. I run locally on your Mac, with no account needed.',
    'Kopiert. Jetzt im Terminal einfügen und Enter drücken.': 'Copied. Paste into Terminal and press Enter.', 'Bitte den markierten Befehl mit ⌘ C kopieren.': 'Please copy the selected command with ⌘ C.',
    'Luna ist ein gemütlicher Browser für den Mac: zehn Farbwelten, Mausgesten, Spotify und eine KI, die auf Wunsch mitdenkt.': 'Luna is a cozy browser for Mac: ten color themes, mouse gestures, Spotify and optional AI assistance.',
    'Zehn Farbwelten, Mausgesten, Spotify und KI – ein Browser, der sich nach dir richtet.': 'Ten color themes, mouse gestures, Spotify and AI – a browser that adapts to you.'
  };
  const t = text => language === 'en' ? (translations[text] || text) : text;
  window.lunaI18n = { language, t };
  document.documentElement.lang = language;
  if (language === 'de') return;
  function translate(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest('script,style,pre,code')) return;
      const text = node.nodeValue.trim(), translated = t(text);
      if (text !== translated) node.nodeValue = node.nodeValue.replace(text, translated);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const attr of ['aria-label', 'title', 'alt', 'content']) {
        if (node.hasAttribute(attr)) node.setAttribute(attr, t(node.getAttribute(attr)));
      }
      for (const child of node.childNodes) translate(child);
    }
  }
  translate(document.documentElement);
  // Localize demo output and accessible labels added after initial rendering.
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') translate(record.target);
      else for (const node of record.addedNodes) translate(node);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  document.querySelector('#vid').src = 'assets/media/trailer-en.mp4';
  document.querySelectorAll('.vlang button').forEach(button => button.classList.toggle('on', button.textContent === 'EN'));
})();
