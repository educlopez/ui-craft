package core_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestLoadState_corruptedStateJSON_realFS is the real-fs DECISION-POINT test
// for installer-hardening T6. The spec ("Corrupted state.json Handling")
// requires: "the command returns a clear, non-panic error naming the corrupt
// file... AND it does not proceed as if state were empty or valid."
//
// The design doc documented CURRENT behavior as: loadStateLocked (state.go:96)
// silently falls back to an empty state on unmarshal error, with a nil error.
// That contradicts the spec's explicit "MUST NOT proceed as if state were
// empty" requirement. This test asserts the SPEC's requirement, not the
// pre-existing (looser) behavior — per design's guidance, if this is RED,
// it's a genuine spec/behavior gap to fix, not a test-harness artifact.
func TestLoadState_corruptedStateJSON_realFS(t *testing.T) {
	root := t.TempDir()
	statePath := filepath.Join(root, "state.json")
	if err := os.WriteFile(statePath, []byte(`{"schemaVersion":1,"harnesses":[{`), 0o644); err != nil {
		t.Fatal(err)
	}

	fs := fsutil.OsFS{}
	state, err := core.LoadState(fs, root)

	if err == nil {
		t.Fatalf("LoadState on truncated/malformed state.json must return a clear error naming the corrupt file, got nil error and state=%+v", state)
	}
	if !containsPath(err.Error(), statePath) {
		t.Errorf("LoadState error should name the corrupt file path %q; got: %v", statePath, err)
	}
}

// TestLoadState_permissionDeniedRead_realFS covers the sibling sub-scenario:
// a state.json that exists but cannot be read due to permissions. Per spec,
// this must also error clearly rather than silently return empty state.
func TestLoadState_permissionDeniedRead_realFS(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("running as root: chmod-based permission checks are not enforced")
	}

	root := t.TempDir()
	statePath := filepath.Join(root, "state.json")
	if err := os.WriteFile(statePath, []byte(`{"schemaVersion":1}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(statePath, 0o000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(statePath, 0o644) })

	// Verify the permission actually blocks reads on this platform (root/CI
	// quirks); otherwise skip as a test-harness limitation, not a prod bug.
	if _, err := os.ReadFile(statePath); err == nil {
		t.Skip("chmod 0o000 did not block reads on this platform/filesystem — cannot exercise permission-denied read")
	}

	fs := fsutil.OsFS{}
	state, err := core.LoadState(fs, root)

	if err == nil {
		t.Fatalf("LoadState on a permission-denied state.json must return a clear error naming the file, got nil error and state=%+v", state)
	}
	if !containsPath(err.Error(), statePath) {
		t.Errorf("LoadState error should name the file path %q; got: %v", statePath, err)
	}
}

func containsPath(s, substr string) bool {
	return len(s) >= len(substr) && (func() bool {
		for i := 0; i+len(substr) <= len(s); i++ {
			if s[i:i+len(substr)] == substr {
				return true
			}
		}
		return false
	})()
}
