package harness_test

import (
	"errors"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// fixtureCommandsFS builds a small in-memory fs.FS that simulates the
// commands-rooted FS returned by assets.CommandsFS(h). Files are flat .md
// files at the root level (no subdirectory nesting).
func fixtureCommandsFS() fs.FS {
	return fstest.MapFS{
		"craft.md": &fstest.MapFile{
			Data: []byte("# /craft\n\nDesign a UI component.\n"),
		},
		"tokens.md": &fstest.MapFile{
			Data: []byte("# /tokens\n\nExtract design tokens.\n"),
		},
	}
}

// --- ConfigPaths.CommandsDir per harness ---

func TestConfigPaths_CommandsDir_claude(t *testing.T) {
	h := harness.ClaudeHarness{}
	paths := h.ConfigPaths()
	if paths.CommandsDir == "" {
		t.Fatal("claude: CommandsDir must not be empty")
	}
	if !strings.HasSuffix(paths.CommandsDir, "commands") {
		t.Errorf("claude: CommandsDir should end with 'commands', got %q", paths.CommandsDir)
	}
}

func TestConfigPaths_CommandsDir_opencode(t *testing.T) {
	h := harness.OpenCodeHarness{}
	paths := h.ConfigPaths()
	if paths.CommandsDir == "" {
		t.Fatal("opencode: CommandsDir must not be empty")
	}
	if !strings.HasSuffix(paths.CommandsDir, "commands") {
		t.Errorf("opencode: CommandsDir should end with 'commands', got %q", paths.CommandsDir)
	}
}

func TestConfigPaths_CommandsDir_cursor_empty(t *testing.T) {
	h := harness.CursorHarness{}
	paths := h.ConfigPaths()
	if paths.CommandsDir != "" {
		t.Errorf("cursor: CommandsDir should be empty (unsupported), got %q", paths.CommandsDir)
	}
}

func TestConfigPaths_CommandsDir_codex_empty(t *testing.T) {
	h := harness.CodexHarness{}
	paths := h.ConfigPaths()
	if paths.CommandsDir != "" {
		t.Errorf("codex: CommandsDir should be empty (unsupported), got %q", paths.CommandsDir)
	}
}

func TestConfigPaths_CommandsDir_gemini_empty(t *testing.T) {
	h := harness.GeminiHarness{}
	paths := h.ConfigPaths()
	if paths.CommandsDir != "" {
		t.Errorf("gemini: CommandsDir should be empty (unsupported), got %q", paths.CommandsDir)
	}
}

// --- WriteCommands writes flat depth-1 .md files ---

func TestWriteCommands_claude_flat(t *testing.T) {
	mem := fsutil.NewMemFS()
	commandsFS := fixtureCommandsFS()

	h := harness.ClaudeHarness{}
	commandsDir := h.ConfigPaths().CommandsDir

	changes, err := h.WriteCommands(mem, commandsFS)
	if err != nil {
		t.Fatalf("WriteCommands: unexpected error: %v", err)
	}
	if len(changes) == 0 {
		t.Fatal("WriteCommands: expected at least one Change")
	}

	// Both files must land flat in commandsDir (no subdirs).
	for _, name := range []string{"craft.md", "tokens.md"} {
		destPath := filepath.Join(commandsDir, name)
		data, readErr := mem.ReadFile(destPath)
		if readErr != nil {
			t.Errorf("expected %s to exist, got: %v", destPath, readErr)
			continue
		}
		if len(data) == 0 {
			t.Errorf("expected %s to have content", destPath)
		}
	}

	// No file should be written in a subdirectory inside commandsDir.
	for _, ch := range changes {
		rel, err := filepath.Rel(commandsDir, ch.FilePath)
		if err != nil {
			t.Errorf("change FilePath %q not under commandsDir %q: %v", ch.FilePath, commandsDir, err)
			continue
		}
		if strings.Contains(rel, string(filepath.Separator)) {
			t.Errorf("expected flat file, got nested path: %s", ch.FilePath)
		}
	}
}

func TestWriteCommands_opencode_flat(t *testing.T) {
	mem := fsutil.NewMemFS()
	commandsFS := fixtureCommandsFS()

	h := harness.OpenCodeHarness{}
	commandsDir := h.ConfigPaths().CommandsDir

	changes, err := h.WriteCommands(mem, commandsFS)
	if err != nil {
		t.Fatalf("WriteCommands: unexpected error: %v", err)
	}
	if len(changes) == 0 {
		t.Fatal("WriteCommands: expected at least one Change")
	}

	for _, name := range []string{"craft.md", "tokens.md"} {
		destPath := filepath.Join(commandsDir, name)
		if _, readErr := mem.ReadFile(destPath); readErr != nil {
			t.Errorf("expected %s to exist, got: %v", destPath, readErr)
		}
	}
}

// --- WriteCommands returns ErrUnsupported for cursor/codex/gemini ---

func TestWriteCommands_cursor_unsupported(t *testing.T) {
	mem := fsutil.NewMemFS()
	commandsFS := fixtureCommandsFS()

	h := harness.CursorHarness{}
	_, err := h.WriteCommands(mem, commandsFS)
	if !errors.Is(err, harness.ErrUnsupported) {
		t.Errorf("cursor.WriteCommands: expected ErrUnsupported, got %v", err)
	}
}

func TestWriteCommands_codex_unsupported(t *testing.T) {
	mem := fsutil.NewMemFS()
	commandsFS := fixtureCommandsFS()

	h := harness.CodexHarness{}
	_, err := h.WriteCommands(mem, commandsFS)
	if !errors.Is(err, harness.ErrUnsupported) {
		t.Errorf("codex.WriteCommands: expected ErrUnsupported, got %v", err)
	}
}

func TestWriteCommands_gemini_unsupported(t *testing.T) {
	mem := fsutil.NewMemFS()
	commandsFS := fixtureCommandsFS()

	h := harness.GeminiHarness{}
	_, err := h.WriteCommands(mem, commandsFS)
	if !errors.Is(err, harness.ErrUnsupported) {
		t.Errorf("gemini.WriteCommands: expected ErrUnsupported, got %v", err)
	}
}

// --- Idempotency: re-run produces Changed:false ---

func TestWriteCommands_idempotent(t *testing.T) {
	for _, tc := range []struct {
		name    string
		harness harness.Harness
	}{
		{"claude", harness.ClaudeHarness{}},
		{"opencode", harness.OpenCodeHarness{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mem := fsutil.NewMemFS()
			commandsFS := fixtureCommandsFS()

			// First write.
			ch1, err := tc.harness.WriteCommands(mem, commandsFS)
			if err != nil {
				t.Fatalf("first WriteCommands: %v", err)
			}
			anyChanged1 := false
			for _, c := range ch1 {
				if c.Changed {
					anyChanged1 = true
					break
				}
			}
			if !anyChanged1 {
				t.Error("first WriteCommands: expected Changed:true (new files)")
			}

			// Second write — same content, should be Changed:false for all.
			ch2, err := tc.harness.WriteCommands(mem, commandsFS)
			if err != nil {
				t.Fatalf("second WriteCommands: %v", err)
			}
			for _, c := range ch2 {
				if c.Changed {
					t.Errorf("second WriteCommands: expected Changed:false, got Changed:true for %s", c.FilePath)
				}
			}
		})
	}
}

// --- Stale cleanup: owned command files no longer in FS are removed ---

func TestWriteCommands_staleCleanup(t *testing.T) {
	for _, tc := range []struct {
		name    string
		harness harness.Harness
	}{
		{"claude", harness.ClaudeHarness{}},
		{"opencode", harness.OpenCodeHarness{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mem := fsutil.NewMemFS()

			// Pre-populate a stale command file that is NOT in the new commandsFS.
			commandsDir := tc.harness.ConfigPaths().CommandsDir
			staleFile := filepath.Join(commandsDir, "old-command.md")
			if err := mem.MkdirAll(commandsDir, 0o755); err != nil {
				t.Fatalf("MkdirAll: %v", err)
			}
			if _, err := fsutil.WriteFileAtomic(mem, staleFile, []byte("old"), 0o644); err != nil {
				t.Fatalf("write stale file: %v", err)
			}

			// Use the standard fixture (craft.md + tokens.md — old-command.md absent).
			commandsFS := fixtureCommandsFS()

			_, err := tc.harness.WriteCommands(mem, commandsFS)
			if err != nil {
				t.Fatalf("WriteCommands: %v", err)
			}

			// Stale file must be gone.
			if _, readErr := mem.ReadFile(staleFile); readErr == nil {
				t.Errorf("expected stale file %s to be removed after WriteCommands", staleFile)
			}

			// Current files must be present.
			for _, name := range []string{"craft.md", "tokens.md"} {
				destPath := filepath.Join(commandsDir, name)
				if _, readErr := mem.ReadFile(destPath); readErr != nil {
					t.Errorf("expected %s to exist after WriteCommands: %v", destPath, readErr)
				}
			}
		})
	}
}

// --- WriteCommands with nil commandsFS returns ErrUnsupported ---

func TestWriteCommands_nilFS_unsupported(t *testing.T) {
	for _, tc := range []struct {
		name    string
		harness harness.Harness
	}{
		{"claude", harness.ClaudeHarness{}},
		{"opencode", harness.OpenCodeHarness{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mem := fsutil.NewMemFS()
			_, err := tc.harness.WriteCommands(mem, nil)
			if !errors.Is(err, harness.ErrUnsupported) {
				t.Errorf("%s.WriteCommands(nil): expected ErrUnsupported, got %v", tc.name, err)
			}
		})
	}
}

// --- Interface satisfaction: all 5 harnesses satisfy WriteCommands ---

var _ interface {
	WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]harness.Change, error)
} = harness.ClaudeHarness{}

var _ interface {
	WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]harness.Change, error)
} = harness.OpenCodeHarness{}

var _ interface {
	WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]harness.Change, error)
} = harness.CursorHarness{}

var _ interface {
	WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]harness.Change, error)
} = harness.CodexHarness{}

var _ interface {
	WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]harness.Change, error)
} = harness.GeminiHarness{}
