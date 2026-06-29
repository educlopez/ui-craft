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
type GeminiHarness struct{}

// Compile-time check: GeminiHarness must satisfy Harness.
var _ Harness = GeminiHarness{}

func (h GeminiHarness) Name() string { return "gemini" }

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

// WriteSkill copies the embedded Gemini skills tree into ~/.gemini/skills/.
// The mirror FS is rooted at the skills level (assets.SkillsFS("gemini")),
// so walking it yields <id>/SKILL.md paths that land at depth-1:
// ~/.gemini/skills/<id>/SKILL.md. Full-file ownership; idempotent via byte-compare.
// Gotcha #7: if npm is global (no nvm/fnm/volta detected), an advisory is
// printed by the caller — WriteSkill itself does not print but sets
// Change.Changed so the caller can surface the advisory.
func (h GeminiHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (Change, error) {
	destDir := h.ConfigPaths().SkillsDir
	ch, err := writeMirrorToDir(w, mirror, destDir)
	if err != nil {
		return Change{}, fmt.Errorf("gemini: write skill mirror: %w", err)
	}
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
