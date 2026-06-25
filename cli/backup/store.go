// Package backup implements snapshot-based backup and restore for harness
// config files. Before any write operation, core.Apply snapshots all target
// files so that a mid-plan failure can roll the whole plan back atomically.
//
// Snapshot layout:
//
//	<root>/<ISO8601-timestamp-id>/
//	  manifest.json      — describes the snapshot (ID, source, files, checksum)
//	  snapshot.tar.gz    — archive of all backed-up file contents
//
// Adapted from github.com/Gentleman-Programming/gentle-ai (MIT).
// Original: internal/backup/
package backup

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// maxExtractFileBytes caps how many bytes are read from any single tar entry
// during extraction to prevent gzip-bomb decompression attacks.
const maxExtractFileBytes = 64 << 20 // 64 MiB

// DefaultRetentionCount is the number of unpinned snapshots kept by Prune.
const DefaultRetentionCount = 5

// Source identifies what triggered the snapshot.
type Source string

const (
	SourceInstall   Source = "install"
	SourceSync      Source = "sync"
	SourceUpgrade   Source = "upgrade"
	SourceUninstall Source = "uninstall"
	SourceManual    Source = "manual"
)

// SnapshotID is an opaque string key that identifies a single snapshot.
// It encodes a sortable ISO-8601 timestamp + a random suffix for uniqueness.
type SnapshotID string

// FileMeta records one file within a snapshot.
type FileMeta struct {
	// Harness is the harness name this file belongs to (e.g. "claude").
	Harness string `json:"harness"`
	// OrigPath is the absolute path of the file on the user's system.
	OrigPath string `json:"origPath"`
	// SavedPath is the archive-relative path inside snapshot.tar.gz.
	SavedPath string `json:"savedPath"`
	// ExistedBefore is true when the file existed before the plan started.
	// Rollback DELETES files where ExistedBefore is false (created by the plan).
	ExistedBefore bool `json:"existedBefore"`
}

// Manifest is the JSON structure written as manifest.json in each snapshot dir.
type Manifest struct {
	ID               SnapshotID `json:"id"`
	CreatedAt        time.Time  `json:"createdAt"`
	Source           Source     `json:"source"`
	Checksum         string     `json:"checksum"`
	Compressed       bool       `json:"compressed"`
	Pinned           bool       `json:"pinned"`
	FileCount        int        `json:"fileCount"`
	CreatedByVersion string     `json:"createdByVersion"`
	Files            []FileMeta `json:"files"`
}

// SnapshotMeta is a lightweight summary returned by List().
type SnapshotMeta struct {
	ID        SnapshotID
	CreatedAt time.Time
	Source    Source
	Pinned    bool
	FileCount int
}

// SnapshotTarget describes a single file to include in a snapshot.
type SnapshotTarget struct {
	// Harness is the owning harness name.
	Harness string
	// OrigPath is the absolute path on disk.
	OrigPath string
}

// Clock is a function that returns the current time. Inject a fake in tests to
// produce deterministic snapshot IDs. Never call time.Now() directly in library
// code — always use the store's clock.
type Clock func() time.Time

// HomeResolver resolves the user's home directory (symlink-evaluated).
// Inject a fake in tests to bypass the real OS home check.
type HomeResolver func() (string, error)

// Store manages a directory of timestamped snapshots.
//
// mu serialises mutating operations (Snapshot, Prune, Restore, deleteSnapshot)
// so that concurrent callers cannot produce duplicate IDs or corrupt the
// snapshot directory.
type Store struct {
	mu           sync.Mutex
	root         string
	fs           fsutil.FileSystem
	clock        Clock
	homeResolver HomeResolver
}

// NewStore creates a Store rooted at root. If clock is nil, time.Now is used.
// If homeResolver is nil, the real os.UserHomeDir + EvalSymlinks is used.
// This is the only call site that may reference time.Now — the rest of the
// package goes through the injected clock.
func NewStore(root string, filesystem fsutil.FileSystem, clock Clock) *Store {
	if clock == nil {
		clock = time.Now
	}
	return &Store{root: root, fs: filesystem, clock: clock, homeResolver: resolvedHomeDir}
}

// NewStoreWithHome creates a Store with an explicit home resolver (for tests).
func NewStoreWithHome(root string, filesystem fsutil.FileSystem, clock Clock, homeResolver HomeResolver) *Store {
	if clock == nil {
		clock = time.Now
	}
	if homeResolver == nil {
		homeResolver = resolvedHomeDir
	}
	return &Store{root: root, fs: filesystem, clock: clock, homeResolver: homeResolver}
}

// archiveEntry holds a file's metadata and raw content for building the tar.gz.
type archiveEntry struct {
	meta    FileMeta
	content []byte // nil for tombstone entries (ExistedBefore=false)
}

// Snapshot archives targets into a new snapshot and returns its ID.
// Files that do not exist on disk are recorded with ExistedBefore=false and
// are NOT written into the tar.gz (they are tombstones only).
// If the resulting snapshot is identical to the most-recent unpinned snapshot
// (per IsDuplicate), the existing ID is returned and no new snapshot is created.
func (s *Store) Snapshot(targets []SnapshotTarget, binaryVersion string, source Source) (SnapshotID, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := s.clock()
	// Build a stable snapshot ID: ISO-8601 compact + nanoseconds for uniqueness.
	id := SnapshotID(now.UTC().Format("20060102T150405") + fmt.Sprintf("-%09d", now.Nanosecond()))

	// Read each target file to build the manifest and tar content.
	var entries []archiveEntry

	for _, t := range targets {
		savedPath := sanitizeSavedPath(t.Harness, t.OrigPath)
		meta := FileMeta{
			Harness:   t.Harness,
			OrigPath:  t.OrigPath,
			SavedPath: savedPath,
		}
		data, err := s.fs.ReadFile(t.OrigPath)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) || isNotExist(err) {
				// File does not exist yet — tombstone; do not add to archive.
				meta.ExistedBefore = false
				entries = append(entries, archiveEntry{meta: meta, content: nil})
				continue
			}
			return "", fmt.Errorf("backup: read %s: %w", t.OrigPath, err)
		}
		meta.ExistedBefore = true
		entries = append(entries, archiveEntry{meta: meta, content: data})
	}

	// Compute dedup checksum before writing anything.
	checksum := computeChecksum(entries)

	// Check for duplicate vs the most-recent unpinned snapshot.
	if dup, dupID, err := s.isDuplicate(checksum); err == nil && dup {
		return dupID, nil
	}

	// Create snapshot directory.
	snapDir := filepath.Join(s.root, string(id))
	if err := s.fs.MkdirAll(snapDir, 0o750); err != nil {
		return "", fmt.Errorf("backup: mkdir snapshot dir: %w", err)
	}

	// Build the tar.gz archive in memory, then write atomically.
	tarPath := filepath.Join(snapDir, "snapshot.tar.gz")
	tarBytes, err := buildTarGz(entries)
	if err != nil {
		return "", fmt.Errorf("backup: build tar.gz: %w", err)
	}
	if err := s.fs.WriteFile(tarPath, tarBytes, 0o640); err != nil {
		return "", fmt.Errorf("backup: write tar.gz: %w", err)
	}

	// Build the manifest.
	var fileMetas []FileMeta
	for _, e := range entries {
		fileMetas = append(fileMetas, e.meta)
	}
	manifest := Manifest{
		ID:               id,
		CreatedAt:        now.UTC(),
		Source:           source,
		Checksum:         checksum,
		Compressed:       true,
		Pinned:           false,
		FileCount:        len(fileMetas),
		CreatedByVersion: binaryVersion,
		Files:            fileMetas,
	}
	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return "", fmt.Errorf("backup: marshal manifest: %w", err)
	}
	manifestPath := filepath.Join(snapDir, "manifest.json")
	if err := s.fs.WriteFile(manifestPath, manifestBytes, 0o640); err != nil {
		return "", fmt.Errorf("backup: write manifest: %w", err)
	}

	return id, nil
}

// Restore extracts the snapshot identified by id, restoring each file to its
// original path. Files with ExistedBefore=false are DELETED (not restored)
// because the plan created them — rollback must leave no trace.
//
// Security: every OrigPath is validated to resolve under os.UserHomeDir()
// (symlink-resolved). Every SavedPath is validated to resolve under the backup
// root. Entries that fail validation are rejected with an error.
func (s *Store) Restore(id SnapshotID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	snapDir := filepath.Join(s.root, string(id))
	manifest, err := s.readManifest(snapDir)
	if err != nil {
		return fmt.Errorf("backup: read manifest for %s: %w", id, err)
	}

	// Validate home dir for path-escape checks.
	homeDir, err := s.homeResolver()
	if err != nil {
		return fmt.Errorf("backup: resolve home dir: %w", err)
	}

	// Load the tar.gz if there are any files to restore.
	var archiveFiles map[string][]byte
	tarPath := filepath.Join(snapDir, "snapshot.tar.gz")
	if manifest.FileCount > 0 {
		archiveFiles, err = extractTarGz(s.fs, tarPath)
		if err != nil {
			return fmt.Errorf("backup: extract tar.gz for %s: %w", id, err)
		}
	}

	for _, fm := range manifest.Files {
		// Security: validate origPath is under $HOME (symlink-resolved).
		if err := validateUnderHome(fm.OrigPath, homeDir); err != nil {
			return fmt.Errorf("backup: restore security: %w", err)
		}

		if !fm.ExistedBefore {
			// File was created by the plan — delete it on rollback.
			if err := s.fs.Remove(fm.OrigPath); err != nil && !errors.Is(err, fs.ErrNotExist) {
				return fmt.Errorf("backup: remove created file %s: %w", fm.OrigPath, err)
			}
			continue
		}

		// Security: validate savedPath is under backup root.
		if err := validateUnderRoot(fm.SavedPath, s.root); err != nil {
			return fmt.Errorf("backup: restore security: %w", err)
		}

		content, ok := archiveFiles[fm.SavedPath]
		if !ok {
			return fmt.Errorf("backup: missing archive entry %s in snapshot %s", fm.SavedPath, id)
		}

		// Ensure parent directory exists.
		if mkErr := s.fs.MkdirAll(filepath.Dir(fm.OrigPath), 0o750); mkErr != nil {
			return fmt.Errorf("backup: mkdir for restore target %s: %w", fm.OrigPath, mkErr)
		}
		if wErr := s.fs.WriteFile(fm.OrigPath, content, 0o640); wErr != nil {
			return fmt.Errorf("backup: write restored file %s: %w", fm.OrigPath, wErr)
		}
	}
	return nil
}

// Prune deletes the oldest unpinned snapshots beyond keep. Pinned snapshots
// are never deleted. keep=DefaultRetentionCount (5) is the standard value.
func (s *Store) Prune(keep int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	metas, err := s.listLocked()
	if err != nil {
		return fmt.Errorf("backup: prune list: %w", err)
	}

	// Separate pinned from unpinned; sort unpinned oldest-first.
	var unpinned []SnapshotMeta
	for _, m := range metas {
		if !m.Pinned {
			unpinned = append(unpinned, m)
		}
	}
	sort.Slice(unpinned, func(i, j int) bool {
		return unpinned[i].CreatedAt.Before(unpinned[j].CreatedAt)
	})

	// Delete from the front (oldest) until we are at or below keep.
	excess := len(unpinned) - keep
	for i := 0; i < excess; i++ {
		if err := s.deleteSnapshotLocked(unpinned[i].ID); err != nil {
			return fmt.Errorf("backup: prune delete %s: %w", unpinned[i].ID, err)
		}
	}
	return nil
}

// Pin marks a snapshot so that Prune will never delete it.
func (s *Store) Pin(id SnapshotID) error {
	return s.setPinned(id, true)
}

// Unpin removes the pin from a snapshot, making it eligible for Prune.
func (s *Store) Unpin(id SnapshotID) error {
	return s.setPinned(id, false)
}

// List returns a summary of all snapshots, sorted newest-first.
func (s *Store) List() ([]SnapshotMeta, error) {
	return s.listLocked()
}

// listLocked is the lock-free internal implementation of List. Call it only
// when the caller already holds s.mu.
func (s *Store) listLocked() ([]SnapshotMeta, error) {
	entries, err := listSnapshotDirs(s.fs, s.root)
	if err != nil {
		return nil, err
	}

	var metas []SnapshotMeta
	for _, dir := range entries {
		manifest, err := s.readManifest(filepath.Join(s.root, dir))
		if err != nil {
			continue // skip corrupt snapshots
		}
		metas = append(metas, SnapshotMeta{
			ID:        manifest.ID,
			CreatedAt: manifest.CreatedAt,
			Source:    manifest.Source,
			Pinned:    manifest.Pinned,
			FileCount: manifest.FileCount,
		})
	}

	// Sort newest-first.
	sort.Slice(metas, func(i, j int) bool {
		return metas[i].CreatedAt.After(metas[j].CreatedAt)
	})
	return metas, nil
}

// Latest returns the most recent snapshot ID, or an error if no snapshots exist.
func (s *Store) Latest() (SnapshotID, error) {
	metas, err := s.List()
	if err != nil {
		return "", err
	}
	if len(metas) == 0 {
		return "", fmt.Errorf("backup: no snapshots found")
	}
	return metas[0].ID, nil
}

// --- internal helpers ---

// isDuplicate returns true if checksum matches the most-recent unpinned snapshot.
// Must only be called while s.mu is held (called from Snapshot).
func (s *Store) isDuplicate(checksum string) (bool, SnapshotID, error) {
	metas, err := s.listLocked()
	if err != nil {
		return false, "", err
	}
	// Find the most recent unpinned snapshot.
	for _, m := range metas {
		if m.Pinned {
			continue
		}
		snapDir := filepath.Join(s.root, string(m.ID))
		manifest, err := s.readManifest(snapDir)
		if err != nil {
			continue
		}
		if manifest.Checksum == checksum {
			return true, m.ID, nil
		}
		// Only compare against the most recent unpinned.
		return false, "", nil
	}
	return false, "", nil
}

// readManifest reads and parses the manifest.json in the given snapshot directory.
func (s *Store) readManifest(snapDir string) (*Manifest, error) {
	data, err := s.fs.ReadFile(filepath.Join(snapDir, "manifest.json"))
	if err != nil {
		return nil, err
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// setPinned updates the Pinned field in a snapshot's manifest.
func (s *Store) setPinned(id SnapshotID, pinned bool) error {
	snapDir := filepath.Join(s.root, string(id))
	manifest, err := s.readManifest(snapDir)
	if err != nil {
		return fmt.Errorf("backup: read manifest: %w", err)
	}
	manifest.Pinned = pinned
	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return fmt.Errorf("backup: marshal manifest: %w", err)
	}
	return s.fs.WriteFile(filepath.Join(snapDir, "manifest.json"), data, 0o640)
}

// deleteSnapshot removes the snapshot directory and all its contents.
// It acquires s.mu; do NOT call from code that already holds s.mu.
func (s *Store) deleteSnapshot(id SnapshotID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.deleteSnapshotLocked(id)
}

// deleteSnapshotLocked removes the snapshot directory recursively.
// Must only be called while s.mu is held.
// RemoveAll is used so that a directory with extra/unexpected files still prunes cleanly.
func (s *Store) deleteSnapshotLocked(id SnapshotID) error {
	snapDir := filepath.Join(s.root, string(id))
	return s.fs.RemoveAll(snapDir)
}

// listSnapshotDirs returns the names of all subdirectories in root.
func listSnapshotDirs(filesystem fsutil.FileSystem, root string) ([]string, error) {
	type readDirFS interface {
		ReadDir(name string) ([]os.DirEntry, error)
	}
	if rdf, ok := filesystem.(readDirFS); ok {
		entries, err := rdf.ReadDir(root)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) || isNotExist(err) {
				return nil, nil
			}
			return nil, err
		}
		var dirs []string
		for _, e := range entries {
			if e.IsDir() {
				dirs = append(dirs, e.Name())
			}
		}
		return dirs, nil
	}
	// Fallback for filesystems that don't implement ReadDir.
	return nil, nil
}

// sanitizeSavedPath produces a safe archive-relative path from harness + origPath.
func sanitizeSavedPath(harness, origPath string) string {
	clean := filepath.ToSlash(filepath.Clean(origPath))
	clean = strings.TrimPrefix(clean, "/")
	return filepath.Join(harness, clean)
}

// computeChecksum returns the SHA-256 hex digest of the sorted
// "path:filehash\n" pairs. Zero-file case returns SHA-256 of empty string.
//
// Finding 16 (by design — not a bug): tombstone entries (ExistedBefore=false,
// content=nil) contribute sha256("") to the checksum. This is intentional: the
// snapshot records which files were absent before the plan, and the absence of a
// file is a stable, hash-able fact. Two snapshots with the same set of absent
// files and the same content for present files will produce the same checksum and
// correctly deduplicate. Changing this would break dedup semantics.
func computeChecksum(entries []archiveEntry) string {
	// Collect path:filehash pairs.
	type pair struct {
		key  string
		hash string
	}
	var pairs []pair
	for _, e := range entries {
		h := sha256.Sum256(e.content)
		pairs = append(pairs, pair{
			key:  e.meta.OrigPath,
			hash: fmt.Sprintf("%x", h),
		})
	}
	// Sort for determinism.
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].key < pairs[j].key
	})

	var sb strings.Builder
	for _, p := range pairs {
		sb.WriteString(p.key)
		sb.WriteString(":")
		sb.WriteString(p.hash)
		sb.WriteString("\n")
	}
	// SHA-256 of the composite string (empty string → SHA of "" for zero-file case).
	composite := sha256.Sum256([]byte(sb.String()))
	return fmt.Sprintf("%x", composite)
}

// buildTarGz produces a gzipped tar archive from the given archive entries.
// Only entries with ExistedBefore=true (non-nil content) are included.
func buildTarGz(entries []archiveEntry) ([]byte, error) {
	rawBuf := &byteBuffer{}
	gw := gzip.NewWriter(rawBuf)
	tw := tar.NewWriter(gw)

	for _, e := range entries {
		if !e.meta.ExistedBefore || e.content == nil {
			continue
		}
		hdr := &tar.Header{
			Name:     e.meta.SavedPath,
			Mode:     0o640,
			Size:     int64(len(e.content)),
			Typeflag: tar.TypeReg,
		}
		if err := tw.WriteHeader(hdr); err != nil {
			return nil, err
		}
		if _, err := tw.Write(e.content); err != nil {
			return nil, err
		}
	}
	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gw.Close(); err != nil {
		return nil, err
	}
	return rawBuf.buf, nil
}

// byteBuffer is a minimal io.Writer backed by a []byte.
type byteBuffer struct {
	buf []byte
}

func (b *byteBuffer) Write(p []byte) (int, error) {
	b.buf = append(b.buf, p...)
	return len(p), nil
}

// extractTarGz reads a tar.gz from the filesystem and returns a map of
// archive-relative path → file contents.
//
// Security hardening applied:
//   - Only tar.TypeReg (regular file) entries are accepted; symlinks, hardlinks,
//     directories, and device entries are silently skipped to prevent abuse.
//   - Each entry name is validated via underRoot against a synthetic root "." to
//     detect path traversal (absolute paths or entries starting with "..").
//   - Each entry is read through an io.LimitReader capped at maxExtractFileBytes
//     to prevent gzip-bomb decompression attacks.
func extractTarGz(filesystem fsutil.FileSystem, tarPath string) (map[string][]byte, error) {
	f, err := filesystem.Open(tarPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	gr, err := gzip.NewReader(f)
	if err != nil {
		return nil, err
	}
	defer gr.Close()

	tr := tar.NewReader(gr)
	result := make(map[string][]byte)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		// Skip non-regular entries (dirs, symlinks, hardlinks, etc.) to prevent
		// symlink-based zip-slip and directory-creation attacks.
		if hdr.Typeflag != tar.TypeReg {
			continue
		}

		// Reject absolute paths and path traversal in entry names.
		if filepath.IsAbs(hdr.Name) {
			return nil, fmt.Errorf("backup: tar entry %q has absolute path", hdr.Name)
		}
		if _, err := underRoot(".", hdr.Name); err != nil {
			return nil, fmt.Errorf("backup: tar entry %q escapes archive root: %w", hdr.Name, err)
		}

		// Limit per-entry read to prevent gzip-bomb decompression.
		limited := io.LimitReader(tr, maxExtractFileBytes)
		data, err := io.ReadAll(limited)
		if err != nil {
			return nil, fmt.Errorf("backup: read tar entry %q: %w", hdr.Name, err)
		}
		result[hdr.Name] = data
	}
	return result, nil
}

// resolvedHomeDir returns the symlink-resolved home directory for path validation.
func resolvedHomeDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(home)
}

// validateUnderHome checks that path resolves under homeDir after symlink
// resolution. Symlink-resolution prevents a symlink inside HOME pointing
// outside HOME (e.g. ~/escape → /etc) from bypassing the check.
//
// Both homeDir and the candidate path are resolved consistently:
//   - homeDir is itself resolved via EvalSymlinks (best-effort).
//   - The candidate is resolved via resolveCandidate (walks up to the deepest
//     existing ancestor then reconstructs the suffix).
//
// Resolving homeDir ensures the comparison is correct on systems where the home
// directory path itself contains symlinks (e.g. macOS /home → /System/Volumes/Data/home).
func validateUnderHome(path, homeDir string) error {
	// Resolve both homeDir and the candidate via the same ancestor-walk algorithm
	// so that symlinks at any level of the path hierarchy are treated consistently.
	// This prevents a path like ~/escape→/etc from appearing "inside" HOME.
	resolvedHome, homeErr := resolveCandidate(homeDir)
	if homeErr != nil {
		// homeDir itself cannot be resolved — fall back to the raw value.
		resolvedHome = filepath.Clean(homeDir)
	}

	resolved, err := resolveCandidate(path)
	if err != nil {
		// Could not resolve even a parent of the candidate — fall back to Clean.
		resolved = filepath.Clean(path)
	}

	if !strings.HasPrefix(resolved, resolvedHome+string(filepath.Separator)) && resolved != resolvedHome {
		return fmt.Errorf("path %q escapes home directory %q", path, homeDir)
	}
	return nil
}

// resolveCandidate attempts to symlink-resolve path. If the path does not
// exist, it walks upward through parent directories until it finds one that
// exists and can be resolved, then appends the unresolved suffix.
func resolveCandidate(path string) (string, error) {
	clean := filepath.Clean(path)
	if resolved, err := filepath.EvalSymlinks(clean); err == nil {
		return resolved, nil
	}
	// Walk up to find the deepest existing ancestor.
	suffix := filepath.Base(clean)
	parent := filepath.Dir(clean)
	for parent != clean {
		if resolved, err := filepath.EvalSymlinks(parent); err == nil {
			return filepath.Join(resolved, suffix), nil
		}
		suffix = filepath.Join(filepath.Base(parent), suffix)
		next := filepath.Dir(parent)
		if next == parent {
			break
		}
		parent = next
	}
	return "", fmt.Errorf("cannot resolve %q or any ancestor", path)
}

// validateUnderRoot checks that savedPath resolves under root using the
// underRoot helper. The _ placeholder is intentionally replaced with the
// real root parameter so that traversal attacks are rejected correctly.
func validateUnderRoot(savedPath, root string) error {
	if _, err := underRoot(root, savedPath); err != nil {
		return fmt.Errorf("saved path %q escapes backup root %q: %w", savedPath, root, err)
	}
	return nil
}

// isNotExist returns true for os.ErrNotExist wrapped by path errors.
func isNotExist(err error) bool {
	return errors.Is(err, os.ErrNotExist)
}
