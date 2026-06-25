package harness

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
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
	if home == "" {
		return ""
	}
	return filepath.Join(home, ".cursor")
}

// Detect checks for ~/.cursor/ directory. No PATH binary exists for Cursor.
// An empty home dir yields not-installed rather than a relative path.
func (h CursorHarness) Detect() (DetectResult, error) {
	root := h.configRoot()
	if root == "" {
		return DetectResult{Installed: false}, nil
	}
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

// WriteMCP implements the ConfigFile strategy for Cursor.
//
// It deep-merges the ui-craft server entry into ~/.cursor/mcp.json under
// mcpServers.<server.Name>. All other keys in the file are preserved
// (merge-not-clobber). If the file does not exist it is created from scratch.
// The write is atomic and idempotent (byte-compare skip when unchanged).
func (h CursorHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	paths := h.ConfigPaths()
	target := paths.MCPConfig // ~/.cursor/mcp.json

	// Read existing content (may not exist yet).
	existing, readErr := w.ReadFile(target)
	existed := readErr == nil
	if !existed {
		existing = []byte("{}")
	}

	// Build the overlay: only inject our single server key under mcpServers.
	overlay := map[string]any{
		"mcpServers": map[string]any{
			server.Name: map[string]any{
				// Use __replace__ so re-runs atomically replace our key's subtree.
				"__replace__": map[string]any{
					"command": server.Command,
					"args":    server.Args,
				},
			},
		},
	}
	overlayJSON, err := json.Marshal(overlay)
	if err != nil {
		return Change{}, fmt.Errorf("cursor: marshal MCP overlay: %w", err)
	}

	mr, err := filemerge.MergeJSONObjectsEx(existing, overlayJSON)
	if err != nil {
		return Change{}, fmt.Errorf("cursor: merge MCP config: %w", err)
	}

	prior := existing
	if !existed {
		prior = nil
	}

	wr, err := fsutil.WriteFileAtomic(w, target, mr.Data, 0o644)
	if err != nil {
		return Change{}, fmt.Errorf("cursor: write MCP config %s: %w", target, err)
	}

	return Change{
		FilePath:      target,
		PriorBytes:    prior,
		ExistedBefore: existed,
		Changed:       wr.Changed,
		MalformedBase: mr.MalformedBase,
		Strategy:      ConfigFile,
	}, nil
}

// WriteSkill is not implemented in Slice 2; returns ErrNotImplemented.
func (h CursorHarness) WriteSkill(w fsutil.FileSystem) (Change, error) {
	return Change{}, ErrNotImplemented
}

// WriteAgents is not implemented in Slice 2; returns ErrNotImplemented.
func (h CursorHarness) WriteAgents(w fsutil.FileSystem) ([]Change, error) {
	return nil, ErrNotImplemented
}
