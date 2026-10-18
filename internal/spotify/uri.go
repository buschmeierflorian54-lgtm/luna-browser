package spotify

import "regexp"

var spotifyURI = regexp.MustCompile(`^spotify:(track|album|artist):[A-Za-z0-9]{22}$`)

func validURI(uri string) bool { return spotifyURI.MatchString(uri) }
