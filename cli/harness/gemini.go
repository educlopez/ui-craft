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

// GeminiHarness is the adapter for Google Gemini CLI.
//
// Detection: "gemini" on PATH.
// MCP config: ~/.gemini/settings.json (JSON / MergeIntoSettings strategy).
// Skills dir: ~/.gemini/skills/
// Agents dir: (none — Gemini CLI has no native sub-agent format).
// Supports:   SkillCommands, MCPGates, DesignMemory = true; ReviewAgents = false.
type GeminiHarness struct {
	// projectRoot is set via WithProjectRoot so ConfigPaths() resolves to
	// project-scoped paths. Empty (zero value) means global scope.
	projectRoot string
}

// Compile-time check: GeminiHarness must satisfy Harness.
var _ Harness = GeminiHarness{}

func (h GeminiHarness) Name() string { return "gemini" }

// WithProjectRoot returns a copy of GeminiHarness scoped to projectRoot. See
// Harness.WithProjectRoot for why this exists.
func (h GeminiHarness) WithProjectRoot(projectRoot string) Harness {
	h.projectRoot = projectRoot
	return h
}

// ConfigRoot returns the Gemini config root (~/.gemini). Satisfies the Harness interface.
func (h GeminiHarness) ConfigRoot() string { return h.configRoot() }

func (h GeminiHarness) configRoot() string {
	home, _ := os.UserHomeDir()
	if home == "" {
		return ""
	}
	return filepath.Join(home, ".gemini")
}

// Detect checks for the "gemini" binary on PATH OR the ~/.gemini config dir.
// npm-global binaries aren't always on PATH, so a config-dir fallback is
// provided: if either signal is present the harness is considered installed.
// An empty home dir yields not-installed rather than a relative path.
func (h GeminiHarness) Detect() (DetectResult, error) {
	root := h.configRoot()
	if root == "" {
		return DetectResult{Installed: false}, nil
	}

	// Primary: check binary on PATH.
	if bin, err := lookPath("gemini"); err == nil {
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

// ConfigPaths returns Gemini CLI's paths for this harness's scope: global
// (home-derived) by default, or project-scoped when constructed via
// WithProjectRoot. Equivalent to ConfigPathsFor(h.projectRoot).
func (h GeminiHarness) ConfigPaths() ConfigPaths {
	return h.ConfigPathsFor(h.projectRoot)
}

// ConfigPathsFor returns Gemini CLI's paths, scoped to projectRoot when
// non-empty. Project-local targets: <projectRoot>/GEMINI.md (managed block,
// written by WriteSkill via filemerge.UpsertManagedBlock — mirrors Codex's
// AGENTS.md pattern) and <projectRoot>/.gemini/settings.json for MCP.
// SkillsDir resolves to <projectRoot>/.gemini since Gemini's project-local
// skills-equivalent surface is the project .gemini/ directory itself.
func (h GeminiHarness) ConfigPathsFor(projectRoot string) ConfigPaths {
	if projectRoot != "" {
		return ConfigPaths{
			MCPConfig:    filepath.Join(projectRoot, ".gemini", "settings.json"),
			SkillsDir:    filepath.Join(projectRoot, ".gemini"),
			AgentsDir:    "", // Gemini CLI has no sub-agent directory.
			AgentsMDPath: filepath.Join(projectRoot, "GEMINI.md"),
			ProjectRoot:  projectRoot,
		}
	}
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

// WriteMCP implements the MergeIntoSettings strategy for Gemini CLI.
//
// It deep-merges the ui-craft server entry into ~/.gemini/settings.json under
// mcpServers.<server.Name>. All other keys in the file are preserved.
// If the file does not exist it is created. Atomic + idempotent.
func (h GeminiHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	paths := h.ConfigPaths()
	target := paths.MCPConfig // ~/.gemini/settings.json

	existing, readErr := w.ReadFile(target)
	existed := readErr == nil
	if !existed {
		existing = []byte("{}")
	}

	overlay := map[string]any{
		"mcpServers": map[string]any{
			server.Name: map[string]any{
				"__replace__": map[string]any{
					"command": server.Command,
					"args":    server.Args,
				},
			},
		},
	}
	overlayJSON, err := json.Marshal(overlay)
	if err != nil {
		return Change{}, fmt.Errorf("gemini: marshal MCP overlay: %w", err)
	}

	mr, err := filemerge.MergeJSONObjectsEx(existing, overlayJSON)
	if err != nil {
		return Change{}, fmt.Errorf("gemini: merge settings.json: %w", err)
	}

	prior := existing
	if !existed {
		prior = nil
	}

	wr, err := fsutil.WriteFileAtomic(w, target, mr.Data, 0o644)
	if err != nil {
		return Change{}, fmt.Errorf("gemini: write settings.json %s: %w", target, err)
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

// WriteSkill writes two targets for Gemini when scoped to a project (mirrors
// Codex's AGENTS.md pattern exactly):
//
//  1. Full-file mirror copy into the skills dir (global: ~/.gemini/skills/;
//     project: <projectRoot>/.gemini/ — depth-1: <id>/SKILL.md peers). The
//     mirror FS is rooted at the skills level (assets.SkillsFS("gemini")), so
//     walking it writes SkillsDir/<id>/SKILL.md directly.
//  2. When ConfigPaths().AgentsMDPath is non-empty (project scope), a managed
//     block is injected into <projectRoot>/GEMINI.md via
//     filemerge.UpsertManagedBlock, which repairs orphan markers before
//     injecting (gotcha #3) and preserves any user-authored content around
//     the block. This is the write-logic half of design's Q2 resolution:
//     Gemini's own loader concatenates the project GEMINI.md with the global
//     ~/.gemini/GEMINI.md at runtime, so ui-craft only ever needs to manage
//     its own block in the project-local file — never a physical merge.
//
// In global scope (AgentsMDPath == ""), Gemini has no managed-block target
// (no global GEMINI.md convention in this design) — only the skills mirror
// is written, byte-for-byte identical to pre-project-scope behavior.
func (h GeminiHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (Change, error) {
	paths := h.ConfigPaths()

	// --- Target 1: full-file mirror copy into skills dir (depth-1) ---
	destDir := paths.SkillsDir
	ch, err := writeMirrorToDir(w, mirror, destDir)
	if err != nil {
		return Change{}, fmt.Errorf("gemini: write skill mirror: %w", err)
	}

	// --- Target 2 (project scope only): GEMINI.md managed-block inject ---
	if paths.AgentsMDPath == "" {
		return ch, nil
	}
	geminiMD := paths.AgentsMDPath
	existing, readErr := w.ReadFile(geminiMD)
	existedBefore := readErr == nil
	if !existedBefore {
		existing = []byte("")
	}

	uicraftSkillDir := filepath.Join(destDir, "ui-craft")
	blockContent := "# ui-craft skill\n\n" +
		"The ui-craft skill is installed at: " + uicraftSkillDir + "\n\n" +
		"Load it at the start of any UI design or implementation task."
	updated := filemerge.UpsertManagedBlock(string(existing), blockContent)

	geminiWR, err := fsutil.WriteFileAtomic(w, geminiMD, []byte(updated), 0o644)
	if err != nil {
		return Change{}, fmt.Errorf("gemini: write GEMINI.md managed block: %w", err)
	}

	if geminiWR.Changed {
		ch.Changed = true
	}
	ch.ExistedBefore = existedBefore

	return ch, nil
}

// WriteAgents returns ErrUnsupported. Gemini CLI has no native sub-agent format;
// core.Plan maps this to a graceful skip notice (exit code 0). Supports(ReviewAgents)
// returns false, so this method is not called in normal install flows — it is
// present only to satisfy the Harness interface.
func (h GeminiHarness) WriteAgents(_ fsutil.FileSystem, _ fs.FS) ([]Change, error) {
	return nil, ErrUnsupported
}

// WriteCommands returns ErrUnsupported. Gemini CLI has no native slash-command
// directory; commands are installed as peer skills via WriteSkill instead.
func (h GeminiHarness) WriteCommands(_ fsutil.FileSystem, _ fs.FS) ([]Change, error) {
	return nil, ErrUnsupported
}
