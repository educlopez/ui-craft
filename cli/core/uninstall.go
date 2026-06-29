// Package core — shared uninstall entry point.
//
// Uninstall encapsulates the filesystem-level removal operations so that BOTH
// the cobra uninstall command and the upcoming TUI Uninstall screen call the
// same code without duplication.
//
// The full harness-specific dispatch (MCP config edits, embedded FS skill
// enumeration, state.json updates, backup snapshot creation) is orchestrated
// by the caller (cmd/uninstall.go or TUI screen) because those concerns touch
// cobra flags, harness types, and OS-level backup stores that live outside
// core.  core.Uninstall handles the pure filesystem operations:
//   - Remove the ui-craft skill directory under SkillsDir
//   - Optionally remove design-memory (.ui-craft/) under ProjectDir
//   - Call SnapshotFn before any removal so the caller can create a backup
//   - Return an UninstallReport with the snapshot ID and removed paths
package core

import (
	"fmt"
	"io"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// ─── Types ────────────────────────────────────────────────────────────────────

// UninstallOpts carries all parameters for core.Uninstall.
type UninstallOpts struct {
	// HomeDir is the user's home directory (e.g. "/home/user").
	HomeDir string

	// SkillsDir is the absolute path to the skills directory for the targeted
	// harness (e.g. "/home/user/.claude/skills").  The "ui-craft" subdirectory
	// inside it will be removed.
	SkillsDir string

	// ProjectDir is the project root, used to locate .ui-craft/ design-memory.
	// Optional — only needed when RemoveDesignMemory is true.
	ProjectDir string

	// RemoveDesignMemory controls whether the .ui-craft/ directory under
	// ProjectDir is deleted.  Default false: design-memory is preserved.
	RemoveDesignMemory bool

	// SnapshotFn is called BEFORE any removal to create a backup snapshot.
	// It returns the snapshot ID (used in UninstallReport) or an error.
	// When nil, no snapshot is created and SnapshotID will be empty.
	SnapshotFn func() (string, error)

	// Output receives progress messages. Pass io.Discard to suppress all output.
	Output io.Writer
}

// UninstallReport summarises what core.Uninstall did.
type UninstallReport struct {
	// SnapshotID is the backup snapshot ID returned by SnapshotFn, or empty
	// if no snapshot was created.
	SnapshotID string

	// RemovedPaths lists the filesystem paths that were actually removed.
	RemovedPaths []string
}

// ─── Uninstall ────────────────────────────────────────────────────────────────

// Uninstall performs the filesystem-level removal of ui-craft artefacts.
// It operates entirely over the provided FileSystem so tests can pass a
// fsutil.MemFS without touching the real OS filesystem.
func Uninstall(opts UninstallOpts, fs fsutil.FileSystem) (UninstallReport, error) {
	if opts.Output == nil {
		opts.Output = io.Discard
	}

	var report UninstallReport

	// 1. Snapshot before any removal.
	if opts.SnapshotFn != nil {
		snapID, err := opts.SnapshotFn()
		if err != nil {
			return report, fmt.Errorf("uninstall: snapshot failed: %w", err)
		}
		report.SnapshotID = snapID
		fmt.Fprintf(opts.Output, "Snapshot created: %s\n", snapID)
	}

	// 2. Remove owned skill directory.
	if opts.SkillsDir != "" {
		uiCraftSkillDir := filepath.Join(opts.SkillsDir, "ui-craft")
		if filepath.IsAbs(uiCraftSkillDir) {
			if _, statErr := fs.Stat(uiCraftSkillDir); statErr == nil {
				if err := fs.RemoveAll(uiCraftSkillDir); err != nil {
					fmt.Fprintf(opts.Output, "  skill+commands: error removing %s: %v\n", uiCraftSkillDir, err)
				} else {
					report.RemovedPaths = append(report.RemovedPaths, uiCraftSkillDir)
					fmt.Fprintf(opts.Output, "  skill+commands: removed %s\n", uiCraftSkillDir)
				}
			}
		}
	}

	// 3. Optionally remove design-memory.
	if opts.RemoveDesignMemory && opts.ProjectDir != "" {
		dmDir := filepath.Join(opts.ProjectDir, ".ui-craft")
		if filepath.IsAbs(dmDir) {
			if _, statErr := fs.Stat(dmDir); statErr == nil {
				if err := fs.RemoveAll(dmDir); err != nil {
					fmt.Fprintf(opts.Output, "  design-memory: error removing %s: %v\n", dmDir, err)
				} else {
					report.RemovedPaths = append(report.RemovedPaths, dmDir)
					fmt.Fprintf(opts.Output, "  design-memory: removed %s\n", dmDir)
				}
			}
		}
	}

	return report, nil
}
