// Package core — project_paths.go
//
// Project-scoped backup/state rooting (design #917's Q1 resolution): the
// project installer gets its OWN self-contained backup dir and state file,
// rooted at the project directory instead of $HOME, mirroring the global
// installer's self-contained pattern (see cmd/install.go's
// filepath.Join(home, ".ui-craft-backups") / filepath.Join(home, ".ui-craft")
// call sites) but with zero shared state between global and project installs.
//
// This file is additive: it introduces NEW functions for the NEW
// project-install code path. It does not modify any existing home-rooted
// call site (cmd/install.go, cmd/update.go, cmd/uninstall.go, tui/app.go,
// tui/hub_backups.go, tui/hub_uninstall.go all continue constructing their
// stores/state exactly as before).
package core

import (
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// ProjectBackupRoot returns the project-local backup directory:
// <projectRoot>/.ui-craft-backups/. This is the project-install analogue of
// the global installer's filepath.Join(home, ".ui-craft-backups").
func ProjectBackupRoot(projectRoot string) string {
	return filepath.Join(projectRoot, ".ui-craft-backups")
}

// ProjectStateRoot returns the project-local state directory:
// <projectRoot>/.ui-craft/ (state.json lives inside, via SaveState/LoadState's
// existing <root>/state.json convention). This is the project-install
// analogue of the global installer's filepath.Join(home, ".ui-craft").
func ProjectStateRoot(projectRoot string) string {
	return filepath.Join(projectRoot, ".ui-craft")
}

// NewProjectBackupStore constructs a backup.Store rooted at
// ProjectBackupRoot(projectRoot), scoped so that Store.Restore's built-in
// path-escape security check treats projectRoot (not $HOME) as the trust
// boundary.
//
// This matters because backup.Store.Restore validates every snapshotted
// OrigPath resolves under os.UserHomeDir() by default (see
// backup.NewStore's doc comment and Store.Restore's security check) — a
// project install writes to paths under an arbitrary project directory,
// which is not guaranteed to be under $HOME (and per the spec's Global
// Installer Non-Regression requirement, must never depend on $HOME at all).
// backup.NewStoreWithHome's injectable homeResolver seam exists for exactly
// this: passing a resolver that returns projectRoot instead of the real home
// directory makes every project-local OrigPath validate correctly, while the
// global installer's stores (constructed via backup.NewStore, unchanged)
// keep validating against the real $HOME.
//
// If clock is nil, time.Now is used (same default as backup.NewStore).
func NewProjectBackupStore(projectRoot string, filesystem fsutil.FileSystem, clock backup.Clock) *backup.Store {
	root := ProjectBackupRoot(projectRoot)
	homeResolver := func() (string, error) {
		// EvalSymlinks requires the path to exist. At the time Restore calls
		// this resolver, projectRoot should already exist (it's the cwd/--dir
		// the user is installing into), but fall back to the raw Clean'd path
		// rather than erroring out entirely — validateUnderHome (backup
		// package) applies the same ancestor-walk fallback internally for its
		// own resolution failures, so mirroring that here keeps behavior
		// consistent instead of hard-failing Restore on a resolver error.
		resolved, err := filepath.EvalSymlinks(projectRoot)
		if err != nil {
			return filepath.Clean(projectRoot), nil
		}
		return resolved, nil
	}
	return backup.NewStoreWithHome(root, filesystem, clock, homeResolver)
}
