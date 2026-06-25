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

// TestUpsertTOMLTableKey_arrayOfTablesAfterBlock verifies that a [[array-of-tables]]
// section following [mcp_servers.ui-craft] survives intact after an upsert/replace.
// This is the regression test for the CRITICAL data-loss bug where the end-of-section
// scan previously skipped [[...]] headers, causing them to be swallowed into the
// discarded old-block range.
func TestUpsertTOMLTableKey_arrayOfTablesAfterBlock(t *testing.T) {
	existing := `[mcp_servers.ui-craft]
command = "old-cmd"
args = ["-old"]

[[plugins]]
name = "some-plugin"
enabled = true
`
	// First upsert: replaces the existing block.
	result, err := UpsertTOMLTableKey(existing, "mcp_servers", "ui-craft", map[string]any{
		"command": "npx",
		"args":    []string{"-y", "ui-craft-mcp"},
	})
	if err != nil {
		t.Fatalf("first upsert: unexpected error: %v", err)
	}

	// The [[plugins]] section must survive.
	if !strings.Contains(result, "[[plugins]]") {
		t.Errorf("first upsert: [[plugins]] header was swallowed:\n%s", result)
	}
	if !strings.Contains(result, `name = "some-plugin"`) {
		t.Errorf("first upsert: [[plugins]] body was swallowed:\n%s", result)
	}
	if !strings.Contains(result, "enabled = true") {
		t.Errorf("first upsert: [[plugins]] enabled key was swallowed:\n%s", result)
	}
	// The old command must be gone.
	if strings.Contains(result, "old-cmd") {
		t.Errorf("first upsert: old command survived:\n%s", result)
	}
	// The new command must be present.
	if !strings.Contains(result, `command = "npx"`) {
		t.Errorf("first upsert: new command not present:\n%s", result)
	}

	// Second upsert (idempotency): same operation on already-updated content.
	result2, err := UpsertTOMLTableKey(result, "mcp_servers", "ui-craft", map[string]any{
		"command": "npx",
		"args":    []string{"-y", "ui-craft-mcp"},
	})
	if err != nil {
		t.Fatalf("second upsert: unexpected error: %v", err)
	}
	if !strings.Contains(result2, "[[plugins]]") {
		t.Errorf("second upsert: [[plugins]] header was swallowed:\n%s", result2)
	}
	if !strings.Contains(result2, `name = "some-plugin"`) {
		t.Errorf("second upsert: [[plugins]] body was swallowed:\n%s", result2)
	}
	count := strings.Count(result2, "[mcp_servers.ui-craft]")
	if count != 1 {
		t.Errorf("second upsert: expected 1 header occurrence, got %d:\n%s", count, result2)
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
