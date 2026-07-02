// Package tui — welcome.go
// Renders the welcome hub screen: persistent dog-art header, tagline,
// async update line (wired in Slice 3), menu options, and key-hint footer.
// This file is ADDITIVE — it does not modify the install-flow path.
package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/educlopez/ui-craft/cli/core"
)

// welcomeTagline is the product tagline shown next to the version on the
// welcome screen. A brief one-line descriptor.
const welcomeTagline = "Install and manage AI coding components"

// renderArtHeader renders the Aren dog-art with the same gradient bands used
// by the splash screen. It is extracted here so both splash.go and welcome.go
// can reuse the same renderer without duplication.
// width is ignored in the current implementation (art is fixed-width braille);
// it is kept as a parameter for future responsive adjustments.
func renderArtHeader(width int) string {
	_ = width // reserved for future responsive layout
	bands := gradientBands()
	numBands := len(bands)
	numRows := len(arenArt)

	var sb strings.Builder
	for i, row := range arenArt {
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
	return sb.String()
}

// renderWelcome builds the full welcome screen string.
// It is called from AppModel.View() when screen == ScreenWelcome.
func renderWelcome(m AppModel) string {
	var sb strings.Builder

	// ── Header: persistent dog art ───────────────────────────────────────────
	sb.WriteString(renderArtHeader(m.width))

	// ── Tagline: "UI Craft <version> — <tagline>" ────────────────────────────
	tagline := "UI Craft " + m.version + " — " + welcomeTagline
	if noColor() {
		sb.WriteString(tagline)
	} else {
		sb.WriteString(accentStyle().Render(tagline))
	}
	sb.WriteByte('\n')

	// ── Update line (placeholder — Slice 3 wires the real advisory) ──────────
	if line := core.UpdateAdvisoryLine(m.updateResult); line != "" {
		if noColor() {
			sb.WriteString(line)
		} else {
			sb.WriteString(mutedStyle().Render(line))
		}
		sb.WriteByte('\n')
	}

	sb.WriteByte('\n')

	// ── Menu items ────────────────────────────────────────────────────────────
	for i, item := range m.menuItems {
		label := item
		// Append ★ to Upgrade when an update is available (Slice 3 full wiring).
		// Upgrade is menu item index 2 (after "Start installation" and
		// "Install (this project)" — see hubMenuItems in app.go).
		if i == 2 && m.updateResult.Available {
			label += " ★"
		}

		if i == m.cursor {
			// Highlighted (selected) item.
			if noColor() {
				sb.WriteString("> " + label)
			} else {
				sb.WriteString(accentStyle().Bold(true).Render("> " + label))
			}
		} else {
			if noColor() {
				sb.WriteString("  " + label)
			} else {
				sb.WriteString(mutedStyle().Render("  " + label))
			}
		}
		sb.WriteByte('\n')
	}

	sb.WriteByte('\n')

	// ── Footer: key hints ─────────────────────────────────────────────────────
	footer := "j/k: navigate • enter: select • q: quit"
	if noColor() {
		sb.WriteString(footer)
	} else {
		sb.WriteString(mutedStyle().Render(footer))
	}
	sb.WriteByte('\n')

	// No surrounding frame — the art + menu render flush.
	return sb.String()
}
