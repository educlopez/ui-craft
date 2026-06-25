package harness

import (
	"os"
	"path/filepath"
	"runtime"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// ClaudeHarness is the adapter for Claude Code (Anthropic).
//
// Detection: ~/.claude/ dir OR "claude" on PATH.
// MCP config: ~/.claude/mcp/ui-craft.json (SeparateFiles strategy).
// Skills dir: ~/.claude/skills/
// Agents dir: ~/.claude/agents/
// Supports:   SkillCommands, MCPGates, ReviewAgents, DesignMemory (all true).
//
// Windows: uses %APPDATA%\Claude as the config root instead of ~/.claude.
type ClaudeHarness struct{}

// Compile-time check: ClaudeHarness must satisfy Harness.
var _ Harness = ClaudeHarness{}

func (h ClaudeHarness) Name() string { return "claude" }

// configRoot returns the OS-appropriate Claude config root.
// On Windows, it uses %APPDATA%\Claude; if APPDATA is empty the harness is
// not detectable and an empty string is returned. On non-Windows systems the
// Unix path (~/.claude) is used. An empty home dir also yields an empty string.
func (h ClaudeHarness) configRoot() string {
	if runtime.GOOS == "windows" {
		appdata := os.Getenv("APPDATA")
		if appdata == "" {
			// APPDATA missing on Windows — do NOT fall through to Unix path.
			return ""
		}
		return filepath.Join(appdata, "Claude")
	}
	home, _ := os.UserHomeDir()
	if home == "" {
		return ""
	}
	return filepath.Join(home, ".claude")
}

// Detect checks for ~/.claude/ directory or "claude" on PATH.
// It uses the package-level lookPath and statPath vars so tests can inject fakes.
// If configRoot() returns empty (e.g. missing APPDATA on Windows or empty home),
// the harness is reported as not installed rather than constructing a bogus path.
func (h ClaudeHarness) Detect() (DetectResult, error) {
	root := h.configRoot()
	if root == "" {
		return DetectResult{Installed: false}, nil
	}

	// Primary: check directory existence.
	if _, err := statPath(root); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
		}, nil
	}

	// Secondary: check binary on PATH.
	if bin, err := lookPath("claude"); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
			BinaryPath: bin,
		}, nil
	}

	return DetectResult{Installed: false}, nil
}

// ConfigPaths returns the canonical paths for Claude Code.
func (h ClaudeHarness) ConfigPaths() ConfigPaths {
	root := h.configRoot()
	return ConfigPaths{
		MCPConfig: filepath.Join(root, "mcp", "ui-craft.json"),
		SkillsDir: filepath.Join(root, "skills"),
		AgentsDir: filepath.Join(root, "agents"),
	}
}

// Supports reports capability support. Claude Code supports all four components.
func (h ClaudeHarness) Supports(c component.Component) bool {
	switch c {
	case component.SkillCommands, component.MCPGates, component.ReviewAgents, component.DesignMemory:
		return true
	default:
		return false
	}
}

// WriteMCP is not implemented in Slice 2; returns ErrNotImplemented.
func (h ClaudeHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteSkill is not implemented in Slice 2; returns ErrNotImplemented.
func (h ClaudeHarness) WriteSkill(w fsutil.FileSystem) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteAgents is not implemented in Slice 2; returns ErrNotImplemented.
func (h ClaudeHarness) WriteAgents(w fsutil.FileSystem) ([]Change, error) {
	return nil, ErrNotImplemented
}
