package tui

import (
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/harness"
)

// A change that wrote nothing and carries a Notice must read as "action needed"
// with the notice shown, never as "already configured".
func TestProgressView_noticeIsActionNeeded(t *testing.T) {
	m := ProgressModel{changes: []harness.Change{{
		HarnessName: "opencode",
		Component:   "mcp-gates",
		Notice:      "opencode.jsonc has comments; copy the \"ui-craft\" key",
	}}}
	view := m.View()
	if !strings.Contains(view, "opencode/mcp-gates: action needed") {
		t.Errorf("view does not flag the manual step:\n%s", view)
	}
	if strings.Contains(view, "already configured") {
		t.Errorf("view reports a manual step as already configured:\n%s", view)
	}
	if !strings.Contains(view, `copy the "ui-craft" key`) {
		t.Errorf("view does not show the notice:\n%s", view)
	}
}
