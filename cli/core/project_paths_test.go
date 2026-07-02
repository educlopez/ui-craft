package core_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestProjectBackupRoot_isRootedAtProjectDotUiCraftBackups verifies the
// project-local backup dir convention from design #917's Q1 resolution:
// <projectRoot>/.ui-craft-backups/, self-contained (not shared with the
// global installer's ~/.ui-craft-backups/).
func TestProjectBackupRoot_isRootedAtProjectDotUiCraftBackups(t *testing.T) {
	projectRoot := t.TempDir()
	got := core.ProjectBackupRoot(projectRoot)
	want := filepath.Join(projectRoot, ".ui-craft-backups")
	if got != want {
		t.Errorf("ProjectBackupRoot(%q) = %q, want %q", projectRoot, got, want)
	}
}

// TestProjectStateRoot_isRootedAtProjectDotUiCraft verifies the project-local
// state dir convention: <projectRoot>/.ui-craft/ (state.json lives inside,
// via core.SaveState's existing <root>/state.json convention).
func TestProjectStateRoot_isRootedAtProjectDotUiCraft(t *testing.T) {
	projectRoot := t.TempDir()
	got := core.ProjectStateRoot(projectRoot)
	want := filepath.Join(projectRoot, ".ui-craft")
	if got != want {
		t.Errorf("ProjectStateRoot(%q) = %q, want %q", projectRoot, got, want)
	}
}

// TestNewProjectBackupStore_snapshotAndRestoreRoundTrip is a real-fs
// (t.TempDir()) integration test proving that a project-scoped backup.Store
// constructed via core.NewProjectBackupStore can snapshot AND restore a file
// that lives under the project root but OUTSIDE $HOME (or at least not
// necessarily inside it) — the key behavior this helper must provide beyond
// what backup.NewStore(root, fs, nil) already gives, since Store.Restore's
// built-in security check normally requires every OrigPath to resolve under
// os.UserHomeDir(). A project-scoped store must instead accept paths under
// projectRoot as its trust boundary.
func TestNewProjectBackupStore_snapshotAndRestoreRoundTrip(t *testing.T) {
	// Use a project dir that is deliberately NOT under $HOME (a plain
	// t.TempDir() is typically under the OS temp dir, e.g. /tmp or
	// /var/folders on macOS — neither is under a typical $HOME), to prove
	// the project store does not depend on $HOME at all.
	projectRoot := t.TempDir()
	fs := fsutil.OsFS{}

	store := core.NewProjectBackupStore(projectRoot, fs, fixedClock(time.Unix(1700000000, 0)))

	targetFile := filepath.Join(projectRoot, ".claude", "skills", "ui-craft", "SKILL.md")
	if err := fs.MkdirAll(filepath.Dir(targetFile), 0o755); err != nil {
		t.Fatal(err)
	}
	original := []byte("original content")
	if err := fs.WriteFile(targetFile, original, 0o644); err != nil {
		t.Fatal(err)
	}

	snapID, err := store.Snapshot([]backup.SnapshotTarget{
		{Harness: "claude", OrigPath: targetFile},
	}, "v1.0.0", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot failed: %v", err)
	}

	// Simulate the installer overwriting the file.
	if err := fs.WriteFile(targetFile, []byte("modified content"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := store.Restore(snapID); err != nil {
		t.Fatalf("Restore failed (project-scoped path should be a valid restore target): %v", err)
	}

	restored, err := fs.ReadFile(targetFile)
	if err != nil {
		t.Fatalf("read restored file: %v", err)
	}
	if string(restored) != string(original) {
		t.Errorf("restored content = %q, want %q", restored, original)
	}
}
