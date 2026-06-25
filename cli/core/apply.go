package core

import (
	"fmt"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// ApplyResult is the outcome of a successful Apply call.
type ApplyResult struct {
	// Changes holds every write that was applied, in order.
	Changes []harness.Change
	// SnapshotID is the ID of the backup snapshot taken before any writes.
	SnapshotID backup.SnapshotID
}

// Apply implements the transactional apply algorithm described in ADR-5:
//
//  1. Snapshot: call store.Snapshot on the paths listed in each target's SnapPath.
//  2. Apply: iterate ComponentTargets and execute each WriterOp.
//     Collect Change records.
//  3. On ANY failure: call store.Restore(snapshotID) to roll back all
//     already-written files and delete files created during this plan.
//     Return a wrapped error naming the failing target.
//  4. On success: call store.Prune(DefaultRetentionCount).
//
// Skipped targets (ComponentTarget.Skip == true) are silently ignored.
// The fs parameter is threaded through for future use by write ops.
func Apply(plan InstallPlan, fs fsutil.FileSystem, store *backup.Store, binaryVersion string) (ApplyResult, error) {
	// --- Phase 1: collect snapshot targets ---
	var snapTargets []backup.SnapshotTarget
	for _, t := range plan.Targets {
		if t.Skip || t.Op == nil {
			continue
		}
		// SnapPath is the file path this op will write; it may be empty for
		// ops that don't know their path at plan time (e.g. multi-file ops in
		// later slices). Only non-empty paths are included in the pre-snapshot.
		if t.SnapPath != "" {
			snapTargets = append(snapTargets, backup.SnapshotTarget{
				Harness:  t.Harness.Name(),
				OrigPath: t.SnapPath,
			})
		}
	}

	// Take the backup snapshot (even if snapTargets is empty — zero-file snapshot
	// still produces a valid dedup-able record per gotcha #5).
	snapshotID, err := store.Snapshot(snapTargets, binaryVersion, backup.SourceInstall)
	if err != nil {
		return ApplyResult{}, fmt.Errorf("apply: snapshot: %w", err)
	}

	// --- Phase 2: execute writes ---
	var applied []harness.Change
	for _, t := range plan.Targets {
		if t.Skip || t.Op == nil {
			continue
		}

		change, err := t.Op()
		if err != nil {
			// --- Phase 3: rollback ---
			rollbackErr := store.Restore(snapshotID)
			if rollbackErr != nil {
				// Both the write and the rollback failed. Return a combined error.
				return ApplyResult{}, fmt.Errorf(
					"apply: write %s/%s failed (%w); rollback also failed: %v",
					t.Harness.Name(), t.Component.String(), err, rollbackErr,
				)
			}
			return ApplyResult{}, fmt.Errorf(
				"apply: write %s/%s: %w (rolled back)",
				t.Harness.Name(), t.Component.String(), err,
			)
		}
		applied = append(applied, change)
	}

	// --- Phase 4: prune old snapshots ---
	_ = store.Prune(backup.DefaultRetentionCount) // best-effort; do not fail apply on prune error

	return ApplyResult{
		Changes:    applied,
		SnapshotID: snapshotID,
	}, nil
}
