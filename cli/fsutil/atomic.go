// Package fsutil — WriteFileAtomic
//
// Adapted from github.com/Gentleman-Programming/gentle-ai (MIT).
// Original: internal/components/filemerge/writer.go
//
// Writes to a temp sibling file, chmods it, fsyncs (tolerates
// ACCESS_DENIED/ErrPermission from directory Sync on Windows), then
// renames into place. If the destination already contains identical
// bytes the write is skipped entirely (Changed: false).
package fsutil

import (
	"bytes"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
)

// WriteResult describes the outcome of WriteFileAtomic.
type WriteResult struct {
	// Changed is false when the file already contained identical bytes and no
	// write was performed.
	Changed bool
}

// WriteFileAtomic writes data to path using a temp-file → rename strategy.
//
// Algorithm:
//  1. Read existing content; if identical to data, return Changed:false.
//  2. Create a sibling temp file (same directory, so rename is always on the
//     same device/volume).
//  3. Write data, chmod to perm, fsync (tolerate ErrPermission on Windows).
//  4. Rename temp → path (atomic on POSIX; best-effort on Windows).
func WriteFileAtomic(filesystem FileSystem, path string, data []byte, perm fs.FileMode) (WriteResult, error) {
	// --- byte-compare early exit ---
	existing, err := filesystem.ReadFile(path)
	if err == nil && bytes.Equal(existing, data) {
		return WriteResult{Changed: false}, nil
	}

	// --- ensure parent directory exists ---
	dir := filepath.Dir(path)
	if mkErr := filesystem.MkdirAll(dir, 0o755); mkErr != nil {
		return WriteResult{}, fmt.Errorf("fsutil: mkdir %s: %w", dir, mkErr)
	}

	// --- write through real OS for fsync; fall back for in-memory FS ---
	// Assert the realDiskFS interface instead of the concrete OsFS type so that
	// any decorator wrapping OsFS (e.g. a logging or metering layer) still gets
	// the full fsync atomic path rather than silently falling to temp+rename.
	if _, ok := filesystem.(realDiskFS); ok {
		return writeAtomicOS(path, data, perm)
	}

	// For non-OS filesystems (e.g. MemFS in tests) use a simple temp+rename.
	tmp := path + ".tmp"
	if wErr := filesystem.WriteFile(tmp, data, perm); wErr != nil {
		return WriteResult{}, fmt.Errorf("fsutil: write temp %s: %w", tmp, wErr)
	}
	if rErr := filesystem.Rename(tmp, path); rErr != nil {
		return WriteResult{}, fmt.Errorf("fsutil: rename %s → %s: %w", tmp, path, rErr)
	}
	return WriteResult{Changed: true}, nil
}

// writeAtomicOS performs the real temp→chmod→fsync→rename sequence on the OS filesystem.
func writeAtomicOS(path string, data []byte, perm fs.FileMode) (WriteResult, error) {
	dir := filepath.Dir(path)

	// Create temp file in the same directory so rename stays on the same volume.
	tmp, err := os.CreateTemp(dir, ".ui-craft-tmp-*")
	if err != nil {
		return WriteResult{}, fmt.Errorf("fsutil: create temp in %s: %w", dir, err)
	}
	tmpName := tmp.Name()

	// Clean up on any failure path.
	ok := false
	defer func() {
		if !ok {
			os.Remove(tmpName)
		}
	}()

	if _, err = tmp.Write(data); err != nil {
		tmp.Close()
		return WriteResult{}, fmt.Errorf("fsutil: write temp: %w", err)
	}
	if err = tmp.Chmod(perm); err != nil {
		tmp.Close()
		return WriteResult{}, fmt.Errorf("fsutil: chmod temp: %w", err)
	}

	// fsync the file data.
	if err = tmp.Sync(); err != nil {
		tmp.Close()
		return WriteResult{}, fmt.Errorf("fsutil: sync temp: %w", err)
	}
	tmp.Close()

	// fsync the directory — tolerate ErrPermission on Windows (gotcha #1).
	if syncErr := syncDir(dir); syncErr != nil {
		return WriteResult{}, syncErr
	}

	// Atomic rename into place.
	if err = os.Rename(tmpName, path); err != nil {
		return WriteResult{}, fmt.Errorf("fsutil: rename %s → %s: %w", tmpName, path, err)
	}

	ok = true
	return WriteResult{Changed: true}, nil
}

// syncDir fsyncs the directory entry. On Windows, os.Open on a directory
// succeeds but Sync returns ACCESS_DENIED (os.ErrPermission); we tolerate
// that silently per gotcha #1.
func syncDir(dir string) error {
	d, err := os.Open(dir)
	if err != nil {
		return fmt.Errorf("fsutil: open dir %s: %w", dir, err)
	}
	defer d.Close()

	if err = d.Sync(); err != nil {
		if runtime.GOOS == "windows" && isPermissionError(err) {
			return nil // tolerate ACCESS_DENIED from directory Sync on Windows
		}
		return fmt.Errorf("fsutil: sync dir %s: %w", dir, err)
	}
	return nil
}

func isPermissionError(err error) bool {
	return os.IsPermission(err)
}
