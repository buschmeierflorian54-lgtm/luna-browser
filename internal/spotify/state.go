package spotify

// State ist der Wiedergabezustand für die Oberfläche.
type State struct {
	URI      string `json:"uri,omitempty"`
	Status   string `json:"status"` // off | stopped | playing | paused | denied | error
	Message  string `json:"message,omitempty"`
	Title    string `json:"title,omitempty"`
	Artist   string `json:"artist,omitempty"`
	Album    string `json:"album,omitempty"`
	Duration int    `json:"duration"` // Sekunden
	Position int    `json:"position"` // Sekunden
	Artwork  string `json:"artwork,omitempty"`
	Volume   int    `json:"volume"`
	Shuffle  bool   `json:"shuffle"`
	Repeat   bool   `json:"repeat"`
}
