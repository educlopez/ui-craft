package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// arenArt is the Aren dog ASCII art loaded at init time from the embedded asset.
// Each element is one rendered row. The art is hand-crafted (no converter tool
// produced output suitable for embedding as plain text rows without ANSI).
var arenArt = []string{
	`     /\_____/\`,
	`    (  o   o  )`,
	`    (  =   =  )`,
	`   / \  ~~~  / \`,
	`  /   \     /   \`,
	` / /|  \___/  |\ \`,
	`/_/ |_________|  \_\`,
	`    |         |`,
	`    |_________|`,
	`   /|         |\`,
	`  /_|_________|_\`,
}

// SplashModel is the Bubble Tea model for the Aren dog splash screen.
// It renders the art through lipgloss gradient color bands (gentle-ai pattern)
// and degrades to plain ASCII when NO_COLOR or TERM=dumb is active.
type SplashModel struct {
	version string
	done    bool
}

// NewSplashModel creates a new SplashModel for the given binary version string.
func NewSplashModel(version string) SplashModel {
	return SplashModel{version: version}
}

// splashDoneMsg is the internal message emitted when the splash is complete.
type splashDoneMsg struct{}

// Init sends a one-shot command to auto-advance past the splash.
func (m SplashModel) Init() tea.Cmd {
	// Advance immediately — the splash is rendered once then the app moves on.
	return func() tea.Msg { return splashDoneMsg{} }
}

// Update handles messages for the SplashModel.
func (m SplashModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg.(type) {
	case splashDoneMsg:
		m.done = true
		return m, nil
	case tea.KeyMsg:
		// Any key press also advances past the splash.
		m.done = true
		return m, nil
	}
	return m, nil
}

// View renders the Aren splash. Each row of the art is colored with a
// gradient band from the palette defined in styles.go. When NO_COLOR or
// TERM=dumb is active, the art is rendered as plain ASCII with no ANSI codes.
func (m SplashModel) View() string {
	bands := gradientBands()
	numBands := len(bands)
	numRows := len(arenArt)

	var sb strings.Builder
	for i, row := range arenArt {
		// Distribute rows evenly across the 5 gradient bands.
		bandIdx := 0
		if numRows > 1 {
			bandIdx = (i * (numBands - 1)) / (numRows - 1)
		}
		color := bands[bandIdx]

		if color == "" || noColor() {
			sb.WriteString(row)
		} else {
			style := lipgloss.NewStyle().Foreground(lipgloss.Color(color))
			sb.WriteString(style.Render(row))
		}
		sb.WriteByte('\n')
	}

	// Version line below the art.
	versionLine := "ui-craft " + m.version
	if noColor() {
		sb.WriteString(versionLine)
	} else {
		sb.WriteString(mutedStyle().Render(versionLine))
	}
	sb.WriteByte('\n')

	return sb.String()
}

// IsDone returns true after the splash has auto-advanced.
func (m SplashModel) IsDone() bool {
	return m.done
}
