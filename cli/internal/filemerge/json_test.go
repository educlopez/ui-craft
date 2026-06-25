package filemerge

import (
	"encoding/json"
	"testing"
)

// helper: unmarshal JSON and compare key presence + value for a given key path.
func jsonGet(t *testing.T, data []byte, keys ...string) any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("jsonGet: unmarshal: %v", err)
	}
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

// TestMergeJSONObjects_basicMerge checks that overlay keys are added to base
// without removing existing keys.
func TestMergeJSONObjects_basicMerge(t *testing.T) {
	base := []byte(`{"mcpServers":{"existing":{"command":"node","args":["server.js"]}}}`)
	overlay := []byte(`{"mcpServers":{"ui-craft":{"__replace__":{"command":"npx","args":["-y","ui-craft-mcp"]}}}}`)

	out, err := MergeJSONObjects(base, overlay)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// "existing" must survive.
	existing := jsonGet(t, out, "mcpServers", "existing")
	if existing == nil {
		t.Fatal("merge removed existing mcpServers key")
	}

	// "ui-craft" must be present.
	uiCraft := jsonGet(t, out, "mcpServers", "ui-craft")
	if uiCraft == nil {
		t.Fatal("merge did not add ui-craft mcpServers key")
	}
}

// TestMergeJSONObjects_malformedBase checks gotcha #2: malformed base falls
// back to {} and the overlay is still applied.
func TestMergeJSONObjects_malformedBase(t *testing.T) {
	base := []byte(`{this is not valid JSON`)
	overlay := []byte(`{"mcpServers":{"ui-craft":{"command":"npx","args":["-y","ui-craft-mcp"]}}}`)

	out, err := MergeJSONObjects(base, overlay)
	if err != nil {
		t.Fatalf("malformed base must not return error, got: %v", err)
	}

	uiCraft := jsonGet(t, out, "mcpServers", "ui-craft")
	if uiCraft == nil {
		t.Fatal("ui-craft key missing after malformed-base fallback")
	}
}

// TestMergeJSONObjects_jsoncComments verifies that JSONC // and /* */ comments
// and trailing commas are stripped before parse.
func TestMergeJSONObjects_jsoncComments(t *testing.T) {
	base := []byte(`{
  // This is a comment
  "mcpServers": {
    /* block comment */
    "other": {"command": "other-tool"}, // trailing comma
  }
}`)
	overlay := []byte(`{"mcpServers":{"ui-craft":{"command":"npx","args":["-y","ui-craft-mcp"]}}}`)

	out, err := MergeJSONObjects(base, overlay)
	if err != nil {
		t.Fatalf("JSONC base must not cause error: %v", err)
	}

	// "other" must survive.
	other := jsonGet(t, out, "mcpServers", "other")
	if other == nil {
		t.Fatal("'other' server was removed after JSONC merge")
	}

	// "ui-craft" must be present.
	uiCraft := jsonGet(t, out, "mcpServers", "ui-craft")
	if uiCraft == nil {
		t.Fatal("ui-craft not present in merged JSONC output")
	}
}

// TestMergeJSONObjects_replacesentinel verifies that {"__replace__": val}
// force-replaces the key's subtree rather than merging recursively.
func TestMergeJSONObjects_replaceSentinel(t *testing.T) {
	base := []byte(`{"mcpServers":{"ui-craft":{"command":"old","args":["old-arg"],"extra":"keep-me-not"}}}`)
	overlay := []byte(`{"mcpServers":{"ui-craft":{"__replace__":{"command":"npx","args":["-y","ui-craft-mcp"]}}}}`)

	out, err := MergeJSONObjects(base, overlay)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	uiCraft, ok := jsonGet(t, out, "mcpServers", "ui-craft").(map[string]any)
	if !ok {
		t.Fatal("ui-craft is not a map")
	}
	// "extra" must be gone (replaced, not merged).
	if _, has := uiCraft["extra"]; has {
		t.Error("__replace__ sentinel did not replace: 'extra' key survived")
	}
	if uiCraft["command"] != "npx" {
		t.Errorf("expected command=npx, got %v", uiCraft["command"])
	}
}

// TestMergeJSONObjects_idempotent verifies that merging the same overlay twice
// produces identical output (no duplication, no error).
func TestMergeJSONObjects_idempotent(t *testing.T) {
	base := []byte(`{}`)
	overlay := []byte(`{"mcpServers":{"ui-craft":{"__replace__":{"command":"npx","args":["-y","ui-craft-mcp"]}}}}`)

	out1, err := MergeJSONObjects(base, overlay)
	if err != nil {
		t.Fatalf("first merge error: %v", err)
	}
	out2, err := MergeJSONObjects(out1, overlay)
	if err != nil {
		t.Fatalf("second merge error: %v", err)
	}

	// Output must be identical after second application.
	if string(out1) != string(out2) {
		t.Errorf("merge is not idempotent:\nfirst:  %s\nsecond: %s", out1, out2)
	}
}

// TestStripJSONC_lineComment checks that // comments are removed.
func TestStripJSONC_lineComment(t *testing.T) {
	input := `{"a": 1 // comment
}`
	result := stripJSONC([]byte(input))
	var m map[string]any
	if err := json.Unmarshal(result, &m); err != nil {
		t.Fatalf("stripJSONC output not valid JSON: %v\ninput: %s\noutput: %s", err, input, result)
	}
}

// TestStripJSONC_blockComment checks that /* */ comments are removed.
func TestStripJSONC_blockComment(t *testing.T) {
	input := `{"a": /* comment */ 1}`
	result := stripJSONC([]byte(input))
	var m map[string]any
	if err := json.Unmarshal(result, &m); err != nil {
		t.Fatalf("stripJSONC output not valid JSON: %v", err)
	}
}

// TestStripJSONC_trailingComma checks that trailing commas are removed.
func TestStripJSONC_trailingComma(t *testing.T) {
	input := `{"a": 1, "b": 2,}`
	result := stripJSONC([]byte(input))
	var m map[string]any
	if err := json.Unmarshal(result, &m); err != nil {
		t.Fatalf("stripJSONC trailing-comma removal failed: %v\noutput: %s", err, result)
	}
}
