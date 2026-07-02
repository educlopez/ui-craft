package core_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// TestApply_readOnlyWriteTarget_realFS is the real-fs DECISION-POINT test for
// installer-hardening T4. It exercises core.Apply's rollback path when a write
// op fails because its target directory is read-only (EACCES), on a real
// filesystem (not MemFS) — the design doc flagged this path as unverified.
//
// Setup: two targets. Target 1 writes successfully into a normal dir (and is
// snapshotted first, so Restore has something real to roll back). Target 2
// writes into a directory chmod'd 0o500 (read-only), which must fail with a
// permission error. Apply must then:
//   - return a non-panic, actionable error (naming the failing target)
//   - successfully roll back (store.Restore must not itself be defeated by
//     the read-only dir, since Restore only needs to restore target 1's file,
//     which lives in a normal, writable directory)
//   - leave no partially-written file under the read-only directory
func TestApply_readOnlyWriteTarget_realFS(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("running as root: chmod-based permission checks are not enforced")
	}

	home := t.TempDir()
	// Restore validates OrigPath resolves under os.UserHomeDir(); point that at
	// our real tempdir so the security check passes for these real-fs targets.
	t.Setenv("HOME", home)
	backupRoot := filepath.Join(home, ".ui-craft-backups")
	if err := os.MkdirAll(backupRoot, 0o750); err != nil {
		t.Fatal(err)
	}

	// Target 1: a normal, writable file that previously existed with known content.
	normalDir := filepath.Join(home, "normal")
	if err := os.MkdirAll(normalDir, 0o755); err != nil {
		t.Fatal(err)
	}
	file1 := filepath.Join(normalDir, "existing.json")
	originalContent := `{"existing":true}`
	if err := os.WriteFile(file1, []byte(originalContent), 0o644); err != nil {
		t.Fatal(err)
	}

	// Target 2: a read-only directory. The write op targets a file inside it.
	roDir := filepath.Join(home, "readonly")
	if err := os.MkdirAll(roDir, 0o755); err != nil {
		t.Fatal(err)
	}
	file2 := filepath.Join(roDir, "new.json")
	if err := os.Chmod(roDir, 0o500); err != nil {
		t.Fatal(err)
	}
	// Ensure we restore permissions so t.TempDir() cleanup can remove the dir.
	t.Cleanup(func() { _ = os.Chmod(roDir, 0o755) })

	// Verify the permission actually blocks writes on this platform/filesystem;
	// otherwise this is a test-harness artifact, not a production bug (per
	// design's guard: "fix the test, not production code" if Chmod isn't honored).
	probe := filepath.Join(roDir, ".probe")
	if err := os.WriteFile(probe, []byte("x"), 0o644); err == nil {
		_ = os.Remove(probe)
		t.Skip("chmod 0o500 did not block writes on this platform/filesystem — cannot exercise EACCES")
	}

	fs := fsutil.OsFS{}
	store := backup.NewStore(backupRoot, fs, fixedClock(time.Unix(1700000100, 0)))
	h := stubHarness{name: "stub"}

	plan := core.InstallPlan{
		Targets: []core.ComponentTarget{
			{
				Harness:   h,
				Component: component.SkillCommands,
				Op:        makeRealWriteOp(fs, file1, "overwritten"),
				SnapPath:  file1,
			},
			{
				Harness:   h,
				Component: component.MCPGates,
				Op:        makeRealWriteOp(fs, file2, "should-fail"),
				SnapPath:  file2,
			},
		},
	}

	_, err := core.Apply(plan, fs, store, "v1.0.0", false)
	if err == nil {
		t.Fatal("Apply should return an error when a write target is read-only")
	}

	// Must be a clean, actionable error — not a panic (implicit: we got here),
	// and must not be swallowed silently.
	t.Logf("Apply error (expected, actionable): %v", err)

	// file1 must have been restored to its original content — rollback must
	// succeed even though target 2's directory is read-only, because file1
	// itself lives in a normal, writable directory.
	restored, readErr := os.ReadFile(file1)
	if readErr != nil {
		t.Fatalf("file1 not readable after rollback: %v", readErr)
	}
	if string(restored) != originalContent {
		t.Errorf("file1 content after rollback = %q; want %q (rollback must restore pre-install state)", restored, originalContent)
	}

	// file2 must not exist — either the write never landed (EACCES before any
	// bytes were written) or rollback cleaned it up. Either way, no partial or
	// corrupted file may survive under the read-only dir.
	if _, statErr := os.Stat(file2); statErr == nil {
		t.Error("file2 should not exist after a failed write + rollback under a read-only directory")
	} else if !errors.Is(statErr, os.ErrNotExist) {
		t.Errorf("unexpected stat error for file2: %v", statErr)
	}
}

// makeRealWriteOp creates a WriterOp that writes content to path on a real
// filesystem via the fsutil.FileSystem interface (mirrors makeWriteOp's MemFS
// shape from apply_test.go, but for OsFS{}).
func makeRealWriteOp(fs fsutil.FileSystem, path, content string) core.WriterOp {
	return func() (harness.Change, error) {
		prior, readErr := fs.ReadFile(path)
		existed := readErr == nil
		if err := fs.WriteFile(path, []byte(content), 0o640); err != nil {
			return harness.Change{}, err
		}
		return harness.Change{
			FilePath:      path,
			PriorBytes:    prior,
			ExistedBefore: existed,
		}, nil
	}
}
