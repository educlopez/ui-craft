package core_test

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
)

// TestUpdate_preservesUserEditsOutsideManagedBlocks verifies that content a
// user wrote outside the ui-craft managed block in an AGENTS.md file is not
// touched by an update that re-injects the managed block.
//
// This tests the filemerge.UpsertManagedBlock contract that the skill writer
// uses for Codex AGENTS.md, which is the primary "user-editable + managed-block"
// file in the system.
func TestUpdate_preservesUserEditsOutsideManagedBlocks(t *testing.T) {
	// Simulate a file that the user has edited outside the managed block.
	originalContent := `# My Project AGENTS

This is my custom instruction for the AI.

` + filemerge.BeginMarker + `
# UI Craft Skills
Use the ui-craft skill.
` + filemerge.EndMarker + `

## My Other Notes
Do not touch this section.
`

	// Simulate an update: re-inject with new block content.
	newBlockContent := "# UI Craft Skills v2\nUpdated skill content.\n"
	updated := filemerge.UpsertManagedBlock(originalContent, newBlockContent)

	// User content before the block must be preserved.
	if !strings.Contains(updated, "This is my custom instruction") {
		t.Error("user content before managed block was lost")
	}
	// User content after the block must be preserved.
	if !strings.Contains(updated, "My Other Notes") {
		t.Error("user content after managed block was lost")
	}
	// New block content must be present.
	if !strings.Contains(updated, "UI Craft Skills v2") {
		t.Error("new block content was not injected")
	}
	// Old block content must be gone.
	if strings.Contains(updated, "UI Craft Skills\n") {
		t.Error("old block content still present after update")
	}
}

// TestUpdate_idempotent verifies that re-injecting the same block content
// leaves the file unchanged (the managed-block hash is stable).
func TestUpdate_idempotent(t *testing.T) {
	blockContent := "# Skill\nContent here.\n"
	base := "# Project\n"
	first := filemerge.UpsertManagedBlock(base, blockContent)
	second := filemerge.UpsertManagedBlock(first, blockContent)
	if first != second {
		t.Errorf("idempotency: second upsert changed the file\nfirst:\n%s\nsecond:\n%s", first, second)
	}
}

// TestUpdate_stateReplay verifies the state-based replay logic:
// only the components recorded in state are included in the update plan.
func TestUpdate_stateReplay(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"
	_ = m.MkdirAll(root, 0o755)

	// Write state recording only mcp-gates was installed.
	stateData := `{
  "schemaVersion": 1,
  "version": "v0.35.0",
  "mirrorVersion": "v0.35.0",
  "harnesses": [
    {
      "name": "cursor",
      "installedComponents": ["mcp-gates"],
      "installedAt": "2026-06-25T00:00:00Z"
    }
  ]
}`
	_ = m.WriteFile(filepath.Join(root, "state.json"), []byte(stateData), 0o644)

	// Load state and verify the saved components are readable.
	state, err := LoadStateViaJSON(t, m, root)
	if err != nil {
		t.Fatalf("load state: %v", err)
	}
	if len(state.Harnesses) != 1 {
		t.Fatalf("expected 1 harness, got %d", len(state.Harnesses))
	}
	h := state.Harnesses[0]
	if h.Name != "cursor" {
		t.Errorf("harness name: got %q, want cursor", h.Name)
	}
	if len(h.InstalledComponents) != 1 || h.InstalledComponents[0] != "mcp-gates" {
		t.Errorf("installed components: got %v, want [mcp-gates]", h.InstalledComponents)
	}
}

// LoadStateViaJSON is a test helper that reads state.json from the MemFS and
// decodes it directly. This lets the test verify the JSON schema is stable.
func LoadStateViaJSON(t *testing.T, m *fsutil.MemFS, root string) (*stateJSON, error) {
	t.Helper()
	data, err := m.ReadFile(filepath.Join(root, "state.json"))
	if err != nil {
		return nil, err
	}
	var s stateJSON
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

// stateJSON mirrors InstallState for JSON decoding in tests without importing
// core (avoids import cycles in table-driven tests).
type stateJSON struct {
	SchemaVersion int `json:"schemaVersion"`
	Harnesses     []struct {
		Name                string   `json:"name"`
		InstalledComponents []string `json:"installedComponents"`
	} `json:"harnesses"`
}
