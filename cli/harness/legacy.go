package harness

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/educlopez/ui-craft/cli/backup"
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
//     AND hold a SKILL.md whose leading frontmatter says "name: <id>" and that
//     mentions ui-craft; inside it, only files the embedded skill also ships
//     (same relative path) are removed, so files the user added survive;
//   - a command or agent file must be named like an embedded one, carry the
//     embedded file's frontmatter "description:" (and, for an agent, "name:"
//     equal to its stem) AND mention ui-craft;
//   - a JSON config only loses its "ui-craft" server key;
//   - a whole file is deleted only when its name is ui-craft's own
//     (mcp/ui-craft.json).
//
// Anything else at those paths is left alone, and so is any path outside HOME
// (a rollback could not restore it) or overlapping a current install
// destination (see sweepable).

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
// still listed; the backup store records them as tombstones. Paths the sweep
// never touches (see sweepable) are left out, so the snapshot and the sweep
// always agree on what is eligible.
func LegacyPaths(h Harness, c component.Component, owned OwnedAssets) []string {
	scope := sweepScopeFor(h)
	var out []string
	for _, t := range legacyTargetsFor(h, c) {
		for _, p := range candidatePaths(t, owned) {
			if scope.sweepable(p) {
				out = append(out, p)
			}
		}
	}
	return out
}

// candidatePaths lists the concrete paths a target may remove or edit.
func candidatePaths(t legacyTarget, owned OwnedAssets) []string {
	var tree fs.FS
	switch t.kind {
	case legacySkillDirs:
		tree = owned.Skills
	case legacyCommandFiles:
		tree = owned.Commands
	case legacyAgentFiles:
		tree = owned.Agents
	default: // legacyFile, legacyJSONKey
		return []string{t.path}
	}
	var out []string
	for _, name := range ownedNames(tree, t.kind == legacySkillDirs) {
		out = append(out, filepath.Join(t.path, name))
	}
	return out
}

// sweepable reports whether the legacy sweep may touch p:
//
//   - p must be absolute (an unresolved root, HOME unset, yields a relative
//     path that must never be touched);
//   - p must pass the backup store's Restore check (under HOME for a global
//     install, under the project root for a project one), so whatever the
//     sweep removes can be rolled back;
//   - p must not be, contain, or sit inside one of the harness's current
//     install destinations. An env override can point the current root at a
//     directory an older version used (OPENCODE_CONFIG_DIR=%APPDATA%\opencode,
//     CLAUDE_CONFIG_DIR=%APPDATA%\Claude); sweeping it would delete what the
//     install just wrote.
func (s sweepScope) sweepable(p string) bool {
	if !filepath.IsAbs(p) || !backup.Restorable(p, s.trustRoot) {
		return false
	}
	for _, a := range s.active {
		if pathsOverlap(p, a) {
			return false
		}
	}
	return true
}

// sweepScope is what the legacy sweep checks every candidate path against.
type sweepScope struct {
	// active lists the paths h currently installs to.
	active []string
	// trustRoot is the backup store's restore boundary: "" (HOME) for a
	// global install, the project root for a project one.
	trustRoot string
}

func sweepScopeFor(h Harness) sweepScope {
	cp := h.ConfigPaths()
	s := sweepScope{trustRoot: cp.ProjectRoot}
	for _, p := range []string{cp.MCPConfig, cp.SkillsDir, cp.CommandsDir, cp.AgentsDir, cp.AgentsMDPath} {
		if p != "" {
			s.active = append(s.active, p)
		}
	}
	return s
}

// pathsOverlap reports whether a and b are the same path or one contains the
// other. Windows paths compare case-insensitively.
func pathsOverlap(a, b string) bool {
	a, b = filepath.Clean(a), filepath.Clean(b)
	if goos == "windows" {
		a, b = strings.ToLower(a), strings.ToLower(b)
	}
	return a == b || isWithin(a, b) || isWithin(b, a)
}

func isWithin(child, parent string) bool {
	sep := string(filepath.Separator)
	if !strings.HasSuffix(parent, sep) {
		parent += sep
	}
	return strings.HasPrefix(child, parent)
}

// CleanupLegacy sweeps the legacy locations for component c and returns the
// paths it removed (or, for a JSON file, edited). With dryRun it only reports
// what it would remove. An error stops the sweep; the paths removed before it
// are still returned, and the caller's backup snapshot (see LegacyPaths)
// covers them.
func CleanupLegacy(w fsutil.FileSystem, h Harness, c component.Component, owned OwnedAssets, dryRun bool) ([]string, error) {
	scope := sweepScopeFor(h)
	var removed []string
	for _, t := range legacyTargetsFor(h, c) {
		var got []string
		var err error
		for _, p := range candidatePaths(t, owned) {
			if !scope.sweepable(p) {
				continue
			}
			var g []string
			switch t.kind {
			case legacySkillDirs:
				g, err = sweepSkillDir(w, p, owned.Skills, dryRun)
			case legacyCommandFiles:
				g, err = sweepOwnedFile(w, p, owned.Commands, false, dryRun)
			case legacyAgentFiles:
				g, err = sweepOwnedFile(w, p, owned.Agents, true, dryRun)
			case legacyFile:
				g, err = sweepFile(w, p, dryRun)
			case legacyJSONKey:
				g, err = sweepJSONKey(w, p, t.parent, t.key, dryRun)
			}
			got = append(got, g...)
			if err != nil {
				break
			}
		}
		removed = append(removed, got...)
		if err != nil {
			return removed, fmt.Errorf("%s: legacy cleanup %s: %w", h.Name(), t.path, err)
		}
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

// frontmatter returns the lines of the leading YAML frontmatter block of data
// (between a first line "---" and the next line "---"), or nil when data does
// not open with one. CRLF line endings and a UTF-8 BOM are accepted: a file
// saved by a Windows editor, or checked out with core.autocrlf, must still
// match.
func frontmatter(data []byte) []string {
	s := strings.ReplaceAll(string(data), "\r\n", "\n")
	s = strings.TrimPrefix(s, "\uFEFF")
	lines := strings.Split(s, "\n")
	if len(lines) == 0 || strings.TrimRight(lines[0], " \t") != "---" {
		return nil
	}
	for i := 1; i < len(lines); i++ {
		if strings.TrimRight(lines[i], " \t") == "---" {
			return lines[1:i]
		}
	}
	return nil
}

// frontmatterValue returns the raw value of a top-level "key: value" line in
// frontmatter lines, or "" when absent.
func frontmatterValue(lines []string, key string) string {
	for _, l := range lines {
		if v, ok := strings.CutPrefix(l, key+":"); ok {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// isOwnedSkillDir reports whether dir looks like a skill ui-craft installed:
// a SKILL.md whose leading frontmatter block says "name: <id>" and that
// mentions ui-craft. A "name:" line further down the body does not count.
func isOwnedSkillDir(w fsutil.FileSystem, dir, id string) bool {
	data, err := w.ReadFile(filepath.Join(dir, "SKILL.md"))
	if err != nil {
		return false
	}
	return frontmatterValue(frontmatter(data), "name") == id && bytes.Contains(data, []byte("ui-craft"))
}

// sweepSkillDir removes, from an owned legacy skill dir, only the files that
// exist at the same relative path in the embedded skill tree, then the
// directories that end up empty. Anything the user added survives, and so
// do the directories holding it. It reports dir itself when the whole dir
// goes, else each removed file.
func sweepSkillDir(w fsutil.FileSystem, dir string, skills fs.FS, dryRun bool) ([]string, error) {
	id := filepath.Base(dir)
	if !exists(w, dir) || !isOwnedSkillDir(w, dir, id) {
		return nil, nil
	}
	owned := map[string]bool{}
	_ = fs.WalkDir(skills, id, func(p string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			owned[filepath.FromSlash(strings.TrimPrefix(p, id+"/"))] = true
		}
		return nil
	})
	var files, dirs []string
	extra := false
	if err := walkFS(w, dir, "", func(rel string, isDir bool) {
		switch {
		case isDir:
			dirs = append(dirs, rel)
		case owned[rel]:
			files = append(files, rel)
		default:
			extra = true
		}
	}); err != nil {
		return nil, err
	}

	if !extra {
		if !dryRun {
			if err := w.RemoveAll(dir); err != nil {
				return nil, err
			}
		}
		return []string{dir}, nil
	}
	var removed []string
	for _, rel := range files {
		p := filepath.Join(dir, rel)
		if !dryRun {
			if err := w.Remove(p); err != nil && !errors.Is(err, fs.ErrNotExist) {
				return removed, err
			}
		}
		removed = append(removed, p)
	}
	if !dryRun {
		// Deepest first, so a parent is checked after its children are gone.
		sort.Slice(dirs, func(i, j int) bool { return len(dirs[i]) > len(dirs[j]) })
		for _, rel := range dirs {
			removeDirIfEmptyFS(w, filepath.Join(dir, rel))
		}
	}
	return removed, nil
}

// walkFS calls fn for every entry under root (not root itself) with its path
// relative to root.
func walkFS(w fsutil.FileSystem, root, rel string, fn func(rel string, isDir bool)) error {
	entries, err := w.ReadDir(filepath.Join(root, rel))
	if err != nil {
		return err
	}
	for _, e := range entries {
		r := filepath.Join(rel, e.Name())
		fn(r, e.IsDir())
		if e.IsDir() {
			if err := walkFS(w, root, r, fn); err != nil {
				return err
			}
		}
	}
	return nil
}

// sweepOwnedFile removes a legacy command or agent file only when it carries
// the frontmatter ui-craft shipped for that file name: the same
// "description:" as the embedded file and a mention of ui-craft, plus, for an
// agent, "name:" equal to the file stem. A file name alone ("audit.md",
// "design-reviewer.md") is common enough that a user's own file could share
// it, and a mention of ui-craft is something a user's file can make too.
func sweepOwnedFile(w fsutil.FileSystem, p string, tree fs.FS, agent bool, dryRun bool) ([]string, error) {
	data, err := w.ReadFile(p)
	if err != nil {
		return nil, nil
	}
	embedded, err := fs.ReadFile(tree, filepath.Base(p))
	if err != nil {
		return nil, nil
	}
	if !isOwnedFile(data, embedded, strings.TrimSuffix(filepath.Base(p), filepath.Ext(p)), agent) {
		return nil, nil
	}
	if !dryRun {
		if err := w.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
	}
	return []string{p}, nil
}

func isOwnedFile(data, embedded []byte, stem string, agent bool) bool {
	want := frontmatterValue(frontmatter(embedded), "description")
	got := frontmatter(data)
	if want == "" || frontmatterValue(got, "description") != want || !bytes.Contains(data, []byte("ui-craft")) {
		return false
	}
	return !agent || frontmatterValue(got, "name") == stem
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
