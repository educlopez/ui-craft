package fsutil_test

import (
	"errors"
	"io/fs"
	"os"
	"testing"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestMemFS_writeAndRead verifies basic write + read round-trip.
func TestMemFS_writeAndRead(t *testing.T) {
	m := fsutil.NewMemFS()
	data := []byte("hello world")
	if err := m.WriteFile("/tmp/test.txt", data, 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	got, err := m.ReadFile("/tmp/test.txt")
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if string(got) != string(data) {
		t.Errorf("got %q, want %q", got, data)
	}
}

// TestMemFS_statExistingFile checks Stat on a written file.
func TestMemFS_statExistingFile(t *testing.T) {
	m := fsutil.NewMemFS()
	_ = m.WriteFile("/a/b/c.txt", []byte("x"), 0o600)
	info, err := m.Stat("/a/b/c.txt")
	if err != nil {
		t.Fatalf("Stat: %v", err)
	}
	if info.IsDir() {
		t.Error("expected IsDir=false")
	}
	if info.Size() != 1 {
		t.Errorf("size: got %d, want 1", info.Size())
	}
}

// TestMemFS_statMissingFile checks that Stat returns os.ErrNotExist.
func TestMemFS_statMissingFile(t *testing.T) {
	m := fsutil.NewMemFS()
	_, err := m.Stat("/no/such/file.txt")
	if !errors.Is(err, os.ErrNotExist) {
		t.Errorf("want os.ErrNotExist, got %v", err)
	}
}

// TestMemFS_mkdirAllAndStatDir checks that MkdirAll records dirs.
func TestMemFS_mkdirAllAndStatDir(t *testing.T) {
	m := fsutil.NewMemFS()
	if err := m.MkdirAll("/some/deep/path", 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	info, err := m.Stat("/some/deep/path")
	if err != nil {
		t.Fatalf("Stat dir: %v", err)
	}
	if !info.IsDir() {
		t.Error("expected IsDir=true")
	}
}

// TestMemFS_rename verifies rename moves the file.
func TestMemFS_rename(t *testing.T) {
	m := fsutil.NewMemFS()
	_ = m.WriteFile("/src.txt", []byte("data"), 0o644)
	if err := m.Rename("/src.txt", "/dst.txt"); err != nil {
		t.Fatalf("Rename: %v", err)
	}
	if _, err := m.ReadFile("/dst.txt"); err != nil {
		t.Fatalf("ReadFile dst: %v", err)
	}
	if _, err := m.ReadFile("/src.txt"); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("src should not exist after rename, got %v", err)
	}
}

// TestMemFS_remove verifies Remove deletes a file.
func TestMemFS_remove(t *testing.T) {
	m := fsutil.NewMemFS()
	_ = m.WriteFile("/del.txt", []byte("bye"), 0o644)
	if err := m.Remove("/del.txt"); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	if _, err := m.Stat("/del.txt"); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("file should be gone, got %v", err)
	}
}

// TestMemFS_open verifies Open returns readable content.
func TestMemFS_open(t *testing.T) {
	m := fsutil.NewMemFS()
	_ = m.WriteFile("/hello.txt", []byte("open me"), 0o644)
	rc, err := m.Open("/hello.txt")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer rc.Close()
	buf := make([]byte, 7)
	if _, err = rc.Read(buf); err != nil {
		t.Fatalf("Read: %v", err)
	}
	if string(buf) != "open me" {
		t.Errorf("got %q", buf)
	}
}

// TestMemFS_satisfiesFileSystemInterface is a compile-time proof via interface assertion.
// If MemFS does not implement FileSystem the package won't compile.
func TestMemFS_satisfiesFileSystemInterface(t *testing.T) {
	var _ fsutil.FileSystem = fsutil.NewMemFS()
}

// TestOsFS_satisfiesFileSystemInterface same for OsFS.
func TestOsFS_satisfiesFileSystemInterface(t *testing.T) {
	var _ fsutil.FileSystem = fsutil.OsFS{}
}

// TestMemFS_modeIsPreserved verifies that the FileMode is stored.
func TestMemFS_modeIsPreserved(t *testing.T) {
	m := fsutil.NewMemFS()
	_ = m.WriteFile("/perm.txt", []byte("x"), 0o600)
	info, err := m.Stat("/perm.txt")
	if err != nil {
		t.Fatalf("Stat: %v", err)
	}
	if info.Mode() != fs.FileMode(0o600) {
		t.Errorf("mode: got %v, want 0o600", info.Mode())
	}
}
