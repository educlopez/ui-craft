package harness

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
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
// On Windows, it uses %APPDATA%\opencode; if APPDATA is empty the harness is
// not detectable and an empty string is returned. On non-Windows systems the
// Unix path (~/.config/opencode) is used. An empty home dir also yields "".
func (h OpenCodeHarness) configRoot() string {
	if runtime.GOOS == "windows" {
		appdata := os.Getenv("APPDATA")
		if appdata == "" {
			// APPDATA missing on Windows — do NOT fall through to Unix path.
			return ""
		}
		return filepath.Join(appdata, "opencode")
	}
	home, _ := os.UserHomeDir()
	if home == "" {
		return ""
	}
	return filepath.Join(home, ".config", "opencode")
}

// Detect checks for the "opencode" binary on PATH or the config dir existence.
// If configRoot() returns empty (e.g. missing APPDATA on Windows or empty home),
// the harness is reported as not installed rather than constructing a bogus path.
func (h OpenCodeHarness) Detect() (DetectResult, error) {
	root := h.configRoot()
	if root == "" {
		return DetectResult{Installed: false}, nil
	}

	// Primary: check config directory existence.
	if _, err := statPath(root); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
		}, nil
	}

	// Secondary: check binary on PATH.
	if bin, err := lookPath("opencode"); err == nil {
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

// WriteMCP implements the MergeIntoSettings strategy for OpenCode.
//
// OpenCode uses JSONC for its config (~/.config/opencode/opencode.json).
// The ui-craft server entry is merged under the top-level "mcp" key:
//
//	"mcp": { "<name>": { "type": "local", "command": ["npx","-y","ui-craft-mcp"] } }
//
// Comments and trailing commas in the existing config are stripped before
// parse (JSONC support) and the file is rewritten as clean JSON.
// Atomic + idempotent (byte-compare skips write when unchanged).
func (h OpenCodeHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	paths := h.ConfigPaths()
	target := paths.MCPConfig // ~/.config/opencode/opencode.json

	existing, readErr := w.ReadFile(target)
	existed := readErr == nil
	if !existed {
		existing = []byte("{}")
	}

	// Build the command slice: combine Command + Args.
	cmd := append([]string{server.Command}, server.Args...)

	overlay := map[string]any{
		"mcp": map[string]any{
			server.Name: map[string]any{
				"__replace__": map[string]any{
					"type":    "local",
					"command": cmd,
				},
			},
		},
	}
	overlayJSON, err := json.Marshal(overlay)
	if err != nil {
		return Change{}, fmt.Errorf("opencode: marshal MCP overlay: %w", err)
	}

	// MergeJSONObjectsEx handles JSONC (strips comments + trailing commas before
	// parse) and reports whether the base was malformed (gotcha #2).
	mr, err := filemerge.MergeJSONObjectsEx(existing, overlayJSON)
	if err != nil {
		return Change{}, fmt.Errorf("opencode: merge opencode.json: %w", err)
	}

	prior := existing
	if !existed {
		prior = nil
	}

	wr, err := fsutil.WriteFileAtomic(w, target, mr.Data, 0o644)
	if err != nil {
		return Change{}, fmt.Errorf("opencode: write opencode.json %s: %w", target, err)
	}

	return Change{
		FilePath:      target,
		PriorBytes:    prior,
		ExistedBefore: existed,
		Changed:       wr.Changed,
		MalformedBase: mr.MalformedBase,
		Strategy:      MergeIntoSettings,
	}, nil
}

// WriteSkill is not implemented in Slice 2; returns ErrNotImplemented.
func (h OpenCodeHarness) WriteSkill(w fsutil.FileSystem) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteAgents is not implemented in Slice 2; returns ErrNotImplemented.
func (h OpenCodeHarness) WriteAgents(w fsutil.FileSystem) ([]Change, error) {
	return nil, ErrNotImplemented
}
