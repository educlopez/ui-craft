package fsutil

import (
	"bytes"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// memFile holds the state for a single file in MemFS.
type memFile struct {
	data []byte
	perm fs.FileMode
	mod  time.Time
}

// memFileInfo implements fs.FileInfo over a memFile.
type memFileInfo struct {
	name string
	f    *memFile
	dir  bool
}

func (i memFileInfo) Name() string       { return i.name }
func (i memFileInfo) Size() int64        { return int64(len(i.f.data)) }
func (i memFileInfo) Mode() fs.FileMode  { return i.f.perm }
func (i memFileInfo) ModTime() time.Time { return i.f.mod }
func (i memFileInfo) IsDir() bool        { return i.dir }
func (i memFileInfo) Sys() any           { return nil }

// memDirInfo is returned when Stat is called on a directory path in MemFS.
type memDirInfo struct {
	name string
}

func (d memDirInfo) Name() string       { return d.name }
func (d memDirInfo) Size() int64        { return 0 }
func (d memDirInfo) Mode() fs.FileMode  { return fs.ModeDir | 0o755 }
func (d memDirInfo) ModTime() time.Time { return time.Time{} }
func (d memDirInfo) IsDir() bool        { return true }
func (d memDirInfo) Sys() any           { return nil }

// MemFS is a concurrency-safe in-memory FileSystem suitable for unit tests.
type MemFS struct {
	mu    sync.RWMutex
	files map[string]*memFile // key: cleaned absolute-style path
	dirs  map[string]struct{} // tracked directory paths
}

// NewMemFS returns an empty in-memory filesystem.
func NewMemFS() *MemFS {
	return &MemFS{
		files: make(map[string]*memFile),
		dirs:  make(map[string]struct{}),
	}
}

// Compile-time check.
var _ FileSystem = (*MemFS)(nil)

func (m *MemFS) clean(name string) string {
	return filepath.Clean(name)
}

func (m *MemFS) Stat(name string) (fs.FileInfo, error) {
	key := m.clean(name)
	m.mu.RLock()
	defer m.mu.RUnlock()

	if f, ok := m.files[key]; ok {
		return memFileInfo{name: filepath.Base(key), f: f}, nil
	}
	if _, ok := m.dirs[key]; ok {
		return memDirInfo{name: filepath.Base(key)}, nil
	}
	return nil, &os.PathError{Op: "stat", Path: name, Err: os.ErrNotExist}
}

func (m *MemFS) ReadFile(name string) ([]byte, error) {
	key := m.clean(name)
	m.mu.RLock()
	defer m.mu.RUnlock()

	f, ok := m.files[key]
	if !ok {
		return nil, &os.PathError{Op: "open", Path: name, Err: os.ErrNotExist}
	}
	out := make([]byte, len(f.data))
	copy(out, f.data)
	return out, nil
}

func (m *MemFS) WriteFile(name string, data []byte, perm fs.FileMode) error {
	key := m.clean(name)
	buf := make([]byte, len(data))
	copy(buf, data)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.files[key] = &memFile{data: buf, perm: perm, mod: time.Now()}
	return nil
}

func (m *MemFS) MkdirAll(path string, _ fs.FileMode) error {
	key := m.clean(path)
	m.mu.Lock()
	defer m.mu.Unlock()
	// Record every component so Stat on parent dirs works.
	parts := strings.Split(key, string(filepath.Separator))
	built := ""
	for _, p := range parts {
		if p == "" {
			built = string(filepath.Separator)
			continue
		}
		if built == string(filepath.Separator) {
			built += p
		} else {
			built = filepath.Join(built, p)
		}
		m.dirs[built] = struct{}{}
	}
	return nil
}

func (m *MemFS) Rename(oldpath, newpath string) error {
	oldKey := m.clean(oldpath)
	newKey := m.clean(newpath)
	m.mu.Lock()
	defer m.mu.Unlock()

	f, ok := m.files[oldKey]
	if !ok {
		return &os.PathError{Op: "rename", Path: oldpath, Err: os.ErrNotExist}
	}
	m.files[newKey] = f
	delete(m.files, oldKey)
	return nil
}

func (m *MemFS) Remove(name string) error {
	key := m.clean(name)
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.files[key]; ok {
		delete(m.files, key)
		return nil
	}
	return &os.PathError{Op: "remove", Path: name, Err: os.ErrNotExist}
}

func (m *MemFS) Open(name string) (io.ReadCloser, error) {
	data, err := m.ReadFile(name)
	if err != nil {
		return nil, err
	}
	return io.NopCloser(bytes.NewReader(data)), nil
}
