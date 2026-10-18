package sonos

import (
	"browser-mac/internal/spotifyapi"
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Small namespace-independent XML tree for Sonos' nested SOAP/DIDL responses.
type queueXML struct {
	XMLName  xml.Name
	Attr     []xml.Attr `xml:",any,attr"`
	Text     string     `xml:",chardata"`
	Children []queueXML `xml:",any"`
}

func (n queueXML) all(name string) []queueXML {
	var out []queueXML
	if n.XMLName.Local == name {
		out = append(out, n)
	}
	for _, child := range n.Children {
		out = append(out, child.all(name)...)
	}
	return out
}
func (n queueXML) value(name string) string {
	if nodes := n.all(name); len(nodes) > 0 {
		return nodes[0].Text
	}
	return ""
}
func (n queueXML) attr(name string) string {
	for _, a := range n.Attr {
		if a.Name.Local == name {
			return a.Value
		}
	}
	return ""
}
func escapeXML(s string) string {
	var b bytes.Buffer
	_ = xml.EscapeText(&b, []byte(s))
	return b.String()
}
func parseQueueXML(s string) (queueXML, error) {
	var n queueXML
	err := xml.Unmarshal([]byte(s), &n)
	return n, err
}

func (m *Manager) queueCall(ctx context.Context, ip, service, action string, args ...string) (queueXML, error) {
	path := "/" + service + "/Control"
	if service == "AVTransport" {
		path = "/MediaRenderer/AVTransport/Control"
		args = append([]string{"InstanceID", "0"}, args...)
	}
	if service == "ContentDirectory" {
		path = "/MediaServer/ContentDirectory/Control"
	}
	urn := "urn:schemas-upnp-org:service:" + service + ":1"
	var fields strings.Builder
	for i := 0; i < len(args); i += 2 {
		fmt.Fprintf(&fields, "<%s>%s</%s>", args[i], escapeXML(args[i+1]), args[i])
	}
	body := `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:` + action + ` xmlns:u="` + urn + `">` + fields.String() + `</u:` + action + `></s:Body></s:Envelope>`
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://"+ip+":1400"+path, strings.NewReader(body))
	if err != nil {
		return queueXML{}, err
	}
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")
	req.Header.Set("SOAPACTION", `"`+urn+`#`+action+`"`)
	client := *m.http
	client.Timeout = 5 * time.Second
	response, err := client.Do(req)
	if err != nil {
		return queueXML{}, errors.New("Sonos antwortet nicht.")
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return queueXML{}, err
	}
	n, err := parseQueueXML(string(data))
	if err != nil {
		return n, errors.New("Sonos-Antwort konnte nicht gelesen werden.")
	}
	if response.StatusCode != 200 || len(n.all("Fault")) > 0 {
		return n, fmt.Errorf("Sonos-Anfrage fehlgeschlagen (%d/%s).", response.StatusCode, n.value("errorCode"))
	}
	return n, nil
}

// Resolve the Spotify target through Sonos topology, including grouped speakers.
// Never use the volume-sync selection: it may refer to a different room.
func (m *Manager) queueTarget(ctx context.Context, playback *spotifyapi.Playback) (Device, error) {
	if playback == nil || playback.Device.Name == "" {
		return Device{}, errors.New("Das aktive Spotify-Gerät konnte nicht bestimmt werden.")
	}
	devices := m.Status().Devices
	if len(devices) == 0 {
		devices = m.Scan().Devices
	}
	for _, d := range devices {
		if !d.Online {
			continue
		}
		response, err := m.queueCall(ctx, d.IP, "ZoneGroupTopology", "GetZoneGroupState")
		if err != nil {
			continue
		}
		topology, err := parseQueueXML(response.value("ZoneGroupState"))
		if err != nil {
			continue
		}
		var candidates []Device
		for _, group := range topology.all("ZoneGroup") {
			matched := false
			var coordinator queueXML
			for _, member := range group.all("ZoneGroupMember") {
				if strings.EqualFold(member.attr("ZoneName"), playback.Device.Name) {
					matched = true
				}
				if member.attr("UUID") == group.attr("Coordinator") {
					coordinator = member
				}
			}
			if !matched {
				continue
			}
			location, err := url.Parse(coordinator.attr("Location"))
			if err != nil {
				continue
			}
			// Only send control requests to a device verified by our LAN discovery.
			for _, known := range devices {
				if known.Online && known.IP == location.Hostname() {
					candidates = append(candidates, known)
				}
			}
		}
		if len(candidates) != 1 {
			return Device{}, errors.New("Das aktive Spotify-Gerät lässt sich keiner eindeutigen Sonos-Gruppe zuordnen.")
		}
		target := candidates[0]
		media, err := m.queueCall(ctx, target.IP, "AVTransport", "GetMediaInfo")
		if err != nil {
			return Device{}, err
		}
		if !strings.HasPrefix(media.value("CurrentURI"), "x-rincon-queue:") {
			return Device{}, errors.New("Diese Sonos-Wiedergabe verwendet keine lokale Sonos-Warteschlange. Ein Wechsel würde die laufende Wiedergabe ersetzen.")
		}
		if playback.Item != nil && playback.Item.URI != "" {
			position, err := m.queueCall(ctx, target.IP, "AVTransport", "GetPositionInfo")
			if err != nil {
				return Device{}, err
			}
			id := strings.TrimPrefix(playback.Item.URI, "spotify:track:")
			if !strings.Contains(position.value("TrackURI"), id) {
				return Device{}, errors.New("Spotify und Sonos melden unterschiedliche laufende Titel. Bitte erneut versuchen.")
			}
		}
		return target, nil
	}
	return Device{}, errors.New("Kein erreichbarer Sonos-Lautsprecher gefunden.")
}

var queueTrackURI = regexp.MustCompile(`^spotify:track:[A-Za-z0-9]{22}$`)

func (m *Manager) AddToQueue(ctx context.Context, uri string, playback *spotifyapi.Playback) error {
	if !queueTrackURI.MatchString(uri) {
		return errors.New("Ungültiger Spotify-Titel.")
	}
	target, err := m.queueTarget(ctx, playback)
	if err != nil {
		return err
	}
	services, err := m.queueCall(ctx, target.IP, "MusicServices", "ListAvailableServices")
	if err != nil {
		return err
	}
	descriptors, err := parseQueueXML(services.value("AvailableServiceDescriptorList"))
	if err != nil {
		return err
	}
	serviceID := 0
	for _, service := range descriptors.all("Service") {
		if strings.EqualFold(service.attr("Name"), "Spotify") {
			serviceID, _ = strconv.Atoi(service.attr("Id"))
			break
		}
	}
	if serviceID <= 0 {
		return errors.New("Spotify ist auf diesem Sonos-System nicht verfügbar.")
	}
	serviceType := serviceID*256 + 7
	encoded := strings.ReplaceAll(uri, ":", "%3a")
	metadata := fmt.Sprintf(`<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="00032020%s" parentID="-1" restricted="true"><dc:title>Spotify</dc:title><upnp:class>object.item.audioItem.musicTrack</upnp:class><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON%d_X_#Svc%d-0-Token</desc></item></DIDL-Lite>`, encoded, serviceType, serviceType)
	result, err := m.queueCall(ctx, target.IP, "AVTransport", "AddURIToQueue", "EnqueuedURI", encoded, "EnqueuedURIMetaData", metadata, "DesiredFirstTrackNumberEnqueued", "0", "EnqueueAsNext", "0")
	if err != nil {
		return err
	}
	index, _ := strconv.Atoi(result.value("FirstTrackNumberEnqueued"))
	if index < 1 {
		return errors.New("Sonos hat das Hinzufügen nicht bestätigt.")
	}
	return nil
}

func (m *Manager) Queue(ctx context.Context, playback *spotifyapi.Playback) (*spotifyapi.Queue, error) {
	target, err := m.queueTarget(ctx, playback)
	if err != nil {
		return nil, err
	}
	position, err := m.queueCall(ctx, target.IP, "AVTransport", "GetPositionInfo")
	if err != nil {
		return nil, err
	}
	track, _ := strconv.Atoi(position.value("Track"))
	if track < 1 {
		return nil, errors.New("Sonos meldet keine aktuelle Warteschlangenposition.")
	}
	response, err := m.queueCall(ctx, target.IP, "ContentDirectory", "Browse", "ObjectID", "Q:0", "BrowseFlag", "BrowseDirectChildren", "Filter", "*", "StartingIndex", strconv.Itoa(track-1), "RequestedCount", "21", "SortCriteria", "")
	if err != nil {
		return nil, err
	}
	items, err := parseQueueXML(response.value("Result"))
	if err != nil {
		return nil, err
	}
	q := &spotifyapi.Queue{Items: []spotifyapi.Track{}}
	for i, item := range items.all("item") {
		resource := item.value("res")
		decoded, _ := url.PathUnescape(resource)
		uri := ""
		if start := strings.Index(decoded, "spotify:track:"); start >= 0 && len(decoded) >= start+36 {
			uri = decoded[start : start+36]
		}
		art := item.value("albumArtURI")
		if strings.HasPrefix(art, "/") {
			art = "http://" + target.IP + ":1400" + art
		}
		t := spotifyapi.Track{Name: item.value("title"), URI: uri, Artists: []spotifyapi.Artist{{Name: item.value("creator")}}, Album: spotifyapi.Album{Name: item.value("album"), Images: []spotifyapi.Image{}}}
		if art != "" {
			t.Album.Images = append(t.Album.Images, spotifyapi.Image{URL: art})
		}
		if i == 0 {
			q.Current = &t
		} else {
			q.Items = append(q.Items, t)
		}
	}
	return q, nil
}
