package sonos

import (
	"browser-mac/internal/macvolume"
	"browser-mac/internal/secret"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

type Device struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Model  string `json:"model"`
	IP     string `json:"-"`
	Online bool   `json:"online"`
}
type Status struct {
	Devices   []Device `json:"devices"`
	Selected  []string `json:"selected"`
	Enabled   bool     `json:"enabled"`
	Scanning  bool     `json:"scanning"`
	Supported bool     `json:"supported"`
	Message   string   `json:"message"`
}
type Manager struct {
	mu       sync.Mutex
	state    Status
	store    *secret.Store
	http     *http.Client
	baseline int
	output   uint32
	wake     chan struct{}
	pinging  bool
}

func New(ctx context.Context, store *secret.Store) *Manager {
	m := &Manager{wake: make(chan struct{}, 1), store: store, http: &http.Client{Timeout: 1200 * time.Millisecond, Transport: &http.Transport{MaxIdleConnsPerHost: 2}}, baseline: -1}
	if v, ok, _ := store.Get("sonos-sync.json"); ok {
		json.Unmarshal([]byte(v), &m.state)
	}
	m.state.Devices = []Device{}
	m.state.Scanning = false
	m.state.Message = ""
	m.state.Supported = false
	go m.run(ctx)
	return m
}
func (m *Manager) Status() Status {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.state
	s.Devices = append([]Device{}, s.Devices...)
	s.Selected = append([]string{}, s.Selected...)
	return s
}
func (m *Manager) Configure(enabled bool, selected []string) (Status, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	valid := map[string]bool{}
	for _, d := range m.state.Devices {
		valid[d.ID] = true
	}
	for _, id := range m.state.Selected {
		valid[id] = true
	}
	ids := []string{}
	for _, id := range selected {
		if valid[id] {
			ids = append(ids, id)
			delete(valid, id)
		}
	}
	activating := enabled && !m.state.Enabled
	s := m.state
	s.Enabled = enabled
	s.Selected = ids
	b, _ := json.Marshal(s)
	if err := m.store.Set("sonos-sync.json", string(b)); err != nil {
		return m.state, err
	}
	m.state = s
	m.baseline = -1
	if activating {
		select {
		case m.wake <- struct{}{}:
		default:
		}
	}
	return s, nil
}
func (m *Manager) run(ctx context.Context) {
	tick := time.NewTicker(180 * time.Millisecond)
	defer tick.Stop()
	refresh := time.NewTicker(30 * time.Second)
	defer refresh.Stop()
	ping := time.NewTicker(5 * time.Second)
	defer ping.Stop()
	if ctx.Err() == nil && m.Status().Enabled {
		go m.Scan()
	}
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.wake:
			if m.Status().Enabled {
				go m.Scan()
			}
		case <-ping.C:
			go m.checkAvailability(ctx)
		case <-refresh.C:
			if m.Status().Enabled {
				go m.Scan()
			}
		case <-tick.C:
			v, d := macvolume.Read()
			m.syncVolume(ctx, v, d)
		}
	}
}
func (m *Manager) syncVolume(ctx context.Context, v int, d uint32) {
	m.mu.Lock()
	m.state.Supported = v >= 0
	changed := m.state.Enabled && v >= 0 && m.baseline >= 0 && v != m.baseline && d == m.output
	m.baseline = v
	m.output = d
	if changed {
		m.state.Message = ""
		for _, speaker := range m.state.Devices {
			if !speaker.Online {
				continue
			}
			for _, id := range m.state.Selected {
				if id == speaker.ID {
					if err := m.setVolume(ctx, speaker.IP, v); err != nil {
						m.state.Message = "Lautstärke konnte bei " + speaker.Name + " nicht geändert werden."
					}
				}
			}
		}
	}
	m.mu.Unlock()
}
func parseDevice(body []byte, ip string) (Device, error) {
	var root struct {
		Device struct {
			Manufacturer string `xml:"manufacturer"`
			Room         string `xml:"roomName"`
			Name         string `xml:"friendlyName"`
			Model        string `xml:"modelName"`
			ID           string `xml:"UDN"`
		} `xml:"device"`
	}
	if err := xml.Unmarshal(body, &root); err != nil {
		return Device{}, err
	}
	d := root.Device
	if !strings.Contains(strings.ToLower(d.Manufacturer), "sonos") || d.ID == "" {
		return Device{}, fmt.Errorf("kein Sonos")
	}
	name := d.Room
	if name == "" {
		name = d.Name
	}
	return Device{ID: d.ID, Name: name, Model: d.Model, IP: ip, Online: true}, nil
}
func (m *Manager) Scan() Status {
	m.mu.Lock()
	if m.state.Scanning {
		m.mu.Unlock()
		return m.Status()
	}
	m.state.Scanning = true
	m.state.Message = ""
	m.mu.Unlock()
	// Wie SonosMacSync: lokale LAN-Adressen auf Sonos' Gerätebeschreibung prüfen.
	ips := map[string]bool{}
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || !strings.HasPrefix(iface.Name, "en") {
			continue
		}
		as, _ := iface.Addrs()
		for _, addr := range as {
			ip, _, err := net.ParseCIDR(addr.String())
			if err != nil || ip.To4() == nil || !ip.IsPrivate() {
				continue
			}
			v := ip.To4()
			for n := 1; n < 255; n++ {
				ips[fmt.Sprintf("%d.%d.%d.%d", v[0], v[1], v[2], n)] = true
			}
		}
	}
	var wg sync.WaitGroup
	var foundMu sync.Mutex
	found := map[string]Device{}
	slots := make(chan struct{}, 48)
	for ip := range ips {
		slots <- struct{}{}
		wg.Add(1)
		go func(ip string) {
			defer wg.Done()
			defer func() { <-slots }()
			r, err := m.http.Get("http://" + ip + ":1400/xml/device_description.xml")
			if err != nil {
				return
			}
			defer r.Body.Close()
			if r.StatusCode != 200 {
				return
			}
			b, _ := io.ReadAll(io.LimitReader(r.Body, 256*1024))
			d, err := parseDevice(b, ip)
			if err == nil {
				if name := m.roomName(ip); name != "" {
					d.Name = name
				}
				foundMu.Lock()
				found[d.ID] = d
				foundMu.Unlock()
			}
		}(ip)
	}
	wg.Wait()
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, old := range m.state.Devices {
		if _, ok := found[old.ID]; !ok {
			old.Online = false
			found[old.ID] = old
		}
	}
	m.state.Devices = []Device{}
	for _, d := range found {
		m.state.Devices = append(m.state.Devices, d)
	}
	sort.Slice(m.state.Devices, func(i, j int) bool { return m.state.Devices[i].Name < m.state.Devices[j].Name })
	m.state.Scanning = false
	if len(m.state.Devices) == 0 {
		m.state.Message = "Keine Sonos-Lautsprecher gefunden. Verbinde deinen Computer mit demselben WLAN."
	}
	return m.state
}
func (m *Manager) setVolume(ctx context.Context, ip string, value int) error {
	if value < 0 {
		value = 0
	}
	if value > 100 {
		value = 100
	}
	body := fmt.Sprintf(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>%d</DesiredVolume></u:SetVolume></s:Body></s:Envelope>`, value)
	req, _ := http.NewRequestWithContext(ctx, "POST", "http://"+ip+":1400/MediaRenderer/RenderingControl/Control", strings.NewReader(body))
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")
	req.Header.Set("SOAPACTION", `"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume"`)
	r, err := m.http.Do(req)
	if err != nil {
		return err
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return fmt.Errorf("Sonos HTTP %d", r.StatusCode)
	}
	return nil
}

func (m *Manager) roomName(ip string) string {
	body := `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:GetZoneAttributes xmlns:u="urn:schemas-upnp-org:service:DeviceProperties:1"/></s:Body></s:Envelope>`
	req, _ := http.NewRequest("POST", "http://"+ip+":1400/DeviceProperties/Control", strings.NewReader(body))
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")
	req.Header.Set("SOAPACTION", `"urn:schemas-upnp-org:service:DeviceProperties:1#GetZoneAttributes"`)
	r, err := m.http.Do(req)
	if err != nil {
		return ""
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return ""
	}
	decoder := xml.NewDecoder(io.LimitReader(r.Body, 65536))
	for {
		tok, err := decoder.Token()
		if err != nil {
			return ""
		}
		if el, ok := tok.(xml.StartElement); ok && el.Name.Local == "CurrentZoneName" {
			var name string
			if decoder.DecodeElement(&name, &el) == nil {
				return name
			}
			return ""
		}
	}
}

// HTTP-Ping prüft auch die Sonos-Identität, falls eine IP neu vergeben wurde.
func (m *Manager) checkAvailability(ctx context.Context) {
	m.mu.Lock()
	if !m.state.Enabled || m.pinging {
		m.mu.Unlock()
		return
	}
	m.pinging = true
	devices := append([]Device{}, m.state.Devices...)
	m.mu.Unlock()
	defer func() { m.mu.Lock(); m.pinging = false; m.mu.Unlock() }()
	var wg sync.WaitGroup
	for _, d := range devices {
		wg.Add(1)
		go func(d Device) {
			defer wg.Done()
			online := false
			req, err := http.NewRequestWithContext(ctx, "GET", "http://"+d.IP+":1400/xml/device_description.xml", nil)
			if err == nil {
				r, err := m.http.Do(req)
				if err == nil {
					if r.StatusCode == 200 {
						b, _ := io.ReadAll(io.LimitReader(r.Body, 256*1024))
						found, e := parseDevice(b, d.IP)
						online = e == nil && found.ID == d.ID
					}
					r.Body.Close()
				}
			}
			m.mu.Lock()
			defer m.mu.Unlock()
			if !m.state.Enabled || ctx.Err() != nil {
				return
			}
			// Copy-on-write: Status-Rückgaben dürfen während der JSON-Kodierung nicht mutieren.
			next := append([]Device{}, m.state.Devices...)
			for i := range next {
				if next[i].ID == d.ID && next[i].IP == d.IP {
					next[i].Online = online
				}
			}
			m.state.Devices = next
		}(d)
	}
	wg.Wait()
}
