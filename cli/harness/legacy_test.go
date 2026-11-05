package harness

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// A "name: <id>" line only counts inside the leading frontmatter block.
func TestIsOwnedSkillDir_nameOnlyInFrontmatter(t *testing.T) {
	mem := fsutil.NewMemFS()
	dir := filepath.Join(t.TempDir(), "ui-craft")
	write(t, mem, filepath.Join(dir, "SKILL.md"),
		"---\nname: my-skill\ndescription: mine\n---\n\nNotes on ui-craft:\nname: ui-craft\n")
	if isOwnedSkillDir(mem, dir, "ui-craft") {
		t.Error("a body line \"name: ui-craft\" made a user skill look owned")
	}
	write(t, mem, filepath.Join(dir, "SKILL.md"), "no frontmatter\nname: ui-craft\nui-craft\n")
	if isOwnedSkillDir(mem, dir, "ui-craft") {
		t.Error("a file without frontmatter was treated as owned")
	}
	write(t, mem, filepath.Join(dir, "SKILL.md"), "---\r\nname: ui-craft\r\n---\r\nThe ui-craft skill.\r\n")
	if !isOwnedSkillDir(mem, dir, "ui-craft") {
		t.Error("CRLF frontmatter with name: ui-craft was not recognised")
	}
}

// Inside an owned legacy skill dir only files the embedded skill ships go;
// what the user added stays, with the directories that hold it.
func TestLegacy_skillDirKeepsUserFiles(t *testing.T) {
	project := t.TempDir()
	mem := fsutil.NewMemFS()
	dir := filepath.Join(project, ".cursor", "rules", "ui-craft")
	write(t, mem, filepath.Join(dir, "SKILL.md"), embeddedSkill(t, "cursor", "ui-craft"))
	write(t, mem, filepath.Join(dir, "references", "accessibility.md"), "ours")
	write(t, mem, filepath.Join(dir, "notes.md"), "my notes")
	write(t, mem, filepath.Join(dir, "mine", "x.md"), "my file")

	h := CursorHarness{}.WithProjectRoot(project)
	removed, err := CleanupLegacy(mem, h, component.SkillCommands, ownedFor("cursor"), false)
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{"SKILL.md", "references"} {
		if !gone(mem, filepath.Join(dir, p)) {
			t.Errorf("%s survived", p)
		}
	}
	for _, p := range []string{"notes.md", filepath.Join("mine", "x.md")} {
		if gone(mem, filepath.Join(dir, p)) {
			t.Errorf("user file %s was removed", p)
		}
	}
	if len(removed) != 2 {
		t.Errorf("removed = %v, want the two shipped files", removed)
	}
}

// A user command or agent that shares a shipped file name and mentions
// ui-craft is still the user's.
func TestLegacy_commandAndAgentNeedShippedFrontmatter(t *testing.T) {
	home := isolateHome(t)
	withStat(t)
	mem := fsutil.NewMemFS()
	owned := ownedFor("opencode")
	base := filepath.Join(home, ".config", "opencode")
	cmdBody, _ := fs.ReadFile(owned.Commands, "audit.md")
	agentBody, _ := fs.ReadFile(owned.Agents, "design-reviewer.md")

	userCmd := "---\ndescription: My own audit, built on ui-craft\n---\nRun the ui-craft audit my way.\n"
	write(t, mem, filepath.Join(base, "command", "audit.md"), userCmd)
	write(t, mem, filepath.Join(base, "command", "polish.md"), "Uses ui-craft polish, no frontmatter.\n")
	// Same description as ours, different agent name: a renamed copy the user owns.
	userAgent := strings.Replace(string(agentBody), "name: design-reviewer", "name: my-reviewer", 1)
	write(t, mem, filepath.Join(base, "agent", "design-reviewer.md"), userAgent)
	write(t, mem, filepath.Join(base, "command", "critique.md"), string(cmdBody))

	for _, c := range []component.Component{component.SkillCommands, component.ReviewAgents} {
		if _, err := CleanupLegacy(mem, OpenCodeHarness{}, c, owned, false); err != nil {
			t.Fatal(err)
		}
	}
	for _, p := range []string{"command/audit.md", "command/polish.md", "agent/design-reviewer.md"} {
		if gone(mem, filepath.Join(base, filepath.FromSlash(p))) {
			t.Errorf("user file %s was removed", p)
		}
	}
	// critique.md carries audit's description, not critique's: not ours either.
	if gone(mem, filepath.Join(base, "command", "critique.md")) {
		t.Error("a command whose description belongs to another command was removed")
	}

	// The shipped files themselves still go.
	write(t, mem, filepath.Join(base, "command", "audit.md"), string(cmdBody))
	write(t, mem, filepath.Join(base, "agent", "design-reviewer.md"), string(agentBody))
	for _, c := range []component.Component{component.SkillCommands, component.ReviewAgents} {
		if _, err := CleanupLegacy(mem, OpenCodeHarness{}, c, owned, false); err != nil {
			t.Fatal(err)
		}
	}
	if !gone(mem, filepath.Join(base, "command", "audit.md")) || !gone(mem, filepath.Join(base, "agent", "design-reviewer.md")) {
		t.Error("shipped command or agent survived")
	}
}

// failRemoveFS fails Remove for one path.
type failRemoveFS struct {
	*fsutil.MemFS
	path string
}

func (f failRemoveFS) Remove(name string) error {
	if name == f.path {
		return &os.PathError{Op: "remove", Path: name, Err: fs.ErrPermission}
	}
	return f.MemFS.Remove(name)
}

// A sweep that fails part-way still reports what it already removed.
func TestCleanupLegacy_keepsPartialRemovalsOnError(t *testing.T) {
	home := isolateHome(t)
	withStat(t)
	mem := fsutil.NewMemFS()
	owned := ownedFor("opencode")
	dir := filepath.Join(home, ".config", "opencode", "command")
	for _, name := range []string{"adapt.md", "animate.md"} {
		body, _ := fs.ReadFile(owned.Commands, name)
		write(t, mem, filepath.Join(dir, name), string(body))
	}
	w := failRemoveFS{MemFS: mem, path: filepath.Join(dir, "animate.md")}
	removed, err := CleanupLegacy(w, OpenCodeHarness{}, component.SkillCommands, owned, false)
	if !errors.Is(err, fs.ErrPermission) {
		t.Fatalf("err = %v, want ErrPermission", err)
	}
	if len(removed) != 1 || removed[0] != filepath.Join(dir, "adapt.md") {
		t.Errorf("removed = %v, want the file removed before the failure", removed)
	}
}

// An env override can point the current config root at a directory an older
// version used. The sweep must then leave the fresh install alone.
func TestLegacy_neverSweepsActiveDestinations(t *testing.T) {
	t.Run("opencode", func(t *testing.T) {
		home := isolateHome(t)
		withStat(t)
		withGOOS(t, "windows")
		appdata := filepath.Join(home, "AppData", "Roaming")
		t.Setenv("APPDATA", appdata)
		t.Setenv("OPENCODE_CONFIG_DIR", filepath.Join(appdata, "opencode"))
		mem := fsutil.NewMemFS()
		h := OpenCodeHarness{}
		owned := ownedFor("opencode")

		if _, err := h.WriteMCP(mem, testServer); err != nil {
			t.Fatal(err)
		}
		cp := h.ConfigPaths()
		write(t, mem, filepath.Join(cp.SkillsDir, "ui-craft", "SKILL.md"), embeddedSkill(t, "opencode", "ui-craft"))
		cmdBody, _ := fs.ReadFile(owned.Commands, "audit.md")
		write(t, mem, filepath.Join(cp.CommandsDir, "audit.md"), string(cmdBody))

		for _, c := range []component.Component{component.MCPGates, component.SkillCommands, component.ReviewAgents} {
			if got := LegacyPaths(h, c, owned); len(got) != 0 {
				for _, p := range got {
					for _, a := range []string{cp.MCPConfig, cp.SkillsDir, cp.CommandsDir} {
						if pathsOverlap(p, a) {
							t.Errorf("%s: legacy path %s overlaps active %s", c, p, a)
						}
					}
				}
			}
			if _, err := CleanupLegacy(mem, h, c, owned, false); err != nil {
				t.Fatal(err)
			}
		}
		if !strings.Contains(read(t, mem, cp.MCPConfig), "ui-craft") {
			t.Error("the MCP entry just written was swept")
		}
		if gone(mem, filepath.Join(cp.SkillsDir, "ui-craft")) || gone(mem, filepath.Join(cp.CommandsDir, "audit.md")) {
			t.Error("freshly installed skills or commands were swept")
		}
	})

	t.Run("claude", func(t *testing.T) {
		home := isolateHome(t)
		withStat(t)
		withGOOS(t, "windows")
		appdata := filepath.Join(home, "AppData", "Roaming")
		t.Setenv("APPDATA", appdata)
		t.Setenv("CLAUDE_CONFIG_DIR", filepath.Join(appdata, "Claude"))
		mem := fsutil.NewMemFS()
		h := ClaudeHarness{}
		cp := h.ConfigPaths()
		write(t, mem, filepath.Join(cp.SkillsDir, "ui-craft", "SKILL.md"), embeddedSkill(t, "claude", "ui-craft"))
		removed, err := CleanupLegacy(mem, h, component.SkillCommands, ownedFor("claude"), false)
		if err != nil || len(removed) != 0 || gone(mem, filepath.Join(cp.SkillsDir, "ui-craft")) {
			t.Errorf("removed=%v err=%v: the active skills dir was swept", removed, err)
		}
	})

	t.Run("case-insensitive on windows", func(t *testing.T) {
		withGOOS(t, "windows")
		if !pathsOverlap(filepath.Join("/Users", "Me", "AppData", "opencode"), filepath.Join("/users", "me", "appdata", "OpenCode", "skills")) {
			t.Error("windows paths differing only in case should overlap")
		}
		if pathsOverlap(filepath.Join("/x", "skill"), filepath.Join("/x", "skills")) {
			t.Error("a shared name prefix is not containment")
		}
	})
}

// A legacy path a rollback could not restore (outside HOME) is neither
// snapshotted nor swept, so the two always agree.
func TestLegacy_outsideHomeSkippedByBothSnapshotAndSweep(t *testing.T) {
	isolateHome(t)
	withStat(t)
	withGOOS(t, "windows")
	appdata := filepath.Join(t.TempDir(), "Roaming") // not under HOME
	t.Setenv("APPDATA", appdata)
	mem := fsutil.NewMemFS()
	legacy := filepath.Join(appdata, "Claude", "mcp", "ui-craft.json")
	write(t, mem, legacy, `{}`)

	for _, p := range LegacyPaths(ClaudeHarness{}, component.MCPGates, OwnedAssets{}) {
		if strings.HasPrefix(p, appdata) {
			t.Errorf("snapshot lists %s, which Restore would reject", p)
		}
	}
	if _, err := CleanupLegacy(mem, ClaudeHarness{}, component.MCPGates, OwnedAssets{}, false); err != nil {
		t.Fatal(err)
	}
	if gone(mem, legacy) {
		t.Error("swept a file outside HOME that the snapshot could not cover")
	}
}
