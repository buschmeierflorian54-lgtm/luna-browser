package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRemovableBundle(t *testing.T) {
	for _, exe := range []string{"/tmp/Luna Browser", "/tmp/Contents/MacOS/Luna Browser", "/tmp/Other.app/Contents/MacOS/Other"} {
		if _, err := removableBundle(exe); err == nil {
			t.Fatalf("accepted development or foreign path %s", exe)
		}
	}
	bundle, err := removableBundle(filepath.FromSlash("/Applications/Luna Browser.app/Contents/MacOS/Luna Browser"))
	if err != nil || bundle != filepath.FromSlash("/Applications/Luna Browser.app") {
		t.Fatalf("%s %v", bundle, err)
	}
}
func TestTrashBundlePreservesOtherFiles(t *testing.T) {
	root := t.TempDir()
	bundle := filepath.Join(root, "Luna Browser.app")
	trash := filepath.Join(root, "Trash")
	if err := os.MkdirAll(bundle, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(trash, "Luna Browser.app"), 0700); err != nil {
		t.Fatal(err)
	}
	sentinel := filepath.Join(root, "browser-data")
	if err := os.WriteFile(sentinel, []byte("keep"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := trashBundle(bundle, trash); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(bundle); !os.IsNotExist(err) {
		t.Fatal("bundle still exists")
	}
	entries, _ := os.ReadDir(trash)
	if len(entries) != 2 {
		t.Fatalf("trash entries: %d", len(entries))
	}
	if data, err := os.ReadFile(sentinel); err != nil || string(data) != "keep" {
		t.Fatal("data changed")
	}
}
