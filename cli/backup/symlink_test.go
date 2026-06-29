package backup_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestSnapshot_skipsDirectorySymlink reproduces the v1.0.2 install crash:
// a user's unrelated skill installed as a directory symlink inside the shared
// skills dir (e.g. ~/.claude/skills/agent-browser -> /elsewhere) made the
// pre-install snapshot fail with "read ...: is a directory" (EISDIR), because
// os.DirEntry.IsDir() reports false for a symlink and the walk then ReadFile'd
// it, following the link into a directory. The snapshot must skip directory
// symlinks (gentle-ai parity) and still capture real files.
func TestSnapshot_skipsDirectorySymlink(t *testing.T) {
	home := t.TempDir()
	skillsDir := filepath.Join(home, ".claude", "skills")

	// A real ui-craft-owned skill dir with a file (must be captured).
	if err := os.MkdirAll(filepath.Join(skillsDir, "ui-craft"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillsDir, "ui-craft", "SKILL.md"), []byte("real"), 0o644); err != nil {
		t.Fatal(err)
	}

	// A user's external skill symlinked into skills/ as a DIRECTORY symlink.
	external := t.TempDir()
	if err := os.WriteFile(filepath.Join(external, "SKILL.md"), []byte("external"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(external, filepath.Join(skillsDir, "agent-browser")); err != nil {
		t.Skipf("symlinks unsupported on this platform: %v", err)
	}

	store := backup.NewStore(filepath.Join(home, ".ui-craft-backups"), fsutil.OsFS{}, fixedClock(time.Unix(1700000000, 0)))
	targets := []backup.SnapshotTarget{{Harness: "claude", OrigPath: skillsDir}}

	if _, err := store.Snapshot(targets, "v1.0.3", backup.SourceInstall); err != nil {
		t.Fatalf("snapshot must not fail on a directory symlink in the skills dir: %v", err)
	}
}
