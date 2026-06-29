package tui

import (
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// arenArt is the Aren dog braille art (24×12), generated from the ui-craft logo.
// Reproduced with: chafa -f symbols --symbols braille -c none --size 24x12 public/icon.png
// Each element is one rendered row; the lipgloss gradient-band renderer below
// colorises them at display time.
var arenArt = []string{
	`⠀⠀⣠⣴⣶⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣶⣦⣄⠀⠀`,
	`⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀`,
	`⣼⣿⡿⠛⠛⠻⢿⣿⣿⠋⠀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧`,
	`⣿⣿⠁⠀⠀⠀⠀⠻⡏⠀⣠⣤⣠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿`,
	`⣿⣿⣆⣀⣴⡖⠀⠀⢩⣤⣿⣹⡿⠛⠛⠛⠛⠛⠛⠛⠛⣿⣿⡝`,
	`⣿⣿⣿⣿⣿⡇⠀⠀⠻⣤⠟⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿`,
	`⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣿⣿⣿`,
	`⣿⣿⣿⣿⣿⠇⠀⠀⠀⢠⣤⣀⡀⠀⠀⠀⢀⣀⣤⣾⣿⣿⣿⣿`,
	`⣿⣿⣿⣿⣿⠀⠀⠀⠀⠈⠿⣿⣿⣿⣿⡿⠿⠛⠋⠉⠀⠀⡇⠈`,
	`⢻⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠃⠀`,
	`⠈⢿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⠊⠀⠀`,
	`⠀⠀⠙⠻⢿⡏⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠉⠁⠀⠀⠀⠀`,
}

// SplashModel is the Bubble Tea model for the Aren dog splash screen.
// It renders the art through lipgloss gradient color bands (gentle-ai pattern)
// and degrades to plain ASCII when NO_COLOR or TERM=dumb is active.
type SplashModel struct {
	version string
	done    bool
	width   int
}

// WithWidth returns a copy of the model with the given terminal width set.
func (m SplashModel) WithWidth(w int) SplashModel {
	m.width = w
	return m
}

// NewSplashModel creates a new SplashModel for the given binary version string.
func NewSplashModel(version string) SplashModel {
	return SplashModel{version: version}
}

// splashDoneMsg is the internal message emitted when the splash is complete.
type splashDoneMsg struct{}

// Init sends a one-shot command to auto-advance past the splash after a
// 1500 ms dwell so at least one rendered frame is visible. Detection runs
// concurrently in app.go via tea.Batch(m.splash.Init(), updateCmd).
func (m SplashModel) Init() tea.Cmd {
	return tea.Tick(1500*time.Millisecond, func(time.Time) tea.Msg {
		return splashDoneMsg{}
	})
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
// The gradient loop is now shared via renderArtHeader (welcome.go).
func (m SplashModel) View() string {
	var sb strings.Builder
	sb.WriteString(renderArtHeader(m.width))

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
