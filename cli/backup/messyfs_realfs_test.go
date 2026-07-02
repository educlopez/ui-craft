package backup_test

// messyfs_realfs_test.go — real-filesystem "messy machine" scenarios for the
// pre-install backup snapshot, distinct from symlink_test.go's directory-
// symlink coverage (v1.0.3 fix, valid target). This file covers a DANGLING
// symlink: one whose target does not exist on disk at all.

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestSnapshot_skipsDanglingSymlink verifies that a dangling symlink (target
// does not exist) inside the shared skills dir is skipped by the pre-install
// backup snapshot walk, without panicking or propagating an ENOENT/stat
// failure on the broken target. This is distinct from
// TestSnapshot_skipsDirectorySymlink (symlink_test.go), which covers a
// symlink pointing at a real, existing directory.
func TestSnapshot_skipsDanglingSymlink(t *testing.T) {
	home := t.TempDir()
	skillsDir := filepath.Join(home, ".claude", "skills")

	// A real ui-craft-owned skill dir with a file (must be captured).
	if err := os.MkdirAll(filepath.Join(skillsDir, "ui-craft"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillsDir, "ui-craft", "SKILL.md"), []byte("real"), 0o644); err != nil {
		t.Fatal(err)
	}

	// A dangling symlink: target does not exist anywhere on disk.
	missingTarget := filepath.Join(home, "does-not-exist-anywhere")
	brokenLink := filepath.Join(skillsDir, "broken-link")
	if err := os.Symlink(missingTarget, brokenLink); err != nil {
		t.Skipf("symlinks unsupported on this platform: %v", err)
	}

	store := backup.NewStore(filepath.Join(home, ".ui-craft-backups"), fsutil.OsFS{}, fixedClock(time.Unix(1700000001, 0)))
	targets := []backup.SnapshotTarget{{Harness: "claude", OrigPath: skillsDir}}

	id, err := store.Snapshot(targets, "v1.0.4", backup.SourceInstall)
	if err != nil {
		t.Fatalf("snapshot must not fail on a dangling symlink in the skills dir: %v", err)
	}
	if id == "" {
		t.Error("expected a non-empty snapshot ID even with a dangling symlink present")
	}
}
