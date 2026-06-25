package harness

import (
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// CursorHarness is the adapter for Cursor.
//
// Detection: ~/.cursor/ dir existence ONLY — Cursor ships no CLI binary.
// This is gotcha #6: do NOT attempt exec.LookPath("cursor").
//
// MCP config: ~/.cursor/mcp.json (ConfigFile / merge strategy).
// Skills dir: ~/.cursor/skills/
// Agents dir: (none — Cursor has no native sub-agent format).
// Supports:   SkillCommands, MCPGates, DesignMemory = true; ReviewAgents = false.
type CursorHarness struct{}

// Compile-time check: CursorHarness must satisfy Harness.
var _ Harness = CursorHarness{}

func (h CursorHarness) Name() string { return "cursor" }

func (h CursorHarness) configRoot() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".cursor")
}

// Detect checks for ~/.cursor/ directory. No PATH binary exists for Cursor.
func (h CursorHarness) Detect() (DetectResult, error) {
	root := h.configRoot()
	if _, err := statPath(root); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
		}, nil
	}
	return DetectResult{Installed: false}, nil
}

// ConfigPaths returns the canonical paths for Cursor.
func (h CursorHarness) ConfigPaths() ConfigPaths {
	root := h.configRoot()
	return ConfigPaths{
		MCPConfig: filepath.Join(root, "mcp.json"),
		SkillsDir: filepath.Join(root, "skills"),
		AgentsDir: "", // Cursor has no sub-agent directory.
	}
}

// Supports reports capability support. Cursor does NOT support ReviewAgents.
func (h CursorHarness) Supports(c component.Component) bool {
	switch c {
	case component.SkillCommands, component.MCPGates, component.DesignMemory:
		return true
	case component.ReviewAgents:
		return false
	default:
		return false
	}
}

// WriteMCP is not implemented in Slice 2; returns ErrNotImplemented.
func (h CursorHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteSkill is not implemented in Slice 2; returns ErrNotImplemented.
func (h CursorHarness) WriteSkill(w fsutil.FileSystem) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteAgents is not implemented in Slice 2; returns ErrNotImplemented.
func (h CursorHarness) WriteAgents(w fsutil.FileSystem) ([]Change, error) {
	return nil, ErrNotImplemented
}
