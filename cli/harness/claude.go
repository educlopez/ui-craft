package harness

import (
	"encoding/json"
	"fmt"
	"io/fs"
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

// WriteMCP implements the SeparateFiles strategy for Claude Code.
//
// It writes a standalone JSON file at ~/.claude/mcp/<server.Name>.json
// containing exactly one server entry:
//
//	{ "<name>": { "command": "...", "args": [...] } }
//
// The file is created (including parent directories) if absent, or updated
// atomically. If the file already contains identical bytes the write is
// skipped and Change.Strategy is still set so callers can log "already configured".
func (h ClaudeHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	paths := h.ConfigPaths()
	target := paths.MCPConfig // ~/.claude/mcp/ui-craft.json

	// Build the JSON content: { "<name>": { "command": ..., "args": [...] } }
	entry := map[string]any{
		"command": server.Command,
		"args":    server.Args,
	}
	payload := map[string]any{server.Name: entry}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return Change{}, fmt.Errorf("claude: marshal MCP config: %w", err)
	}
	data = append(data, '\n')

	// Read prior bytes for the Change record (backup/rollback).
	prior, readErr := w.ReadFile(target)
	existed := readErr == nil

	wr, err := fsutil.WriteFileAtomic(w, target, data, 0o644)
	if err != nil {
		return Change{}, fmt.Errorf("claude: write MCP config %s: %w", target, err)
	}

	return Change{
		FilePath:      target,
		PriorBytes:    prior,
		ExistedBefore: existed,
		Changed:       wr.Changed,
		Strategy:      SeparateFiles,
	}, nil
}

// WriteSkill copies the embedded Claude mirror into ~/.claude/skills/ui-craft/.
// The CLI has full ownership of this directory; every file is written atomically
// via WriteFileAtomic (byte-compare early exit = idempotent re-runs).
func (h ClaudeHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (Change, error) {
	destDir := filepath.Join(h.ConfigPaths().SkillsDir, "ui-craft")
	ch, err := writeMirrorToDir(w, mirror, destDir)
	if err != nil {
		return Change{}, fmt.Errorf("claude: write skill mirror: %w", err)
	}
	return ch, nil
}

// WriteAgents is not implemented in Slice 2; returns ErrNotImplemented.
func (h ClaudeHarness) WriteAgents(w fsutil.FileSystem) ([]Change, error) {
	return nil, ErrNotImplemented
}
