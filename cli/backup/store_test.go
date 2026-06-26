package backup_test

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// fixedClock returns a Clock that always returns t.
func fixedClock(t time.Time) backup.Clock {
	return func() time.Time { return t }
}

// fakeHome is the test home directory used to avoid real path resolution.
const fakeHome = "/home/user"

// fakeHomeResolver always returns fakeHome so that paths under /home/user pass
// the path-escape validation in Restore.
func fakeHomeResolver() (string, error) {
	return fakeHome, nil
}

// testStore builds a Store on an in-memory FS with a fixed clock and fake home.
func testStore(root string, mem *fsutil.MemFS, t time.Time) *backup.Store {
	return backup.NewStoreWithHome(root, mem, fixedClock(t), fakeHomeResolver)
}

// newStore creates a Store with fakeHomeResolver (use instead of backup.NewStore in tests).
func newStore(root string, mem *fsutil.MemFS, clk backup.Clock) *backup.Store {
	return backup.NewStoreWithHome(root, mem, clk, fakeHomeResolver)
}

// seed writes a file to a MemFS.
func seed(mem *fsutil.MemFS, path, content string) {
	_ = mem.MkdirAll(filepath.Dir(path), 0o750)
	_ = mem.WriteFile(path, []byte(content), 0o640)
}

// TestSnapshot_roundtrip verifies that a snapshot can be restored byte-for-byte.
// fakeHomeResolver is injected so Restore path validation accepts /home/user paths
// on all platforms (CI, macOS, Linux) without depending on the real OS home dir.
func TestSnapshot_roundtrip(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	home := "/home/user"

	origFile := filepath.Join(home, ".claude", "mcp.json")
	origContent := `{"mcpServers":{"other-tool":{}}}`
	seed(mem, origFile, origContent)

	_ = mem.MkdirAll(root, 0o750)
	store := testStore(root, mem, time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))

	targets := []backup.SnapshotTarget{
		{Harness: "claude", OrigPath: origFile},
	}
	id, err := store.Snapshot(targets, "v1.0.0", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}
	if id == "" {
		t.Fatal("expected non-empty snapshot ID")
	}

	// Overwrite the original file to prove restore works.
	_ = mem.WriteFile(origFile, []byte("corrupted"), 0o640)

	// Restore MUST succeed: testStore injects fakeHomeResolver so that
	// /home/user paths are accepted regardless of the real OS home directory.
	if err := store.Restore(id); err != nil {
		t.Fatalf("Restore failed: %v", err)
	}

	restored, err := mem.ReadFile(origFile)
	if err != nil {
		t.Fatalf("read restored file: %v", err)
	}
	if string(restored) != origContent {
		t.Errorf("restored content = %q; want %q", restored, origContent)
	}
}

// TestIsDuplicate_emptyContent verifies that two consecutive snapshots of
// zero files return the same ID (dedup via SHA-256 of empty string).
func TestIsDuplicate_emptyContent(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	_ = mem.MkdirAll(root, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	store1 := newStore(root, mem, fixedClock(baseTime))

	// First snapshot: no targets → zero-file backup.
	id1, err := store1.Snapshot(nil, "v1.0.0", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot 1: %v", err)
	}

	// Second snapshot with a different clock (different timestamp) but same content.
	store2 := newStore(root, mem, fixedClock(baseTime.Add(time.Hour)))
	id2, err := store2.Snapshot(nil, "v1.0.0", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot 2: %v", err)
	}

	if id1 != id2 {
		t.Errorf("expected dedup: id1=%s id2=%s should be equal", id1, id2)
	}
}

// TestIsDuplicate_differentContent verifies that two snapshots with different
// file content produce different IDs (no false dedup).
func TestIsDuplicate_differentContent(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(root, 0o750)

	file := filepath.Join(home, "file.txt")
	seed(mem, file, "content-A")

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	store1 := newStore(root, mem, fixedClock(baseTime))

	targets := []backup.SnapshotTarget{{Harness: "h", OrigPath: file}}
	id1, err := store1.Snapshot(targets, "v1", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot 1: %v", err)
	}

	// Change file content and snapshot again.
	_ = mem.WriteFile(file, []byte("content-B"), 0o640)
	store2 := newStore(root, mem, fixedClock(baseTime.Add(time.Hour)))
	id2, err := store2.Snapshot(targets, "v1", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot 2: %v", err)
	}

	if id1 == id2 {
		t.Error("expected different IDs for different content; got the same")
	}
}

// TestPrune_keepsMax5 verifies that Prune keeps the 5 most-recent unpinned
// snapshots and deletes the rest.
func TestPrune_keepsMax5(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	_ = mem.MkdirAll(root, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	// Create 8 unique snapshots (different content = different checksums).
	var ids []backup.SnapshotID
	for i := 0; i < 8; i++ {
		file := fmt.Sprintf("/home/user/file%d.txt", i)
		seed(mem, file, fmt.Sprintf("content-%d", i))
		clk := fixedClock(baseTime.Add(time.Duration(i) * time.Hour))
		store := newStore(root, mem, clk)
		targets := []backup.SnapshotTarget{{Harness: "h", OrigPath: file}}
		id, err := store.Snapshot(targets, "v1", backup.SourceInstall)
		if err != nil {
			t.Fatalf("Snapshot %d: %v", i, err)
		}
		ids = append(ids, id)
	}

	// Use the latest store reference for Prune.
	finalStore := newStore(root, mem, fixedClock(baseTime.Add(8*time.Hour)))
	if err := finalStore.Prune(5); err != nil {
		t.Fatalf("Prune: %v", err)
	}

	metas, err := finalStore.List()
	if err != nil {
		t.Fatalf("List after prune: %v", err)
	}
	if len(metas) != 5 {
		t.Errorf("after Prune(5): got %d snapshots, want 5", len(metas))
	}

	// The oldest 3 (ids[0..2]) should be gone; newest 5 (ids[3..7]) should remain.
	remaining := make(map[backup.SnapshotID]bool)
	for _, m := range metas {
		remaining[m.ID] = true
	}
	for i := 0; i < 3; i++ {
		if remaining[ids[i]] {
			t.Errorf("snapshot %d (oldest) should have been pruned but still present", i)
		}
	}
	for i := 3; i < 8; i++ {
		if !remaining[ids[i]] {
			t.Errorf("snapshot %d should remain after prune but was deleted", i)
		}
	}
	_ = ids
}

// TestPrune_neverDeletesPinned verifies that Prune never removes pinned snapshots
// even when they are older than the retention window.
func TestPrune_neverDeletesPinned(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	_ = mem.MkdirAll(root, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	// Create the pinned snapshot first (oldest).
	file0 := "/home/user/file0.txt"
	seed(mem, file0, "pinned-content")
	store0 := newStore(root, mem, fixedClock(baseTime))
	targets0 := []backup.SnapshotTarget{{Harness: "h", OrigPath: file0}}
	pinnedID, err := store0.Snapshot(targets0, "v1", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot pinned: %v", err)
	}
	if err := store0.Pin(pinnedID); err != nil {
		t.Fatalf("Pin: %v", err)
	}

	// Create 6 more unpinned snapshots.
	for i := 1; i <= 6; i++ {
		file := fmt.Sprintf("/home/user/file%d.txt", i)
		seed(mem, file, fmt.Sprintf("content-%d", i))
		clk := fixedClock(baseTime.Add(time.Duration(i) * time.Hour))
		st := newStore(root, mem, clk)
		targets := []backup.SnapshotTarget{{Harness: "h", OrigPath: file}}
		if _, err := st.Snapshot(targets, "v1", backup.SourceInstall); err != nil {
			t.Fatalf("Snapshot %d: %v", i, err)
		}
	}

	finalStore := newStore(root, mem, fixedClock(baseTime.Add(7*time.Hour)))
	if err := finalStore.Prune(5); err != nil {
		t.Fatalf("Prune: %v", err)
	}

	metas, err := finalStore.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}

	// Check the pinned snapshot still exists.
	found := false
	for _, m := range metas {
		if m.ID == pinnedID {
			found = true
			if !m.Pinned {
				t.Error("pinned snapshot lost its pinned flag")
			}
		}
	}
	if !found {
		t.Error("pinned snapshot was deleted by Prune — must never delete pinned")
	}
}

// TestRestore_deletesNewFiles verifies that files with ExistedBefore=false are
// deleted (not just left alone) during rollback/restore.
// fakeHomeResolver is injected via newStore so Restore accepts /home/user paths
// unconditionally — this makes both assertions below unconditional.
func TestRestore_deletesNewFiles(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(root, 0o750)

	// newFile did NOT exist before the plan.
	newFile := filepath.Join(home, "new-file.txt")
	// existingFile existed before the plan.
	existingFile := filepath.Join(home, "existing.txt")
	seed(mem, existingFile, "original content")

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	// newStore injects fakeHomeResolver — Restore MUST succeed for /home/user.
	store := newStore(root, mem, fixedClock(baseTime))

	// Snapshot includes both: existingFile (ExistedBefore=true) and newFile
	// (does not exist yet → ExistedBefore=false tombstone).
	targets := []backup.SnapshotTarget{
		{Harness: "h", OrigPath: existingFile},
		{Harness: "h", OrigPath: newFile},
	}
	id, err := store.Snapshot(targets, "v1", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}

	// Simulate the plan creating newFile and modifying existingFile.
	seed(mem, newFile, "created by plan")
	_ = mem.WriteFile(existingFile, []byte("modified by plan"), 0o640)

	// Restore MUST succeed — fakeHomeResolver ensures path validation passes.
	if err := store.Restore(id); err != nil {
		t.Fatalf("Restore failed: %v", err)
	}

	// newFile MUST be deleted (ExistedBefore=false).
	if _, err := mem.Stat(newFile); err == nil {
		t.Error("newFile (ExistedBefore=false) should be deleted after restore, but still exists")
	}

	// existingFile MUST be restored to original content.
	restored, err := mem.ReadFile(existingFile)
	if err != nil {
		t.Fatalf("read existingFile after restore: %v", err)
	}
	if string(restored) != "original content" {
		t.Errorf("existingFile content = %q; want %q", restored, "original content")
	}
}

// TestRestore_rejectsPathEscape verifies that Restore returns an error when
// a manifest OrigPath escapes the home directory.
func TestRestore_rejectsPathEscape(t *testing.T) {
	// We test validateUnderHome directly since we can't control EvalSymlinks in tests.
	// The path "/etc/passwd" should not be under any normal home directory.

	mem := fsutil.NewMemFS()
	root := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(root, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	store := newStore(root, mem, fixedClock(baseTime))

	// Create an existing file to snapshot (we need at least one real file in the
	// manifest to exercise path validation during restore).
	legitFile := filepath.Join(home, "config.json")
	seed(mem, legitFile, "content")

	targets := []backup.SnapshotTarget{
		{Harness: "h", OrigPath: legitFile},
	}
	id, err := store.Snapshot(targets, "v1", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}

	// Tamper: overwrite the manifest with a path that escapes home.
	snapDir := filepath.Join(root, string(id))
	manifestPath := filepath.Join(snapDir, "manifest.json")
	data, _ := mem.ReadFile(manifestPath)

	// Inject an escape path into the manifest JSON.
	escaped := string(data)
	escaped = replaceFirst(escaped, legitFile, "/etc/passwd")
	_ = mem.WriteFile(manifestPath, []byte(escaped), 0o640)

	// Restore must reject the tampered path.
	err = store.Restore(id)
	if err == nil {
		t.Error("Restore should have returned an error for path escaping home dir")
	}
}

// replaceFirst replaces the first occurrence of old with new in s.
func replaceFirst(s, old, newStr string) string {
	idx := len(s)
	for i := 0; i <= len(s)-len(old); i++ {
		if s[i:i+len(old)] == old {
			idx = i
			break
		}
	}
	if idx == len(s) {
		return s
	}
	return s[:idx] + newStr + s[idx+len(old):]
}

// TestList_sortedNewestFirst verifies List() returns snapshots newest-first.
func TestList_sortedNewestFirst(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	_ = mem.MkdirAll(root, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	var wantOrder []backup.SnapshotID
	for i := 0; i < 3; i++ {
		file := fmt.Sprintf("/home/user/f%d.txt", i)
		seed(mem, file, fmt.Sprintf("v%d", i))
		clk := fixedClock(baseTime.Add(time.Duration(i) * time.Hour))
		st := newStore(root, mem, clk)
		id, err := st.Snapshot(
			[]backup.SnapshotTarget{{Harness: "h", OrigPath: file}},
			"v1", backup.SourceInstall,
		)
		if err != nil {
			t.Fatalf("Snapshot %d: %v", i, err)
		}
		wantOrder = append([]backup.SnapshotID{id}, wantOrder...) // prepend = newest first
	}

	finalStore := newStore(root, mem, fixedClock(baseTime.Add(4*time.Hour)))
	metas, err := finalStore.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(metas) != 3 {
		t.Fatalf("List: got %d, want 3", len(metas))
	}
	for i, m := range metas {
		if m.ID != wantOrder[i] {
			t.Errorf("position %d: got %s, want %s", i, m.ID, wantOrder[i])
		}
	}
}

// TestSnapshot_tombstonesNonExistentFiles verifies that files that don't exist
// produce ExistedBefore=false entries in the manifest (tombstones).
func TestSnapshot_tombstonesNonExistentFiles(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	_ = mem.MkdirAll(root, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	store := newStore(root, mem, fixedClock(baseTime))

	// File does not exist — should produce a tombstone.
	targets := []backup.SnapshotTarget{
		{Harness: "h", OrigPath: "/home/user/nonexistent.json"},
	}
	id, err := store.Snapshot(targets, "v1", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}

	// Check manifest directly.
	snapDir := filepath.Join(root, string(id))
	manifestPath := filepath.Join(snapDir, "manifest.json")
	data, err := mem.ReadFile(manifestPath)
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}

	content := string(data)
	if !contains(content, `"existedBefore": false`) {
		t.Errorf("expected existedBefore=false in manifest; got:\n%s", content)
	}
}

// TestPin_unpinCycle verifies Pin and Unpin toggle the flag in the manifest.
func TestPin_unpinCycle(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	_ = mem.MkdirAll(root, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	store := newStore(root, mem, fixedClock(baseTime))

	id, err := store.Snapshot(nil, "v1", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}

	if err := store.Pin(id); err != nil {
		t.Fatalf("Pin: %v", err)
	}
	metas, _ := store.List()
	for _, m := range metas {
		if m.ID == id && !m.Pinned {
			t.Error("expected Pinned=true after Pin()")
		}
	}

	if err := store.Unpin(id); err != nil {
		t.Fatalf("Unpin: %v", err)
	}
	metas, _ = store.List()
	for _, m := range metas {
		if m.ID == id && m.Pinned {
			t.Error("expected Pinned=false after Unpin()")
		}
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsStr(s, sub))
}

func containsStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

// TestPathEscape_validateUnderHome is a unit test for the home-dir validation
// logic using os.UserHomeDir() as the resolved home.
func TestPathEscape_validateUnderHome(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("no user home dir available")
	}
	// Resolve symlinks the same way the store does.
	resolvedHome, err := filepath.EvalSymlinks(home)
	if err != nil {
		t.Skip("EvalSymlinks failed")
	}

	// A path inside home should pass.
	inside := filepath.Join(resolvedHome, ".config", "test.json")
	mem := fsutil.NewMemFS()
	root := filepath.Join(resolvedHome, ".ui-craft-backups-test")
	_ = mem.MkdirAll(root, 0o750)
	seed(mem, inside, "data")
	store := newStore(root, mem, fixedClock(time.Now()))
	_, err = store.Snapshot([]backup.SnapshotTarget{{Harness: "h", OrigPath: inside}}, "v1", backup.SourceManual)
	if err != nil {
		t.Fatalf("snapshot inside home: %v", err)
	}
}

// --- Security regression tests (findings from security review) ---

// TestSecurity_extractTarGz_rejectsTraversal verifies that a crafted tar.gz
// entry named "../../escape" is rejected by Restore and does not write any
// file outside the snapshot directory (zip-slip / path-traversal fix).
func TestSecurity_extractTarGz_rejectsTraversal(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(root, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	store := newStore(root, mem, fixedClock(baseTime))

	// Create a legitimate snapshot first so we have a valid manifest to tamper with.
	legitFile := filepath.Join(home, "legit.json")
	seed(mem, legitFile, "legitimate content")
	targets := []backup.SnapshotTarget{{Harness: "h", OrigPath: legitFile}}
	id, err := store.Snapshot(targets, "v1", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}

	// Craft a malicious tar.gz: the sole entry has a path-traversal name.
	maliciousTar, err := buildMaliciousTarGz("../../escape", []byte("pwned"))
	if err != nil {
		t.Fatalf("build malicious tar: %v", err)
	}

	// Overwrite the snapshot's tar.gz with the malicious archive.
	snapDir := filepath.Join(root, string(id))
	tarPath := filepath.Join(snapDir, "snapshot.tar.gz")
	_ = mem.WriteFile(tarPath, maliciousTar, 0o640)

	// Restore MUST return an error and MUST NOT write /escape.
	err = store.Restore(id)
	if err == nil {
		t.Error("Restore should have returned an error for a traversal tar entry")
	}

	// The traversal target must not exist anywhere in the MemFS.
	if _, statErr := mem.Stat("/escape"); statErr == nil {
		t.Error("traversal target /escape must not have been written")
	}
}

// TestSecurity_rollbackAt_rejectsPathSeparator verifies that a snapshot ID
// containing a path separator or ".." is rejected before Restore is called.
// This tests the validation logic directly via the exported store API.
func TestSecurity_rollbackAt_rejectsPathSeparator(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	_ = mem.MkdirAll(root, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	store := newStore(root, mem, fixedClock(baseTime))

	// Craft IDs that look like path traversal attempts.
	badIDs := []string{
		"../../../etc/passwd",
		"valid-id/../../escape",
		"..dangerous",
		"a/b",
	}
	for _, bad := range badIDs {
		// The store List will not contain these IDs, so Restore returns "not found"
		// or a path-containment error. Either way it must NOT succeed.
		err := store.Restore(backup.SnapshotID(bad))
		if err == nil {
			t.Errorf("Restore(%q) should have failed but succeeded", bad)
		}
	}
}

// TestSecurity_validateUnderHome_rejectsSymlinkOutside verifies that a symlink
// that lives inside HOME but points to a path outside HOME is rejected.
// This test uses the real OS filesystem to create an actual symlink.
func TestSecurity_validateUnderHome_rejectsSymlinkOutside(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("no user home dir available")
	}
	resolvedHome, err := filepath.EvalSymlinks(home)
	if err != nil {
		t.Skip("EvalSymlinks failed")
	}

	// Create a temp directory outside HOME to be the symlink target.
	outsideDir := t.TempDir()
	outsideFile := filepath.Join(outsideDir, "secret.txt")
	if err := os.WriteFile(outsideFile, []byte("secret"), 0o644); err != nil {
		t.Fatalf("write outside file: %v", err)
	}

	// Create a temp dir inside HOME to hold our symlink.
	insideDir, err := os.MkdirTemp(resolvedHome, ".ui-craft-symtest-*")
	if err != nil {
		t.Skipf("cannot create temp dir inside HOME: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(insideDir) })

	// Create a symlink inside HOME → outside file.
	symlinkPath := filepath.Join(insideDir, "escape-link")
	if err := os.Symlink(outsideFile, symlinkPath); err != nil {
		t.Skipf("cannot create symlink: %v", err)
	}

	// Build a store rooted inside HOME (required by validateUnderHome) and
	// try to snapshot the symlink path. Restore will call validateUnderHome on
	// the origPath; after EvalSymlinks it resolves outside HOME and must fail.
	mem := fsutil.NewMemFS()
	backupRoot := filepath.Join(insideDir, "backups")
	_ = mem.MkdirAll(backupRoot, 0o750)

	// Use the real OsFS so Snapshot can actually read the symlink target.
	osStore := backup.NewStore(backupRoot, fsutil.OsFS{}, nil)

	targets := []backup.SnapshotTarget{{Harness: "test", OrigPath: symlinkPath}}
	id, err := osStore.Snapshot(targets, "v1", backup.SourceManual)
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}

	// Restore must reject symlinkPath because EvalSymlinks(symlinkPath) resolves
	// to outsideFile which is outside HOME.
	err = osStore.Restore(id)
	if err == nil {
		t.Error("Restore should have rejected a symlink-inside-HOME pointing outside HOME")
	}
}

// buildMaliciousTarGz creates a gzipped tar archive with a single entry at the
// given (potentially traversal) path — used only in security regression tests.
func buildMaliciousTarGz(entryName string, content []byte) ([]byte, error) {
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gw)

	hdr := &tar.Header{
		Name:     entryName,
		Mode:     0o644,
		Size:     int64(len(content)),
		Typeflag: tar.TypeReg,
	}
	if err := tw.WriteHeader(hdr); err != nil {
		return nil, err
	}
	if _, err := tw.Write(content); err != nil {
		return nil, err
	}
	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// buildTamperedManifest is a helper that reads a manifest from mem, replaces
// the SavedPath of the first file entry, and writes it back. Used in security tests.
func buildTamperedManifest(mem *fsutil.MemFS, manifestPath, newSavedPath string) {
	data, _ := mem.ReadFile(manifestPath)
	var m map[string]interface{}
	_ = json.Unmarshal(data, &m)
	if files, ok := m["files"].([]interface{}); ok && len(files) > 0 {
		if entry, ok := files[0].(map[string]interface{}); ok {
			entry["savedPath"] = newSavedPath
		}
	}
	out, _ := json.MarshalIndent(m, "", "  ")
	_ = mem.WriteFile(manifestPath, out, 0o640)
}

// TestSnapshot_directoryRollback verifies the full directory-snapshot and rollback
// cycle described in the DATA-LOSS fix:
//
//   - Pre-condition: …/skills/ui-craft/old.md exists; …/skills/other-skill/keep.md exists.
//   - Snapshot the ui-craft SUBDIR only (bounded blast radius).
//   - Simulate an install that writes a different set of files under ui-craft/.
//   - Force a rollback (store.Restore).
//   - Assert: ui-craft/ is restored to its prior state (old.md back, install-added
//     files gone), AND other-skill/keep.md is UNTOUCHED.
func TestSnapshot_directoryRollback(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(root, 0o750)

	skillsBase := filepath.Join(home, ".testharness", "skills")
	uicraftDir := filepath.Join(skillsBase, "ui-craft")
	otherSkillDir := filepath.Join(skillsBase, "other-skill")

	// Pre-populate the ui-craft subdir with a file that existed before the install.
	oldFile := filepath.Join(uicraftDir, "old.md")
	seed(mem, oldFile, "# old skill file\n")

	// Plant a sibling skill that must survive rollback.
	keepFile := filepath.Join(otherSkillDir, "keep.md")
	seed(mem, keepFile, "# other skill — must not be touched\n")

	baseTime := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)
	store := newStore(root, mem, fixedClock(baseTime))

	// Snapshot the ui-craft SUBDIR (not the parent skills dir).
	targets := []backup.SnapshotTarget{
		{Harness: "testharness", OrigPath: uicraftDir},
	}
	id, err := store.Snapshot(targets, "v1", backup.SourceInstall)
	if err != nil {
		t.Fatalf("Snapshot directory: %v", err)
	}

	// Simulate install: add a new file, remove old.md (mirror no longer has it).
	newFile := filepath.Join(uicraftDir, "new.md")
	seed(mem, newFile, "# new skill file\n")
	_ = mem.Remove(oldFile)

	// Verify pre-rollback state.
	if _, err := mem.Stat(oldFile); err == nil {
		t.Error("pre-rollback: old.md should be gone (removed by simulated install)")
	}
	if _, err := mem.Stat(newFile); err != nil {
		t.Error("pre-rollback: new.md should exist (created by simulated install)")
	}

	// Force rollback.
	if err := store.Restore(id); err != nil {
		t.Fatalf("Restore: %v", err)
	}

	// Post-rollback assertions.

	// old.md must be restored to its prior content.
	gotOld, err := mem.ReadFile(oldFile)
	if err != nil {
		t.Fatalf("old.md missing after rollback: %v", err)
	}
	if string(gotOld) != "# old skill file\n" {
		t.Errorf("old.md content after rollback = %q; want %q", gotOld, "# old skill file\n")
	}

	// new.md must be deleted (it was created by the install, not pre-existing).
	if _, err := mem.Stat(newFile); err == nil {
		t.Error("new.md (created by install) should be deleted after rollback")
	}

	// other-skill/keep.md must be completely untouched.
	gotKeep, err := mem.ReadFile(keepFile)
	if err != nil {
		t.Fatalf("other-skill/keep.md missing after rollback — sibling skill was clobbered: %v", err)
	}
	if string(gotKeep) != "# other skill — must not be touched\n" {
		t.Errorf("other-skill/keep.md content changed after rollback:\nwant: %q\ngot:  %q",
			"# other skill — must not be touched\n", gotKeep)
	}
}
