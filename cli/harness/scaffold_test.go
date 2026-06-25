package harness_test

import (
	"io/fs"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// fixtureTemplateFS builds an in-memory fs.FS that mimics the embedded
// templates directory used for design-memory scaffolding.
func fixtureTemplateFS() fs.FS {
	return fstest.MapFS{
		"brief.md": &fstest.MapFile{
			Data: []byte("# Project Brief\n\n## Design Intent\n\n## Audience\n"),
		},
		"tokens.md": &fstest.MapFile{
			Data: []byte("# Design Tokens\n\n## Colors\n\n## Typography\n\n## Spacing\n"),
		},
		"decisions.md": &fstest.MapFile{
			Data: []byte("# Design Decisions\n"),
		},
		"patterns.md": &fstest.MapFile{
			Data: []byte("# Patterns\n"),
		},
		"surfaces/example.md": &fstest.MapFile{
			Data: []byte("# {Surface Name}\n\n## Layout\n\n## Components\n\n## Notes\n"),
		},
	}
}

// TestScaffold_firstTime verifies that ScaffoldDesignMemory creates all template
// files when the project directory has no .ui-craft/ directory yet.
func TestScaffold_firstTime(t *testing.T) {
	t.Parallel()

	mem := fsutil.NewMemFS()
	projectDir := "/project"
	_ = mem.MkdirAll(projectDir, 0o755)

	tmplFS := fixtureTemplateFS()
	result, err := harness.ScaffoldDesignMemory(mem, tmplFS, projectDir)
	if err != nil {
		t.Fatalf("ScaffoldDesignMemory unexpected error: %v", err)
	}

	// All files should have been created (ExistedBefore=false, Changed=true).
	if len(result.Changes) == 0 {
		t.Fatal("expected Changes to be non-empty")
	}
	for _, ch := range result.Changes {
		if ch.ExistedBefore {
			t.Errorf("file %s: ExistedBefore=true on first-time scaffold", ch.FilePath)
		}
		if !ch.Changed {
			t.Errorf("file %s: Changed=false on first-time scaffold", ch.FilePath)
		}
	}

	// AllExisted should be false — at least one file was created.
	if result.AllExisted {
		t.Error("AllExisted should be false on first-time scaffold")
	}

	// Verify files actually exist in the MemFS.
	expectedFiles := []string{
		".ui-craft/brief.md",
		".ui-craft/tokens.md",
		".ui-craft/decisions.md",
		".ui-craft/patterns.md",
		".ui-craft/surfaces/example.md",
	}
	for _, rel := range expectedFiles {
		abs := filepath.Join(projectDir, rel)
		if _, err := mem.Stat(abs); err != nil {
			t.Errorf("expected file %s to exist after scaffold, got error: %v", abs, err)
		}
	}
}

// TestScaffold_partialExists verifies that ScaffoldDesignMemory skips files that
// already exist and only creates the missing ones.
func TestScaffold_partialExists(t *testing.T) {
	t.Parallel()

	mem := fsutil.NewMemFS()
	projectDir := "/project"
	_ = mem.MkdirAll(projectDir, 0o755)

	// Pre-populate brief.md with user content.
	uicraftDir := filepath.Join(projectDir, ".ui-craft")
	_ = mem.MkdirAll(uicraftDir, 0o755)
	userContent := []byte("# My custom brief — do not overwrite\n\nThis is user content.\n")
	if _, err := fsutil.WriteFileAtomic(mem, filepath.Join(uicraftDir, "brief.md"), userContent, 0o644); err != nil {
		t.Fatalf("setup: write pre-existing brief.md: %v", err)
	}

	tmplFS := fixtureTemplateFS()
	result, err := harness.ScaffoldDesignMemory(mem, tmplFS, projectDir)
	if err != nil {
		t.Fatalf("ScaffoldDesignMemory unexpected error: %v", err)
	}

	// Find brief.md in the results — it must be marked ExistedBefore=true and Changed=false.
	briefChange := findChange(result.Changes, filepath.Join(uicraftDir, "brief.md"))
	if briefChange == nil {
		t.Fatal("expected a Change record for brief.md")
	}
	if !briefChange.ExistedBefore {
		t.Error("brief.md: ExistedBefore should be true (it was pre-populated)")
	}
	if briefChange.Changed {
		t.Error("brief.md: Changed should be false (must not overwrite user content)")
	}

	// The pre-existing content must be untouched.
	got, err := mem.ReadFile(filepath.Join(uicraftDir, "brief.md"))
	if err != nil {
		t.Fatalf("read brief.md after scaffold: %v", err)
	}
	if string(got) != string(userContent) {
		t.Errorf("brief.md content was modified: got %q, want %q", got, userContent)
	}

	// Other files should have been created.
	if result.AllExisted {
		t.Error("AllExisted should be false because missing files were created")
	}
}

// TestScaffold_fullyExists verifies that ScaffoldDesignMemory reports AllExisted
// and makes no changes when all template files are already present.
func TestScaffold_fullyExists(t *testing.T) {
	t.Parallel()

	mem := fsutil.NewMemFS()
	projectDir := "/project"
	_ = mem.MkdirAll(projectDir, 0o755)

	// Pre-populate all template files.
	uicraftDir := filepath.Join(projectDir, ".ui-craft")
	_ = mem.MkdirAll(filepath.Join(uicraftDir, "surfaces"), 0o755)
	for _, name := range []string{"brief.md", "tokens.md", "decisions.md", "patterns.md", "surfaces/example.md"} {
		path := filepath.Join(uicraftDir, filepath.FromSlash(name))
		if _, err := fsutil.WriteFileAtomic(mem, path, []byte("# existing\n"), 0o644); err != nil {
			t.Fatalf("setup: write %s: %v", name, err)
		}
	}

	tmplFS := fixtureTemplateFS()
	result, err := harness.ScaffoldDesignMemory(mem, tmplFS, projectDir)
	if err != nil {
		t.Fatalf("ScaffoldDesignMemory unexpected error: %v", err)
	}

	if !result.AllExisted {
		t.Error("AllExisted should be true when all files already exist")
	}
	for _, ch := range result.Changes {
		if ch.Changed {
			t.Errorf("file %s: Changed=true but it already existed — no write expected", ch.FilePath)
		}
	}
}

// TestScaffold_doesNotOverwrite is the critical correctness test: a pre-existing
// brief.md with user content must survive a scaffold run byte-for-byte.
func TestScaffold_doesNotOverwrite(t *testing.T) {
	t.Parallel()

	mem := fsutil.NewMemFS()
	projectDir := "/project"
	_ = mem.MkdirAll(projectDir, 0o755)

	uicraftDir := filepath.Join(projectDir, ".ui-craft")
	_ = mem.MkdirAll(uicraftDir, 0o755)

	original := []byte("# Custom Brief\n\nI wrote this myself. Must not be overwritten.\n")
	if _, err := fsutil.WriteFileAtomic(mem, filepath.Join(uicraftDir, "brief.md"), original, 0o644); err != nil {
		t.Fatalf("setup: write brief.md: %v", err)
	}

	tmplFS := fixtureTemplateFS()
	if _, err := harness.ScaffoldDesignMemory(mem, tmplFS, projectDir); err != nil {
		t.Fatalf("ScaffoldDesignMemory unexpected error: %v", err)
	}

	got, err := mem.ReadFile(filepath.Join(uicraftDir, "brief.md"))
	if err != nil {
		t.Fatalf("read brief.md: %v", err)
	}
	if string(got) != string(original) {
		t.Errorf("brief.md overwritten: got %q, want %q", got, original)
	}
}

// TestScaffold_idempotent verifies that running ScaffoldDesignMemory twice is a
// no-op on the second call (all files present → AllExisted=true, Changed=false).
func TestScaffold_idempotent(t *testing.T) {
	t.Parallel()

	mem := fsutil.NewMemFS()
	projectDir := "/project"
	_ = mem.MkdirAll(projectDir, 0o755)

	tmplFS := fixtureTemplateFS()

	// First run — creates all files.
	if _, err := harness.ScaffoldDesignMemory(mem, tmplFS, projectDir); err != nil {
		t.Fatalf("first ScaffoldDesignMemory: %v", err)
	}

	// Second run — should be a complete no-op.
	result2, err := harness.ScaffoldDesignMemory(mem, tmplFS, projectDir)
	if err != nil {
		t.Fatalf("second ScaffoldDesignMemory: %v", err)
	}
	if !result2.AllExisted {
		t.Error("AllExisted should be true on second run (idempotent)")
	}
	for _, ch := range result2.Changes {
		if ch.Changed {
			t.Errorf("file %s: Changed=true on second run — scaffold is not idempotent", ch.FilePath)
		}
	}
}

// TestScaffold_rollbackCreatedOnly verifies the rollback invariant: files that
// already existed before the scaffold must NOT be deleted when a rollback
// removes only scaffold-created files.
//
// This test simulates what the backup/restore layer does: it checks that
// ExistedBefore=false records are the only ones eligible for deletion.
func TestScaffold_rollbackCreatedOnly(t *testing.T) {
	t.Parallel()

	mem := fsutil.NewMemFS()
	projectDir := "/project"
	_ = mem.MkdirAll(projectDir, 0o755)

	uicraftDir := filepath.Join(projectDir, ".ui-craft")
	_ = mem.MkdirAll(uicraftDir, 0o755)

	// Pre-existing brief.md — must survive the simulated rollback.
	preExistingContent := []byte("# Pre-existing brief\n")
	briefPath := filepath.Join(uicraftDir, "brief.md")
	if _, err := fsutil.WriteFileAtomic(mem, briefPath, preExistingContent, 0o644); err != nil {
		t.Fatalf("setup: write brief.md: %v", err)
	}

	tmplFS := fixtureTemplateFS()
	result, err := harness.ScaffoldDesignMemory(mem, tmplFS, projectDir)
	if err != nil {
		t.Fatalf("ScaffoldDesignMemory: %v", err)
	}

	// Simulate rollback: delete only files with ExistedBefore=false.
	for _, ch := range result.Changes {
		if !ch.ExistedBefore {
			if err := mem.Remove(ch.FilePath); err != nil {
				t.Errorf("rollback: remove %s: %v", ch.FilePath, err)
			}
		}
	}

	// brief.md must still exist with its original content.
	got, err := mem.ReadFile(briefPath)
	if err != nil {
		t.Fatalf("read brief.md after simulated rollback: %v", err)
	}
	if string(got) != string(preExistingContent) {
		t.Errorf("brief.md content wrong after rollback: got %q, want %q", got, preExistingContent)
	}
}

// findChange returns the Change for the given absolute file path, or nil if not found.
func findChange(changes []harness.Change, path string) *harness.Change {
	for i := range changes {
		if changes[i].FilePath == path {
			return &changes[i]
		}
	}
	return nil
}
