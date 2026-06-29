// Package tui — hub_actions.go
// Implements the Upgrade screen (Slice 4): spinner while the upgrade runs,
// Complete/result screen on finish.
//
// Architecture:
//   - upgradeDoneMsg is the Bubble Tea message delivered when the upgrade
//     goroutine completes (success or failure).
//   - TickMsg drives the 100ms spinner animation on action screens.
//   - AppModel carries upgradeOverride (injection seam) and spinnerFrame / upgradeMethod.
//   - Esc on ScreenUpgrade or ScreenComplete routes back to ScreenWelcome
//     (local back-nav; does NOT trigger global tea.Quit).
//   - The real upgrade dispatches brew or direct based on DetectInstallMethod;
//     tests inject upgradeOverride to bypass both.
package tui

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/core"
)

// ─── Messages ─────────────────────────────────────────────────────────────────

// upgradeDoneMsg is the message delivered by the upgrade goroutine when it
// finishes. err is nil on success; method records which path was taken
// ("brew", "direct", or "test").
// generation must match AppModel.upgradeGeneration; stale msgs are discarded.
type upgradeDoneMsg struct {
	err        error
	newVersion string // non-empty when a newer version was installed
	method     string // "brew" | "direct" | "" (for tests)
	generation int    // must match AppModel.upgradeGeneration to be applied
}

// TickMsg drives spinner animation. It carries the time of the tick so callers
// can inspect timing if needed. 100ms tick interval mirrors the gentle-ai pattern.
type TickMsg time.Time

// ─── Spinner frames ───────────────────────────────────────────────────────────

// spinnerFrames is the ordered list of braille spinner characters.
var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// ─── Tick command ─────────────────────────────────────────────────────────────

// tickCmd returns a tea.Cmd that fires a TickMsg after 100ms.
func tickCmd() tea.Cmd {
	return tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

// ─── Upgrade command builder ──────────────────────────────────────────────────

// buildUpgradeCmd returns a tea.Cmd that performs the binary self-update.
// If upgradeOverride is non-nil, it is used instead (test injection seam).
// Otherwise the real upgrade logic runs:
//   - brew install method → exec `brew upgrade --cask ui-craft`
//   - direct install → core.RunSelfUpdate
//
// The execBrewFn parameter allows injecting a custom exec function in tests;
// pass nil to use the real os/exec.
//
// generation is baked into the returned upgradeDoneMsg so that stale goroutine
// results from a prior upgrade run can be discarded in Update().
func buildUpgradeCmd(version string, upgradeOverride func() tea.Msg, execBrewFn func(args ...string) (string, error), generation int) tea.Cmd {
	if upgradeOverride != nil {
		return func() tea.Msg {
			msg := upgradeOverride()
			// Wrap override result in upgradeDoneMsg with correct generation if the
			// override itself returns an upgradeDoneMsg (test helpers often do).
			if done, ok := msg.(upgradeDoneMsg); ok {
				done.generation = generation
				return done
			}
			// For non-upgradeDoneMsg returns (e.g. nil from no-op overrides), pass through.
			return msg
		}
	}
	return func() tea.Msg {
		// Detect install method using the running binary's path.
		exePath, err := core.ResolveExecPath()
		if err != nil {
			return upgradeDoneMsg{err: err, method: "direct", generation: generation}
		}
		method := core.DetectInstallMethod(exePath)

		if method == "brew" {
			// Homebrew: shell out to `brew upgrade --cask ui-craft`.
			out, err := execBrewCommand(execBrewFn)
			if err != nil {
				return upgradeDoneMsg{err: fmt.Errorf("brew upgrade: %w", err), method: "brew", generation: generation}
			}
			_ = out
			return upgradeDoneMsg{err: nil, method: "brew", generation: generation}
		}

		// Direct install: use the hardened core.RunSelfUpdate.
		var buf bytes.Buffer
		newVer, runErr := core.RunSelfUpdate(core.SelfUpdateOpts{
			CurrentVersion: version,
			Output:         &buf,
		})
		return upgradeDoneMsg{err: runErr, newVersion: newVer, method: "direct", generation: generation}
	}
}

// execBrewCommand runs `brew upgrade --cask ui-craft` using the provided
// execFn. If execFn is nil it falls back to the real os/exec.Command.
func execBrewCommand(execFn func(args ...string) (string, error)) (string, error) {
	if execFn != nil {
		return execFn("brew", "upgrade", "--cask", "ui-craft")
	}
	// Real exec path.
	cmd := exec.Command("brew", "upgrade", "--cask", "ui-craft")
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// ─── renderUpgrade ────────────────────────────────────────────────────────────

// renderUpgrade renders the Upgrade screen spinner while the upgrade is in progress.
func renderUpgrade(m AppModel) string {
	frame := spinnerFrames[m.spinnerFrame%len(spinnerFrames)]
	msg := frame + " Upgrading ui-craft…"
	hint := "\n(Press Esc to cancel and return)"
	if noColor() {
		return msg + hint + "\n"
	}
	return accentStyle().Render(msg) + mutedStyle().Render(hint) + "\n"
}

// ─── renderComplete ───────────────────────────────────────────────────────────

// renderComplete renders the Complete screen after the upgrade finishes.
func renderComplete(m AppModel) string {
	var sb strings.Builder

	if m.upgradeErr == nil {
		// Success path.
		if m.upgradeMethod == "brew" {
			sb.WriteString("Homebrew upgraded ui-craft successfully.\n")
		} else if m.upgradeNewVersion != "" {
			sb.WriteString("Updated to " + m.upgradeNewVersion + " successfully.\n")
		} else {
			sb.WriteString("ui-craft is up to date (already at the latest version).\n")
		}
	} else {
		// Failure path.
		sb.WriteString("Upgrade failed: " + m.upgradeErr.Error() + "\n")
	}

	hint := "\nPress Esc to return to the menu."
	if noColor() {
		sb.WriteString(hint)
		return sb.String() + "\n"
	}
	return accentStyle().Render(sb.String()) + mutedStyle().Render(hint) + "\n"
}
