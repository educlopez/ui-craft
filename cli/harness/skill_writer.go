package harness

import (
	"io/fs"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// writeMirrorToDir copies every file in mirror (a harness-specific subtree from
// assets.MirrorFS()) into destDir on the target filesystem. The CLI has full
// ownership of destDir; every file is written atomically via WriteFileAtomic
// (byte-compare early exit = idempotent). Returns Changed:true if any file
// was newly written or updated, Changed:false if all files were already current.
//
// destDir is the skills directory for the harness (e.g. ~/.claude/skills/ui-craft/).
// The Change record's FilePath is set to destDir (representing the dir, not a single file),
// since WriteSkill may touch multiple files; callers use Changed to determine status.
func writeMirrorToDir(w fsutil.FileSystem, mirror fs.FS, destDir string) (Change, error) {
	anyChanged := false

	err := fs.WalkDir(mirror, ".", func(path string, d fs.DirEntry, walkErr error) error {
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
