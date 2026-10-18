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
}
