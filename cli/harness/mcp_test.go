package harness

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// uiCraftServer is the canonical MCP server definition used across all tests.
var uiCraftServer = MCPServer{
	Name:    "ui-craft",
	Command: "npx",
	Args:    []string{"-y", "ui-craft-mcp"},
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

// readJSON reads a file from the MemFS and unmarshals it.
func readJSON(t *testing.T, mem *fsutil.MemFS, path string) map[string]any {
	t.Helper()
	data, err := mem.ReadFile(path)
	if err != nil {
		t.Fatalf("readJSON: ReadFile %s: %v", path, err)
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("readJSON: Unmarshal %s: %v", path, err)
	}
	return m
}

// jsonGet traverses a JSON map by key path and returns the value.
func jsonGet(t *testing.T, m map[string]any, keys ...string) any {
	t.Helper()
	var cur any = m
	for _, k := range keys {
		mm, ok := cur.(map[string]any)
		if !ok {
			t.Fatalf("jsonGet: %v is not a map at key %q", cur, k)
		}
		cur = mm[k]
	}
	return cur
}

// readFile reads raw bytes from a MemFS file.
func readFile(t *testing.T, mem *fsutil.MemFS, path string) string {
	t.Helper()
	data, err := mem.ReadFile(path)
	if err != nil {
		t.Fatalf("readFile %s: %v", path, err)
	}
	return string(data)
}

// --------------------------------------------------------------------------
// Claude — SeparateFiles
// --------------------------------------------------------------------------

// TestWriteMCP_claudeAbsent verifies that Claude creates the MCP file when absent.
func TestWriteMCP_claudeAbsent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := ClaudeHarness{}
	change, err := h.WriteMCP(mem, uiCraftServer)
	if err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if change.ExistedBefore {
		t.Error("ExistedBefore should be false for a new file")
	}

	m := readJSON(t, mem, change.FilePath)
	entry, ok := m["ui-craft"].(map[string]any)
	if !ok {
		t.Fatal("missing 'ui-craft' key in Claude MCP file")
	}
	if entry["command"] != "npx" {
		t.Errorf("command = %v, want npx", entry["command"])
	}
}

// TestWriteMCP_claudeIdempotent verifies that a second run on Claude produces
// no change (byte-compare skip).
func TestWriteMCP_claudeIdempotent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := ClaudeHarness{}

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("first WriteMCP: %v", err)
	}
	first, _ := mem.ReadFile(h.ConfigPaths().MCPConfig)

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("second WriteMCP: %v", err)
	}
	second, _ := mem.ReadFile(h.ConfigPaths().MCPConfig)

	if string(first) != string(second) {
		t.Errorf("WriteMCP is not idempotent:\nfirst:  %s\nsecond: %s", first, second)
	}
}

// --------------------------------------------------------------------------
// Cursor — ConfigFile (merge into mcp.json)
// --------------------------------------------------------------------------

// TestWriteMCP_cursorAbsent verifies that Cursor creates mcp.json when absent.
func TestWriteMCP_cursorAbsent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := CursorHarness{}
	change, err := h.WriteMCP(mem, uiCraftServer)
	if err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if change.ExistedBefore {
		t.Error("ExistedBefore should be false for a new file")
	}

	m := readJSON(t, mem, change.FilePath)
	uiCraft := jsonGet(t, m, "mcpServers", "ui-craft")
	if uiCraft == nil {
		t.Fatal("ui-craft missing from mcpServers")
	}
}

// TestWriteMCP_cursorPreservesExistingServer is the spec's "merge-not-clobber"
// scenario: a pre-existing user server must survive after wiring ui-craft.
func TestWriteMCP_cursorPreservesExistingServer(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := CursorHarness{}
	target := h.ConfigPaths().MCPConfig

	// Pre-populate with a user's existing server.
	existing := `{"mcpServers":{"my-other-tool":{"command":"node","args":["server.js"]}}}`
	if err := mem.WriteFile(target, []byte(existing), 0o644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}

	m := readJSON(t, mem, target)

	// The existing server must survive unchanged.
	other := jsonGet(t, m, "mcpServers", "my-other-tool")
	if other == nil {
		t.Fatal("my-other-tool was removed by WriteMCP (clobbered)")
	}

	// Our server must be present.
	uiCraft := jsonGet(t, m, "mcpServers", "ui-craft")
	if uiCraft == nil {
		t.Fatal("ui-craft missing from mcpServers after merge")
	}
}

// TestWriteMCP_cursorIdempotent verifies two consecutive Cursor writes produce
// identical output.
func TestWriteMCP_cursorIdempotent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := CursorHarness{}
	target := h.ConfigPaths().MCPConfig

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("first: %v", err)
	}
	first, _ := mem.ReadFile(target)

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("second: %v", err)
	}
	second, _ := mem.ReadFile(target)

	if string(first) != string(second) {
		t.Errorf("Cursor WriteMCP is not idempotent:\nfirst:  %s\nsecond: %s", first, second)
	}
}

// TestWriteMCP_cursorMalformedBase checks that a corrupt mcp.json falls back
// to {} and still writes our key (gotcha #2).
func TestWriteMCP_cursorMalformedBase(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := CursorHarness{}
	target := h.ConfigPaths().MCPConfig

	if err := mem.WriteFile(target, []byte(`{not valid json`), 0o644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("WriteMCP on malformed base: %v", err)
	}

	m := readJSON(t, mem, target)
	uiCraft := jsonGet(t, m, "mcpServers", "ui-craft")
	if uiCraft == nil {
		t.Fatal("ui-craft missing after malformed-base recovery")
	}
}

// TestWriteMCP_cursorJSONC verifies that a JSONC mcp.json (with comments) is
// handled correctly and our key is added without destroying the parse.
func TestWriteMCP_cursorJSONC(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := CursorHarness{}
	target := h.ConfigPaths().MCPConfig

	jsonc := []byte(`{
  // Cursor MCP config
  "mcpServers": {
    /* block comment */
    "existing": {"command": "node", "args": ["s.js"]}, // trailing comma
  }
}`)
	if err := mem.WriteFile(target, jsonc, 0o644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("WriteMCP on JSONC base: %v", err)
	}

	m := readJSON(t, mem, target)
	if jsonGet(t, m, "mcpServers", "existing") == nil {
		t.Error("'existing' server removed after JSONC merge")
	}
	if jsonGet(t, m, "mcpServers", "ui-craft") == nil {
		t.Error("ui-craft not added into JSONC config")
	}
}

// --------------------------------------------------------------------------
// Codex — TOMLFile
// --------------------------------------------------------------------------

// TestWriteMCP_codexAbsent verifies Codex creates config.toml when absent.
func TestWriteMCP_codexAbsent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := CodexHarness{}
	change, err := h.WriteMCP(mem, uiCraftServer)
	if err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if change.ExistedBefore {
		t.Error("ExistedBefore should be false")
	}

	content := readFile(t, mem, change.FilePath)
	if !strings.Contains(content, "[mcp_servers.ui-craft]") {
		t.Errorf("expected [mcp_servers.ui-craft] in config.toml:\n%s", content)
	}
	if !strings.Contains(content, `command = "npx"`) {
		t.Errorf("expected command = \"npx\" in config.toml:\n%s", content)
	}
}

// TestWriteMCP_codexPreservesOtherTables ensures other TOML tables survive.
func TestWriteMCP_codexPreservesOtherTables(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := CodexHarness{}
	target := h.ConfigPaths().MCPConfig

	existing := `[settings]
theme = "dark"

[mcp_servers.other-tool]
command = "other"
args = ["-x"]
`
	if err := mem.WriteFile(target, []byte(existing), 0o644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}

	content := readFile(t, mem, target)
	if !strings.Contains(content, "[settings]") {
		t.Error("[settings] table was removed")
	}
	if !strings.Contains(content, `theme = "dark"`) {
		t.Error("theme key was removed")
	}
	if !strings.Contains(content, "[mcp_servers.other-tool]") {
		t.Error("[mcp_servers.other-tool] was removed")
	}
	if !strings.Contains(content, "[mcp_servers.ui-craft]") {
		t.Error("[mcp_servers.ui-craft] not added")
	}
}

// TestWriteMCP_codexIdempotent verifies repeated Codex writes are idempotent.
func TestWriteMCP_codexIdempotent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := CodexHarness{}
	target := h.ConfigPaths().MCPConfig

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("first: %v", err)
	}
	first, _ := mem.ReadFile(target)

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("second: %v", err)
	}
	second, _ := mem.ReadFile(target)

	if string(first) != string(second) {
		t.Errorf("Codex WriteMCP is not idempotent:\nfirst:  %s\nsecond: %s", first, second)
	}
}

// --------------------------------------------------------------------------
// Gemini — MergeIntoSettings
// --------------------------------------------------------------------------

// TestWriteMCP_geminiAbsent verifies Gemini creates settings.json when absent.
func TestWriteMCP_geminiAbsent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := GeminiHarness{}
	change, err := h.WriteMCP(mem, uiCraftServer)
	if err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if change.ExistedBefore {
		t.Error("ExistedBefore should be false")
	}

	m := readJSON(t, mem, change.FilePath)
	if jsonGet(t, m, "mcpServers", "ui-craft") == nil {
		t.Fatal("ui-craft missing from Gemini settings.json")
	}
}

// TestWriteMCP_geminiMerge checks that Gemini preserves existing settings keys.
func TestWriteMCP_geminiMerge(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := GeminiHarness{}
	target := h.ConfigPaths().MCPConfig

	existing := `{"theme":"dark","mcpServers":{"other":{"command":"other"}}}`
	if err := mem.WriteFile(target, []byte(existing), 0o644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}

	m := readJSON(t, mem, target)
	if m["theme"] != "dark" {
		t.Errorf("top-level 'theme' key removed, got %v", m["theme"])
	}
	if jsonGet(t, m, "mcpServers", "other") == nil {
		t.Error("'other' server removed")
	}
	if jsonGet(t, m, "mcpServers", "ui-craft") == nil {
		t.Error("ui-craft not added")
	}
}

// TestWriteMCP_geminiIdempotent verifies Gemini writes are idempotent.
func TestWriteMCP_geminiIdempotent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := GeminiHarness{}
	target := h.ConfigPaths().MCPConfig

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("first: %v", err)
	}
	first, _ := mem.ReadFile(target)

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("second: %v", err)
	}
	second, _ := mem.ReadFile(target)

	if string(first) != string(second) {
		t.Errorf("Gemini WriteMCP not idempotent:\nfirst:  %s\nsecond: %s", first, second)
	}
}

// --------------------------------------------------------------------------
// OpenCode — MergeIntoSettings (JSONC)
// --------------------------------------------------------------------------

// TestWriteMCP_opencodeAbsent verifies OpenCode creates opencode.json when absent.
func TestWriteMCP_opencodeAbsent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := OpenCodeHarness{}
	change, err := h.WriteMCP(mem, uiCraftServer)
	if err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if change.ExistedBefore {
		t.Error("ExistedBefore should be false")
	}

	m := readJSON(t, mem, change.FilePath)
	entry := jsonGet(t, m, "mcp", "ui-craft")
	if entry == nil {
		t.Fatal("ui-craft missing under 'mcp' in opencode.json")
	}
	entryMap, ok := entry.(map[string]any)
	if !ok {
		t.Fatal("ui-craft is not a map")
	}
	if entryMap["type"] != "local" {
		t.Errorf("type = %v, want local", entryMap["type"])
	}
}

// TestWriteMCP_opencodeJSONC verifies that JSONC opencode.json (with comments)
// is handled correctly — our key is added without destroying the parse.
func TestWriteMCP_opencodeJSONC(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := OpenCodeHarness{}
	target := h.ConfigPaths().MCPConfig

	jsonc := []byte(`{
  // OpenCode config
  "theme": "dark",
  "mcp": {
    /* existing servers */
    "other-server": {"type": "local", "command": ["node", "s.js"]}, // trailing comma
  }
}`)
	if err := mem.WriteFile(target, jsonc, 0o644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("WriteMCP on JSONC: %v", err)
	}

	m := readJSON(t, mem, target)
	if m["theme"] != "dark" {
		t.Error("'theme' key was removed")
	}
	if jsonGet(t, m, "mcp", "other-server") == nil {
		t.Error("'other-server' was removed from mcp")
	}
	if jsonGet(t, m, "mcp", "ui-craft") == nil {
		t.Error("ui-craft not added under mcp in JSONC config")
	}
}

// TestWriteMCP_opencodeIdempotent verifies OpenCode writes are idempotent.
func TestWriteMCP_opencodeIdempotent(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := OpenCodeHarness{}
	target := h.ConfigPaths().MCPConfig

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("first: %v", err)
	}
	first, _ := mem.ReadFile(target)

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("second: %v", err)
	}
	second, _ := mem.ReadFile(target)

	if string(first) != string(second) {
		t.Errorf("OpenCode WriteMCP not idempotent:\nfirst:  %s\nsecond: %s", first, second)
	}
}

// TestWriteMCP_opencodePreservesExistingServer checks merge-not-clobber for OpenCode.
func TestWriteMCP_opencodePreservesExistingServer(t *testing.T) {
	mem := fsutil.NewMemFS()
	h := OpenCodeHarness{}
	target := h.ConfigPaths().MCPConfig

	existing := `{"mcp":{"user-server":{"type":"local","command":["node","s.js"]}}}`
	if err := mem.WriteFile(target, []byte(existing), 0o644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if _, err := h.WriteMCP(mem, uiCraftServer); err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}

	m := readJSON(t, mem, target)
	if jsonGet(t, m, "mcp", "user-server") == nil {
		t.Error("user-server was removed (clobbered)")
	}
	if jsonGet(t, m, "mcp", "ui-craft") == nil {
		t.Error("ui-craft not added")
	}
}
