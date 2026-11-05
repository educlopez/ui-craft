package harness

import (
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/educlopez/ui-craft/cli/component"
)

// isolateHome points HOME/USERPROFILE at a fresh temp dir and returns it.
func isolateHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	return home
}

// withGOOS fakes runtime.GOOS for the Windows-only branches.
func withGOOS(t *testing.T, v string) {
	t.Helper()
	prev := goos
	goos = v
	t.Cleanup(func() { goos = prev })
}

// withStat fakes statPath with a set of paths that exist.
func withStat(t *testing.T, existing ...string) {
	t.Helper()
	set := map[string]bool{}
	for _, p := range existing {
		set[p] = true
	}
	prev := statPath
	statPath = func(name string) (fs.FileInfo, error) {
		if set[name] {
			return nil, nil
		}
		return nil, fs.ErrNotExist
	}
	t.Cleanup(func() { statPath = prev })
}

func TestRoots_defaults(t *testing.T) {
	home := isolateHome(t)
	withStat(t)
	cases := []struct {
		h        Harness
		root     string
		mcp      string
		skills   string
		agents   string
		commands string
	}{
		{ClaudeHarness{}, filepath.Join(home, ".claude"), filepath.Join(home, ".claude.json"),
			filepath.Join(home, ".claude", "skills"), filepath.Join(home, ".claude", "agents"), filepath.Join(home, ".claude", "commands")},
		{CodexHarness{}, filepath.Join(home, ".codex"), filepath.Join(home, ".codex", "config.toml"),
			filepath.Join(home, ".codex", "skills"), filepath.Join(home, ".codex", "agents"), ""},
		{CursorHarness{}, filepath.Join(home, ".cursor"), filepath.Join(home, ".cursor", "mcp.json"),
			filepath.Join(home, ".cursor", "skills"), filepath.Join(home, ".cursor", "agents"), ""},
		{GeminiHarness{}, filepath.Join(home, ".gemini"), filepath.Join(home, ".gemini", "settings.json"),
			filepath.Join(home, ".gemini", "skills"), filepath.Join(home, ".gemini", "agents"), ""},
		{OpenCodeHarness{}, filepath.Join(home, ".config", "opencode"), filepath.Join(home, ".config", "opencode", "opencode.json"),
			filepath.Join(home, ".config", "opencode", "skills"), filepath.Join(home, ".config", "opencode", "agents"), filepath.Join(home, ".config", "opencode", "commands")},
	}
	for _, c := range cases {
		p := c.h.ConfigPaths()
		if c.h.ConfigRoot() != c.root || p.MCPConfig != c.mcp || p.SkillsDir != c.skills || p.AgentsDir != c.agents || p.CommandsDir != c.commands {
			t.Errorf("%s: root=%q paths=%+v\nwant root=%q mcp=%q skills=%q agents=%q commands=%q",
				c.h.Name(), c.h.ConfigRoot(), p, c.root, c.mcp, c.skills, c.agents, c.commands)
		}
	}
}

func TestRoots_envOverrides(t *testing.T) {
	isolateHome(t)
	withStat(t)
	base := t.TempDir()

	t.Run("CLAUDE_CONFIG_DIR", func(t *testing.T) {
		dir := filepath.Join(base, "claude-cfg")
		t.Setenv("CLAUDE_CONFIG_DIR", dir)
		h := ClaudeHarness{}
		if h.ConfigRoot() != dir {
			t.Errorf("root = %q, want %q", h.ConfigRoot(), dir)
		}
		if got := h.ConfigPaths().MCPConfig; got != filepath.Join(dir, ".claude.json") {
			t.Errorf("MCPConfig = %q, want %q", got, filepath.Join(dir, ".claude.json"))
		}
		if got := h.ConfigPaths().SkillsDir; got != filepath.Join(dir, "skills") {
			t.Errorf("SkillsDir = %q", got)
		}
	})
	t.Run("CODEX_HOME", func(t *testing.T) {
		dir := filepath.Join(base, "codex-home")
		t.Setenv("CODEX_HOME", dir)
		p := CodexHarness{}.ConfigPaths()
		if p.MCPConfig != filepath.Join(dir, "config.toml") || p.SkillsDir != filepath.Join(dir, "skills") ||
			p.AgentsDir != filepath.Join(dir, "agents") || p.AgentsMDPath != filepath.Join(dir, "AGENTS.md") {
			t.Errorf("paths = %+v, want everything under %q", p, dir)
		}
	})
	t.Run("GEMINI_CLI_HOME", func(t *testing.T) {
		dir := filepath.Join(base, "gemini-home")
		t.Setenv("GEMINI_CLI_HOME", dir)
		h := GeminiHarness{}
		if want := filepath.Join(dir, ".gemini"); h.ConfigRoot() != want {
			t.Errorf("root = %q, want %q (GEMINI_CLI_HOME replaces the home dir)", h.ConfigRoot(), want)
		}
		if got := h.ConfigPaths().MCPConfig; got != filepath.Join(dir, ".gemini", "settings.json") {
			t.Errorf("MCPConfig = %q", got)
		}
	})
	t.Run("XDG_CONFIG_HOME", func(t *testing.T) {
		xdg := filepath.Join(base, "xdg")
		t.Setenv("XDG_CONFIG_HOME", xdg)
		if got := (OpenCodeHarness{}).ConfigRoot(); got != filepath.Join(xdg, "opencode") {
			t.Errorf("root = %q, want %q", got, filepath.Join(xdg, "opencode"))
		}
	})
	t.Run("OPENCODE_CONFIG_DIR wins over XDG_CONFIG_HOME", func(t *testing.T) {
		t.Setenv("XDG_CONFIG_HOME", filepath.Join(base, "xdg"))
		dir := filepath.Join(base, "oc")
		t.Setenv("OPENCODE_CONFIG_DIR", dir)
		p := OpenCodeHarness{}.ConfigPaths()
		if p.MCPConfig != filepath.Join(dir, "opencode.json") || p.AgentsDir != filepath.Join(dir, "agents") {
			t.Errorf("paths = %+v, want everything under %q", p, dir)
		}
	})
	// Codex canonicalizes a relative CODEX_HOME against its working directory;
	// Gemini and OpenCode use theirs as given. Resolve the same way, so the
	// install lands where the harness reads.
	t.Run("relative override resolved against cwd", func(t *testing.T) {
		cwd, err := os.Getwd()
		if err != nil {
			t.Fatal(err)
		}
		t.Setenv("CODEX_HOME", filepath.Join("relative", "codex"))
		if got, want := (CodexHarness{}).ConfigRoot(), filepath.Join(cwd, "relative", "codex"); got != want {
			t.Errorf("CODEX_HOME root = %q, want %q", got, want)
		}
		t.Setenv("OPENCODE_CONFIG_DIR", filepath.Join("relative", "oc"))
		if got, want := (OpenCodeHarness{}).ConfigRoot(), filepath.Join(cwd, "relative", "oc"); got != want {
			t.Errorf("OPENCODE_CONFIG_DIR root = %q, want %q", got, want)
		}
	})
	t.Run("relative CLAUDE_CONFIG_DIR ignored", func(t *testing.T) {
		t.Setenv("CLAUDE_CONFIG_DIR", filepath.Join("relative", "claude"))
		if got := (ClaudeHarness{}).ConfigRoot(); !filepath.IsAbs(got) {
			t.Errorf("relative CLAUDE_CONFIG_DIR was trusted: %q", got)
		}
	})
}

// TestRoots_windows checks that on Windows Claude Code and OpenCode resolve
// under the user profile (not %APPDATA%), and that the old %APPDATA% roots
// only show up as legacy sweep targets.
func TestRoots_windows(t *testing.T) {
	home := isolateHome(t)
	withStat(t)
	withGOOS(t, "windows")
	appdata := filepath.Join(home, "AppData", "Roaming")
	t.Setenv("APPDATA", appdata)

	if got := (ClaudeHarness{}).ConfigRoot(); got != filepath.Join(home, ".claude") {
		t.Errorf("claude root = %q, want %q", got, filepath.Join(home, ".claude"))
	}
	if got := (ClaudeHarness{}).ConfigPaths().MCPConfig; got != filepath.Join(home, ".claude.json") {
		t.Errorf("claude MCPConfig = %q", got)
	}
	if got := (OpenCodeHarness{}).ConfigRoot(); got != filepath.Join(home, ".config", "opencode") {
		t.Errorf("opencode root = %q, want ~/.config/opencode", got)
	}

	claudeLegacy := LegacyPaths(ClaudeHarness{}, component.MCPGates, OwnedAssets{})
	wantClaude := filepath.Join(appdata, "Claude", "mcp", "ui-craft.json")
	if !contains(claudeLegacy, wantClaude) {
		t.Errorf("claude legacy MCP paths %v missing %s", claudeLegacy, wantClaude)
	}
	ocLegacy := LegacyPaths(OpenCodeHarness{}, component.MCPGates, OwnedAssets{})
	if !contains(ocLegacy, filepath.Join(appdata, "opencode", "opencode.json")) {
		t.Errorf("opencode legacy MCP paths %v missing the %%APPDATA%% config", ocLegacy)
	}

	// Off Windows the %APPDATA% roots are never touched.
	goos = "linux"
	if got := LegacyPaths(ClaudeHarness{}, component.MCPGates, OwnedAssets{}); contains(got, wantClaude) {
		t.Errorf("non-Windows legacy paths include %%APPDATA%%: %v", got)
	}
}

func TestOpenCode_jsoncConfigSelection(t *testing.T) {
	home := isolateHome(t)
	root := filepath.Join(home, ".config", "opencode")
	jsonc := filepath.Join(root, "opencode.jsonc")
	jsonPath := filepath.Join(root, "opencode.json")

	withStat(t, jsonc)
	if got := (OpenCodeHarness{}).ConfigPaths().MCPConfig; got != jsonc {
		t.Errorf("only opencode.jsonc exists: MCPConfig = %q, want %q", got, jsonc)
	}
	withStat(t, jsonc, jsonPath)
	if got := (OpenCodeHarness{}).ConfigPaths().MCPConfig; got != jsonPath {
		t.Errorf("both exist: MCPConfig = %q, want %q", got, jsonPath)
	}
	withStat(t)
	if got := (OpenCodeHarness{}).ConfigPaths().MCPConfig; got != jsonPath {
		t.Errorf("neither exists: MCPConfig = %q, want %q", got, jsonPath)
	}
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
