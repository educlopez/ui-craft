// Package tui — error.go
// Dedicated error screen shown when detection or apply returns a real error.
// Provides a clear message + remedy hint + quit instruction.
// Ctrl-C / q / Esc are handled globally by AppModel.Update before reaching here.
package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// ErrorModel is the sub-model for the dedicated error screen.
type ErrorModel struct {
	err   error
	width int
}

// NewErrorModel creates an ErrorModel for the given error.
// width is the current terminal width (0 = unconstrained).
func NewErrorModel(err error, width int) ErrorModel {
	return ErrorModel{err: err, width: width}
}

// WithWidth returns a copy of the model with the given terminal width set.
func (m ErrorModel) WithWidth(w int) ErrorModel {
	m.width = w
	return m
}

// View renders the error screen.
func (m ErrorModel) View() string {
	var sb strings.Builder

	sb.WriteString(titleStyle().Render("Install error"))
	sb.WriteString("\n\n")

	errMsg := "unknown error"
	if m.err != nil {
		errMsg = m.err.Error()
	}

	// Wrap the error message to the terminal width (minus padding) when a width
	// is available. This prevents overflow on narrow terminals.
	if m.width > 0 {
		maxW := m.width - 4 // 4-char padding buffer
		if maxW < 20 {
			maxW = 20
		}
		style := errorStyle().Width(maxW)
		sb.WriteString(style.Render("Error: " + errMsg))
	} else {
		sb.WriteString(errorStyle().Render("Error: " + errMsg))
	}
	sb.WriteString("\n\n")

	remedy := remedyHint(m.err)
	if remedy != "" {
		sb.WriteString(mutedStyle().Render(remedy))
		sb.WriteString("\n\n")
	}

	// Quit hint.
	quitHint := "Press any key to exit."
	if m.width > 0 {
		style := mutedStyle().Width(m.width - 4)
		_ = style // suppress lint
	}
	sb.WriteString(mutedStyle().Render(quitHint))
	sb.WriteByte('\n')

	// If a width is set, wrap the whole view in a lipgloss container.
	if m.width > 0 {
		container := lipgloss.NewStyle().Width(m.width).MaxWidth(m.width)
		return container.Render(sb.String())
	}
	return sb.String()
}

// remedyHint returns a short user-facing remedy based on the error message.
// It is heuristic — if no specific remedy is known the function returns "".
func remedyHint(err error) string {
	if err == nil {
		return ""
	}
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "permission denied"):
		return "Remedy: check file permissions and re-run `ui-craft install`."
	case strings.Contains(msg, "no space left"):
		return "Remedy: free up disk space and re-run `ui-craft install`."
	case strings.Contains(msg, "rolled back"):
		return "All changes were rolled back — your files are unchanged."
	case strings.Contains(msg, "no harness"):
		return "Install a supported AI coding harness (Claude Code, Cursor, Codex, Gemini, OpenCode) and re-run."
	default:
		return "All changes have been rolled back. Re-run `ui-craft install` to try again."
	}
}
