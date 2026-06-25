package harness

import (
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// GeminiHarness is the adapter for Google Gemini CLI.
//
// Detection: "gemini" on PATH.
// MCP config: ~/.gemini/settings.json (JSON / MergeIntoSettings strategy).
// Skills dir: ~/.gemini/skills/
// Agents dir: (none — Gemini CLI has no native sub-agent format).
// Supports:   SkillCommands, MCPGates, DesignMemory = true; ReviewAgents = false.
type GeminiHarness struct{}

// Compile-time check: GeminiHarness must satisfy Harness.
var _ Harness = GeminiHarness{}

func (h GeminiHarness) Name() string { return "gemini" }

func (h GeminiHarness) configRoot() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".gemini")
}

// Detect checks for the "gemini" binary on PATH.
func (h GeminiHarness) Detect() (DetectResult, error) {
	if bin, err := lookPath("gemini"); err == nil {
		root := h.configRoot()
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
			BinaryPath: bin,
		}, nil
	}
	return DetectResult{Installed: false}, nil
}

// ConfigPaths returns the canonical paths for Gemini CLI.
func (h GeminiHarness) ConfigPaths() ConfigPaths {
	root := h.configRoot()
	return ConfigPaths{
		MCPConfig: filepath.Join(root, "settings.json"),
		SkillsDir: filepath.Join(root, "skills"),
		AgentsDir: "", // Gemini CLI has no sub-agent directory.
	}
}

// Supports reports capability support. Gemini does NOT support ReviewAgents.
func (h GeminiHarness) Supports(c component.Component) bool {
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
func (h GeminiHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteSkill is not implemented in Slice 2; returns ErrNotImplemented.
func (h GeminiHarness) WriteSkill(w fsutil.FileSystem) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteAgents is not implemented in Slice 2; returns ErrNotImplemented.
func (h GeminiHarness) WriteAgents(w fsutil.FileSystem) ([]Change, error) {
	return nil, ErrNotImplemented
}
