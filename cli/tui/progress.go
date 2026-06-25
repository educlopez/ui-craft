package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/harness"
)

// ProgressModel renders per-target apply progress and the final result summary.
// It receives Change records from core.Apply via ApplyResultMsg.
type ProgressModel struct {
	changes  []harness.Change
	applying bool
	err      error
}

// NewProgressModel creates a ProgressModel in the "applying" state.
func NewProgressModel() ProgressModel {
	return ProgressModel{applying: true}
}

// Init implements tea.Model.
func (m ProgressModel) Init() tea.Cmd { return nil }

// Update handles ApplyResultMsg delivered from the apply goroutine.
func (m ProgressModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case ApplyResultMsg:
		m.applying = false
		m.changes = msg.Changes
		m.err = msg.Err
	}
	return m, nil
}

// View renders the apply progress/result.
func (m ProgressModel) View() string {
	var sb strings.Builder
	sb.WriteString(titleStyle().Render("Installing"))
	sb.WriteString("\n\n")

	if m.applying {
		sb.WriteString(mutedStyle().Render("Applying changes..."))
		sb.WriteByte('\n')
		return sb.String()
	}

	if m.err != nil {
		sb.WriteString(errorStyle().Render("Error: " + m.err.Error()))
		sb.WriteString("\n")
		sb.WriteString(mutedStyle().Render("All changes have been rolled back."))
		sb.WriteByte('\n')
		return sb.String()
	}

	for _, ch := range m.changes {
		status := "created"
		if !ch.Changed {
			status = "already configured"
		} else if ch.ExistedBefore {
			status = "updated"
		}
		line := fmt.Sprintf("  %s/%s: %s", ch.HarnessName, ch.Component, status)
		if ch.Changed {
			sb.WriteString(successStyle().Render(line))
		} else {
			sb.WriteString(mutedStyle().Render(line))
		}
		sb.WriteByte('\n')
	}

	sb.WriteString("\n")
	sb.WriteString(successStyle().Render("Done! Press any key to exit."))
	sb.WriteByte('\n')
	return sb.String()
}

// IsDone returns true when apply has completed (successfully or with error).
func (m ProgressModel) IsDone() bool { return !m.applying }

// HasError returns true when apply failed.
func (m ProgressModel) HasError() bool { return m.err != nil }
