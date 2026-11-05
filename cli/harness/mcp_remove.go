package harness

import (
	"fmt"

	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
)

// RemoveMCP removes only the named server entry from h's MCP config and
// never deletes the file itself: every MCP config ui-craft touches is shared
// with the user or with the harness (~/.claude.json, .mcp.json, mcp.json,
// settings.json, opencode.json(c), config.toml).
//
// A missing file or a missing entry is a no-op (Changed=false); any other
// read error is returned. A JSON file
// that does not parse as plain JSON (corrupt, or JSONC with comments) is not
// rewritten: the returned Change carries a Notice naming the entry to delete
// by hand.
func RemoveMCP(w fsutil.FileSystem, h Harness, name string) (Change, error) {
	target := h.ConfigPaths().MCPConfig
	if target == "" {
		return Change{}, nil
	}
	existing, existed, err := readConfigFile(w, target)
	if err != nil {
		return Change{}, fmt.Errorf("%s: read %s: %w", h.Name(), target, err)
	}
	if !existed {
		return Change{FilePath: target}, nil
	}
	ch := Change{FilePath: target, PriorBytes: existing, ExistedBefore: true}

	var updated []byte
	switch h.Name() {
	case "codex":
		out := filemerge.RemoveTOMLTable(string(existing), "mcp_servers", name)
		updated = []byte(out)
	default:
		parent := "mcpServers"
		if h.Name() == "opencode" {
			parent = "mcp"
		}
		out, removed, rerr := filemerge.RemoveOrderedJSONKey(existing, parent, name)
		if rerr != nil {
			ch.Notice = fmt.Sprintf("%s is not plain JSON (comments or a syntax error), so ui-craft left it untouched; "+
				"delete the %q entry under %q by hand", target, name, parent)
			return ch, nil
		}
		// Claude project .mcp.json: also drop the top-level entry older
		// ui-craft versions wrote without the mcpServers wrapper.
		if h.Name() == "claude" && h.ConfigPaths().ProjectRoot != "" &&
			isLegacyServerEntry(filemerge.LookupOrderedJSONKey(out, "", name)) {
			out2, removed2, err2 := filemerge.RemoveOrderedJSONKey(out, "", name)
			if err2 == nil {
				out, removed = out2, removed || removed2
			}
		}
		if !removed {
			return ch, nil
		}
		updated = out
	}

	// The file exists here, so writeConfigFile keeps its current mode.
	wr, err := writeConfigFile(w, target, updated, 0o644)
	if err != nil {
		return Change{}, fmt.Errorf("%s: write %s: %w", h.Name(), target, err)
	}
	ch.Changed = wr.Changed
	return ch, nil
}
