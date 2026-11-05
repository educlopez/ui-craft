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

// A hand-edited config can hold the same key twice. JSON parsers keep the
// last occurrence, so a helper that only touched the first one would report
// success while the harness still read the stale entry.
const dupJSON = `{
  "mcpServers": {
    "ui-craft": {
      "command": "old-first"
    },
    "other": {
      "command": "keep"
    },
    "ui-craft": {
      "command": "old-second"
    }
  }
}
`

func TestUpsertOrderedJSONKey_collapsesDuplicateKeys(t *testing.T) {
	out, changed, err := UpsertOrderedJSONKey([]byte(dupJSON), "mcpServers", "ui-craft", uiCraftEntry)
	if err != nil || !changed {
		t.Fatalf("upsert: changed=%v err=%v", changed, err)
	}
	s := string(out)
	if n := strings.Count(s, `"ui-craft"`); n != 1 {
		t.Fatalf("want exactly one ui-craft entry, got %d:\n%s", n, s)
	}
	if strings.Contains(s, "old-") || !strings.Contains(s, "ui-craft-mcp@0.9.0") || !strings.Contains(s, `"keep"`) {
		t.Fatalf("stale duplicate kept or neighbour lost:\n%s", s)
	}
	if strings.Index(s, `"ui-craft"`) > strings.Index(s, `"other"`) {
		t.Fatalf("entry should stay at the first occurrence's position:\n%s", s)
	}
	// A second run sees one up-to-date entry and changes nothing.
	again, changed, err := UpsertOrderedJSONKey(out, "mcpServers", "ui-craft", uiCraftEntry)
	if err != nil || changed || string(again) != s {
		t.Fatalf("second upsert should be a no-op: changed=%v err=%v", changed, err)
	}
}

func TestUpsertOrderedJSONKey_duplicateWithEqualFirstStillChanges(t *testing.T) {
	src := `{"mcpServers":{"ui-craft":{"command":"npx","args":["-y","ui-craft-mcp@0.9.0"]},"ui-craft":{"command":"stale"}}}`
	out, changed, err := UpsertOrderedJSONKey([]byte(src), "mcpServers", "ui-craft", uiCraftEntry)
	if err != nil || !changed {
		t.Fatalf("a stale later duplicate must force a write: changed=%v err=%v", changed, err)
	}
	if strings.Contains(string(out), "stale") {
		t.Fatalf("stale duplicate kept:\n%s", out)
	}
}

func TestRemoveOrderedJSONKey_removesEveryDuplicate(t *testing.T) {
	out, removed, err := RemoveOrderedJSONKey([]byte(dupJSON), "mcpServers", "ui-craft")
	if err != nil || !removed {
		t.Fatalf("remove: removed=%v err=%v", removed, err)
	}
	if strings.Contains(string(out), "ui-craft") || !strings.Contains(string(out), `"keep"`) {
		t.Fatalf("duplicate survived or neighbour lost:\n%s", out)
	}

	top := `{"ui-craft":{"command":"a"},"x":1,"ui-craft":{"command":"b"}}`
	out, removed, err = RemoveOrderedJSONKey([]byte(top), "", "ui-craft")
	if err != nil || !removed || strings.Contains(string(out), "ui-craft") {
		t.Fatalf("top-level duplicates: removed=%v err=%v out=%s", removed, err, out)
	}

	parents := `{"mcp":{"ui-craft":{"a":1}},"mcp":{"ui-craft":{"b":2},"y":true}}`
	out, removed, err = RemoveOrderedJSONKey([]byte(parents), "mcp", "ui-craft")
	if err != nil || !removed || strings.Contains(string(out), "ui-craft") || !strings.Contains(string(out), `"y"`) {
		t.Fatalf("duplicate parents: removed=%v err=%v out=%s", removed, err, out)
	}
}

func TestLookupOrderedJSONKey_readsLastDuplicate(t *testing.T) {
	got := LookupOrderedJSONKey([]byte(dupJSON), "mcpServers", "ui-craft")
	if !strings.Contains(string(got), "old-second") {
		t.Fatalf("lookup should return the occurrence a parser keeps, got %s", got)
	}
}
