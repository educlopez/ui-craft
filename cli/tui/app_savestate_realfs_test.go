package tui

// app_savestate_realfs_test.go is the real-filesystem (t.TempDir(), OsFS{} —
// not MemFS/fakes) test for runApplyCmd's SaveState parity with
// cmd/install.go's Slice-10 block (design #927, tasks #928 T1-T3).
//
// It builds a real (non-fake) []core.DetectedHarness fixture — the same
// pattern used by core/apply_project_realfs_test.go — because the fake
// DetectedHarness/harness adapters used elsewhere in this package
// (tui_test.go's detectedFake/fakeHarnessAdapter) stub Write* with
// ErrNotImplemented and are unsuitable for a real end-to-end core.Apply run.

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// buildRealDetectedHarnesses returns a []core.DetectedHarness covering every
// known harness, marked as installed, mirroring
// core/apply_project_realfs_test.go's fixture builder.
func buildRealDetectedHarnesses() []core.DetectedHarness {
	var detected []core.DetectedHarness
	for _, h := range harness.All() {
		detected = append(detected, core.DetectedHarness{
			Harness: h,
			Result:  harness.DetectResult{Installed: true},
		})
	}
	return detected
}

func TestRunApplyCmd_GlobalScope_WritesState(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	// Pin the clock so InstalledAt is deterministic.
	fixed := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	orig := core.Now
	core.Now = func() time.Time { return fixed }
	t.Cleanup(func() { core.Now = orig })

	m := NewAppModel("v1.0.0-test", t.TempDir())
	m.selected = buildRealDetectedHarnesses()
	m.components = component.All()
	m.installScope = core.Global
	m.applyOverride = nil

	cmd := m.runApplyCmd()
	msg := cmd()

	result, ok := msg.(ApplyResultMsg)
	if !ok {
		t.Fatalf("expected ApplyResultMsg, got %T", msg)
	}
	if result.Err != nil {
		t.Fatalf("expected no error, got: %v", result.Err)
	}

	statePath := filepath.Join(home, ".ui-craft", "state.json")
	if _, err := os.Stat(statePath); err != nil {
		t.Fatalf("expected state.json to exist at %s: %v", statePath, err)
	}

	stateRoot := filepath.Join(home, ".ui-craft")
	state, err := core.LoadState(fsutil.OsFS{}, stateRoot)
	if err != nil {
		t.Fatalf("LoadState failed: %v", err)
	}
	if state.Version != "v1.0.0-test" {
		t.Errorf("Version: got %q, want %q", state.Version, "v1.0.0-test")
	}
	if state.SchemaVersion != core.StateSchemaVersion {
		t.Errorf("SchemaVersion: got %d, want %d", state.SchemaVersion, core.StateSchemaVersion)
	}
	if len(state.Harnesses) == 0 {
		t.Fatal("expected at least one harness in state")
	}
	wantInstalledAt := fixed.UTC().Format("2006-01-02T15:04:05Z07:00")
	for _, hs := range state.Harnesses {
		if len(hs.InstalledComponents) == 0 {
			t.Errorf("harness %s: expected non-empty InstalledComponents", hs.Name)
		}
		if hs.InstalledAt != wantInstalledAt {
			t.Errorf("harness %s: InstalledAt got %q, want %q", hs.Name, hs.InstalledAt, wantInstalledAt)
		}
	}
}

func TestRunApplyCmd_ProjectScope_WritesStateAtProjectRoot(t *testing.T) {
	projectDir := t.TempDir()
	homeDir := t.TempDir()
	t.Setenv("HOME", homeDir)

	fixed := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	orig := core.Now
	core.Now = func() time.Time { return fixed }
	t.Cleanup(func() { core.Now = orig })

	m := NewAppModel("v1.0.0-test", projectDir)
	m.selected = buildRealDetectedHarnesses()
	m.components = component.All()
	m.installScope = core.Project
	m.applyOverride = nil

	cmd := m.runApplyCmd()
	msg := cmd()

	result, ok := msg.(ApplyResultMsg)
	if !ok {
		t.Fatalf("expected ApplyResultMsg, got %T", msg)
	}
	if result.Err != nil {
		t.Fatalf("expected no error, got: %v", result.Err)
	}

	projectStatePath := filepath.Join(core.ProjectStateRoot(projectDir), "state.json")
	if _, err := os.Stat(projectStatePath); err != nil {
		t.Fatalf("expected project state.json to exist at %s: %v", projectStatePath, err)
	}

	state, err := core.LoadState(fsutil.OsFS{}, core.ProjectStateRoot(projectDir))
	if err != nil {
		t.Fatalf("LoadState failed: %v", err)
	}
	if len(state.Harnesses) == 0 {
		t.Fatal("expected at least one harness in project state")
	}

	// Regression guard: no cross-scope leakage into the global state root.
	globalStatePath := filepath.Join(homeDir, ".ui-craft", "state.json")
	if _, err := os.Stat(globalStatePath); err == nil {
		t.Fatalf("expected NO state.json under global HOME %s, but it exists", globalStatePath)
	} else if !os.IsNotExist(err) {
		t.Fatalf("unexpected error checking global state.json: %v", err)
	}
}

func TestRunApplyCmd_OverridePath_SkipsSaveState(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	m := NewAppModel("v1.0.0-test", t.TempDir())
	m.selected = buildRealDetectedHarnesses()
	m.components = component.All()
	m.installScope = core.Global
	m.applyOverride = func(plan core.InstallPlan) ([]harness.Change, error) {
		return []harness.Change{{HarnessName: "x", Component: "y"}}, nil
	}

	cmd := m.runApplyCmd()
	msg := cmd()

	result, ok := msg.(ApplyResultMsg)
	if !ok {
		t.Fatalf("expected ApplyResultMsg, got %T", msg)
	}
	if result.Err != nil {
		t.Fatalf("expected no error, got: %v", result.Err)
	}
	if len(result.Changes) != 1 || result.Changes[0].HarnessName != "x" {
		t.Fatalf("expected canned override changes, got: %+v", result.Changes)
	}

	statePath := filepath.Join(home, ".ui-craft", "state.json")
	if _, err := os.Stat(statePath); err == nil {
		t.Fatalf("expected NO state.json to be created via override branch, but it exists at %s", statePath)
	} else if !os.IsNotExist(err) {
		t.Fatalf("unexpected error checking state.json: %v", err)
	}
}
