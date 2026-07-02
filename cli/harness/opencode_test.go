package harness

import (
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestOpenCodeWriteSkill_projectScope_noAGENTSMDWrite is the regression test
// for design's Q3 resolution (design #917): OpenCode's ui-craft integration
// is skills-dir + commands-dir + agent-dir + opencode.json based, and does
// NOT manage an AGENTS.md file at all — not in global scope, and not in
// project scope either. This confirms the "self-resolved" design finding
// holds in actual WriteSkill behavior, not just in ConfigPathsFor's path
// resolution (which already correctly leaves AgentsMDPath empty for
// OpenCode — this test proves WriteSkill's actual write side-effects agree).
func TestOpenCodeWriteSkill_projectScope_noAGENTSMDWrite(t *testing.T) {
	m := fsutil.NewMemFS()
	mirror := fstest.MapFS{
		"ui-craft/SKILL.md": &fstest.MapFile{Data: []byte("# ui-craft skill")},
	}

	projectRoot := filepath.FromSlash("/tmp/my-opencode-project")
	h := OpenCodeHarness{}.WithProjectRoot(projectRoot)

	ch, err := h.WriteSkill(m, mirror)
	if err != nil {
		t.Fatalf("WriteSkill returned error: %v", err)
	}
	if !ch.Changed {
		t.Errorf("expected Changed=true on first write")
	}

	// The skill mirror itself must land under the project-scoped .opencode/skill dir.
	wantSkillsDir := filepath.Join(projectRoot, ".opencode", "skill")
	if _, statErr := m.Stat(filepath.Join(wantSkillsDir, "ui-craft", "SKILL.md")); statErr != nil {
		t.Errorf("expected skill mirror at %s, stat error: %v", wantSkillsDir, statErr)
	}

	// AGENTS.md must NOT exist anywhere under the project root — OpenCode has
	// no managed-block rules file at all (unlike Codex/Gemini).
	agentsMD := filepath.Join(projectRoot, "AGENTS.md")
	if _, statErr := m.Stat(agentsMD); statErr == nil {
		t.Errorf("OpenCode project install must NOT write %s — OpenCode has no AGENTS.md managed-block mechanism (design Q3)", agentsMD)
	}

	// Also confirm ConfigPathsFor never advertises an AgentsMDPath for
	// OpenCode, in either scope — the write-side assertion above only holds
	// meaningfully if the path-resolution side agrees.
	paths := OpenCodeHarness{}.ConfigPathsFor(projectRoot)
	if paths.AgentsMDPath != "" {
		t.Errorf("OpenCode ConfigPathsFor(%q).AgentsMDPath = %q, want empty — OpenCode has no AGENTS.md convention", projectRoot, paths.AgentsMDPath)
	}
	globalPaths := OpenCodeHarness{}.ConfigPaths()
	if globalPaths.AgentsMDPath != "" {
		t.Errorf("OpenCode global ConfigPaths().AgentsMDPath = %q, want empty", globalPaths.AgentsMDPath)
	}
}

// TestOpenCodeWithProjectRoot_configPathsMatchesConfigPathsFor verifies that
// WithProjectRoot(root).ConfigPaths() is byte-identical to
// OpenCodeHarness{}.ConfigPathsFor(root), mirroring the same parity guard
// added for Gemini.
func TestOpenCodeWithProjectRoot_configPathsMatchesConfigPathsFor(t *testing.T) {
	projectRoot := filepath.FromSlash("/tmp/opencode-parity-check")
	viaWith := OpenCodeHarness{}.WithProjectRoot(projectRoot).ConfigPaths()
	viaDirect := OpenCodeHarness{}.ConfigPathsFor(projectRoot)
	if viaWith != viaDirect {
		t.Errorf("WithProjectRoot(%q).ConfigPaths() = %+v, want %+v", projectRoot, viaWith, viaDirect)
	}
}
