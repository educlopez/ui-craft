package harness

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

func modeOf(t *testing.T, w fsutil.FileSystem, p string) fs.FileMode {
	t.Helper()
	info, err := w.Stat(p)
	if err != nil {
		t.Fatalf("stat %s: %v", p, err)
	}
	return info.Mode().Perm()
}

// A user who tightened ~/.claude.json (it holds Claude Code's account state)
// must not find it world-readable after an install or an uninstall.
func TestSharedConfig_writeAndRemoveKeepExistingMode(t *testing.T) {
	home := isolateHome(t)
	mem := fsutil.NewMemFS()
	target := filepath.Join(home, ".claude.json")
	write(t, mem, target, claudeState)
	if err := mem.WriteFile(target, []byte(claudeState), 0o600); err != nil {
		t.Fatal(err)
	}

	if _, err := (ClaudeHarness{}).WriteMCP(mem, testServer); err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if got := modeOf(t, mem, target); got != 0o600 {
		t.Errorf("after WriteMCP mode = %o, want 600", got)
	}
	if _, err := RemoveMCP(mem, ClaudeHarness{}, "ui-craft"); err != nil {
		t.Fatalf("RemoveMCP: %v", err)
	}
	if got := modeOf(t, mem, target); got != 0o600 {
		t.Errorf("after RemoveMCP mode = %o, want 600", got)
	}

	// A looser mode the user chose is kept too: ui-craft does not decide it.
	if err := mem.WriteFile(target, []byte(claudeState), 0o640); err != nil {
		t.Fatal(err)
	}
	if _, err := (ClaudeHarness{}).WriteMCP(mem, testServer); err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if got := modeOf(t, mem, target); got != 0o640 {
		t.Errorf("mode = %o, want 640 kept", got)
	}
}

func TestSharedConfig_newFileModes(t *testing.T) {
	home := isolateHome(t)
	mem := fsutil.NewMemFS()

	if _, err := (ClaudeHarness{}).WriteMCP(mem, testServer); err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if got := modeOf(t, mem, filepath.Join(home, ".claude.json")); got != 0o600 {
		t.Errorf("new ~/.claude.json mode = %o, want 600", got)
	}

	project := filepath.Join(home, "proj")
	if _, err := (ClaudeHarness{projectRoot: project}).WriteMCP(mem, testServer); err != nil {
		t.Fatalf("project WriteMCP: %v", err)
	}
	if got := modeOf(t, mem, filepath.Join(project, ".mcp.json")); got != 0o644 {
		t.Errorf("new .mcp.json mode = %o, want 644", got)
	}
}

func TestSharedConfig_otherHarnessesKeepMode(t *testing.T) {
	isolateHome(t)
	for _, h := range []Harness{CursorHarness{}, GeminiHarness{}, OpenCodeHarness{}, CodexHarness{}} {
		t.Run(h.Name(), func(t *testing.T) {
			mem := fsutil.NewMemFS()
			target := h.ConfigPaths().MCPConfig
			seed := "{}\n"
			if h.Name() == "codex" {
				seed = "model = \"o3\"\n"
			}
			write(t, mem, target, seed)
			if err := mem.WriteFile(target, []byte(seed), 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := h.WriteMCP(mem, testServer); err != nil {
				t.Fatalf("WriteMCP: %v", err)
			}
			if got := modeOf(t, mem, target); got != 0o600 {
				t.Errorf("after WriteMCP mode = %o, want 600", got)
			}
			if _, err := RemoveMCP(mem, h, "ui-craft"); err != nil {
				t.Fatalf("RemoveMCP: %v", err)
			}
			if got := modeOf(t, mem, target); got != 0o600 {
				t.Errorf("after RemoveMCP mode = %o, want 600", got)
			}
		})
	}
}

// The real atomic writer chmods its temp file before the rename, so this is
// where a hard-coded 0o644 would actually loosen the file.
func TestSharedConfig_keepsModeOnDisk(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX permission bits")
	}
	home := isolateHome(t)
	target := filepath.Join(home, ".claude.json")
	if err := os.WriteFile(target, []byte(claudeState), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(target, 0o600); err != nil {
		t.Fatal(err)
	}
	w := fsutil.OsFS{}
	if _, err := (ClaudeHarness{}).WriteMCP(w, testServer); err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if got := modeOf(t, w, target); got != 0o600 {
		t.Errorf("after WriteMCP mode = %o, want 600", got)
	}
	if _, err := RemoveMCP(w, ClaudeHarness{}, "ui-craft"); err != nil {
		t.Fatalf("RemoveMCP: %v", err)
	}
	if got := modeOf(t, w, target); got != 0o600 {
		t.Errorf("after RemoveMCP mode = %o, want 600", got)
	}
}

// unreadableFS fails every read of one path with a permission error.
type unreadableFS struct {
	*fsutil.MemFS
	path string
}

func (u unreadableFS) ReadFile(name string) ([]byte, error) {
	if name == u.path {
		return nil, &os.PathError{Op: "open", Path: name, Err: fs.ErrPermission}
	}
	return u.MemFS.ReadFile(name)
}

// An unreadable config is not a missing one: treating it as missing would
// write a fresh file over the user's (losing every other server), and
// RemoveMCP would report success while our entry stayed in place.
func TestSharedConfig_readErrorIsNotMissing(t *testing.T) {
	isolateHome(t)
	for _, h := range []Harness{ClaudeHarness{}, CursorHarness{}, GeminiHarness{}, OpenCodeHarness{}, CodexHarness{}} {
		t.Run(h.Name(), func(t *testing.T) {
			mem := fsutil.NewMemFS()
			target := h.ConfigPaths().MCPConfig
			write(t, mem, target, "{}\n")
			u := unreadableFS{MemFS: mem, path: target}

			if _, err := h.WriteMCP(u, testServer); !errors.Is(err, fs.ErrPermission) {
				t.Errorf("WriteMCP err = %v, want ErrPermission", err)
			}
			if got := read(t, mem, target); got != "{}\n" {
				t.Errorf("WriteMCP wrote despite the read error: %q", got)
			}
			if _, err := RemoveMCP(u, h, "ui-craft"); !errors.Is(err, fs.ErrPermission) {
				t.Errorf("RemoveMCP err = %v, want ErrPermission", err)
			}
		})
	}

	// A missing file is still the quiet no-op it always was.
	mem := fsutil.NewMemFS()
	ch, err := RemoveMCP(mem, ClaudeHarness{}, "ui-craft")
	if err != nil || ch.Changed {
		t.Errorf("missing file: changed=%v err=%v", ch.Changed, err)
	}
}
