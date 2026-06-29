package cmd_test

// uninstall_test.go — tests for the uninstall command.
//
// Test scenarios:
//   - Uninstall removes our entries AND preserves a pre-existing user MCP server.
//   - Design-memory is preserved unless explicitly targeted.
//   - A snapshot is created before removal.
//   - Owned paths are derived from embedded FS (not hardcoded).
//   - Unrelated user skills/commands/agents are preserved.
//   - Shared parent dir is preserved when user files remain.
//   - Stale depth-2 layout (skills/ui-craft/ui-craft/) is cleaned.
//
// Tests use real OS filesystem (temp dirs) for backup/snapshot checks.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestUninstall_preservesOpenCodeUserServer verifies that removing the ui-craft
// MCP entry from an OpenCode-style JSON config (uses "mcp" key) preserves other servers.
func TestUninstall_preservesOpenCodeUserServer(t *testing.T) {
	openCodeConfig := []byte(`{
  "mcp": {
    "user-server": {
      "type": "local",
      "command": ["npx", "-y", "user-mcp"]
    },
    "ui-craft": {
      "type": "local",
      "command": ["npx", "-y", "ui-craft-mcp"]
    }
  }
}
`)
	result, err := cmd.RemoveJSONKeyForTest(openCodeConfig, "mcp", "ui-craft")
	if err != nil {
		t.Fatalf("RemoveJSONKey: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(result, &parsed); err != nil {
		t.Fatalf("result not valid JSON: %v\nresult:\n%s", err, result)
	}
	mcpSection, _ := parsed["mcp"].(map[string]any)
	if mcpSection == nil {
		t.Fatalf("mcp key missing from result:\n%s", result)
	}
	if _, hasUICraft := mcpSection["ui-craft"]; hasUICraft {
		t.Errorf("ui-craft server should be removed, result:\n%s", result)
	}
	if _, hasUser := mcpSection["user-server"]; !hasUser {
		t.Errorf("user-server should be preserved, result:\n%s", result)
	}
}

// TestUninstall_preservesUserMCPServer verifies that removing the ui-craft
// MCP entry from a Cursor-style JSON config preserves pre-existing user servers.
func TestUninstall_preservesUserMCPServer(t *testing.T) {
	cursorMCPContent := []byte(`{
  "mcpServers": {
    "my-other-server": {
      "command": "npx",
      "args": ["-y", "my-server"]
    },
    "ui-craft": {
      "command": "npx",
      "args": ["-y", "ui-craft-mcp"]
    }
  }
}
`)
	result, err := cmd.RemoveJSONKeyForTest(cursorMCPContent, "mcpServers", "ui-craft")
	if err != nil {
		t.Fatalf("RemoveJSONKey: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(result, &parsed); err != nil {
		t.Fatalf("result not valid JSON: %v\nresult:\n%s", err, result)
	}
	servers, _ := parsed["mcpServers"].(map[string]any)
	if servers == nil {
		t.Fatalf("mcpServers missing from result:\n%s", result)
	}
	if _, hasUICraft := servers["ui-craft"]; hasUICraft {
		t.Errorf("ui-craft server should be removed, result:\n%s", result)
	}
	if _, hasOther := servers["my-other-server"]; !hasOther {
		t.Errorf("my-other-server should be preserved, result:\n%s", result)
	}
}

// TestUninstall_designMemoryPreservedByDefault verifies that design-memory
// files are not touched during a default uninstall (no --components design-memory).
// We test this via the RemoveDir helper: the uninstall logic only calls removeDir
// on <skillsDir>/ui-craft, never on .ui-craft/.
func TestUninstall_designMemoryPreservedByDefault(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}

	// Create .ui-craft/ with a file.
	uiCraftDir := filepath.Join(tmpDir, ".ui-craft")
	if err := osfs.MkdirAll(uiCraftDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	briefFile := filepath.Join(uiCraftDir, "brief.md")
	if err := osfs.WriteFile(briefFile, []byte("# My Design\n"), 0o644); err != nil {
		t.Fatalf("write brief.md: %v", err)
	}

	// Simulate uninstall: removeDir is called ONLY on <skillsDir>/ui-craft, never on .ui-craft.
	skillsUICraft := filepath.Join(tmpDir, "skills", "ui-craft")
	if err := osfs.MkdirAll(skillsUICraft, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := cmd.RemoveDir(osfs, skillsUICraft); err != nil {
		t.Fatalf("RemoveDir: %v", err)
	}

	// .ui-craft/brief.md must still exist.
	if _, err := osfs.Stat(briefFile); err != nil {
		t.Errorf("brief.md was removed; it should be preserved by default: %v", err)
	}
}

// TestUninstall_siblingSkillsPreserved verifies that the ui-craft/ subtree is
// removed while a sibling skill directory is left intact.
func TestUninstall_siblingSkillsPreserved(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}

	uiCraftSkill := filepath.Join(tmpDir, "skills", "ui-craft")
	siblingSkill := filepath.Join(tmpDir, "skills", "my-skill")

	for _, dir := range []string{uiCraftSkill, siblingSkill} {
		if err := osfs.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", dir, err)
		}
	}

	if err := cmd.RemoveDir(osfs, uiCraftSkill); err != nil {
		t.Fatalf("RemoveDir: %v", err)
	}

	if _, err := osfs.Stat(uiCraftSkill); err == nil {
		t.Error("ui-craft skill dir should have been removed")
	}
	if _, err := osfs.Stat(siblingSkill); err != nil {
		t.Errorf("sibling skill dir should be preserved: %v", err)
	}
}

// TestUninstall_agentsMDBlockRemoved verifies that our managed block is removed
// from an AGENTS.md file while preserving content outside the block.
func TestUninstall_agentsMDBlockRemoved(t *testing.T) {
	agentsMD := `# Project Agents

This is user content.

<!-- BEGIN ui-craft (managed — do not edit) -->
Some ui-craft managed content here.
<!-- END ui-craft -->

More user content below.
`
	result := cmd.RemoveManagedBlockForTest(agentsMD)
	if strings.Contains(result, "BEGIN ui-craft") {
		t.Errorf("managed block should be removed, got:\n%s", result)
	}
	if !strings.Contains(result, "This is user content.") {
		t.Errorf("user content before block should be preserved, got:\n%s", result)
	}
	if !strings.Contains(result, "More user content below.") {
		t.Errorf("user content after block should be preserved, got:\n%s", result)
	}
}

// TestUninstall_relativePath_neverRemoved is the regression test for the
// CRITICAL absolute-path guard.
//
// Scenario: a harness whose SkillsDir resolves to "" (e.g. HOME is unset at
// install time) produces a path like filepath.Join("", "ui-craft") == "ui-craft"
// (a RELATIVE path). removeDir MUST refuse to act on it and MUST NOT call
// os.RemoveAll, so a sentinel directory at that relative path in the CWD survives.
func TestUninstall_relativePath_neverRemoved(t *testing.T) {
	// Change into a fresh temp dir so any accidental relative removal is scoped
	// and the sentinel is predictable.
	tmpDir := t.TempDir()
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(origDir) })

	osfs := fsutil.OsFS{}

	// Create a sentinel directory at the relative path that an empty SkillsDir
	// would produce: filepath.Join("", "ui-craft") == "ui-craft".
	sentinel := filepath.Join(tmpDir, "ui-craft")
	if err := osfs.MkdirAll(sentinel, 0o755); err != nil {
		t.Fatalf("mkdir sentinel: %v", err)
	}
	// Also write a file inside so we can prove the tree was untouched.
	sentinelFile := filepath.Join(sentinel, "important.txt")
	if err := osfs.WriteFile(sentinelFile, []byte("do not delete\n"), 0o644); err != nil {
		t.Fatalf("write sentinel file: %v", err)
	}

	// Simulate the buggy path: filepath.Join("", "ui-craft") == "ui-craft" (relative).
	relPath := filepath.Join("", "ui-craft")
	if filepath.IsAbs(relPath) {
		t.Skipf("platform produced an absolute path from empty SkillsDir; guard trivially safe")
	}

	// removeDir must refuse and return errRelativePath.
	if err := cmd.RemoveDir(osfs, relPath); err == nil {
		t.Fatalf("removeDir returned nil on a relative path — absolute-path guard missing!")
	}

	// The sentinel directory and its contents MUST survive.
	if _, err := osfs.Stat(sentinel); err != nil {
		t.Errorf("sentinel dir was removed by removeDir on a relative path: %v", err)
	}
	if _, err := osfs.Stat(sentinelFile); err != nil {
		t.Errorf("sentinel file was removed by removeDir on a relative path: %v", err)
	}
}

// TestUninstall_relativePathError verifies that ErrRelativePath is returned
// (not nil) when removeDir receives a non-absolute path.
func TestUninstall_relativePathError(t *testing.T) {
	osfs := fsutil.OsFS{}
	err := cmd.RemoveDir(osfs, "relative/path")
	if err == nil {
		t.Fatal("expected an error for relative path, got nil")
	}
	if !errors.Is(err, cmd.ErrRelativePath) {
		t.Errorf("expected ErrRelativePath, got: %v", err)
	}
}

// TestUninstall_notExistReportsNotActed verifies that removeDirSafe reports
// "not acted" (false) when the target dir does not exist.
func TestUninstall_notExistReportsNotActed(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}
	nonExistent := filepath.Join(tmpDir, "does-not-exist")
	acted, err := cmd.RemoveDirSafe(osfs, nonExistent)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if acted {
		t.Error("removeDirSafe should report acted=false for non-existent dir")
	}
}

// TestUninstall_snapshotCreated verifies that the backup store grows by one
// entry after a snapshot is taken (the pattern used by runUninstall).
func TestUninstall_snapshotCreated(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}
	store := backup.NewStore(filepath.Join(tmpDir, "backups"), osfs, nil)

	before, _ := store.List()

	_, err := store.Snapshot(nil, "v-test", backup.SourceUninstall)
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}

	after, _ := store.List()
	if len(after) != len(before)+1 {
		t.Errorf("expected 1 more snapshot, got before=%d after=%d", len(before), len(after))
	}
}

// ---------------------------------------------------------------------------
// Slice 5: derived-path uninstall tests (TDD — RED first)
// ---------------------------------------------------------------------------

// fakeSkillsFS builds a minimal in-memory FS that looks like assets.SkillsFS:
// top-level entries are skill IDs (depth-1 dirs), each containing a SKILL.md.
func fakeSkillsFS(ids ...string) fs.FS {
	m := fstest.MapFS{}
	for _, id := range ids {
		m[id+"/SKILL.md"] = &fstest.MapFile{Data: []byte("# " + id)}
	}
	return m
}

// fakeCommandsFS builds a minimal in-memory FS with flat *.md command files.
func fakeCommandsFS(files ...string) fs.FS {
	m := fstest.MapFS{}
	for _, f := range files {
		m[f] = &fstest.MapFile{Data: []byte("# cmd " + f)}
	}
	return m
}

// TestUninstall_derivesOwnedSkillPaths verifies that RemoveOwnedSkills removes
// exactly the skill dirs present in the embedded FS and no others.
func TestUninstall_derivesOwnedSkillPaths(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}
	skillsDir := filepath.Join(tmpDir, "skills")

	// Create managed skill dirs (from embedded FS).
	for _, id := range []string{"ui-craft", "ui-craft-minimal"} {
		dir := filepath.Join(skillsDir, id)
		if err := osfs.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", dir, err)
		}
		if err := osfs.WriteFile(filepath.Join(dir, "SKILL.md"), []byte("# "+id), 0o644); err != nil {
			t.Fatalf("write SKILL.md: %v", err)
		}
	}

	// Create an unrelated user skill dir that must survive.
	userSkill := filepath.Join(skillsDir, "my-custom-skill")
	if err := osfs.MkdirAll(userSkill, 0o755); err != nil {
		t.Fatalf("mkdir user skill: %v", err)
	}
	if err := osfs.WriteFile(filepath.Join(userSkill, "SKILL.md"), []byte("user"), 0o644); err != nil {
		t.Fatalf("write user SKILL.md: %v", err)
	}

	embeddedSkillsFS := fakeSkillsFS("ui-craft", "ui-craft-minimal")

	notices, err := cmd.RemoveOwnedSkills(osfs, skillsDir, embeddedSkillsFS)
	if err != nil {
		t.Fatalf("RemoveOwnedSkills: %v", err)
	}
	_ = notices

	// Managed dirs must be gone.
	for _, id := range []string{"ui-craft", "ui-craft-minimal"} {
		if _, err := osfs.Stat(filepath.Join(skillsDir, id)); err == nil {
			t.Errorf("skill dir %q should be removed", id)
		}
	}

	// User skill must survive.
	if _, err := osfs.Stat(userSkill); err != nil {
		t.Errorf("user skill dir should be preserved: %v", err)
	}

	// skills/ dir itself survives because user skill is still there.
	if _, err := osfs.Stat(skillsDir); err != nil {
		t.Errorf("skills/ parent dir should be preserved when user files remain: %v", err)
	}
}

// TestUninstall_skillsDirRemovedWhenEmpty verifies that the skills/ parent dir
// is removed when all remaining entries after uninstall are gone.
func TestUninstall_skillsDirRemovedWhenEmpty(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}
	skillsDir := filepath.Join(tmpDir, "skills")

	// Only managed skills, no user files.
	dir := filepath.Join(skillsDir, "ui-craft")
	if err := osfs.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	embeddedSkillsFS := fakeSkillsFS("ui-craft")

	if _, err := cmd.RemoveOwnedSkills(osfs, skillsDir, embeddedSkillsFS); err != nil {
		t.Fatalf("RemoveOwnedSkills: %v", err)
	}

	// skills/ dir itself should be removed when empty.
	if _, err := osfs.Stat(skillsDir); err == nil {
		t.Error("empty skills/ dir should be removed after uninstall")
	}
}

// TestUninstall_emitsManualNotice verifies that when the skills/ parent dir
// still has user files after removing managed dirs, a manual-action notice
// is returned (dir not removed, user informed).
func TestUninstall_emitsManualNotice(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}
	skillsDir := filepath.Join(tmpDir, "skills")

	// Create managed skill dir.
	managedDir := filepath.Join(skillsDir, "ui-craft")
	if err := osfs.MkdirAll(managedDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	// Create a loose user file directly in skills/ (not in a subdir).
	userFile := filepath.Join(skillsDir, "my-notes.md")
	if err := osfs.WriteFile(userFile, []byte("user notes"), 0o644); err != nil {
		t.Fatalf("write user file: %v", err)
	}

	embeddedSkillsFS := fakeSkillsFS("ui-craft")

	notices, err := cmd.RemoveOwnedSkills(osfs, skillsDir, embeddedSkillsFS)
	if err != nil {
		t.Fatalf("RemoveOwnedSkills: %v", err)
	}

	// skills/ dir must NOT be removed (user file remains).
	if _, err := osfs.Stat(skillsDir); err != nil {
		t.Errorf("skills/ dir should be preserved when user files remain")
	}

	// A manual-action notice must be returned.
	if len(notices) == 0 {
		t.Error("expected at least one manual-action notice, got none")
	}
}

// TestUninstall_derivesOwnedCommandPaths verifies that RemoveOwnedCommands
// removes exactly the command files present in the embedded FS and no others.
func TestUninstall_derivesOwnedCommandPaths(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}
	commandsDir := filepath.Join(tmpDir, "commands")

	// Create managed command files.
	if err := osfs.MkdirAll(commandsDir, 0o755); err != nil {
		t.Fatalf("mkdir commands: %v", err)
	}
	for _, f := range []string{"adapt.md", "animate.md"} {
		if err := osfs.WriteFile(filepath.Join(commandsDir, f), []byte("# "+f), 0o644); err != nil {
			t.Fatalf("write %s: %v", f, err)
		}
	}

	// Create an unrelated user command file that must survive.
	userCmd := filepath.Join(commandsDir, "my-workflow.md")
	if err := osfs.WriteFile(userCmd, []byte("user cmd"), 0o644); err != nil {
		t.Fatalf("write user cmd: %v", err)
	}

	embeddedCommandsFS := fakeCommandsFS("adapt.md", "animate.md")

	notices, err := cmd.RemoveOwnedCommands(osfs, commandsDir, embeddedCommandsFS)
	if err != nil {
		t.Fatalf("RemoveOwnedCommands: %v", err)
	}

	// Managed files must be gone.
	for _, f := range []string{"adapt.md", "animate.md"} {
		if _, err := osfs.Stat(filepath.Join(commandsDir, f)); err == nil {
			t.Errorf("command file %q should be removed", f)
		}
	}

	// User command must survive.
	if _, err := osfs.Stat(userCmd); err != nil {
		t.Errorf("user command should be preserved: %v", err)
	}

	// Notice: commands/ dir survives because user file is still there.
	_ = notices
	if _, err := osfs.Stat(commandsDir); err != nil {
		t.Errorf("commands/ dir should be preserved when user files remain: %v", err)
	}
}

// TestUninstall_derivesOwnedAgentPaths verifies that RemoveOwnedAgents removes
// exactly the agent files present in the embedded FS and no others.
func TestUninstall_derivesOwnedAgentPaths(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}
	agentsDir := filepath.Join(tmpDir, "agents")

	if err := osfs.MkdirAll(agentsDir, 0o755); err != nil {
		t.Fatalf("mkdir agents: %v", err)
	}

	// Create managed agent files.
	for _, f := range []string{"design-reviewer.md", "a11y-auditor.md"} {
		if err := osfs.WriteFile(filepath.Join(agentsDir, f), []byte("# "+f), 0o644); err != nil {
			t.Fatalf("write %s: %v", f, err)
		}
	}

	// Create an unrelated user agent that must survive.
	userAgent := filepath.Join(agentsDir, "my-reviewer.md")
	if err := osfs.WriteFile(userAgent, []byte("user agent"), 0o644); err != nil {
		t.Fatalf("write user agent: %v", err)
	}

	embeddedAgentsFS := fakeCommandsFS("design-reviewer.md", "a11y-auditor.md")

	notices, err := cmd.RemoveOwnedAgents(osfs, agentsDir, embeddedAgentsFS)
	if err != nil {
		t.Fatalf("RemoveOwnedAgents: %v", err)
	}

	// Managed agents must be gone.
	for _, f := range []string{"design-reviewer.md", "a11y-auditor.md"} {
		if _, err := osfs.Stat(filepath.Join(agentsDir, f)); err == nil {
			t.Errorf("agent file %q should be removed", f)
		}
	}

	// User agent must survive.
	if _, err := osfs.Stat(userAgent); err != nil {
		t.Errorf("user agent should be preserved: %v", err)
	}

	// Notice may or may not be emitted, but agents/ dir must survive.
	_ = notices
	if _, err := osfs.Stat(agentsDir); err != nil {
		t.Errorf("agents/ dir should be preserved when user files remain: %v", err)
	}
}

// TestUninstall_cleansStaleDepth2 verifies that a pre-existing stale depth-2
// layout (skills/ui-craft/ui-craft/) is removed during uninstall.
func TestUninstall_cleansStaleDepth2(t *testing.T) {
	tmpDir := t.TempDir()
	osfs := fsutil.OsFS{}
	skillsDir := filepath.Join(tmpDir, "skills")

	// Pre-populate stale depth-2 layout: skills/ui-craft/ui-craft/SKILL.md
	staleDir := filepath.Join(skillsDir, "ui-craft", "ui-craft")
	if err := osfs.MkdirAll(staleDir, 0o755); err != nil {
		t.Fatalf("mkdir stale: %v", err)
	}
	staleFile := filepath.Join(staleDir, "SKILL.md")
	if err := osfs.WriteFile(staleFile, []byte("stale"), 0o644); err != nil {
		t.Fatalf("write stale: %v", err)
	}
	// Also populate the correct depth-1 file.
	depth1File := filepath.Join(skillsDir, "ui-craft", "SKILL.md")
	if err := osfs.WriteFile(depth1File, []byte("current"), 0o644); err != nil {
		t.Fatalf("write depth-1: %v", err)
	}

	embeddedSkillsFS := fakeSkillsFS("ui-craft")

	if _, err := cmd.RemoveOwnedSkills(osfs, skillsDir, embeddedSkillsFS); err != nil {
		t.Fatalf("RemoveOwnedSkills: %v", err)
	}

	// The entire ui-craft/ dir (including stale depth-2) must be removed.
	if _, err := osfs.Stat(filepath.Join(skillsDir, "ui-craft")); err == nil {
		t.Error("skills/ui-craft/ dir should be removed on uninstall")
	}
	if _, err := osfs.Stat(staleFile); err == nil {
		t.Error("stale depth-2 file should be removed")
	}
}
