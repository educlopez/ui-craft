package cmd_test

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/spf13/cobra"
)

// TestUninstall_claudeKeepsClaudeJSON runs the real uninstall command against
// a real temp HOME. ~/.claude.json is Claude Code's own state file: uninstall
// must remove only mcpServers["ui-craft"], keep every other key in place and
// never delete the file. It must also sweep the dead ~/.claude/mcp/ui-craft.json
// older versions wrote.
func TestUninstall_claudeKeepsClaudeJSON(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	claudeJSON := filepath.Join(home, ".claude.json")
	const original = `{
  "numStartups": 3,
  "mcpServers": {
    "github": {
      "command": "gh-mcp"
    },
    "ui-craft": {
      "command": "npx",
      "args": [
        "-y",
        "ui-craft-mcp@0.9.0"
      ]
    }
  },
  "projects": {}
}
`
	if err := os.WriteFile(claudeJSON, []byte(original), 0o644); err != nil {
		t.Fatal(err)
	}
	legacy := filepath.Join(home, ".claude", "mcp", "ui-craft.json")
	if err := os.MkdirAll(filepath.Dir(legacy), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(legacy, []byte(`{"ui-craft":{"command":"npx"}}`), 0o644); err != nil {
		t.Fatal(err)
	}

	restore := cmd.SetFlags("claude", []string{"mcp-gates"}, true)
	defer restore()

	var out bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.AddCommand(cmd.MakeUninstallCmd())
	root.SetOut(&out)
	root.SetErr(&out)
	root.SetArgs([]string{"uninstall"})
	if err := root.Execute(); err != nil {
		t.Fatalf("uninstall: %v\n%s", err, out.String())
	}

	got, err := os.ReadFile(claudeJSON)
	if err != nil {
		t.Fatalf("~/.claude.json was deleted: %v", err)
	}
	want := `{
  "numStartups": 3,
  "mcpServers": {
    "github": {
      "command": "gh-mcp"
    }
  },
  "projects": {}
}
`
	if string(got) != want {
		t.Errorf("~/.claude.json after uninstall:\n%s\nwant:\n%s", got, want)
	}
	if _, err := os.Stat(filepath.Dir(legacy)); err == nil {
		t.Error("legacy ~/.claude/mcp/ was not swept")
	}
	if !strings.Contains(out.String(), "removed legacy") {
		t.Errorf("output does not report the legacy sweep:\n%s", out.String())
	}
}

// TestUninstall_mcpOnlySnapshotsOnlyMCPLegacy: an MCP-only uninstall must not
// snapshot the legacy skill dirs it never touches. An unreadable one there
// used to abort the snapshot, and with it the whole uninstall.
func TestUninstall_mcpOnlySnapshotsOnlyMCPLegacy(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("needs POSIX permissions and a non-root user")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", "")
	t.Setenv("OPENCODE_CONFIG_DIR", "")

	ocDir := filepath.Join(home, ".config", "opencode")
	cfg := filepath.Join(ocDir, "opencode.json")
	if err := os.MkdirAll(ocDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(cfg, []byte(`{"mcp":{"ui-craft":{"type":"local","command":["npx"]},"x":{"type":"local"}}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	// A legacy skill dir (singular skill/) the snapshot cannot read.
	locked := filepath.Join(ocDir, "skill", "ui-craft")
	if err := os.MkdirAll(locked, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(locked, "SKILL.md"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(locked, 0o000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(locked, 0o755) })

	restore := cmd.SetFlags("opencode", []string{"mcp-gates"}, true)
	defer restore()

	var out bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.AddCommand(cmd.MakeUninstallCmd())
	root.SetOut(&out)
	root.SetErr(&out)
	root.SetArgs([]string{"uninstall"})
	if err := root.Execute(); err != nil {
		t.Fatalf("uninstall: %v\n%s", err, out.String())
	}
	got, err := os.ReadFile(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(got), "ui-craft") || !strings.Contains(string(got), `"x"`) {
		t.Errorf("opencode.json after uninstall:\n%s", got)
	}
}
