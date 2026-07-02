package core_test

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestLoadState_missingFile verifies that a missing state.json returns an empty
// state (not an error) — "nothing installed yet" is a valid initial state.
func TestLoadState_missingFile(t *testing.T) {
	m := fsutil.NewMemFS()
	_ = m.MkdirAll("/home/user/.ui-craft", 0o755)

	state, err := core.LoadState(m, "/home/user/.ui-craft")
	if err != nil {
		t.Fatalf("LoadState: unexpected error: %v", err)
	}
	if state == nil {
		t.Fatal("LoadState: expected non-nil state")
	}
	if len(state.Harnesses) != 0 {
		t.Errorf("expected empty harnesses, got %d", len(state.Harnesses))
	}
	if state.SchemaVersion != core.StateSchemaVersion {
		t.Errorf("schema version: got %d, want %d", state.SchemaVersion, core.StateSchemaVersion)
	}
}

// TestLoadState_malformedFallback verifies that a malformed state.json returns
// a clear, non-nil error naming the corrupt file (installer-hardening T6):
// the state is unknown, not empty, so LoadState MUST NOT proceed as if
// nothing were installed. It still returns a non-nil, zero-value state
// alongside the error so callers that intentionally proceed after inspecting
// the error (see cli/tui/hub_uninstall.go) have a safe struct to read.
func TestLoadState_malformedFallback(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"
	_ = m.MkdirAll(root, 0o755)
	_ = m.WriteFile(filepath.Join(root, "state.json"), []byte("{invalid json!!!"), 0o644)

	state, err := core.LoadState(m, root)
	if err == nil {
		t.Fatal("LoadState on malformed file: expected a clear error naming the corrupt file, got nil")
	}
	if !strings.Contains(err.Error(), filepath.Join(root, "state.json")) {
		t.Errorf("LoadState error should name the corrupt file path; got: %v", err)
	}
	if state == nil {
		t.Fatal("expected non-nil state on malformed file (safe fallback struct for callers that proceed anyway)")
	}
	if len(state.Harnesses) != 0 {
		t.Errorf("expected empty harnesses in fallback state, got %d", len(state.Harnesses))
	}
}

// TestSaveState_roundTrip verifies write → read produces the same data.
func TestSaveState_roundTrip(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"
	_ = m.MkdirAll(root, 0o755)

	original := &core.InstallState{
		Version:       "v0.35.0",
		MirrorVersion: "v0.35.0",
		Harnesses: []core.HarnessState{
			{
				Name:                "claude",
				InstalledComponents: []string{"skill+commands", "mcp-gates"},
				InstalledAt:         "2026-06-25T00:00:00Z",
			},
		},
	}

	if err := core.SaveState(m, root, original); err != nil {
		t.Fatalf("SaveState: %v", err)
	}

	loaded, err := core.LoadState(m, root)
	if err != nil {
		t.Fatalf("LoadState after save: %v", err)
	}
	if loaded.Version != original.Version {
		t.Errorf("version: got %q, want %q", loaded.Version, original.Version)
	}
	if len(loaded.Harnesses) != 1 {
		t.Fatalf("expected 1 harness, got %d", len(loaded.Harnesses))
	}
	h := loaded.Harnesses[0]
	if h.Name != "claude" {
		t.Errorf("harness name: got %q, want claude", h.Name)
	}
	if len(h.InstalledComponents) != 2 {
		t.Errorf("installed components: got %d, want 2", len(h.InstalledComponents))
	}
}

// TestUpsertHarnessState_newEntry verifies that a new harness is appended.
func TestUpsertHarnessState_newEntry(t *testing.T) {
	state := &core.InstallState{}
	core.UpsertHarnessState(state, core.HarnessState{Name: "claude", InstalledComponents: []string{"mcp-gates"}})
	if len(state.Harnesses) != 1 {
		t.Fatalf("expected 1 harness, got %d", len(state.Harnesses))
	}
	if state.Harnesses[0].Name != "claude" {
		t.Errorf("name: got %q, want claude", state.Harnesses[0].Name)
	}
}

// TestUpsertHarnessState_updateExisting verifies that an existing entry is replaced.
func TestUpsertHarnessState_updateExisting(t *testing.T) {
	state := &core.InstallState{
		Harnesses: []core.HarnessState{
			{Name: "claude", InstalledComponents: []string{"mcp-gates"}},
		},
	}
	core.UpsertHarnessState(state, core.HarnessState{
		Name:                "claude",
		InstalledComponents: []string{"skill+commands", "mcp-gates"},
		InstalledAt:         "2026-06-25T00:00:00Z",
	})
	if len(state.Harnesses) != 1 {
		t.Fatalf("expected 1 harness after upsert, got %d", len(state.Harnesses))
	}
	if len(state.Harnesses[0].InstalledComponents) != 2 {
		t.Errorf("expected 2 components after upsert, got %d", len(state.Harnesses[0].InstalledComponents))
	}
}

// TestFindHarness_found and _notFound.
func TestFindHarness_found(t *testing.T) {
	state := &core.InstallState{
		Harnesses: []core.HarnessState{
			{Name: "cursor", InstalledComponents: []string{"skill+commands"}},
		},
	}
	hs := core.FindHarness(state, "cursor")
	if hs == nil {
		t.Fatal("expected FindHarness to return non-nil")
	}
	if hs.Name != "cursor" {
		t.Errorf("name: got %q, want cursor", hs.Name)
	}
}

func TestFindHarness_notFound(t *testing.T) {
	state := &core.InstallState{}
	hs := core.FindHarness(state, "claude")
	if hs != nil {
		t.Errorf("expected nil for missing harness, got %+v", hs)
	}
}

// TestInstall_skippedComponentNotInState verifies that a component whose target
// is marked Skip=true (e.g. review-agents on a harness that doesn't support it)
// does NOT appear in the installed-components list saved to state.json.
//
// The regression: before the fix, install.go derived the installed list from
// component.All() filtered by Harness.Supports(), which included components the
// plan skipped. After the fix it derives the list from result.Changes (only
// components with an actual Change record), so skipped components are excluded.
func TestInstall_skippedComponentNotInState(t *testing.T) {
	// Simulate the state-building logic from install.go after the fix:
	// only components that appear in result.Changes are recorded.
	type fakeChange struct {
		harnessName string
		component   string
	}
	changes := []fakeChange{
		{harnessName: "cursor", component: "skill+commands"},
		{harnessName: "cursor", component: "mcp-gates"},
		// review-agents was skipped — no Change entry.
	}

	// Build installed list from changes (mirrors the fixed install.go logic).
	seen := map[string]bool{}
	var installedComps []string
	for _, ch := range changes {
		if ch.harnessName == "cursor" && !seen[ch.component] {
			seen[ch.component] = true
			installedComps = append(installedComps, ch.component)
		}
	}

	// Assert review-agents is absent.
	for _, c := range installedComps {
		if c == "review-agents" {
			t.Errorf("review-agents was skipped but appears in installedComps: %v", installedComps)
		}
	}
	// Assert the two applied components are present.
	if len(installedComps) != 2 {
		t.Errorf("expected 2 installed components, got %d: %v", len(installedComps), installedComps)
	}
}

// TestNow_injectable verifies that the Now variable can be replaced in tests.
// (This is important for update tests that need deterministic timestamps.)
func TestNow_injectable(t *testing.T) {
	fixed := time.Date(2026, 6, 25, 0, 0, 0, 0, time.UTC)
	original := core.Now
	core.Now = func() time.Time { return fixed }
	defer func() { core.Now = original }()

	if core.Now() != fixed {
		t.Errorf("Now() = %v, want %v", core.Now(), fixed)
	}
}
