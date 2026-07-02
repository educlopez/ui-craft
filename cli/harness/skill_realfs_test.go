package harness_test

// skill_realfs_test.go — real-filesystem twins of the MemFS-backed skill
// layout tests in skill_test.go. These exercise fsutil.OsFS{} against a real
// t.TempDir() with HOME overridden, matching the integration-test style
// established by backup/symlink_test.go. They exist alongside (not instead
// of) the MemFS unit tests.

import (
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// TestWriteSkill_cleansStaleDepth2_realFS is the real-fs twin of
// TestWriteSkill_cleansStaleDepth2 (skill_test.go). It verifies that on a
// real disk, WriteSkill removes a pre-existing stale depth-2 layout
// (skills/ui-craft/ui-craft/) left by an old broken install and replaces it
// with the correct depth-1 layout.
func TestWriteSkill_cleansStaleDepth2_realFS(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	h := harness.ClaudeHarness{}
	skillsDir := h.ConfigPaths().SkillsDir

	// Pre-populate the stale depth-2 layout on real disk.
	staleFile := filepath.Join(skillsDir, "ui-craft", "ui-craft", "SKILL.md")
	if err := os.MkdirAll(filepath.Dir(staleFile), 0o755); err != nil {
		t.Fatalf("setup MkdirAll: %v", err)
	}
	if err := os.WriteFile(staleFile, []byte("# stale\n"), 0o644); err != nil {
		t.Fatalf("setup WriteFile: %v", err)
	}

	mirror := fstest.MapFS{
		"ui-craft/SKILL.md": &fstest.MapFile{Data: []byte("# ui-craft\n")},
	}

	if _, err := h.WriteSkill(fsutil.OsFS{}, mirror); err != nil {
		t.Fatalf("WriteSkill: %v", err)
	}

	// Stale depth-2 file must be gone on real disk.
	if _, err := os.Stat(staleFile); err == nil {
		t.Errorf("stale depth-2 path %s should have been removed by WriteSkill", staleFile)
	}

	// Correct depth-1 file must exist on real disk.
	depth1 := filepath.Join(skillsDir, "ui-craft", "SKILL.md")
	if _, err := os.Stat(depth1); err != nil {
		t.Errorf("depth-1 path %s missing after WriteSkill: %v", depth1, err)
	}
}

// TestWriteSkill_siblingSkillSurvives_realFS is the real-fs twin of
// TestWriteSkill_siblingSkillSurvives (skill_test.go). It exercises the
// name-collision scenario from the installer-hardening spec: a foreign,
// non-ui-craft directory already sitting inside the shared skills dir must
// survive untouched when ui-craft installs its own subdir alongside it.
//
// This encodes the SAME concrete behavior the MemFS test already asserts
// (coexist, no deletion) — real disk confirms it holds outside memory too.
func TestWriteSkill_siblingSkillSurvives_realFS(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	h := harness.ClaudeHarness{}
	skillsDir := h.ConfigPaths().SkillsDir

	// Plant a foreign, non-ui-craft directory with its own file — must survive.
	foreignFile := filepath.Join(skillsDir, "other-skill", "SKILL.md")
	foreignContent := []byte("# other-skill — must not be touched\n")
	if err := os.MkdirAll(filepath.Dir(foreignFile), 0o755); err != nil {
		t.Fatalf("setup MkdirAll: %v", err)
	}
	if err := os.WriteFile(foreignFile, foreignContent, 0o644); err != nil {
		t.Fatalf("setup WriteFile: %v", err)
	}

	mirror := fstest.MapFS{
		"ui-craft/SKILL.md": &fstest.MapFile{Data: []byte("# ui-craft\n")},
	}

	if _, err := h.WriteSkill(fsutil.OsFS{}, mirror); err != nil {
		t.Fatalf("WriteSkill: %v", err)
	}

	// Foreign directory content must survive untouched.
	got, err := os.ReadFile(foreignFile)
	if err != nil {
		t.Fatalf("foreign file missing after WriteSkill: %v", err)
	}
	if string(got) != string(foreignContent) {
		t.Errorf("foreign file content changed:\nwant: %q\ngot:  %q", foreignContent, got)
	}

	// ui-craft's own depth-1 file must be present alongside it.
	own := filepath.Join(skillsDir, "ui-craft", "SKILL.md")
	if _, err := os.Stat(own); err != nil {
		t.Errorf("ui-craft own path %s missing after WriteSkill: %v", own, err)
	}
}
