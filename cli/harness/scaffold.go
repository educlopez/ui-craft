package harness

import (
	"fmt"
	"io/fs"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// ScaffoldResult holds the per-file outcome of a ScaffoldDesignMemory call.
type ScaffoldResult struct {
	// Changes contains one entry per template file: created files have
	// ExistedBefore=false and Changed=true; skipped files have
	// ExistedBefore=true and Changed=false.
	Changes []Change
	// AllExisted is true when every template file was already present —
	// callers can use this to print "design-memory: already scaffolded".
	AllExisted bool
}

// ScaffoldDesignMemory scaffolds the .ui-craft/ design-memory directory into
// projectDir by writing each template file from templateFS if it does not
// already exist on the target filesystem.
//
// Rules:
//   - If the file already exists (Stat succeeds), it is SKIPPED — user content
//     is NEVER overwritten. The Change record is still returned with
//     ExistedBefore=true and Changed=false so callers can report "already present".
//   - Only files that did not exist before are created; the Change record for
//     those has ExistedBefore=false and Changed=true.
//   - The .gitkeep placeholder is always skipped (it is a build seam, not a
//     real template).
//   - Template files are written with mode 0o644.
//
// SnapPath for transactional rollback: the caller should use the .ui-craft/
// directory path as the SnapPath in the ComponentTarget. Rollback only deletes
// files where ExistedBefore=false (files created by this scaffold run), so
// pre-existing user content is preserved on rollback.
func ScaffoldDesignMemory(w fsutil.FileSystem, templateFS fs.FS, projectDir string) (ScaffoldResult, error) {
	destRoot := filepath.Join(projectDir, ".ui-craft")

	var changes []Change
	allExisted := true

	err := fs.WalkDir(templateFS, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		// Skip build placeholders.
		if d.Name() == ".gitkeep" {
			return nil
		}

		data, err := fs.ReadFile(templateFS, path)
		if err != nil {
			return fmt.Errorf("scaffold: read template %s: %w", path, err)
		}

		dest := filepath.Join(destRoot, filepath.FromSlash(path))

		// Check whether the file already exists in the project.
		_, statErr := w.Stat(dest)
		existed := statErr == nil

		if existed {
			// File already present — skip, do not overwrite user content.
			changes = append(changes, Change{
				FilePath:      dest,
				ExistedBefore: true,
				Changed:       false,
			})
			return nil
		}

		// File absent — create it.
		allExisted = false
		wr, err := fsutil.WriteFileAtomic(w, dest, data, 0o644)
		if err != nil {
			return fmt.Errorf("scaffold: write %s: %w", dest, err)
		}

		changes = append(changes, Change{
			FilePath:      dest,
			ExistedBefore: false,
			Changed:       wr.Changed,
		})
		return nil
	})
	if err != nil {
		return ScaffoldResult{}, err
	}

	// If no template files were found (empty templateFS), allExisted stays true
	// but changes is empty — treat as already-scaffolded (no-op).
	if len(changes) > 0 && !allExisted {
		// At least one file was created.
	}

	return ScaffoldResult{
		Changes:    changes,
		AllExisted: allExisted,
	}, nil
}
