package harness

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// writeMirrorToDir copies every file in mirror (a harness-specific subtree from
// assets.MirrorFS()) into destDir on the target filesystem. The CLI has full
// ownership of destDir (the …/skills/ui-craft/ subdir).
//
// Stale-file cleanup: files present in destDir but absent from the current
// mirror (i.e. deleted upstream) are removed ONLY within destDir. Sibling
// directories (e.g. …/skills/other-skill/) are never touched. Cleanup is
// done by targeted Remove of extra files rather than a blanket RemoveAll, so
// that idempotency (same mirror → Changed:false) is preserved.
//
// Returns Changed:true if any file was newly written, updated, or removed;
// Changed:false if all files were already current and no stalefile existed.
//
// destDir is the ui-craft subdir of the skills directory
// (e.g. ~/.claude/skills/ui-craft/). The Change record's FilePath is set to
// destDir since WriteSkill may touch multiple files; callers use Changed to
// determine overall install status.
func writeMirrorToDir(w fsutil.FileSystem, mirror fs.FS, destDir string) (Change, error) {
	// --- Step 1: collect the set of paths the new mirror will write ---
	mirrorFiles := make(map[string]struct{})
	err := fs.WalkDir(mirror, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil || d.IsDir() || d.Name() == ".gitkeep" {
			return walkErr
		}
		dest := filepath.Join(destDir, filepath.FromSlash(path))
		mirrorFiles[dest] = struct{}{}
		return nil
	})
	if err != nil {
		return Change{}, fmt.Errorf("writeMirrorToDir: walk mirror: %w", err)
	}

	anyChanged := false

	// --- Step 2: remove stale files in destDir not present in the new mirror ---
	// Only remove files under destDir (never sibling skill dirs or the parent).
	if err := removeStaleFiles(w, destDir, mirrorFiles, &anyChanged); err != nil {
		return Change{}, err
	}

	// --- Step 3: write all current mirror files (idempotent via byte-compare) ---
	err = fs.WalkDir(mirror, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil // directories are created on demand when writing files
		}
		// Skip placeholder files that are only present for go:embed compilation.
		if d.Name() == ".gitkeep" {
			return nil
		}

		data, err := fs.ReadFile(mirror, path)
		if err != nil {
			return err
		}

		dest := filepath.Join(destDir, filepath.FromSlash(path))
		wr, err := fsutil.WriteFileAtomic(w, dest, data, 0o644)
		if err != nil {
			return err
		}
		if wr.Changed {
			anyChanged = true
		}
		return nil
	})
	if err != nil {
		return Change{}, err
	}

	return Change{
		FilePath: destDir,
		Changed:  anyChanged,
		Strategy: SeparateFiles, // full-file ownership
	}, nil
}

// removeStaleFiles removes any files under dirPath that are not in the keepSet
// map. It descends into subdirectories but never touches paths outside dirPath.
// anyChanged is set to true if at least one file was removed.
func removeStaleFiles(w fsutil.FileSystem, dirPath string, keepSet map[string]struct{}, anyChanged *bool) error {
	type readDirFS interface {
		ReadDir(name string) ([]os.DirEntry, error)
	}
	rdf, ok := w.(readDirFS)
	if !ok {
		return nil // FileSystem doesn't support ReadDir — no stale cleanup possible
	}

	children, err := rdf.ReadDir(dirPath)
	if err != nil {
		// Directory doesn't exist yet — nothing to clean.
		return nil
	}
	for _, child := range children {
		childPath := filepath.Join(dirPath, child.Name())
		if child.IsDir() {
			if err := removeStaleFiles(w, childPath, keepSet, anyChanged); err != nil {
				return err
			}
			continue
		}
		if _, keep := keepSet[childPath]; !keep {
			// File exists on disk but is not in the new mirror — remove it.
			if err := w.Remove(childPath); err != nil {
				return fmt.Errorf("writeMirrorToDir: remove stale file %s: %w", childPath, err)
			}
			*anyChanged = true
		}
	}
	return nil
}
