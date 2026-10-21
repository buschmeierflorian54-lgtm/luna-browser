//go:build windows

package main

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unicode/utf16"
)

// Portable Windows builds have no registered installer. Recycle only known package
// components, after Luna and its native host have released their file handles.
func startWindowsRemoval() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return err
	}
	dir := filepath.Dir(exe)
	var manifest struct {
		Platform string `json:"platform"`
	}
	data, err := os.ReadFile(filepath.Join(dir, "luna-package.json"))
	if err != nil || json.Unmarshal(data, &manifest) != nil || manifest.Platform != "windows-amd64" || filepath.Base(exe) != "Luna Browser.exe" {
		return fmt.Errorf("Diese Entwicklungsversion kann nicht automatisch entfernt werden. Beende Luna und entferne den entpackten App-Ordner im Explorer.")
	}
	native := filepath.Join(dir, "native")
	if _, err := os.Stat(filepath.Join(native, "Luna.Windows.exe")); err != nil {
		return fmt.Errorf("Das Luna-Paket ist unvollständig. Bitte entferne den App-Ordner im Explorer.")
	}
	quote := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
	script := fmt.Sprintf(`$ErrorActionPreference='Stop'
try {
 $p=Get-Process -Id %d -ErrorAction SilentlyContinue
 if ($p) { $p | Wait-Process -Timeout 30 }
 Add-Type -AssemblyName Microsoft.VisualBasic
 Start-Sleep -Milliseconds 800
 [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(%s,'OnlyErrorDialogs','SendToRecycleBin')
 [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(%s,'OnlyErrorDialogs','SendToRecycleBin')
 foreach ($f in @(%s,%s,%s)) {
  if (Test-Path -LiteralPath $f) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($f,'OnlyErrorDialogs','SendToRecycleBin') }
 }
} catch {
 Add-Type -AssemblyName PresentationFramework
 [System.Windows.MessageBox]::Show('Luna konnte nicht vollständig entfernt werden. Bitte entferne die verbleibenden App-Dateien im Explorer. Deine Browserdaten bleiben erhalten.','Luna entfernen')
}`, os.Getpid(), quote(exe), quote(native), quote(filepath.Join(dir, "luna-package.json")), quote(filepath.Join(dir, "WINDOWS-EXPERIMENTAL.txt")), quote(filepath.Join(dir, "LIESMICH.txt")))
	units := utf16.Encode([]rune(script))
	encoded := make([]byte, len(units)*2)
	for i, u := range units {
		binary.LittleEndian.PutUint16(encoded[i*2:], u)
	}
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-EncodedCommand", base64.StdEncoding.EncodeToString(encoded))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	cmd.Dir = os.TempDir()
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}
