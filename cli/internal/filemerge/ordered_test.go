package filemerge

import (
	"errors"
	"strings"
	"testing"
)

var uiCraftEntry = struct {
	Command string   `json:"command"`
	Args    []string `json:"args"`
}{"npx", []string{"-y", "ui-craft-mcp@0.9.0"}}

// A ~/.claude.json-like file: keys in non-alphabetical order, nested state,
// an HTML-ish string and a big number that a map round-trip would mangle.
const claudeJSON = `{
  "numStartups": 42,
  "theme": "dark",
  "projects": {
    "/Users/me/app": {
      "allowedTools": [],
      "history": [
        {
          "display": "<b>fix</b> & ship"
        }
      ]
    }
  },
  "userID": 12345678901234567890,
  "mcpServers": {
    "zeta": {
      "command": "node",
      "args": [
        "z.js"
      ]
    },
    "alpha": {
      "type": "http",
      "url": "https://example.com/mcp"
    }
  },
  "autoUpdates": false
}`

func TestUpsertOrderedJSONKey_preservesEverythingElse(t *testing.T) {
	out, changed, err := UpsertOrderedJSONKey([]byte(claudeJSON), "mcpServers", "ui-craft", uiCraftEntry)
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if !changed {
		t.Fatal("changed = false on first insert")
	}
	want := strings.Replace(claudeJSON, `      "url": "https://example.com/mcp"
    }
  },`, `      "url": "https://example.com/mcp"
    },
    "ui-craft": {
      "command": "npx",
      "args": [
        "-y",
        "ui-craft-mcp@0.9.0"
      ]
    }
  },`, 1)
	if string(out) != want {
		t.Errorf("unexpected output.\n got:\n%s\nwant:\n%s", out, want)
	}
}

func TestUpsertOrderedJSONKey_idempotentReturnsSourceUntouched(t *testing.T) {
	first, _, err := UpsertOrderedJSONKey([]byte(claudeJSON), "mcpServers", "ui-craft", uiCraftEntry)
	if err != nil {
		t.Fatal(err)
	}
	second, changed, err := UpsertOrderedJSONKey(first, "mcpServers", "ui-craft", uiCraftEntry)
	if err != nil {
		t.Fatal(err)
	}
	if changed {
		t.Error("changed = true on a second identical upsert")
	}
	if string(second) != string(first) {
		t.Error("bytes differ on a second identical upsert")
	}
}

func TestUpsertOrderedJSONKey_replacesInPlace(t *testing.T) {
	src := `{"mcpServers":{"a":{},"ui-craft":{"command":"old"},"b":{}},"z":1}`
	out, changed, err := UpsertOrderedJSONKey([]byte(src), "mcpServers", "ui-craft", uiCraftEntry)
	if err != nil || !changed {
		t.Fatalf("changed=%v err=%v", changed, err)
	}
	s := string(out)
	a, us, b := strings.Index(s, `"a"`), strings.Index(s, `"ui-craft"`), strings.Index(s, `"b"`)
	if a > us || us > b {
		t.Errorf("ui-craft entry moved:\n%s", s)
	}
	if strings.Contains(s, `"old"`) {
		t.Errorf("old entry not replaced:\n%s", s)
	}
	if strings.HasSuffix(s, "\n") {
		t.Error("source had no trailing newline; output should not add one")
	}
}

func TestUpsertOrderedJSONKey_createsParentAndEmptyFile(t *testing.T) {
	for _, src := range []string{"", "  \n", `{"theme":"dark"}`} {
		out, changed, err := UpsertOrderedJSONKey([]byte(src), "mcpServers", "ui-craft", uiCraftEntry)
		if err != nil || !changed {
			t.Fatalf("src %q: changed=%v err=%v", src, changed, err)
		}
		if got := LookupOrderedJSONKey(out, "mcpServers", "ui-craft"); got == nil {
			t.Errorf("src %q: entry missing:\n%s", src, out)
		}
		if strings.Contains(src, "theme") && !strings.HasPrefix(string(out), "{\n  \"theme\"") {
			t.Errorf("existing key not kept first:\n%s", out)
		}
	}
}

func TestUpsertOrderedJSONKey_refusesInvalid(t *testing.T) {
	for _, src := range []string{
		`{not json`,
		`[1,2]`,
		`{"a":1} {"b":2}`,
		`{"mcpServers": "nope"}`,
		`{"mcpServers": null}`,
		"{\n  // comment\n  \"a\": 1\n}",
	} {
		out, _, err := UpsertOrderedJSONKey([]byte(src), "mcpServers", "ui-craft", uiCraftEntry)
		if !errors.Is(err, ErrNotJSONObject) {
			t.Errorf("src %q: err = %v, want ErrNotJSONObject", src, err)
		}
		if out != nil {
			t.Errorf("src %q: returned bytes on error", src)
		}
	}
}

func TestRemoveOrderedJSONKey(t *testing.T) {
	withUs, _, err := UpsertOrderedJSONKey([]byte(claudeJSON), "mcpServers", "ui-craft", uiCraftEntry)
	if err != nil {
		t.Fatal(err)
	}
	out, removed, err := RemoveOrderedJSONKey(withUs, "mcpServers", "ui-craft")
	if err != nil || !removed {
		t.Fatalf("removed=%v err=%v", removed, err)
	}
	if string(out) != claudeJSON {
		t.Errorf("remove did not restore the original bytes:\n%s", out)
	}

	// Absent key: untouched, removed=false.
	same, removed, err := RemoveOrderedJSONKey([]byte(claudeJSON), "mcpServers", "ui-craft")
	if err != nil || removed || string(same) != claudeJSON {
		t.Errorf("absent key: removed=%v err=%v", removed, err)
	}

	// Top-level key (legacy .mcp.json shape); the parent object stays even
	// when it becomes empty.
	out, removed, err = RemoveOrderedJSONKey([]byte(`{"ui-craft":{"command":"npx"},"mcpServers":{"ui-craft":{}}}`+"\n"), "", "ui-craft")
	if err != nil || !removed {
		t.Fatalf("top-level: removed=%v err=%v", removed, err)
	}
	if string(out) != "{\n  \"mcpServers\": {\n    \"ui-craft\": {}\n  }\n}\n" {
		t.Errorf("top-level removal output:\n%s", out)
	}
	out, _, _ = RemoveOrderedJSONKey(out, "mcpServers", "ui-craft")
	if string(out) != "{\n  \"mcpServers\": {}\n}\n" {
		t.Errorf("parent should remain as an empty object:\n%s", out)
	}

	if _, _, err := RemoveOrderedJSONKey([]byte(`{oops`), "mcpServers", "ui-craft"); !errors.Is(err, ErrNotJSONObject) {
		t.Errorf("invalid JSON: err = %v, want ErrNotJSONObject", err)
	}
}
