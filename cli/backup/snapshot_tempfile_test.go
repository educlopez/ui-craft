package backup_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// lockedTempReadFS refuses to read our atomic-write temp files, the way Windows refuses to
// read a file another process holds open.
type lockedTempReadFS struct {
	*fsutil.MemFS
}

func (f lockedTempReadFS) ReadFile(name string) ([]byte, error) {
	if strings.HasPrefix(filepath.Base(name), fsutil.TempPrefix) {
		return nil, &os.PathError{
			Op:   "open",
			Path: name,
			Err:  errors.New("The process cannot access the file because it is being used by another process."),
		}
	}
	return f.MemFS.ReadFile(name)
}

// TestSnapshot_skipsAtomicWriteTempFiles covers a temp file leaking into a backup.
//
// WriteFileAtomic puts its temp beside the destination, so a snapshot walking a skill
// directory finds them. Two things go wrong. The snapshot stores a half-written file under a
// name nothing will ever restore to — silent on POSIX, so it went unnoticed. And on Windows
// the read fails outright, which aborted the entire snapshot and with it the install that
// requested it: "apply: snapshot: backup: read ...\.ui-craft-tmp-...: The process cannot
// access the file because it is being used by another process."
func TestSnapshot_skipsAtomicWriteTempFiles(t *testing.T) {
	base := t.TempDir() // absolute on every platform, unlike a hardcoded /home/user
	root := filepath.Join(base, "backups")
	skillDir := filepath.Join(base, "skills", "ui-craft")

	mem := fsutil.NewMemFS()
	_ = mem.MkdirAll(root, 0o750)
	seed(mem, filepath.Join(skillDir, "SKILL.md"), "# real content")
	seed(mem, filepath.Join(skillDir, "references", "brief.md"), "# reference")
	seed(mem, filepath.Join(skillDir, fsutil.TempPrefix+"2716015297"), "half-written")
	seed(mem, filepath.Join(skillDir, "references", fsutil.TempPrefix+"1060469423"), "half-written")

	store := backup.NewStoreWithHome(
		root,
		lockedTempReadFS{MemFS: mem},
		fixedClock(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)),
		func() (string, error) { return base, nil },
	)

	targets := []backup.SnapshotTarget{{Harness: "claude", OrigPath: skillDir}}
	id, err := store.Snapshot(targets, "v1.0.0", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot aborted over a temp file it should never have read: %v", err)
	}

	manifest, err := mem.ReadFile(filepath.Join(root, string(id), "manifest.json"))
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	if strings.Contains(string(manifest), fsutil.TempPrefix) {
		t.Errorf("snapshot captured an atomic-write temp file:\n%s", manifest)
	}
	// The real content must still be there, or "skipped the temp" would be indistinguishable
	// from "skipped everything".
	if !strings.Contains(string(manifest), "SKILL.md") {
		t.Errorf("snapshot missed the real files; manifest:\n%s", manifest)
	}
}
