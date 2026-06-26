// Package tui provides the Bubble Tea TUI for the ui-craft installer.
// It is a thin driver over core.Plan / core.Apply — it never writes files
// directly (ADR-2: TUI builds the same InstallPlan as --yes non-interactive mode).
package tui

import (
	"os"

	"github.com/charmbracelet/lipgloss"
	"github.com/mattn/go-isatty"
)

// noColor returns true when the NO_COLOR environment variable is set (any value)
// or TERM=dumb. In that case all lipgloss styling is disabled.
func noColor() bool {
	if os.Getenv("NO_COLOR") != "" {
		return true
	}
	if os.Getenv("TERM") == "dumb" {
		return true
	}
	return false
}

// IsTerminal returns true when stdout is a real TTY.
func IsTerminal() bool {
	return isatty.IsTerminal(os.Stdout.Fd())
}

// Palette defines the single-accent color theme. No rainbow — we dogfood our
// own anti-slop rules. Uses adaptive colors so the palette works on both light
// and dark terminal backgrounds.
var (
	// AccentColor is the primary brand color (sky blue).
	AccentColor = lipgloss.AdaptiveColor{Light: "#0284C7", Dark: "#38BDF8"}
	// MutedColor is for secondary text (grey).
	MutedColor = lipgloss.AdaptiveColor{Light: "#6B7280", Dark: "#9CA3AF"}
	// ErrorColor is for error/warning text (red).
	ErrorColor = lipgloss.AdaptiveColor{Light: "#DC2626", Dark: "#F87171"}
	// SuccessColor is for success text (green).
	SuccessColor = lipgloss.AdaptiveColor{Light: "#16A34A", Dark: "#4ADE80"}
	// DisabledColor is for greyed-out unsupported components.
	DisabledColor = lipgloss.AdaptiveColor{Light: "#D1D5DB", Dark: "#4B5563"}
)

// accentStyle returns the accent lipgloss style, or a plain style when NO_COLOR
// / TERM=dumb is active.
func accentStyle() lipgloss.Style {
	if noColor() {
		return lipgloss.NewStyle()
	}
	return lipgloss.NewStyle().Foreground(AccentColor)
}

// mutedStyle returns a muted (secondary) text style.
func mutedStyle() lipgloss.Style {
	if noColor() {
		return lipgloss.NewStyle()
	}
	return lipgloss.NewStyle().Foreground(MutedColor)
}

// errorStyle returns an error text style.
func errorStyle() lipgloss.Style {
	if noColor() {
		return lipgloss.NewStyle()
	}
	return lipgloss.NewStyle().Foreground(ErrorColor)
}

// successStyle returns a success text style.
func successStyle() lipgloss.Style {
	if noColor() {
		return lipgloss.NewStyle()
	}
	return lipgloss.NewStyle().Foreground(SuccessColor)
}

// disabledStyle returns the style for unsupported/greyed-out items.
func disabledStyle() lipgloss.Style {
	if noColor() {
		return lipgloss.NewStyle()
	}
	return lipgloss.NewStyle().Foreground(DisabledColor)
}

// titleStyle returns the style for screen titles / header text.
func titleStyle() lipgloss.Style {
	if noColor() {
		return lipgloss.NewStyle().Bold(true)
	}
	return lipgloss.NewStyle().Foreground(AccentColor).Bold(true)
}

// gradientBands returns the 5 accent-toned colors used for the splash art
// gradient. When NO_COLOR is active, all bands are empty strings (no styling).
func gradientBands() []string {
	if noColor() {
		return []string{"", "", "", "", ""}
	}
	// Five bands from deep sky blue → pale sky, giving a gradient sweep top-down.
	return []string{
		"#0EA5E9", // band 0 — deepest
		"#38BDF8", // band 1
		"#7DD3FC", // band 2
		"#BAE6FD", // band 3
		"#E0F2FE", // band 4 — lightest
	}
}
