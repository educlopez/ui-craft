package harness

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
)

// CodexHarness is the adapter for OpenAI Codex CLI.
//
// Detection: "codex" on PATH.
// MCP config: ~/.codex/config.toml (global) or <projectRoot>/.codex/config.toml
// (project-scoped, full parity with the other harnesses — see ConfigPathsFor).
// Skills dir: ~/.codex/skills/ (plus managed block in project AGENTS.md — Slice 5).
// Agents dir: (none — Codex has no native sub-agent format).
// Supports:   SkillCommands, MCPGates, DesignMemory = true; ReviewAgents = false.
type CodexHarness struct {
	// projectRoot is set via WithProjectRoot so ConfigPaths() resolves to
	// project-scoped paths. Empty (zero value) means global scope.
	projectRoot string
}

// Compile-time check: CodexHarness must satisfy Harness.
var _ Harness = CodexHarness{}

func (h CodexHarness) Name() string { return "codex" }

// WithProjectRoot returns a copy of CodexHarness scoped to projectRoot. See
// Harness.WithProjectRoot for why this exists.
func (h CodexHarness) WithProjectRoot(projectRoot string) Harness {
	h.projectRoot = projectRoot
	return h
}

// ConfigRoot returns the Codex config root (~/.codex). Satisfies the Harness interface.
func (h CodexHarness) ConfigRoot() string { return h.configRoot() }

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

// ConfigPaths returns Codex's paths for this harness's scope: global
// (home-derived) by default, or project-scoped when constructed via
// WithProjectRoot. Equivalent to ConfigPathsFor(h.projectRoot).
func (h CodexHarness) ConfigPaths() ConfigPaths {
	return h.ConfigPathsFor(h.projectRoot)
}

// ConfigPathsFor returns Codex's paths, scoped to projectRoot when non-empty.
//
// Project-local targets: <projectRoot>/.codex/skills, <projectRoot>/AGENTS.md
// (managed block, via the existing agentsMDPath(projectRoot) branch), and
// <projectRoot>/.codex/config.toml for MCP.
//
// Codex MCP is FULL PARITY with the other 4 harnesses in project mode — it is
// NOT global-only. OpenAI's official Codex CLI docs
// (developers.openai.com/codex/mcp) confirm Codex supports project-scoped MCP
// via a .codex/config.toml at the project root, using the same TOML format as
// the global ~/.codex/config.toml, just resolved from a different root. Codex
// gates project-scoped configs behind its own "trusted projects only"
// approval mechanism — that is Codex's own UX and is not something this
// installer controls or needs to implement; it is documented here (and should
// be surfaced in the project-install flow's summary text) purely so users
// aren't surprised if Codex itself prompts for trust before honoring it.
func (h CodexHarness) ConfigPathsFor(projectRoot string) ConfigPaths {
	if projectRoot != "" {
		return ConfigPaths{
			MCPConfig:    filepath.Join(projectRoot, ".codex", "config.toml"),
			SkillsDir:    filepath.Join(projectRoot, ".codex", "skills"),
			AgentsDir:    "", // Codex has no sub-agent directory.
			AgentsMDPath: h.agentsMDPath(projectRoot),
			ProjectRoot:  projectRoot,
		}
	}
	root := h.configRoot()
	return ConfigPaths{
		MCPConfig:    filepath.Join(root, "config.toml"),
		SkillsDir:    filepath.Join(root, "skills"),
		AgentsDir:    "", // Codex has no sub-agent directory.
		AgentsMDPath: h.agentsMDPath(""),
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

// WriteMCP implements the TOMLFile strategy for Codex.
//
// It upserts a [mcp_servers.<server.Name>] block into ~/.codex/config.toml
// using pure line operations (no go-toml dependency). All other TOML keys and
// sections are preserved unchanged. Gotcha #4: Windows path strings are
// automatically backslash-escaped by UpsertTOMLTableKey.
func (h CodexHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	paths := h.ConfigPaths()
	target := paths.MCPConfig // ~/.codex/config.toml

	// Read existing content (may not exist yet).
	existing, readErr := w.ReadFile(target)
	existed := readErr == nil
	content := ""
	if existed {
		content = string(existing)
	}

	entry := map[string]any{
		"command": server.Command,
		"args":    server.Args,
	}
	updated, err := filemerge.UpsertTOMLTableKey(content, "mcp_servers", server.Name, entry)
	if err != nil {
		return Change{}, fmt.Errorf("codex: upsert TOML MCP block: %w", err)
	}

	prior := existing
	if !existed {
		prior = nil
	}

	wr, err := fsutil.WriteFileAtomic(w, target, []byte(updated), 0o644)
	if err != nil {
		return Change{}, fmt.Errorf("codex: write TOML config %s: %w", target, err)
	}

	return Change{
		FilePath:      target,
		PriorBytes:    prior,
		ExistedBefore: existed,
		Changed:       wr.Changed,
		Strategy:      TOMLFile,
	}, nil
}

// agentsMDPath returns the path to the AGENTS.md file that receives the managed
// block. When projectRoot is set we use the project-local AGENTS.md; otherwise
// we fall back to ~/.codex/AGENTS.md (global).
func (h CodexHarness) agentsMDPath(projectRoot string) string {
	if projectRoot != "" {
		return filepath.Join(projectRoot, "AGENTS.md")
	}
	root := h.configRoot()
	return filepath.Join(root, "AGENTS.md")
}

// WriteSkill writes two targets for Codex:
//
//  1. Full-file mirror copy into ~/.codex/skills/ (depth-1: <id>/SKILL.md peers).
//     The mirror FS is rooted at the skills level (assets.SkillsFS("codex")),
//     so walking it writes SkillsDir/<id>/SKILL.md directly.
//  2. A managed block injected into the project AGENTS.md (or global ~/.codex/AGENTS.md)
//     referencing the installed skills dir, so Codex picks it up without a marketplace.
//
// Note: project-local AGENTS.md (--dir / ProjectRoot) is honored when
// ConfigPaths().ProjectRoot is set; otherwise the global ~/.codex/AGENTS.md is used.
//
// The managed block uses section.go's UpsertManagedBlock, which repairs orphan
// markers before injecting (gotcha #3). The Change.FilePath reflects the
// skills directory (target 1) since it is the primary write target; the AGENTS.md
// write is performed as a side-effect, and its prior state is snapshotted by
// core.Apply via the SnapPaths list set in core/plan.go.
func (h CodexHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (Change, error) {
	paths := h.ConfigPaths()

	// --- Target 1: full-file mirror copy into skills dir (depth-1) ---
	destDir := paths.SkillsDir
	ch, err := writeMirrorToDir(w, mirror, destDir)
	if err != nil {
		return Change{}, fmt.Errorf("codex: write skill mirror: %w", err)
	}

	// --- Target 2: AGENTS.md managed-block inject ---
	// ProjectRoot is honored: project-local AGENTS.md when set, global otherwise.
	agentsMD := h.agentsMDPath(paths.ProjectRoot)
	existing, readErr := w.ReadFile(agentsMD)
	existedBefore := readErr == nil
	if !existedBefore {
		existing = []byte("")
	}

	uicraftSkillDir := filepath.Join(destDir, "ui-craft")
	blockContent := "# ui-craft skill\n\n" +
		"The ui-craft skill is installed at: " + uicraftSkillDir + "\n\n" +
		"Load it at the start of any UI design or implementation task."
	updated := filemerge.UpsertManagedBlock(string(existing), blockContent)

	agentsWR, err := fsutil.WriteFileAtomic(w, agentsMD, []byte(updated), 0o644)
	if err != nil {
		return Change{}, fmt.Errorf("codex: write AGENTS.md managed block: %w", err)
	}

	// Report Changed if either target changed.
	if agentsWR.Changed {
		ch.Changed = true
	}

	// Thread existedBefore into the primary Change so callers can distinguish
	// "first install" from "update" without re-reading the skills dir.
	ch.ExistedBefore = existedBefore

	return ch, nil
}

// WriteAgents returns ErrUnsupported. Codex has no native sub-agent format;
// core.Plan maps this to a graceful skip notice (exit code 0). Supports(ReviewAgents)
// returns false, so this method is not called in normal install flows — it is
// present only to satisfy the Harness interface.
func (h CodexHarness) WriteAgents(_ fsutil.FileSystem, _ fs.FS) ([]Change, error) {
	return nil, ErrUnsupported
}

// WriteCommands returns ErrUnsupported. Codex has no native slash-command
// directory; commands are installed as peer skills via WriteSkill instead.
func (h CodexHarness) WriteCommands(_ fsutil.FileSystem, _ fs.FS) ([]Change, error) {
	return nil, ErrUnsupported
}
