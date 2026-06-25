package harness

import (
	"os"
	"path/filepath"
	"runtime"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// OpenCodeHarness is the adapter for OpenCode.
//
// Detection: "opencode" on PATH.
// MCP config: ~/.config/opencode/opencode.json (JSONC / MergeIntoSettings strategy).
// Skills dir: ~/.config/opencode/skills/
// Agents dir: ~/.config/opencode/agent/ (or project .opencode/agent/).
// Supports:   SkillCommands, MCPGates, ReviewAgents, DesignMemory (all true).
//
// Windows: ~/.config resolves via %APPDATA% expansion.
// Gotcha: the config root on Windows differs — always use configRoot() rather
// than hardcoding a path.
type OpenCodeHarness struct{}

// Compile-time check: OpenCodeHarness must satisfy Harness.
var _ Harness = OpenCodeHarness{}

func (h OpenCodeHarness) Name() string { return "opencode" }

// configRoot returns the OS-appropriate OpenCode config root.
// On Windows, ~/.config equivalent is %APPDATA%.
func (h OpenCodeHarness) configRoot() string {
	if runtime.GOOS == "windows" {
		if appdata := os.Getenv("APPDATA"); appdata != "" {
			return filepath.Join(appdata, "opencode")
		}
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "opencode")
}

// Detect checks for the "opencode" binary on PATH.
func (h OpenCodeHarness) Detect() (DetectResult, error) {
	if bin, err := lookPath("opencode"); err == nil {
		root := h.configRoot()
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
			BinaryPath: bin,
		}, nil
	}
	return DetectResult{Installed: false}, nil
}

// ConfigPaths returns the canonical paths for OpenCode.
func (h OpenCodeHarness) ConfigPaths() ConfigPaths {
	root := h.configRoot()
	return ConfigPaths{
		MCPConfig: filepath.Join(root, "opencode.json"),
		SkillsDir: filepath.Join(root, "skills"),
		AgentsDir: filepath.Join(root, "agent"),
	}
}

// Supports reports capability support. OpenCode supports all four components
// including ReviewAgents (it has a native sub-agent format).
func (h OpenCodeHarness) Supports(c component.Component) bool {
	switch c {
	case component.SkillCommands, component.MCPGates, component.ReviewAgents, component.DesignMemory:
		return true
	default:
		return false
	}
}

// WriteMCP is not implemented in Slice 2; returns ErrNotImplemented.
func (h OpenCodeHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteSkill is not implemented in Slice 2; returns ErrNotImplemented.
func (h OpenCodeHarness) WriteSkill(w fsutil.FileSystem) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteAgents is not implemented in Slice 2; returns ErrNotImplemented.
func (h OpenCodeHarness) WriteAgents(w fsutil.FileSystem) ([]Change, error) {
	return nil, ErrNotImplemented
}
