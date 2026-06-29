package harness

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// writeFlatMDToDir writes every .md file in commandsFS flat into destDir on the
// target filesystem. It is the counterpart to writeAgentsToDir but also performs
// scoped stale-file cleanup: command files present in destDir that are NOT in
// commandsFS are removed, so stale commands from old installs don't accumulate.
//
// "Flat" means no subdirectories are created — each <name>.md in commandsFS
// maps to destDir/<name>.md. Files in commandsFS that are not .md are skipped.
// Placeholder files (.gitkeep) are also skipped.
//
// The CLI has full-file ownership of each command file it writes; files in
// destDir with names that do NOT appear in commandsFS are removed (scoped
// stale cleanup). User files that were never in commandsFS are never touched
// because the keepSet is derived from commandsFS, not from destDir.
//
// Returns one Change per .md file acted on. Idempotent: a re-run where the
// content is unchanged produces Changed:false for each file, satisfying the
// idempotency requirement.
func writeFlatMDToDir(w fsutil.FileSystem, commandsFS fs.FS, destDir, harnessName string) ([]Change, error) {
	// --- Step 1: enumerate files from commandsFS to build the keepSet ---
	// keepSet maps destDir/<name>.md → struct{} for every .md entry in commandsFS.
	keepSet := make(map[string]struct{})

	err := fs.WalkDir(commandsFS, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() || d.Name() == ".gitkeep" {
			return nil
		}
		if filepath.Ext(d.Name()) != ".md" {
			return nil
		}
		destPath := filepath.Join(destDir, d.Name())
		keepSet[destPath] = struct{}{}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("%s: commands: walk commandsFS: %w", harnessName, err)
	}

	// --- Step 2: remove stale command files (present in destDir but not in keepSet) ---
	type readDirFS interface {
		ReadDir(name string) ([]os.DirEntry, error)
	}
	if rdf, ok := w.(readDirFS); ok {
		children, readErr := rdf.ReadDir(destDir)
		if readErr == nil { // directory exists
			for _, child := range children {
				if child.IsDir() {
					continue
				}
				if filepath.Ext(child.Name()) != ".md" {
					continue
				}
				childPath := filepath.Join(destDir, child.Name())
				if _, keep := keepSet[childPath]; !keep {
					if rmErr := w.Remove(childPath); rmErr != nil {
						return nil, fmt.Errorf("%s: commands: remove stale file %s: %w", harnessName, childPath, rmErr)
					}
				}
			}
		}
	}

	// --- Step 3: write current command files (idempotent byte-compare) ---
	var changes []Change

	err = fs.WalkDir(commandsFS, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() || d.Name() == ".gitkeep" {
			return nil
		}
		if filepath.Ext(d.Name()) != ".md" {
			return nil
		}

		data, readErr := fs.ReadFile(commandsFS, path)
		if readErr != nil {
			return fmt.Errorf("%s: read command file %s: %w", harnessName, path, readErr)
		}

		destPath := filepath.Join(destDir, d.Name())

		// Capture prior bytes for the Change record (backup/rollback).
		prior, priorErr := w.ReadFile(destPath)
		existed := priorErr == nil

		wr, writeErr := fsutil.WriteFileAtomic(w, destPath, data, 0o644)
		if writeErr != nil {
			return fmt.Errorf("%s: write command file %s: %w", harnessName, destPath, writeErr)
		}

		priorBytes := prior
		if !existed {
			priorBytes = nil
		}

		changes = append(changes, Change{
			FilePath:      destPath,
			PriorBytes:    priorBytes,
			ExistedBefore: existed,
			Changed:       wr.Changed,
			Strategy:      SeparateFiles, // full-file ownership per command file
		})
		return nil
	})
	if err != nil {
		return nil, err
	}

	return changes, nil
}
