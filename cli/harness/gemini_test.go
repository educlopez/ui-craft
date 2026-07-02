package harness

import (
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
)

// TestGeminiWriteSkill_globalScope_noManagedBlock verifies that WriteSkill's
// global-scope behavior (no WithProjectRoot applied) is unchanged by the new
// project managed-block logic: only the skills mirror is written, no
// GEMINI.md file is touched.
func TestGeminiWriteSkill_globalScope_noManagedBlock(t *testing.T) {
	m := fsutil.NewMemFS()
	mirror := fstest.MapFS{
		"ui-craft/SKILL.md": &fstest.MapFile{Data: []byte("# ui-craft skill")},
	}

	h := GeminiHarness{}
	ch, err := h.WriteSkill(m, mirror)
	if err != nil {
		t.Fatalf("WriteSkill returned error: %v", err)
	}
	if !ch.Changed {
		t.Errorf("expected Changed=true on first write")
	}

	// GEMINI.md must not exist anywhere — global scope has no managed-block target.
	if _, statErr := m.Stat("GEMINI.md"); statErr == nil {
		t.Errorf("global-scope WriteSkill must not create a GEMINI.md file")
	}
}

// TestGeminiWriteSkill_projectScope_writesManagedBlock verifies that when the
// harness is scoped to a project via WithProjectRoot (mirroring what
// core.Plan does for Project InstallScope), WriteSkill also writes a managed
// block into <projectRoot>/GEMINI.md, using filemerge.UpsertManagedBlock —
// the same pattern Codex's AGENTS.md write already uses.
func TestGeminiWriteSkill_projectScope_writesManagedBlock(t *testing.T) {
	m := fsutil.NewMemFS()
	mirror := fstest.MapFS{
		"ui-craft/SKILL.md": &fstest.MapFile{Data: []byte("# ui-craft skill")},
	}

	projectRoot := filepath.FromSlash("/tmp/my-gemini-project")
	h := GeminiHarness{}.WithProjectRoot(projectRoot)

	ch, err := h.WriteSkill(m, mirror)
	if err != nil {
		t.Fatalf("WriteSkill returned error: %v", err)
	}
	if !ch.Changed {
		t.Errorf("expected Changed=true on first write")
	}

	geminiMD := filepath.Join(projectRoot, "GEMINI.md")
	content, err := m.ReadFile(geminiMD)
	if err != nil {
		t.Fatalf("expected %s to be written, got error: %v", geminiMD, err)
	}
	if !strings.Contains(string(content), filemerge.BeginMarker) || !strings.Contains(string(content), filemerge.EndMarker) {
		t.Errorf("GEMINI.md content missing managed-block markers: %s", content)
	}

	// Idempotency: writing again must not duplicate the managed block.
	ch2, err := h.WriteSkill(m, mirror)
	if err != nil {
		t.Fatalf("second WriteSkill returned error: %v", err)
	}
	if ch2.Changed {
		t.Errorf("second WriteSkill should be a no-op (Changed=false) for identical content")
	}
	content2, _ := m.ReadFile(geminiMD)
	if strings.Count(string(content2), filemerge.BeginMarker) != 1 {
		t.Errorf("expected exactly 1 BeginMarker after second write, got content: %s", content2)
	}
}

// TestGeminiWriteSkill_projectScope_preservesUserContent verifies that
// pre-existing user content in a project GEMINI.md is preserved around the
// managed block (filemerge semantics), matching Codex's AGENTS.md behavior.
func TestGeminiWriteSkill_projectScope_preservesUserContent(t *testing.T) {
	m := fsutil.NewMemFS()
	mirror := fstest.MapFS{
		"ui-craft/SKILL.md": &fstest.MapFile{Data: []byte("# ui-craft skill")},
	}

	projectRoot := filepath.FromSlash("/tmp/my-gemini-project-2")
	geminiMD := filepath.Join(projectRoot, "GEMINI.md")
	userContent := "# My Project Rules\n\nAlways use tabs.\n"
	if err := m.MkdirAll(projectRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := m.WriteFile(geminiMD, []byte(userContent), 0o644); err != nil {
		t.Fatal(err)
	}

	h := GeminiHarness{}.WithProjectRoot(projectRoot)
	if _, err := h.WriteSkill(m, mirror); err != nil {
		t.Fatalf("WriteSkill returned error: %v", err)
	}

	content, err := m.ReadFile(geminiMD)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "Always use tabs.") {
		t.Errorf("user content lost from GEMINI.md: %s", content)
	}
	if !strings.Contains(string(content), filemerge.BeginMarker) {
		t.Errorf("managed block missing from GEMINI.md: %s", content)
	}
}

// TestGeminiWithProjectRoot_configPathsMatchesConfigPathsFor verifies that
// WithProjectRoot(root).ConfigPaths() is byte-identical to
// GeminiHarness{}.ConfigPathsFor(root) — the two entry points into
// project-scoped path resolution must agree.
func TestGeminiWithProjectRoot_configPathsMatchesConfigPathsFor(t *testing.T) {
	projectRoot := filepath.FromSlash("/tmp/gemini-parity-check")
	viaWith := GeminiHarness{}.WithProjectRoot(projectRoot).ConfigPaths()
	viaDirect := GeminiHarness{}.ConfigPathsFor(projectRoot)
	if viaWith != viaDirect {
		t.Errorf("WithProjectRoot(%q).ConfigPaths() = %+v, want %+v", projectRoot, viaWith, viaDirect)
	}
}
