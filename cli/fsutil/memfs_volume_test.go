package fsutil_test

import (
	"path/filepath"
	"testing"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestMemFS_MkdirAllRoundTripsOnPlatformPaths pins the property that made MemFS lie on
// Windows: a directory it was asked to create must be a directory it can then read.
//
// MkdirAll records each ancestor by walking the path's components. Splitting on the
// separator makes the first component of C:\Users\x be "C:", and filepath.Join("C:", "Users")
// is "C:Users" — relative to the drive, not rooted at it. Every recorded key was malformed,
// so ReadDir reported ErrNotExist for directories that existed, and callers written to treat
// a missing directory as "nothing to do" silently did nothing. Six Windows test failures
// blamed the code being tested; none of them said the fake filesystem had never been read.
//
// t.TempDir() is a volume-rooted path on Windows and a plain absolute path elsewhere, so this
// exercises the volume case on the platform that has volumes and stays a valid round-trip
// check on the ones that don't.
func TestMemFS_MkdirAllRoundTripsOnPlatformPaths(t *testing.T) {
	mem := fsutil.NewMemFS()
	dir := filepath.Join(t.TempDir(), "skills", "ui-craft", "references")

	if err := mem.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("MkdirAll(%q): %v", dir, err)
	}

	// The directory itself, and every ancestor MkdirAll claims to have recorded.
	for p := dir; ; p = filepath.Dir(p) {
		if _, err := mem.ReadDir(p); err != nil {
			t.Errorf("ReadDir(%q) after MkdirAll(%q): %v", p, dir, err)
		}
		parent := filepath.Dir(p)
		if parent == p || parent == filepath.VolumeName(p)+string(filepath.Separator) {
			break
		}
	}
}

// TestMemFS_ReadDirSeesFilesWrittenUnderIt is the other half: a file written into a recorded
// directory must show up when that directory is listed. The stale-file sweep is built
// entirely on this, and it is what silently did nothing on Windows.
func TestMemFS_ReadDirSeesFilesWrittenUnderIt(t *testing.T) {
	mem := fsutil.NewMemFS()
	dir := filepath.Join(t.TempDir(), "commands")
	if err := mem.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	file := filepath.Join(dir, "old-command.md")
	if _, err := fsutil.WriteFileAtomic(mem, file, []byte("stale"), 0o644); err != nil {
		t.Fatalf("WriteFileAtomic: %v", err)
	}

	entries, err := mem.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir(%q): %v", dir, err)
	}
	for _, e := range entries {
		if e.Name() == "old-command.md" {
			return
		}
	}
	t.Errorf("ReadDir(%q) did not list the file written into it; got %d entries", dir, len(entries))
}
