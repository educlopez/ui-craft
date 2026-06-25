package harness

import (
	"fmt"
	"io/fs"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// writeAgentsToDir writes every .md file in agentsFS into agentsDir on the
// target filesystem. The CLI has full-file ownership of each agent file it
// installs; pre-existing user agents with different names are never touched
// (no stale-file cleanup — the CLI only writes the files it knows about).
//
// Each file is written atomically via WriteFileAtomic with an idempotent
// byte-compare: a re-run where the agent content is unchanged produces
// Changed:false for that file, satisfying the idempotency requirement.
//
// harnessName is used in error messages to identify the adapter (e.g. "claude").
//
// Returns one Change per agent file written. An empty agentsFS (no .md files)
// returns an empty slice with no error — callers should warn the user if this
// is unexpected.
func writeAgentsToDir(w fsutil.FileSystem, agentsFS fs.FS, agentsDir, harnessName string) ([]Change, error) {
	var changes []Change

	err := fs.WalkDir(agentsFS, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		// Only write .md files; skip any scaffolding artifacts.
		if filepath.Ext(d.Name()) != ".md" {
			return nil
		}

		data, err := fs.ReadFile(agentsFS, path)
		if err != nil {
			return fmt.Errorf("%s: read agent file %s: %w", harnessName, path, err)
		}

		destPath := filepath.Join(agentsDir, filepath.Base(path))

		// Read prior bytes for Change record (backup/rollback).
		prior, readErr := w.ReadFile(destPath)
		existed := readErr == nil

		wr, err := fsutil.WriteFileAtomic(w, destPath, data, 0o644)
		if err != nil {
			return fmt.Errorf("%s: write agent file %s: %w", harnessName, destPath, err)
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
			Strategy:      SeparateFiles, // full-file ownership per agent file
		})
		return nil
	})
	if err != nil {
		return nil, err
	}

	return changes, nil
}
