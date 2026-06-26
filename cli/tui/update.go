// Package tui — update.go
// Wires the launch-time update-check into the TUI as a non-blocking goroutine.
// The check fires from Init() concurrently with detection so it never delays
// the install flow.
package tui

import (
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// updateResultMsg is the internal Bubble Tea message delivered when the
// background update-check goroutine completes.
type updateResultMsg struct {
	result core.UpdateResult
}

// updateCheckCmd returns a Bubble Tea Cmd that runs CheckForUpdate in a
// goroutine and delivers an updateResultMsg. Fail-open: any error inside
// CheckForUpdate is already swallowed by that function.
func updateCheckCmd(version string) tea.Cmd {
	return func() tea.Msg {
		home, err := os.UserHomeDir()
		if err != nil {
			// Cannot resolve home — silently skip.
			return updateResultMsg{}
		}
		stateRoot := filepath.Join(home, ".ui-craft")
		result := core.CheckForUpdate(fsutil.OsFS{}, stateRoot, version)
		return updateResultMsg{result: result}
	}
}
