package harness

import (
	"errors"
	"io/fs"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/component"
)

// fakeFileInfo is a minimal fs.FileInfo used to make statPath return success.
type fakeFileInfo struct{ name string }

func (f fakeFileInfo) Name() string       { return f.name }
func (f fakeFileInfo) Size() int64        { return 0 }
func (f fakeFileInfo) Mode() fs.FileMode  { return 0o755 }
func (f fakeFileInfo) ModTime() time.Time { return time.Time{} }
func (f fakeFileInfo) IsDir() bool        { return true }
func (f fakeFileInfo) Sys() any           { return nil }

// errNotFound is a sentinel error simulating "path not found".
var errNotFound = errors.New("path not found")

// withInjectedDetect replaces the package-level lookPath and statPath vars for
// the duration of fn, then restores the originals.
func withInjectedDetect(
	lp func(string) (string, error),
	sp func(string) (fs.FileInfo, error),
	fn func(),
) {
	origLook := lookPath
	origStat := statPath
	lookPath = lp
	statPath = sp
	defer func() {
		lookPath = origLook
		statPath = origStat
	}()
	fn()
}

// --- Claude ---

func TestClaudeDetect_installedViaDir(t *testing.T) {
	withInjectedDetect(
		func(string) (string, error) { return "", errNotFound },
		func(string) (fs.FileInfo, error) { return fakeFileInfo{"claude"}, nil },
		func() {
			h := ClaudeHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !res.Installed {
				t.Fatal("expected Installed=true when ~/.claude dir exists")
			}
		},
	)
}

func TestClaudeDetect_installedViaBinary(t *testing.T) {
	withInjectedDetect(
		func(file string) (string, error) {
			if file == "claude" {
				return "/usr/local/bin/claude", nil
			}
			return "", errNotFound
		},
		func(string) (fs.FileInfo, error) { return nil, errNotFound },
		func() {
			h := ClaudeHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !res.Installed {
				t.Fatal("expected Installed=true when claude binary on PATH")
			}
			if res.BinaryPath == "" {
				t.Fatal("expected non-empty BinaryPath")
			}
		},
	)
}

func TestClaudeDetect_notInstalled(t *testing.T) {
	withInjectedDetect(
		func(string) (string, error) { return "", errNotFound },
		func(string) (fs.FileInfo, error) { return nil, errNotFound },
		func() {
			h := ClaudeHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Installed {
				t.Fatal("expected Installed=false")
			}
		},
	)
}

// --- Cursor ---

func TestCursorDetect_installedViaDir(t *testing.T) {
	withInjectedDetect(
		func(string) (string, error) { return "", errNotFound },
		func(string) (fs.FileInfo, error) { return fakeFileInfo{"cursor"}, nil },
		func() {
			h := CursorHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !res.Installed {
				t.Fatal("expected Installed=true when ~/.cursor dir exists")
			}
		},
	)
}

func TestCursorDetect_notInstalled(t *testing.T) {
	withInjectedDetect(
		func(string) (string, error) { return "", errNotFound },
		func(string) (fs.FileInfo, error) { return nil, errNotFound },
		func() {
			h := CursorHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Installed {
				t.Fatal("expected Installed=false")
			}
		},
	)
}

// --- Codex ---

func TestCodexDetect_installed(t *testing.T) {
	withInjectedDetect(
		func(file string) (string, error) {
			if file == "codex" {
				return "/usr/local/bin/codex", nil
			}
			return "", errNotFound
		},
		func(string) (fs.FileInfo, error) { return nil, errNotFound },
		func() {
			h := CodexHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !res.Installed {
				t.Fatal("expected Installed=true when codex on PATH")
			}
		},
	)
}

func TestCodexDetect_notInstalled(t *testing.T) {
	withInjectedDetect(
		func(string) (string, error) { return "", errNotFound },
		func(string) (fs.FileInfo, error) { return nil, errNotFound },
		func() {
			h := CodexHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Installed {
				t.Fatal("expected Installed=false")
			}
		},
	)
}

// --- Gemini ---

func TestGeminiDetect_installed(t *testing.T) {
	withInjectedDetect(
		func(file string) (string, error) {
			if file == "gemini" {
				return "/usr/local/bin/gemini", nil
			}
			return "", errNotFound
		},
		func(string) (fs.FileInfo, error) { return nil, errNotFound },
		func() {
			h := GeminiHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !res.Installed {
				t.Fatal("expected Installed=true when gemini on PATH")
			}
		},
	)
}

func TestGeminiDetect_notInstalled(t *testing.T) {
	withInjectedDetect(
		func(string) (string, error) { return "", errNotFound },
		func(string) (fs.FileInfo, error) { return nil, errNotFound },
		func() {
			h := GeminiHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Installed {
				t.Fatal("expected Installed=false")
			}
		},
	)
}

// --- OpenCode ---

func TestOpenCodeDetect_installed(t *testing.T) {
	withInjectedDetect(
		func(file string) (string, error) {
			if file == "opencode" {
				return "/usr/local/bin/opencode", nil
			}
			return "", errNotFound
		},
		func(string) (fs.FileInfo, error) { return nil, errNotFound },
		func() {
			h := OpenCodeHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !res.Installed {
				t.Fatal("expected Installed=true when opencode on PATH")
			}
		},
	)
}

func TestOpenCodeDetect_notInstalled(t *testing.T) {
	withInjectedDetect(
		func(string) (string, error) { return "", errNotFound },
		func(string) (fs.FileInfo, error) { return nil, errNotFound },
		func() {
			h := OpenCodeHarness{}
			res, err := h.Detect()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Installed {
				t.Fatal("expected Installed=false")
			}
		},
	)
}

// --- Supports matrix ---

// TestSupports_reviewAgentsOnlyClaudeAndOpenCode asserts the critical capability
// gate: only Claude Code and OpenCode return true for ReviewAgents.
func TestSupports_reviewAgentsOnlyClaudeAndOpenCode(t *testing.T) {
	type tc struct {
		h    Harness
		want bool
	}
	cases := []tc{
		{ClaudeHarness{}, true},
		{OpenCodeHarness{}, true},
		{CursorHarness{}, false},
		{CodexHarness{}, false},
		{GeminiHarness{}, false},
	}
	for _, c := range cases {
		got := c.h.Supports(component.ReviewAgents)
		if got != c.want {
			t.Errorf("%s.Supports(ReviewAgents) = %v, want %v", c.h.Name(), got, c.want)
		}
	}
}

// TestSupports_cursorSkipsAgents is an explicitly named variant required by tasks.md.
func TestSupports_cursorSkipsAgents(t *testing.T) {
	h := CursorHarness{}
	if h.Supports(component.ReviewAgents) {
		t.Fatal("CursorHarness must not support ReviewAgents")
	}
}

// TestSupports_codexSkipsAgents is an explicitly named variant required by tasks.md.
func TestSupports_codexSkipsAgents(t *testing.T) {
	h := CodexHarness{}
	if h.Supports(component.ReviewAgents) {
		t.Fatal("CodexHarness must not support ReviewAgents")
	}
}

// TestSupports_geminiSkipsAgents is an explicitly named variant required by tasks.md.
func TestSupports_geminiSkipsAgents(t *testing.T) {
	h := GeminiHarness{}
	if h.Supports(component.ReviewAgents) {
		t.Fatal("GeminiHarness must not support ReviewAgents")
	}
}

// TestSupports_allHarnesses asserts that every harness supports the three
// universally-required components.
func TestSupports_allHarnesses(t *testing.T) {
	universal := []component.Component{
		component.SkillCommands,
		component.MCPGates,
		component.DesignMemory,
	}
	for _, h := range All() {
		for _, c := range universal {
			if !h.Supports(c) {
				t.Errorf("%s.Supports(%s) = false, want true", h.Name(), c)
			}
		}
	}
}
