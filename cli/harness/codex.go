package harness

import (
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// CodexHarness is the adapter for OpenAI Codex CLI.
//
// Detection: "codex" on PATH.
// MCP config: ~/.codex/config.toml (TOML / TOMLFile strategy).
// Skills dir: ~/.codex/skills/ (plus managed block in project AGENTS.md — Slice 5).
// Agents dir: (none — Codex has no native sub-agent format).
// Supports:   SkillCommands, MCPGates, DesignMemory = true; ReviewAgents = false.
type CodexHarness struct{}

// Compile-time check: CodexHarness must satisfy Harness.
var _ Harness = CodexHarness{}

func (h CodexHarness) Name() string { return "codex" }

func (h CodexHarness) configRoot() string {
	home, _ := os.UserHomeDir()
	if home == "" {
		return ""
	}
	return filepath.Join(home, ".codex")
}

// Detect checks for the "codex" binary on PATH OR the ~/.codex config dir.
// npm-global binaries aren't always on PATH, so a config-dir fallback is
// provided: if either signal is present the harness is considered installed.
// An empty home dir yields not-installed rather than a relative path.
func (h CodexHarness) Detect() (DetectResult, error) {
	root := h.configRoot()
	if root == "" {
		return DetectResult{Installed: false}, nil
	}

	// Primary: check binary on PATH.
	if bin, err := lookPath("codex"); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
			BinaryPath: bin,
		}, nil
	}

	// Fallback: check config directory existence.
	if _, err := statPath(root); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
		}, nil
	}

	return DetectResult{Installed: false}, nil
}

// ConfigPaths returns the canonical paths for Codex.
func (h CodexHarness) ConfigPaths() ConfigPaths {
	root := h.configRoot()
	return ConfigPaths{
		MCPConfig: filepath.Join(root, "config.toml"),
		SkillsDir: filepath.Join(root, "skills"),
		AgentsDir: "", // Codex has no sub-agent directory.
	}
}

// Supports reports capability support. Codex does NOT support ReviewAgents.
func (h CodexHarness) Supports(c component.Component) bool {
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
func (h CodexHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteSkill is not implemented in Slice 2; returns ErrNotImplemented.
func (h CodexHarness) WriteSkill(w fsutil.FileSystem) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteAgents is not implemented in Slice 2; returns ErrNotImplemented.
func (h CodexHarness) WriteAgents(w fsutil.FileSystem) ([]Change, error) {
	return nil, ErrNotImplemented
}
