package cmd_test

// uninstall_test.go — tests for the uninstall command.
//
// Test scenarios:
//   - Uninstall removes our entries AND preserves a pre-existing user MCP server.
//   - Design-memory is preserved unless explicitly targeted.
//   - A snapshot is created before removal.
//
// Tests use real OS filesystem (temp dirs) for backup/snapshot checks.

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

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
