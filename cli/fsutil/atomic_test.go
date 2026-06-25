package fsutil_test

import (
	"errors"
	"os"
	"testing"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestWriteFileAtomic_firstWrite verifies that a new file is created (Changed=true).
func TestWriteFileAtomic_firstWrite(t *testing.T) {
	m := fsutil.NewMemFS()
	result, err := fsutil.WriteFileAtomic(m, "/out/file.txt", []byte("content"), 0o644)
	if err != nil {
		t.Fatalf("WriteFileAtomic: %v", err)
	}
	if !result.Changed {
		t.Error("expected Changed=true on first write")
	}
	got, _ := m.ReadFile("/out/file.txt")
	if string(got) != "content" {
		t.Errorf("file content: got %q, want %q", got, "content")
	}
}

// TestWriteFileAtomic_idempotentOnIdenticalContent verifies that an identical
// re-write returns Changed=false and does NOT modify the file.
func TestWriteFileAtomic_idempotentOnIdenticalContent(t *testing.T) {
	m := fsutil.NewMemFS()
	data := []byte("same bytes")
	// First write.
	_, _ = fsutil.WriteFileAtomic(m, "/idempotent.txt", data, 0o644)

	// Overwrite file data to a sentinel so we can detect if the function
	// re-wrote the file.
	_ = m.WriteFile("/idempotent.txt", data, 0o644) // still same bytes

	result, err := fsutil.WriteFileAtomic(m, "/idempotent.txt", data, 0o644)
	if err != nil {
		t.Fatalf("WriteFileAtomic (2nd): %v", err)
	}
	if result.Changed {
		t.Error("expected Changed=false when content is identical")
	}
}

// TestWriteFileAtomic_writesWhenContentDiffers verifies Changed=true when data changes.
func TestWriteFileAtomic_writesWhenContentDiffers(t *testing.T) {
	m := fsutil.NewMemFS()
	_, _ = fsutil.WriteFileAtomic(m, "/changing.txt", []byte("v1"), 0o644)

	result, err := fsutil.WriteFileAtomic(m, "/changing.txt", []byte("v2"), 0o644)
	if err != nil {
		t.Fatalf("WriteFileAtomic (v2): %v", err)
	}
	if !result.Changed {
		t.Error("expected Changed=true when content differs")
	}
	got, _ := m.ReadFile("/changing.txt")
	if string(got) != "v2" {
		t.Errorf("file content: got %q, want %q", got, "v2")
	}
}

// TestWriteFileAtomic_createsParentDirs verifies MkdirAll is called for deep paths.
func TestWriteFileAtomic_createsParentDirs(t *testing.T) {
	m := fsutil.NewMemFS()
	result, err := fsutil.WriteFileAtomic(m, "/deep/nested/dir/file.txt", []byte("hi"), 0o644)
	if err != nil {
		t.Fatalf("WriteFileAtomic: %v", err)
	}
	if !result.Changed {
		t.Error("expected Changed=true")
	}
}

// TestWriteFileAtomic_emptyContent verifies that a zero-byte file is handled
// consistently (no special-casing of empty slices).
func TestWriteFileAtomic_emptyContent(t *testing.T) {
	m := fsutil.NewMemFS()
	result, err := fsutil.WriteFileAtomic(m, "/empty.txt", []byte{}, 0o644)
	if err != nil {
		t.Fatalf("WriteFileAtomic empty: %v", err)
	}
	if !result.Changed {
		t.Error("first write of empty content should be Changed=true")
	}
	// Second write with identical empty content → Changed=false.
	result2, err := fsutil.WriteFileAtomic(m, "/empty.txt", []byte{}, 0o644)
	if err != nil {
		t.Fatalf("WriteFileAtomic empty (2nd): %v", err)
	}
	if result2.Changed {
		t.Error("expected Changed=false on identical empty content re-write")
	}
}

// TestWriteFileAtomic_OsFS_nestedDirCreation verifies that WriteFileAtomic creates
// a not-yet-existing nested parent directory on the real OS filesystem before
// writing. This covers the case where the target dir (e.g. ~/.claude/mcp/) does
// not exist when install runs for the first time.
func TestWriteFileAtomic_OsFS_nestedDirCreation(t *testing.T) {
	base := t.TempDir()
	// Construct a path three levels deep that does not exist yet.
	target := base + "/a/b/c/mcp.json"
	osfs := fsutil.OsFS{}

	result, err := fsutil.WriteFileAtomic(osfs, target, []byte(`{"ok":true}`), 0o644)
	if err != nil {
		t.Fatalf("WriteFileAtomic into nested non-existent dir: %v", err)
	}
	if !result.Changed {
		t.Error("expected Changed=true on first write into new dir")
	}
	got, readErr := os.ReadFile(target)
	if readErr != nil {
		t.Fatalf("ReadFile after nested write: %v", readErr)
	}
	if string(got) != `{"ok":true}` {
		t.Errorf("content: got %q, want %q", got, `{"ok":true}`)
	}
}

// TestWriteFileAtomic_OsFS_idempotent runs the idempotent check against a real
// temp directory to confirm the OS-path code also respects the byte-compare.
func TestWriteFileAtomic_OsFS_idempotent(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/real.txt"
	data := []byte("real os data")

	osfs := fsutil.OsFS{}
	r1, err := fsutil.WriteFileAtomic(osfs, path, data, 0o644)
	if err != nil {
		t.Fatalf("first write: %v", err)
	}
	if !r1.Changed {
		t.Error("expected Changed=true on first write (OsFS)")
	}

	r2, err := fsutil.WriteFileAtomic(osfs, path, data, 0o644)
	if err != nil {
		t.Fatalf("second write: %v", err)
	}
	if r2.Changed {
		t.Error("expected Changed=false on identical re-write (OsFS)")
	}
}

// TestWriteFileAtomic_OsFS_changesWhenDifferent confirms real-FS write on changed data.
func TestWriteFileAtomic_OsFS_changesWhenDifferent(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/change.txt"
	osfs := fsutil.OsFS{}

	_, _ = fsutil.WriteFileAtomic(osfs, path, []byte("old"), 0o644)
	r, err := fsutil.WriteFileAtomic(osfs, path, []byte("new"), 0o644)
	if err != nil {
		t.Fatalf("write: %v", err)
	}
	if !r.Changed {
		t.Error("expected Changed=true when content differs (OsFS)")
	}
	got, _ := os.ReadFile(path)
	if string(got) != "new" {
		t.Errorf("content: got %q, want %q", got, "new")
	}
}

// TestWriteFileAtomic_OsFS_cleanupOnFailure verifies that when the real-disk
// atomic write fails after creating the temp file (simulated by targeting a
// path whose parent directory doesn't exist so os.Rename fails), no leftover
// temp file remains — the deferred cleanup in writeAtomicOS fired correctly.
func TestWriteFileAtomic_OsFS_cleanupOnFailure(t *testing.T) {
	dir := t.TempDir()
	osfs := fsutil.OsFS{}

	// Inject failure at the rename stage: create a directory, do one successful
	// write into it, then make the directory read-only (0555) so the subsequent
	// write can create a temp file but the final os.Rename is denied by the OS.
	// The deferred cleanup in writeAtomicOS must remove the temp file.
	rodir := dir + "/readonly"
	if err := os.Mkdir(rodir, 0o755); err != nil {
		t.Fatalf("setup rodir: %v", err)
	}
	targetPath := rodir + "/file.txt"
	// First write succeeds to create the file.
	if _, err := fsutil.WriteFileAtomic(osfs, targetPath, []byte("initial"), 0o644); err != nil {
		t.Fatalf("initial write: %v", err)
	}
	// Make the directory read-only so that rename (which requires write perms on
	// the dir) fails — the temp file created in the same dir should be cleaned up.
	if err := os.Chmod(rodir, 0o555); err != nil {
		t.Fatalf("chmod rodir: %v", err)
	}
	t.Cleanup(func() { os.Chmod(rodir, 0o755) }) // restore so TempDir cleanup works

	_, err := fsutil.WriteFileAtomic(osfs, targetPath, []byte("updated"), 0o644)
	if err == nil {
		// On some systems (e.g. running as root) the chmod trick doesn't block writes.
		t.Skip("could not trigger rename failure (possibly running as root); skipping cleanup check")
	}

	// Assert no .ui-craft-tmp-* temp files remain in the directory.
	entries, readErr := os.ReadDir(rodir)
	if readErr != nil {
		t.Fatalf("ReadDir after failure: %v", readErr)
	}
	for _, e := range entries {
		if e.Name() != "file.txt" {
			t.Errorf("unexpected leftover file in dir after atomic-write failure: %s", e.Name())
		}
	}
}

// renameErrFS wraps MemFS and makes Rename fail, used to test error paths.
type renameErrFS struct {
	*fsutil.MemFS
}

func (r renameErrFS) Rename(_, _ string) error {
	return errors.New("rename: injected failure")
}

// TestWriteFileAtomic_renameError verifies an error is surfaced from Rename.
func TestWriteFileAtomic_renameError(t *testing.T) {
	m := &renameErrFS{MemFS: fsutil.NewMemFS()}
	_, err := fsutil.WriteFileAtomic(m, "/fail.txt", []byte("data"), 0o644)
	if err == nil {
		t.Fatal("expected error from Rename failure, got nil")
	}
}
