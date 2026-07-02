// Package core — state.go
// Persists install choices to ~/.ui-craft/state.json so that `ui-craft update`
// can replay the saved harness+component selections at the new embedded-mirror
// version without requiring the user to re-enter choices.
//
// Schema is versioned (StateSchemaVersion); older schemas are loaded as-is and
// re-written with the current schema on the next SaveState call. Malformed or
// missing files are treated as "nothing installed yet" (gotcha #2: never abort).
//
// Adapted from github.com/Gentleman-Programming/gentle-ai §7 state.json pattern (MIT).
package core

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"sync"
	"time"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// stateMu guards all read-modify-write operations on state.json, including
// SaveState and saveUpdateState (the update-check goroutine). Without this lock,
// a concurrent update-check write and an install/update SaveState write can
// produce a lost-update race that go test -race flags.
var stateMu sync.Mutex

// StateSchemaVersion is bumped when the state.json schema changes in a
// backward-incompatible way. Older files are still loaded (fields are additive);
// the version field signals when a re-save is needed.
const StateSchemaVersion = 1

// HarnessState records which components were installed for one harness and
// when they were installed.
type HarnessState struct {
	// Name is the canonical harness name (e.g. "claude", "cursor").
	Name string `json:"name"`
	// InstalledComponents is the ordered list of component names that were
	// selected by the user and successfully applied (e.g. "skill+commands").
	InstalledComponents []string `json:"installedComponents"`
	// InstalledAt is the RFC3339 timestamp of the last successful install or
	// update for this harness.
	InstalledAt string `json:"installedAt"`
}

// InstallState is the root document written to ~/.ui-craft/state.json.
type InstallState struct {
	// SchemaVersion allows future migrations. Always written as StateSchemaVersion.
	SchemaVersion int `json:"schemaVersion"`
	// Version is the binary version that last wrote state (from -X main.version).
	Version string `json:"version"`
	// MirrorVersion is the embedded mirror version that produced the install
	// (from -X main.mirrorVersion, or the embedded VERSION stamp).
	MirrorVersion string `json:"mirrorVersion"`
	// Harnesses contains one entry per harness that has had components installed.
	Harnesses []HarnessState `json:"harnesses"`
	// LastUpdateCheck is the RFC3339 timestamp of the most recent launch-time
	// update check against the GitHub releases API. Used by the 24h TTL gate.
	// Written by CheckForUpdate; omitted when empty (never checked yet).
	LastUpdateCheck string `json:"lastUpdateCheck,omitempty"`
}

// statePath joins root + "state.json".
func statePath(root string) string {
	return filepath.Join(root, "state.json")
}

// Now is the clock function used by SaveState. Tests may replace it.
var Now = time.Now

// LoadState reads the state file at <root>/state.json.
//
// A MISSING file is "nothing installed yet" — a valid initial state — and
// returns a zero-value InstallState with a nil error (gotcha #2: never abort
// just because install has never run).
//
// A file that EXISTS but cannot be read (permission denied, etc.) or cannot
// be parsed (malformed/truncated JSON) is a DIFFERENT situation: the state is
// unknown, not empty. LoadState returns a non-nil error naming statePath(root)
// in that case, alongside a zero-value InstallState (SchemaVersion set) so
// callers that intentionally choose to proceed with an empty state after
// inspecting the error (see cli/tui/hub_uninstall.go's realUninstall /
// realUninstallSnapshot) still get a safe, non-nil struct to read from.
// Callers that ignore the error (`state, _ := LoadState(...)`) keep their
// prior "nothing installed" fallback behavior, but now silently mask a real
// problem — see apply-progress for the installer-hardening change for the
// audit of every call site and why each one is safe to leave as-is or was
// already handling this error path.
func LoadState(filesystem fsutil.FileSystem, root string) (*InstallState, error) {
	stateMu.Lock()
	defer stateMu.Unlock()
	return loadStateLocked(filesystem, root)
}

// loadStateLocked is the lock-free inner read, callable by callers that already
// hold stateMu (e.g. SaveState, which reads-then-writes atomically).
func loadStateLocked(filesystem fsutil.FileSystem, root string) (*InstallState, error) {
	p := statePath(root)
	data, err := filesystem.ReadFile(p)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			// Missing file → empty state, not an error.
			return &InstallState{SchemaVersion: StateSchemaVersion}, nil
		}
		// Any other read error (permission, etc.) → the file exists but we
		// could not read it. This is NOT "nothing installed yet" — surface a
		// clear, named error so callers can decide how to proceed instead of
		// silently trusting an empty state as if it were valid.
		return &InstallState{SchemaVersion: StateSchemaVersion},
			fmt.Errorf("core: read state file %s: %w", p, err)
	}

	var state InstallState
	if err := json.Unmarshal(data, &state); err != nil {
		// Malformed/truncated JSON → the file exists and was read, but its
		// content is not valid state. Surface a clear, named error rather
		// than silently falling back to empty state (spec: "MUST NOT proceed
		// as if state were empty or valid").
		return &InstallState{SchemaVersion: StateSchemaVersion},
			fmt.Errorf("core: parse state file %s: %w", p, err)
	}

	return &state, nil
}

// SaveState writes the state to <root>/state.json using WriteFileAtomic.
// It creates the directory if needed. A non-nil error means the write failed;
// the caller should log it but not abort (state.json is advisory, not critical).
func SaveState(filesystem fsutil.FileSystem, root string, state *InstallState) error {
	stateMu.Lock()
	defer stateMu.Unlock()

	// Ensure the directory exists.
	if err := filesystem.MkdirAll(root, 0o755); err != nil {
		return err
	}

	state.SchemaVersion = StateSchemaVersion

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	_, err = fsutil.WriteFileAtomic(filesystem, statePath(root), data, 0o644)
	return err
}

// UpsertHarnessState merges a new HarnessState into the existing slice.
// If an entry for the harness already exists it is replaced; otherwise it
// is appended. The slice order is stable (existing entries keep their index).
func UpsertHarnessState(state *InstallState, hs HarnessState) {
	for i, existing := range state.Harnesses {
		if existing.Name == hs.Name {
			state.Harnesses[i] = hs
			return
		}
	}
	state.Harnesses = append(state.Harnesses, hs)
}

// FindHarness returns the HarnessState for the given harness name, or nil if
// not found. The returned pointer is a copy; modifications do not affect state.
func FindHarness(state *InstallState, name string) *HarnessState {
	for i := range state.Harnesses {
		if state.Harnesses[i].Name == name {
			cp := state.Harnesses[i]
			return &cp
		}
	}
	return nil
}
