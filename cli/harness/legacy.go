package harness

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
)

// Legacy install locations.
//
// Older ui-craft versions wrote some components to paths the harness never
// reads (for example ~/.claude/mcp/ui-craft.json or <project>/.cursor/rules/).
// Install and uninstall both sweep those locations so upgrading users do not
// keep dead copies around. The sweep removes ONLY content ui-craft can prove
// it wrote:
//
//   - a skill dir must be named like one of the harness's embedded skill ids
//     AND hold a SKILL.md whose frontmatter says "name: <id>" and that
//     mentions ui-craft;
//   - a command or agent file must be named like an embedded one AND mention
//     ui-craft;
//   - a JSON config only loses its "ui-craft" server key;
//   - a whole file is deleted only when its name is ui-craft's own
//     (mcp/ui-craft.json).
//
// Anything else at those paths is left alone.

// legacyKind says how a legacyTarget is swept.
type legacyKind int

const (
	// legacySkillDirs: remove <path>/<id>/ for each owned skill id.
	legacySkillDirs legacyKind = iota
	// legacyCommandFiles: remove <path>/<name> for each owned command file.
	legacyCommandFiles
	// legacyAgentFiles: remove <path>/<name> for each owned agent file.
	legacyAgentFiles
	// legacyFile: remove the file at path itself.
	legacyFile
	// legacyJSONKey: remove root[parent][key] from the JSON file at path.
	legacyJSONKey
)

// legacyTarget is one location an older ui-craft version wrote to.
type legacyTarget struct {
	path string
	kind legacyKind
	// pruneDir removes path (for the *Dirs/*Files kinds) or the file's parent
	// dir (for legacyFile) when the sweep leaves it empty. Off for directories
	// the harness itself owns, such as <project>/.gemini.
	pruneDir bool
	// parent/key name the JSON entry for legacyJSONKey.
	parent, key string
}

// legacyLocator is implemented by harness adapters that have legacy paths.
type legacyLocator interface {
	legacyTargets(c component.Component) []legacyTarget
}

// OwnedAssets carries the embedded asset trees that identify ui-craft's own
// files for a harness. Any field may be nil.
type OwnedAssets struct {
	Skills   fs.FS
	Commands fs.FS
	Agents   fs.FS
}

func legacyTargetsFor(h Harness, c component.Component) []legacyTarget {
	if l, ok := h.(legacyLocator); ok {
		return l.legacyTargets(c)
	}
	return nil
}

// LegacyPaths lists the concrete files and directories the legacy sweep for
// component c may touch, so callers can include them in the pre-write backup
// snapshot (keeping the sweep rollback-safe). Paths that do not exist are
// still listed; the backup store records them as tombstones.
func LegacyPaths(h Harness, c component.Component, owned OwnedAssets) []string {
	var out []string
	for _, t := range legacyTargetsFor(h, c) {
		switch t.kind {
		case legacySkillDirs:
			for _, name := range ownedNames(owned.Skills, true) {
				out = append(out, filepath.Join(t.path, name))
			}
		case legacyCommandFiles:
			for _, name := range ownedNames(owned.Commands, false) {
				out = append(out, filepath.Join(t.path, name))
			}
		case legacyAgentFiles:
			for _, name := range ownedNames(owned.Agents, false) {
				out = append(out, filepath.Join(t.path, name))
			}
		case legacyFile, legacyJSONKey:
			out = append(out, t.path)
		}
	}
	return out
}

// CleanupLegacy sweeps the legacy locations for component c and returns the
// paths it removed (or, for a JSON file, edited). With dryRun it only reports
// what it would remove. Errors stop the sweep; the caller's backup snapshot
// (see LegacyPaths) covers anything already removed.
func CleanupLegacy(w fsutil.FileSystem, h Harness, c component.Component, owned OwnedAssets, dryRun bool) ([]string, error) {
	var removed []string
	for _, t := range legacyTargetsFor(h, c) {
		if !filepath.IsAbs(t.path) {
			continue // unresolved root (HOME unset): never touch a relative path
		}
		var got []string
		var err error
		switch t.kind {
		case legacySkillDirs:
			got, err = sweepSkillDirs(w, t.path, owned.Skills, dryRun)
		case legacyCommandFiles:
			got, err = sweepOwnedFiles(w, t.path, owned.Commands, dryRun)
		case legacyAgentFiles:
			got, err = sweepOwnedFiles(w, t.path, owned.Agents, dryRun)
		case legacyFile:
			got, err = sweepFile(w, t.path, dryRun)
		case legacyJSONKey:
			got, err = sweepJSONKey(w, t.path, t.parent, t.key, dryRun)
		}
		if err != nil {
			return removed, fmt.Errorf("%s: legacy cleanup %s: %w", h.Name(), t.path, err)
		}
		removed = append(removed, got...)
		if !dryRun && t.pruneDir && len(got) > 0 {
			dir := t.path
			if t.kind == legacyFile {
				dir = filepath.Dir(t.path)
			}
			removeDirIfEmptyFS(w, dir)
		}
	}
	return removed, nil
}

// ownedNames lists the top-level entry names of an embedded tree: dirs when
// wantDirs is true, files otherwise.
func ownedNames(tree fs.FS, wantDirs bool) []string {
	if tree == nil {
		return nil
	}
	entries, err := fs.ReadDir(tree, ".")
	if err != nil {
		return nil
	}
	var names []string
	for _, e := range entries {
		if e.IsDir() == wantDirs {
			names = append(names, e.Name())
		}
	}
	return names
}

func exists(w fsutil.FileSystem, p string) bool {
	_, err := w.Stat(p)
	return err == nil
}

// isOwnedSkillDir reports whether dir looks like a skill ui-craft installed:
// SKILL.md with "name: <id>" frontmatter that mentions ui-craft.
func isOwnedSkillDir(w fsutil.FileSystem, dir, id string) bool {
	data, err := w.ReadFile(filepath.Join(dir, "SKILL.md"))
	if err != nil {
		return false
	}
	// Normalize CRLF first: a SKILL.md saved by a Windows editor, or checked out with
	// core.autocrlf, would otherwise never match and the legacy copy would survive.
	data = bytes.ReplaceAll(data, []byte("\r\n"), []byte("\n"))
	return bytes.Contains(data, []byte("\nname: "+id+"\n")) && bytes.Contains(data, []byte("ui-craft"))
}

func sweepSkillDirs(w fsutil.FileSystem, base string, skills fs.FS, dryRun bool) ([]string, error) {
	var removed []string
	for _, id := range ownedNames(skills, true) {
		dir := filepath.Join(base, id)
		if !exists(w, dir) || !isOwnedSkillDir(w, dir, id) {
			continue
		}
		if !dryRun {
			if err := w.RemoveAll(dir); err != nil {
				return removed, err
			}
		}
		removed = append(removed, dir)
	}
	return removed, nil
}

func sweepOwnedFiles(w fsutil.FileSystem, base string, tree fs.FS, dryRun bool) ([]string, error) {
	var removed []string
	for _, name := range ownedNames(tree, false) {
		p := filepath.Join(base, name)
		data, err := w.ReadFile(p)
		if err != nil || !bytes.Contains(data, []byte("ui-craft")) {
			continue
		}
		if !dryRun {
			if err := w.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
				return removed, err
			}
		}
		removed = append(removed, p)
	}
	return removed, nil
}

func sweepFile(w fsutil.FileSystem, p string, dryRun bool) ([]string, error) {
	if !exists(w, p) {
		return nil, nil
	}
	if !dryRun {
		if err := w.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
	}
	return []string{p}, nil
}

func sweepJSONKey(w fsutil.FileSystem, p, parent, key string, dryRun bool) ([]string, error) {
	data, err := w.ReadFile(p)
	if err != nil {
		return nil, nil
	}
	out, removed, err := filemerge.RemoveOrderedJSONKey(data, parent, key)
	if err != nil {
		// Not valid JSON (comments, corruption): leave it for the user.
		return nil, nil
	}
	if !removed {
		return nil, nil
	}
	if !dryRun {
		if _, err := writeConfigFile(w, p, out, 0o644); err != nil {
			return nil, err
		}
	}
	return []string{p}, nil
}

// removeDirIfEmptyFS removes dir when it exists and has no entries.
func removeDirIfEmptyFS(w fsutil.FileSystem, dir string) {
	entries, err := w.ReadDir(dir)
	if err != nil || len(entries) > 0 {
		return
	}
	_ = w.Remove(dir)
}
