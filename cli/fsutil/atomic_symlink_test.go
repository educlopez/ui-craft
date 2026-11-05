package fsutil

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// A symlinked config (dotfile managers do this for ~/.claude.json) must stay a
// symlink after an atomic write, and the new bytes must land in its target.
func TestWriteFileAtomic_writesThroughSymlink(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlinks need extra privileges on Windows runners")
	}
	dir := t.TempDir()
	target := filepath.Join(dir, "dotfiles", "claude.json")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(dir, ".claude.json")
	if err := os.Symlink(target, link); err != nil {
		t.Fatal(err)
	}

	if _, err := WriteFileAtomic(OsFS{}, link, []byte("{\"a\":1}\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	info, err := os.Lstat(link)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode()&os.ModeSymlink == 0 {
		t.Fatal("the symlink was replaced by a regular file")
	}
	got, err := os.ReadFile(target)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "{\"a\":1}\n" {
		t.Fatalf("target = %q, want the new content", got)
	}
}
