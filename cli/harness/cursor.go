package harness

import (
	"encoding/json"
	"fmt"
	"io/fs"
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
// MCP config: ~/.cursor/mcp.json or <project>/.cursor/mcp.json (merge strategy).
// Skills dir: ~/.cursor/skills/ or <project>/.cursor/skills/ (<id>/SKILL.md).
// Agents dir: ~/.cursor/agents/ or <project>/.cursor/agents/ (markdown with
// YAML frontmatter; .cursor/ wins over .claude/agents on a name clash).
// Supports:   SkillCommands, MCPGates, ReviewAgents, DesignMemory (all true).
// Commands are not installed: they ship as peer skills.
type CursorHarness struct {
	// projectRoot is set via WithProjectRoot so ConfigPaths() resolves to
	// project-scoped paths. Empty (zero value) means global scope.
	projectRoot string
}

// Compile-time check: CursorHarness must satisfy Harness.
var _ Harness = CursorHarness{}

func (h CursorHarness) Name() string { return "cursor" }

// WithProjectRoot returns a copy of CursorHarness scoped to projectRoot. See
// Harness.WithProjectRoot for why this exists.
func (h CursorHarness) WithProjectRoot(projectRoot string) Harness {
	h.projectRoot = projectRoot
	return h
}

// ConfigRoot returns the Cursor config root (~/.cursor). Satisfies the Harness interface.
func (h CursorHarness) ConfigRoot() string { return h.configRoot() }

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

// ConfigPaths returns Cursor's paths for this harness's scope: global
// (home-derived) by default, or project-scoped when constructed via
// WithProjectRoot. Equivalent to ConfigPathsFor(h.projectRoot).
func (h CursorHarness) ConfigPaths() ConfigPaths {
	return h.ConfigPathsFor(h.projectRoot)
}

// ConfigPathsFor returns Cursor's paths, scoped to projectRoot when
// non-empty. Project-local targets: <projectRoot>/.cursor/skills,
// <projectRoot>/.cursor/agents and <projectRoot>/.cursor/mcp.json.
// (.cursor/rules only loads .mdc rule files, so skills never go there.)
func (h CursorHarness) ConfigPathsFor(projectRoot string) ConfigPaths {
	if projectRoot != "" {
		return ConfigPaths{
			MCPConfig:   filepath.Join(projectRoot, ".cursor", "mcp.json"),
			SkillsDir:   filepath.Join(projectRoot, ".cursor", "skills"),
			AgentsDir:   filepath.Join(projectRoot, ".cursor", "agents"),
			ProjectRoot: projectRoot,
		}
	}
	root := h.configRoot()
	if root == "" {
		return ConfigPaths{}
	}
	return ConfigPaths{
		MCPConfig: filepath.Join(root, "mcp.json"),
		SkillsDir: filepath.Join(root, "skills"),
		AgentsDir: filepath.Join(root, "agents"),
	}
}

// Supports reports capability support.
func (h CursorHarness) Supports(c component.Component) bool {
	switch c {
	case component.SkillCommands, component.MCPGates, component.ReviewAgents, component.DesignMemory:
		return true
	default:
		return false
	}
}

// legacyTargets: older versions put project skill trees in
// <project>/.cursor/rules/<id>/, which Cursor ignores (rules must be .mdc).
func (h CursorHarness) legacyTargets(c component.Component) []legacyTarget {
	if h.projectRoot == "" || c != component.SkillCommands {
		return nil
	}
	return []legacyTarget{{path: filepath.Join(h.projectRoot, ".cursor", "rules"), kind: legacySkillDirs, pruneDir: true}}
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
	existing, existed, readErr := readConfigFile(w, target)
	if readErr != nil {
		return Change{}, fmt.Errorf("cursor: read MCP config %s: %w", target, readErr)
	}
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

	wr, err := writeConfigFile(w, target, mr.Data, 0o644)
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

// WriteSkill copies the embedded Cursor skills tree into ~/.cursor/skills/.
// The mirror FS is rooted at the skills level (assets.SkillsFS("cursor")),
// so walking it yields <id>/SKILL.md paths that land at depth-1:
// ~/.cursor/skills/<id>/SKILL.md. Full-file ownership; idempotent via byte-compare.
func (h CursorHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (Change, error) {
	destDir := h.ConfigPaths().SkillsDir
	ch, err := writeMirrorToDir(w, mirror, destDir)
	if err != nil {
		return Change{}, fmt.Errorf("cursor: write skill mirror: %w", err)
	}
	return ch, nil
}

// WriteAgents writes the Cursor-format review agents (assets/agents/cursor/)
// into ~/.cursor/agents/ or <project>/.cursor/agents/. A nil agentsFS returns
// ErrUnsupported.
func (h CursorHarness) WriteAgents(w fsutil.FileSystem, agentsFS fs.FS) ([]Change, error) {
	if agentsFS == nil {
		return nil, ErrUnsupported
	}
	return writeAgentsToDir(w, agentsFS, h.ConfigPaths().AgentsDir, "cursor")
}

// WriteCommands returns ErrUnsupported. Cursor has no native slash-command
// directory; commands are installed as peer skills via WriteSkill instead.
func (h CursorHarness) WriteCommands(_ fsutil.FileSystem, _ fs.FS) ([]Change, error) {
	return nil, ErrUnsupported
}
