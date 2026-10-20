# Luna Browser für Windows – EXPERIMENTELL / INSTABIL

Dies ist eine frühe Windows-Testversion, keine als stabil freigegebene Version.
Automatisierte Tests ersetzen keinen Test auf deinem Windows-Laptop.

## Starten

1. Im GitHub-Repo unter Actions den neuesten **erfolgreichen** Lauf von
   „Build and test both platforms“ öffnen.
2. `luna-windows-amd64-EXPERIMENTAL` laden. Das enthaltene
   `Luna-Browser-…-windows-amd64.zip` vollständig in einen eigenen Ordner entpacken.
3. `Luna Browser.exe` starten. Der Unterordner `native` muss daneben bleiben.
4. Windows 10 ab Version 2004 / Windows 11, x64. Edge WebView2 Runtime erforderlich;
   Wails bietet bei fehlender Runtime den offiziellen Download an. .NET ist mitgeliefert.

Die App ist noch nicht Authenticode-signiert. Windows kann daher einen Hinweis
für einen unbekannten Herausgeber zeigen. Keine Sicherheitseinstellungen global ausschalten.

## Was portiert wurde

- Webseiten-Tabs mit WebView2, Verlauf/Navigation, Zoom, Suche und Popups.
- Screenshots und Zwischenablage, Mausgesten, Töne, Strg-Tastenkürzel.
- Windows-Mediensteuerung für laufendes Spotify; Lautstärke über Windows-Audiositzungen.
- Titel gezielt starten über Spotify Web API (Konto verbinden, Premium und aktives Gerät).
- Sonos folgt der Windows-Systemlautstärke.
- Windows Hello für das Einschalten des lokalen MCP-Zugriffs.
- API-Schlüssel mit benutzergebundener Windows-DPAPI verschlüsselt.
- Gemeinsame Oberfläche, Datenmodelle, Suche, Chat, Notizen, Lesezeichen und MCP.

## Bekannte Einschränkungen

- Windows ist experimentell und instabil; Geräte-/Anbieterverhalten ist noch nicht am Laptop geprüft.
- Apple Intelligence / Sira ist Apple-exklusiv. Groq und OpenRouter bleiben verfügbar.
- Die lokale Funktion „als nächstes vormerken“ benötigt eine zuverlässige Spotify-Titel-ID,
  die Windows-Mediensitzungen nicht liefern. Stattdessen Spotify-/Sonos-Warteschlange nutzen.
- WebView2 zeigt seine eigenen Fehlerseiten; die auf dem Mac individuell eingefärbten
  Fehlerseiten und alle Dock-Funktionen sind nicht identisch.
- DRM-/Streaming-Anbieter können eingebettete Browser einschränken.
- Windows Hello muss eingerichtet sein; ohne erfolgreiche Bestätigung bleibt MCP aus.
- Noch kein praktischer Update-/Neustarttest auf einem echten Windows-Laptop.

## Laptop-Testliste

- Einrichtung abschließen; Neustart und Sitzungswiederherstellung prüfen.
- Mehrere Tabs, Login/Popups, Zurück/Vorwärts, Downloads und Strg+L/T/W testen.
- Skalierung 100/125/150 %, Fenstergröße ändern, externe Bildschirme prüfen.
- S-Geste ausführen und Bild in Paint einfügen; Suche/Notizen testen.
- Spotify starten, pausieren, Titel wechseln, Lautstärke und Queue testen.
- Sonos im lokalen Netzwerk und Windows-Firewallabfrage prüfen.
- MCP zuerst ohne und dann mit Windows-Hello-Bestätigung prüfen.
- Fehler mit Version, Windows-Version und Schritten im Repo melden.

### Tastatureingabe in eingebetteten Seiten (1.2.1)

Der Windows-Host wird auch im WinForms-Fenstermodell als untergeordnetes
Fenster eingebettet. Wiederholte Anzeige-/Layoutaufrufe setzen den Fokus nicht
erneut auf die Webansicht. Dadurch konkurriert das eingebettete Fenster nicht
mehr als eigenständiges Fenster um die Aktivierung; Eingaben bleiben im
ausgewählten Feld. Native Tests prüfen die Einbettung und den Fokuserhalt bei
wiederholter Anzeige. Zusätzlich wurde die Texteingabe auf einer lokalen
Webseite im vollständigen Windows-Browser geprüft.

### Einrichtung bei langsamen Starts

Die Einrichtung wartet nicht mehr auf die erste Windows-Spotify-Abfrage. Die
Anbieterseite zeigt ihre Bedienelemente bereits während des WebView2-Starts;
Fensteranzeige und Zwischenablage-Abfragen werden nicht hinter langsamen
Browser- oder Medienanfragen eingereiht.

Bei der Ersteinrichtung erscheint nach 10 Sekunden im Startbildschirm oder nach
2 Sekunden beim Laden der Brave-Seite ein Hinweis. „Ich will es trotzdem
probieren“ lässt die Einrichtung weiterlaufen und unterdrückt weitere Hinweise
für diese Sitzung. Eine langsame Verbindung kann den Hinweis ebenfalls auslösen.

„Luna entfernen“ verschiebt die erkannten Dateien des entpackten Windows-Pakets
nach dem Beenden in den Papierkorb. Eigene Dateien im übergeordneten Ordner und
Browserdaten bleiben erhalten. Bei einem unvollständigen Paket zeigt Luna eine
Anleitung zum manuellen Entfernen. Das Verhalten auf den betroffenen echten
Windows-Rechnern muss mit dem neuen Testbuild erneut geprüft werden.
