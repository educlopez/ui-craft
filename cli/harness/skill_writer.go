package harness

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// writeMirrorToDir copies every file in mirror (a skills-rooted FS, e.g. the
// result of assets.SkillsFS(h)) into destDir on the target filesystem.
//
// Depth-1 layout: the mirror FS contains top-level skill-id dirs
// (e.g. "ui-craft/SKILL.md", "ui-craft-minimal/SKILL.md") that map directly
// to destDir/<id>/SKILL.md. The CLI owns exactly the top-level dirs present in
// the mirror; sibling dirs in destDir that are unknown to the mirror are never
// touched (isolation guarantee).
//
// Stale-file cleanup: files present in an owned top-level dir but absent from
// the current mirror (i.e. deleted upstream) are removed. Cleanup is bounded
// to the owned top-level dirs so that sibling skills are never affected. This
// also removes stale depth-2 layouts (skills/<id>/<id>/) left by old installs.
//
// Returns Changed:true if any file was newly written, updated, or removed;
// Changed:false if all files were already current and no stalefile existed.
//
// The Change record's FilePath is set to destDir since WriteSkill may touch
// multiple files; callers use Changed to determine overall install status.
func writeMirrorToDir(w fsutil.FileSystem, mirror fs.FS, destDir string) (Change, error) {
	// --- Step 1: collect the set of paths the new mirror will write AND the
	//             set of top-level dirs the mirror owns ---
	mirrorFiles := make(map[string]struct{})
	ownedTopDirs := make(map[string]struct{})

	err := fs.WalkDir(mirror, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == "." {
			return nil
		}
		// The mirror FS uses forward-slash paths. Get the first path component
		// (e.g. "ui-craft" from "ui-craft/SKILL.md") — this is the skill-id dir.
		topComp := strings.SplitN(path, "/", 2)[0]
		topDir := filepath.Join(destDir, topComp)
		ownedTopDirs[topDir] = struct{}{}

		if d.IsDir() || d.Name() == ".gitkeep" {
			return nil
		}
		dest := filepath.Join(destDir, filepath.FromSlash(path))
		mirrorFiles[dest] = struct{}{}
		return nil
	})
	if err != nil {
		return Change{}, fmt.Errorf("writeMirrorToDir: walk mirror: %w", err)
	}

	anyChanged := false

	// --- Step 2: remove stale files within owned top-level dirs only ---
	// Sibling dirs (e.g. destDir/other-skill/) are never touched.
	for topDir := range ownedTopDirs {
		if err := removeStaleFiles(w, topDir, mirrorFiles, &anyChanged); err != nil {
			return Change{}, err
		}
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
