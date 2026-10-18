package store

import "testing"

func TestStore(t *testing.T) {
	s, err := New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	s.SetBookmark("https://a.de", "A", true)
	s.SetBookmark("https://b.de", "", true)
	if bs := s.SetBookmark("https://a.de", "", false); len(bs) != 1 || bs[0].Title != "https://b.de" {
		t.Fatalf("%+v", bs)
	}
	s.HistoryAdd("https://x.de/1", "Eins")
	s.HistoryAdd("https://x.de/2", "Zwei")
	s.HistoryAdd("https://x.de/1", "Eins!")
	h := s.History("", 10)
	if len(h) != 2 || h[0].URL != "https://x.de/1" || h[0].Visits != 2 || h[0].Title != "Eins!" {
		t.Fatalf("%+v", h)
	}
	if len(s.History("zwei", 10)) != 1 {
		t.Fatal("Suche")
	}
	s.HistoryAdd("about:blank", "")
	if len(s.History("", 10)) != 2 {
		t.Fatal("about:blank gespeichert")
	}
	s2, _ := New(s.dir) // Persistenz
	if len(s2.History("", 10)) != 2 || len(s2.Bookmarks()) != 1 {
		t.Fatal("nicht persistent")
	}
	// Einstellungen
	if s2.Prefs()["restoreSession"] {
		t.Fatal("Standard muss aus sein: der Browser startet mit der Startseite")
	}
	s2.SetPref("restoreSession", true)
	s2.SetPref("unbekannt", true)
	s3, _ := New(s.dir)
	if !s3.Prefs()["restoreSession"] || s3.Prefs()["unbekannt"] {
		t.Fatalf("Prefs: %v", s3.Prefs())
	}
	// Automatic playback consent defaults off and survives both enabling and disabling.
	if s3.Prefs()["spotifyAutoNextAlways"] {
		t.Fatal("automatic playback must be opt-in")
	}
	s3.SetPref("spotifyAutoNextAlways", true)
	consent, _ := New(s.dir)
	if !consent.Prefs()["spotifyAutoNextAlways"] {
		t.Fatal("consent was not persisted")
	}
	consent.SetPref("spotifyAutoNextAlways", false)
	revoked, _ := New(s.dir)
	if revoked.Prefs()["spotifyAutoNextAlways"] {
		t.Fatal("revocation was not persisted")
	}
	// Lesezeichen bearbeiten: Position bleibt, Doppelte verschwinden
	e, _ := New(t.TempDir())
	e.SetBookmark("https://1.de", "Eins", true)
	e.SetBookmark("https://2.de", "Zwei", true)
	e.SetBookmark("https://3.de", "Drei", true)
	bs := e.EditBookmark("https://2.de", "https://zwei.de", "Zwei neu")
	if len(bs) != 3 || bs[1].URL != "https://zwei.de" || bs[1].Title != "Zwei neu" {
		t.Fatalf("Edit: %+v", bs)
	}
	bs = e.EditBookmark("https://1.de", "https://3.de", "Drei mit Eins")
	if len(bs) != 2 || bs[0].URL != "https://3.de" || bs[0].Title != "Drei mit Eins" {
		t.Fatalf("Duplikat: %+v", bs)
	}
	if bs = e.EditBookmark("https://gibtsnicht.de", "https://neu.de", ""); len(bs) != 3 || bs[2].Title != "https://neu.de" {
		t.Fatalf("Neu: %+v", bs)
	}
	e.SetPref("showBookmarkBar", false)
	if v, ok := e.Prefs()["showBookmarkBar"]; !ok || v {
		t.Fatal("showBookmarkBar nicht speicherbar")
	}
	// Notizzettel
	n, _ := New(t.TempDir())
	n.SetNote("https://a.de/x", "A", "erste Notiz")
	n.SetNote("https://b.de/", "B", "zweite")
	list := n.SetNote("https://a.de/x", "A", "erste Notiz (neu)")
	if len(list) != 2 || list[0].Key != "https://a.de/x" || list[0].Text != "erste Notiz (neu)" {
		t.Fatalf("Notes: %+v", list)
	}
	if list = n.SetNote("https://b.de/", "B", "   "); len(list) != 1 {
		t.Fatalf("leerer Text muss löschen: %+v", list)
	}
	n2, _ := New(n.dir)
	if len(n2.Notes()) != 1 {
		t.Fatal("nicht persistent")
	}
}
