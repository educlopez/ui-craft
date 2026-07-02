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
type OpenCodeHarness struct {
	// projectRoot is set via WithProjectRoot so ConfigPaths() resolves to
	// project-scoped paths. Empty (zero value) means global scope.
	projectRoot string
}

// Compile-time check: OpenCodeHarness must satisfy Harness.
var _ Harness = OpenCodeHarness{}

func (h OpenCodeHarness) Name() string { return "opencode" }

// WithProjectRoot returns a copy of OpenCodeHarness scoped to projectRoot.
// See Harness.WithProjectRoot for why this exists.
func (h OpenCodeHarness) WithProjectRoot(projectRoot string) Harness {
	h.projectRoot = projectRoot
	return h
}

// ConfigRoot returns the OpenCode config root. Satisfies the Harness interface.
func (h OpenCodeHarness) ConfigRoot() string { return h.configRoot() }

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

// ConfigPaths returns OpenCode's paths for this harness's scope: global
// (home-derived) by default, or project-scoped when constructed via
// WithProjectRoot. Equivalent to ConfigPathsFor(h.projectRoot).
func (h OpenCodeHarness) ConfigPaths() ConfigPaths {
	return h.ConfigPathsFor(h.projectRoot)
}

// ConfigPathsFor returns OpenCode's paths, scoped to projectRoot when
// non-empty. Project-local targets mirror OpenCode's existing global
// component set (skills-dir, commands-dir, agent-dir) into `.opencode/`-scoped
// project dirs, plus a project-root opencode.json for MCP. Per design's Q3
// resolution, OpenCode never writes an AGENTS.md managed block in project
// mode — its skills/commands/agent dirs are its native project mechanism.
func (h OpenCodeHarness) ConfigPathsFor(projectRoot string) ConfigPaths {
	if projectRoot != "" {
		return ConfigPaths{
			MCPConfig:   filepath.Join(projectRoot, "opencode.json"),
			SkillsDir:   filepath.Join(projectRoot, ".opencode", "skill"),
			AgentsDir:   filepath.Join(projectRoot, ".opencode", "agent"),
			CommandsDir: filepath.Join(projectRoot, ".opencode", "command"),
			ProjectRoot: projectRoot,
		}
	}
	root := h.configRoot()
	return ConfigPaths{
		MCPConfig:   filepath.Join(root, "opencode.json"),
		SkillsDir:   filepath.Join(root, "skills"),
		AgentsDir:   filepath.Join(root, "agent"),
		CommandsDir: filepath.Join(root, "commands"),
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

// WriteSkill copies the embedded OpenCode skills tree into ~/.config/opencode/skills/.
// The mirror FS is rooted at the skills level (assets.SkillsFS("opencode")),
// so walking it yields <id>/SKILL.md paths that land at depth-1:
// ~/.config/opencode/skills/<id>/SKILL.md. Full-file ownership; idempotent.
func (h OpenCodeHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (Change, error) {
	destDir := h.ConfigPaths().SkillsDir
	ch, err := writeMirrorToDir(w, mirror, destDir)
	if err != nil {
		return Change{}, fmt.Errorf("opencode: write skill mirror: %w", err)
	}
	return ch, nil
}

// WriteCommands writes slash-command .md files flat into ~/.config/opencode/commands/.
// commandsFS is the commands-rooted FS from assets.CommandsFS("opencode"), where
// each entry is a flat <name>.md file. The CLI owns the command files it
// installs; stale files no longer in commandsFS are removed (scoped cleanup).
// A nil commandsFS returns ErrUnsupported.
func (h OpenCodeHarness) WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]Change, error) {
	if commandsFS == nil {
		return nil, ErrUnsupported
	}
	commandsDir := h.ConfigPaths().CommandsDir // ~/.config/opencode/commands/
	return writeFlatMDToDir(w, commandsFS, commandsDir, "opencode")
}

// WriteAgents writes the review agent definitions into OpenCode's native agent
// directory (~/.config/opencode/agent/). Each .md file in agentsFS is written
// as a separate agent file using WriteFileAtomic (idempotent byte-compare).
//
// OpenCode uses a simpler frontmatter schema (name + description only, no tools
// or color fields). The agent files in assets/agents/opencode/ are pre-formatted
// for OpenCode — the body/instructions are identical to the Claude versions but
// only the harness-relevant frontmatter keys are present.
//
// agentsFS is the sub-FS rooted at assets/agents/opencode/. If agentsFS is nil,
// ErrUnsupported is returned.
func (h OpenCodeHarness) WriteAgents(w fsutil.FileSystem, agentsFS fs.FS) ([]Change, error) {
	if agentsFS == nil {
		return nil, ErrUnsupported
	}
	agentsDir := h.ConfigPaths().AgentsDir // ~/.config/opencode/agent/
	return writeAgentsToDir(w, agentsFS, agentsDir, "opencode")
}
