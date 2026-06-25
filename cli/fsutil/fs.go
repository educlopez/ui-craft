// Package fsutil provides a FileSystem abstraction used throughout the cli.
// The OsFS implementation delegates to the os stdlib; MemFS is an in-memory
// implementation used in unit tests so no real disk is touched.
package fsutil

import (
	"io"
	"io/fs"
	"os"
)

// FileSystem is the interface that wraps common filesystem operations.
// All path arguments are absolute or relative to the working directory.
type FileSystem interface {
	// Stat returns a FileInfo for the named file.
	Stat(name string) (fs.FileInfo, error)

	// ReadFile reads the named file and returns the contents.
	ReadFile(name string) ([]byte, error)

	// WriteFile writes data to the named file, creating it if necessary.
	WriteFile(name string, data []byte, perm fs.FileMode) error

	// MkdirAll creates a directory named path, along with any necessary parents.
	MkdirAll(path string, perm fs.FileMode) error

	// Rename atomically replaces newpath with oldpath.
	Rename(oldpath, newpath string) error

	// Remove removes the named file or empty directory.
	Remove(name string) error

	// Open opens the named file for reading.
	Open(name string) (io.ReadCloser, error)
}

// realDiskFS is a seam interface that any real-disk FileSystem satisfies.
// WriteFileAtomic asserts this instead of the concrete OsFS type so that
// decorator wrappers around OsFS still receive the full fsync atomic path.
type realDiskFS interface {
	realDisk() bool
}

// OsFS is a FileSystem implementation backed by the real OS stdlib.
type OsFS struct{}

// Compile-time check: OsFS must satisfy FileSystem.
var _ FileSystem = OsFS{}

// realDisk satisfies the realDiskFS interface, signalling that OsFS writes to
// the real OS filesystem and WriteFileAtomic should use the fsync path.
func (OsFS) realDisk() bool { return true }

func (OsFS) Stat(name string) (fs.FileInfo, error) { return os.Stat(name) }

func (OsFS) ReadFile(name string) ([]byte, error) { return os.ReadFile(name) }

func (OsFS) WriteFile(name string, data []byte, perm fs.FileMode) error {
	return os.WriteFile(name, data, perm)
}

func (OsFS) MkdirAll(path string, perm fs.FileMode) error { return os.MkdirAll(path, perm) }

func (OsFS) Rename(oldpath, newpath string) error { return os.Rename(oldpath, newpath) }

func (OsFS) Remove(name string) error { return os.Remove(name) }

func (OsFS) Open(name string) (io.ReadCloser, error) { return os.Open(name) }

// ReadDir reads the directory named by dirname and returns a list of directory entries.
func (OsFS) ReadDir(name string) ([]os.DirEntry, error) { return os.ReadDir(name) }
