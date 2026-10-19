## So installierst du Luna

Öffne das Terminal (⌘ + Leertaste, „Terminal“ tippen, Enter), füge diesen Befehl ein und drücke Enter:

```sh
( installer=$(mktemp) && trap 'rm -f "$installer"' EXIT && curl --fail --location --proto '=https' --proto-redir '=https' https://raw.githubusercontent.com/buschmeierflorian54-lgtm/luna-browser/main/docs/install.sh -o "$installer" && /bin/bash "$installer" )
```

Es öffnen sich der Ordner „Programme“ und ein Fenster mit Luna. Ziehe Luna hinüber und lass das Terminal offen, den Rest erledigt das Skript.

**Bitte nicht die DMG-Datei unten einzeln laden:** Luna ist noch nicht von Apple notarisiert, und eine im Browser geladene DMG löst eine Sicherheitsmeldung aus. Der Befehl umgeht das. Hast du die DMG schon geladen, hilft die [Notlösung in der README](https://github.com/buschmeierflorian54-lgtm/luna-browser#luna-startet-nicht).

Für Apple-Silicon-Macs mit macOS 13 oder neuer. Bestehende Installationen aktualisieren sich automatisch und signaturgeprüft über Sparkle.
