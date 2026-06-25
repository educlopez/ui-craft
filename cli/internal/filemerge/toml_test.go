package filemerge

import (
	"strings"
	"testing"
)

// TestUpsertTOMLTableKey_absent creates a new block when none exists.
func TestUpsertTOMLTableKey_absent(t *testing.T) {
	result, err := UpsertTOMLTableKey("", "mcp_servers", "ui-craft", map[string]any{
		"command": "npx",
		"args":    []string{"-y", "ui-craft-mcp"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "[mcp_servers.ui-craft]") {
		t.Errorf("expected [mcp_servers.ui-craft] header in output:\n%s", result)
	}
	if !strings.Contains(result, `command = "npx"`) {
		t.Errorf("expected command = \"npx\" in output:\n%s", result)
	}
	if !strings.Contains(result, `"-y"`) {
		t.Errorf("expected -y arg in output:\n%s", result)
	}
}

// TestUpsertTOMLTableKey_preservesOtherTables checks that tables other than
// [mcp_servers.ui-craft] are left untouched (merge-not-clobber for TOML).
func TestUpsertTOMLTableKey_preservesOtherTables(t *testing.T) {
	existing := `[other_table]
key = "value"

[mcp_servers.some-other-tool]
command = "other"
args = ["-x"]
`
	result, err := UpsertTOMLTableKey(existing, "mcp_servers", "ui-craft", map[string]any{
		"command": "npx",
		"args":    []string{"-y", "ui-craft-mcp"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "[other_table]") {
		t.Error("[other_table] was removed")
	}
	if !strings.Contains(result, `key = "value"`) {
		t.Error(`key = "value" was removed from [other_table]`)
	}
	if !strings.Contains(result, "[mcp_servers.some-other-tool]") {
		t.Error("[mcp_servers.some-other-tool] was removed")
	}
	if !strings.Contains(result, "[mcp_servers.ui-craft]") {
		t.Error("[mcp_servers.ui-craft] was not added")
	}
}

// TestUpsertTOMLTableKey_replacesExisting verifies that an existing
// [mcp_servers.ui-craft] block is replaced, not duplicated.
func TestUpsertTOMLTableKey_replacesExisting(t *testing.T) {
	existing := `[mcp_servers.ui-craft]
command = "old-cmd"
args = ["-old"]
`
	result, err := UpsertTOMLTableKey(existing, "mcp_servers", "ui-craft", map[string]any{
		"command": "npx",
		"args":    []string{"-y", "ui-craft-mcp"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Must not contain the old command.
	if strings.Contains(result, "old-cmd") {
		t.Error("old command survived upsert")
	}
	// Must contain the new command.
	if !strings.Contains(result, `command = "npx"`) {
		t.Error("new command not present after upsert")
	}
	// Must contain only one header occurrence.
	count := strings.Count(result, "[mcp_servers.ui-craft]")
	if count != 1 {
		t.Errorf("expected exactly 1 [mcp_servers.ui-craft] header, found %d", count)
	}
}

// TestUpsertTOMLTableKey_windowsBackslash verifies that on all platforms the
// escaping helper doesn't break on non-path strings. (Full Windows-path
// escaping is only active when runtime.GOOS == "windows".)
func TestUpsertTOMLTableKey_regularString(t *testing.T) {
	result, err := UpsertTOMLTableKey("", "mcp_servers", "ui-craft", map[string]any{
		"command": "npx",
		"args":    []string{"-y", "ui-craft-mcp"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "mcp_servers") {
		t.Error("expected mcp_servers in result")
	}
}
