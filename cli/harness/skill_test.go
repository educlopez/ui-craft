package harness_test

import (
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
)

// fixtureMirror builds an in-memory fs.FS with a SKILL.md and a subdir file.
func fixtureMirror() fs.FS {
	return fstest.MapFS{
		"SKILL.md": &fstest.MapFile{
			Data: []byte("# ui-craft skill\n\nThis is the skill content.\n"),
		},
		"references/tokens.md": &fstest.MapFile{
			Data: []byte("# Design Tokens\n"),
		},
	}
}

// TestWriteSkill_idempotentWhenCurrent verifies that running WriteSkill twice
// with the same mirror returns Changed:false on the second call.
func TestWriteSkill_idempotentWhenCurrent(t *testing.T) {
	home := t.TempDir()
	mem := fsutil.NewMemFS()
	_ = mem.MkdirAll(home, 0o755)

	mirror := fixtureMirror()

	for _, tc := range []struct {
		name    string
		harness harness.Harness
		destDir func() string
	}{
		{
			name:    "claude",
			harness: harness.ClaudeHarness{},
		},
		{
			name:    "cursor",
			harness: harness.CursorHarness{},
		},
		{
			name:    "gemini",
			harness: harness.GeminiHarness{},
		},
		{
			name:    "opencode",
			harness: harness.OpenCodeHarness{},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// First write — should be Changed:true.
			ch1, err := tc.harness.WriteSkill(mem, mirror)
			if err != nil {
				t.Fatalf("first WriteSkill: %v", err)
			}
			if !ch1.Changed {
				t.Error("first WriteSkill: expected Changed:true (new files)")
			}

			// Second write — same mirror, should be Changed:false.
			ch2, err := tc.harness.WriteSkill(mem, mirror)
			if err != nil {
				t.Fatalf("second WriteSkill: %v", err)
			}
			if ch2.Changed {
				t.Error("second WriteSkill: expected Changed:false (idempotent)")
			}
		})
	}
}

// TestWriteSkill_updateReplacesFile verifies that writing a different mirror
// replaces the existing skill files and returns Changed:true.
func TestWriteSkill_updateReplacesFile(t *testing.T) {
	mem := fsutil.NewMemFS()

	mirror1 := fstest.MapFS{
		"SKILL.md": &fstest.MapFile{Data: []byte("version 1\n")},
	}
	mirror2 := fstest.MapFS{
		"SKILL.md": &fstest.MapFile{Data: []byte("version 2\n")},
	}

	h := harness.ClaudeHarness{}

	ch1, err := h.WriteSkill(mem, mirror1)
	if err != nil {
		t.Fatalf("first write: %v", err)
	}
	if !ch1.Changed {
		t.Error("expected Changed:true on first write")
	}

	ch2, err := h.WriteSkill(mem, mirror2)
	if err != nil {
		t.Fatalf("update write: %v", err)
	}
	if !ch2.Changed {
		t.Error("expected Changed:true when mirror content changes")
	}
}

// TestWriteSkill_codexManagedBlock verifies that Codex's WriteSkill:
//  1. Copies the mirror files into the skills dir.
//  2. Injects a managed block into AGENTS.md.
//  3. Is idempotent (second run = Changed:false).
//  4. Preserves user content outside the managed block.
func TestWriteSkill_codexManagedBlock(t *testing.T) {
	h := harness.CodexHarness{}
	mem := fsutil.NewMemFS()

	// Derive the AGENTS.md path the harness will use:
	// ConfigPaths().SkillsDir is ~/.codex/skills; parent is ~/.codex.
	skillsDir := h.ConfigPaths().SkillsDir
	codexRoot := filepath.Dir(skillsDir) // ~/.codex
	agentsMD := filepath.Join(codexRoot, "AGENTS.md")

	// Pre-populate AGENTS.md with user content.
	_ = mem.MkdirAll(codexRoot, 0o755)
	userContent := "# My Project\n\nThis is user-owned content.\n"
	_ = mem.WriteFile(agentsMD, []byte(userContent), 0o644)

	mirror := fixtureMirror()

	ch1, err := h.WriteSkill(mem, mirror)
	if err != nil {
		t.Fatalf("first WriteSkill: %v", err)
	}
	if !ch1.Changed {
		t.Error("expected Changed:true on first write")
	}

	// Verify the managed block is in AGENTS.md.
	content, readErr := mem.ReadFile(agentsMD)
	if readErr != nil {
		t.Fatalf("read AGENTS.md: %v", readErr)
	}
	got := string(content)
	if !strings.Contains(got, filemerge.BeginMarker) {
		t.Errorf("AGENTS.md missing BEGIN marker; content:\n%s", got)
	}
	if !strings.Contains(got, filemerge.EndMarker) {
		t.Errorf("AGENTS.md missing END marker; content:\n%s", got)
	}
	// User content must be preserved outside the block.
	if !strings.Contains(got, "This is user-owned content.") {
		t.Errorf("AGENTS.md lost user content; content:\n%s", got)
	}

	// Second run must be idempotent.
	ch2, err2 := h.WriteSkill(mem, mirror)
	if err2 != nil {
		t.Fatalf("second WriteSkill: %v", err2)
	}
	if ch2.Changed {
		t.Error("second WriteSkill: expected Changed:false (idempotent)")
	}

	// Content must be unchanged after second run.
	content2, _ := mem.ReadFile(agentsMD)
	if string(content2) != got {
		t.Errorf("AGENTS.md changed on second run (not idempotent)\nbefore:\n%s\nafter:\n%s", got, string(content2))
	}
}

// TestWriteSkill_codexOrphanMarkerRepair verifies that orphan BEGIN markers in
// AGENTS.md are repaired before injection (gotcha #3). This test exercises the
// CodexHarness.WriteSkill adapter directly rather than filemerge internals, so
// that the full adapter path (including writeMirrorToDir + UpsertManagedBlock)
// is covered.
func TestWriteSkill_codexOrphanMarkerRepair(t *testing.T) {
	h := harness.CodexHarness{}
	mem := fsutil.NewMemFS()

	skillsDir := h.ConfigPaths().SkillsDir
	codexRoot := filepath.Dir(skillsDir)
	agentsMD := filepath.Join(codexRoot, "AGENTS.md")

	// Seed AGENTS.md with an orphan BEGIN marker (no matching END).
	orphaned := "# Project\n" + filemerge.BeginMarker + "\nOrphan content without end marker.\n"
	_ = mem.MkdirAll(codexRoot, 0o755)
	_ = mem.WriteFile(agentsMD, []byte(orphaned), 0o644)

	mirror := fixtureMirror()
	_, err := h.WriteSkill(mem, mirror)
	if err != nil {
		t.Fatalf("WriteSkill on orphaned AGENTS.md: %v", err)
	}

	content, readErr := mem.ReadFile(agentsMD)
	if readErr != nil {
		t.Fatalf("read AGENTS.md after WriteSkill: %v", readErr)
	}
	got := string(content)

	if strings.Contains(got, filemerge.BeginMarker+"\n"+filemerge.BeginMarker) {
		t.Error("double BEGIN marker after orphan repair — repair failed")
	}
	if !strings.Contains(got, filemerge.BeginMarker) {
		t.Error("managed block missing after insert into orphaned content")
	}
	if !strings.Contains(got, filemerge.EndMarker) {
		t.Error("END marker missing after insert into orphaned content")
	}
}

// TestWriteSkill_copiesAllMirrorFiles verifies that every file in the mirror
// (except .gitkeep) is written into the destination directory.
func TestWriteSkill_copiesAllMirrorFiles(t *testing.T) {
	mem := fsutil.NewMemFS()
	mirror := fstest.MapFS{
		"SKILL.md":             &fstest.MapFile{Data: []byte("skill")},
		"references/tokens.md": &fstest.MapFile{Data: []byte("tokens")},
		".gitkeep":             &fstest.MapFile{Data: []byte("")},
	}

	h := harness.ClaudeHarness{}
	_, err := h.WriteSkill(mem, mirror)
	if err != nil {
		t.Fatalf("WriteSkill: %v", err)
	}

	skillsDir := filepath.Join(h.ConfigPaths().SkillsDir, "ui-craft")

	// SKILL.md and references/tokens.md should exist.
	for _, rel := range []string{"SKILL.md", "references/tokens.md"} {
		p := filepath.Join(skillsDir, rel)
		if _, err := mem.Stat(p); err != nil {
			t.Errorf("expected %s to exist after WriteSkill: %v", p, err)
		}
	}

	// .gitkeep should NOT be written.
	gitkeep := filepath.Join(skillsDir, ".gitkeep")
	if _, err := mem.Stat(gitkeep); err == nil {
		t.Errorf(".gitkeep should not be written to skills dir")
	}
}

// TestHarnessInterface_writeSkillSignature verifies that all 5 adapters
// satisfy the updated Harness interface including the mirror parameter.
func TestHarnessInterface_writeSkillSignature(t *testing.T) {
	harnesses := []harness.Harness{
		harness.ClaudeHarness{},
		harness.CursorHarness{},
		harness.CodexHarness{},
		harness.GeminiHarness{},
		harness.OpenCodeHarness{},
	}
	mirror := fixtureMirror()
	mem := fsutil.NewMemFS()

	for _, h := range harnesses {
		t.Run(h.Name(), func(t *testing.T) {
			// Must compile and not panic — actual behavior tested in specific tests.
			if _, err := h.WriteSkill(mem, mirror); err != nil {
				// Errors from WriteSkill (e.g. mkdir) are expected in some
				// edge cases; what we check is the interface is satisfied.
				t.Logf("WriteSkill(%s): %v (ok — interface satisfied)", h.Name(), err)
			}
		})
	}
}

// TestWriteSkill_supportsMatrix verifies all harnesses report SkillCommands supported.
func TestWriteSkill_supportsMatrix(t *testing.T) {
	harnesses := []harness.Harness{
		harness.ClaudeHarness{},
		harness.CursorHarness{},
		harness.CodexHarness{},
		harness.GeminiHarness{},
		harness.OpenCodeHarness{},
	}
	for _, h := range harnesses {
		if !h.Supports(component.SkillCommands) {
			t.Errorf("harness %s: Supports(SkillCommands) = false; all harnesses must support skill+commands", h.Name())
		}
	}
}

// TestWriteSkill_siblingSkillSurvives verifies that running WriteSkill for any
// full-file harness does NOT delete or modify a pre-existing sibling skill
// (e.g. …/skills/other-skill/) that lives next to the …/skills/ui-craft/ subdir.
// This is the critical isolation guarantee: the CLI only ever owns its own subdir.
func TestWriteSkill_siblingSkillSurvives(t *testing.T) {
	fullFileHarnesses := []harness.Harness{
		harness.ClaudeHarness{},
		harness.CursorHarness{},
		harness.GeminiHarness{},
		harness.OpenCodeHarness{},
	}

	mirror := fixtureMirror()

	for _, h := range fullFileHarnesses {
		t.Run(h.Name(), func(t *testing.T) {
			mem := fsutil.NewMemFS()

			// Plant a sibling skill that must survive.
			skillsDir := h.ConfigPaths().SkillsDir
			siblingFile := filepath.Join(skillsDir, "other-skill", "SKILL.md")
			siblingContent := []byte("# other-skill — must not be touched\n")
			_ = mem.MkdirAll(filepath.Dir(siblingFile), 0o755)
			_ = mem.WriteFile(siblingFile, siblingContent, 0o644)

			// Run WriteSkill.
			if _, err := h.WriteSkill(mem, mirror); err != nil {
				t.Fatalf("WriteSkill: %v", err)
			}

			// Sibling skill must still exist and be unchanged.
			got, err := mem.ReadFile(siblingFile)
			if err != nil {
				t.Fatalf("sibling skill file missing after WriteSkill: %v", err)
			}
			if string(got) != string(siblingContent) {
				t.Errorf("sibling skill file content changed:\nwant: %q\ngot:  %q", siblingContent, got)
			}
		})
	}
}

// TestWriteSkill_staleFilesRemovedOnUpdate verifies that a file present in a
// previous install but absent from the new mirror is removed during an update.
// This guards against stale files persisting across mirror version upgrades.
func TestWriteSkill_staleFilesRemovedOnUpdate(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := harness.ClaudeHarness{}

	mirror1 := fstest.MapFS{
		"SKILL.md": &fstest.MapFile{Data: []byte("v1\n")},
		"old.md":   &fstest.MapFile{Data: []byte("old file\n")},
	}
	mirror2 := fstest.MapFS{
		"SKILL.md": &fstest.MapFile{Data: []byte("v2\n")},
		// old.md deliberately removed from v2 mirror
	}

	if _, err := h.WriteSkill(mem, mirror1); err != nil {
		t.Fatalf("first WriteSkill: %v", err)
	}

	skillsDir := filepath.Join(h.ConfigPaths().SkillsDir, "ui-craft")
	oldFile := filepath.Join(skillsDir, "old.md")

	// Verify old.md exists after first install.
	if _, err := mem.Stat(oldFile); err != nil {
		t.Fatalf("old.md should exist after first install: %v", err)
	}

	// Update with new mirror that no longer contains old.md.
	ch, err := h.WriteSkill(mem, mirror2)
	if err != nil {
		t.Fatalf("second WriteSkill (update): %v", err)
	}
	if !ch.Changed {
		t.Error("expected Changed:true because mirror content changed")
	}

	// old.md must have been removed.
	if _, err := mem.Stat(oldFile); err == nil {
		t.Error("old.md should have been removed after update with new mirror that lacks it")
	}

	// SKILL.md must be present with new content.
	skillMD := filepath.Join(skillsDir, "SKILL.md")
	data, err := mem.ReadFile(skillMD)
	if err != nil {
		t.Fatalf("SKILL.md missing after update: %v", err)
	}
	if string(data) != "v2\n" {
		t.Errorf("SKILL.md content = %q; want %q", data, "v2\n")
	}
}
