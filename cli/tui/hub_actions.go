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
// can inspect timing if needed. 100ms tick interval is a standard spinner cadence.
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

// ─── ci-install command builder (PR4) ─────────────────────────────────────────

// ciInstallDoneMsg is the message delivered by the ci-install goroutine when
// it finishes. Mirrors upgradeDoneMsg's shape: generation must match
// AppModel.ciInstallGeneration to be applied (stale-result discard guard).
type ciInstallDoneMsg struct {
	err        error
	generation int
}

// buildCIInstallCmd returns a tea.Cmd that shells out to
// `npx ui-craft-detect@latest ci install --yes` in the current working
// directory, mirroring buildUpgradeCmd's override/spinner/generation pattern.
//
// If ciInstallOverride is non-nil, it is used instead (test injection seam) —
// same shape as upgradeOverride. Otherwise the real exec runs via execCIFn
// (mirrors execBrewFn); passing nil for execCIFn uses the real os/exec.
//
// The subprocess is run non-interactively (--yes) since it is invoked from
// inside the TUI, which already gathered user confirmation via the prompt
// screen. A failure (npx missing, non-zero exit) is surfaced as an error on
// ciInstallDoneMsg — it must never panic or hang the TUI.
func buildCIInstallCmd(ciInstallOverride func() tea.Msg, execCIFn func(name string, args ...string) (string, error), generation int) tea.Cmd {
	if ciInstallOverride != nil {
		return func() tea.Msg {
			msg := ciInstallOverride()
			if done, ok := msg.(ciInstallDoneMsg); ok {
				done.generation = generation
				return done
			}
			return msg
		}
	}
	return func() tea.Msg {
		_, err := execCIInstallCommand(execCIFn)
		if err != nil {
			return ciInstallDoneMsg{err: fmt.Errorf("ci install: %w", err), generation: generation}
		}
		return ciInstallDoneMsg{err: nil, generation: generation}
	}
}

// execCIInstallCommand runs `npx ui-craft-detect@latest ci install --yes`
// using the provided execFn. If execFn is nil it falls back to the real
// os/exec.Command, run in the current working directory.
func execCIInstallCommand(execFn func(name string, args ...string) (string, error)) (string, error) {
	if execFn != nil {
		return execFn("npx", "ui-craft-detect@latest", "ci", "install", "--yes")
	}
	cmd := exec.Command("npx", "ui-craft-detect@latest", "ci", "install", "--yes")
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// renderCIInstallPrompt renders the post-project-install follow-up prompt
// asking whether to also set up the CI scan GitHub Action for this project.
// Only reached when installScope==core.Project and a GitHub-hosted origin
// was detected (see AppModel.Update's ApplyScreen branch).
func renderCIInstallPrompt(m AppModel) string {
	var sb strings.Builder
	sb.WriteString(titleStyle().Render("Set up CI scan?"))
	sb.WriteString("\n\n")
	msg := "Also set up the AI-slop-scanning GitHub Action for this project?"
	if noColor() {
		sb.WriteString(msg)
	} else {
		sb.WriteString(accentStyle().Render(msg))
	}
	sb.WriteString("\n\n")
	hint := "y/enter: install  n/esc: skip"
	if noColor() {
		sb.WriteString(hint)
	} else {
		sb.WriteString(mutedStyle().Render(hint))
	}
	sb.WriteByte('\n')
	return sb.String()
}

// renderCIInstalling renders the spinner while the ci-install subprocess runs.
func renderCIInstalling(m AppModel) string {
	frame := spinnerFrames[m.spinnerFrame%len(spinnerFrames)]
	msg := frame + " Setting up CI scan…"
	hint := "\n(Press Esc to cancel and return)"
	if noColor() {
		return msg + hint + "\n"
	}
	return accentStyle().Render(msg) + mutedStyle().Render(hint) + "\n"
}

// renderCIInstallComplete renders the ScreenComplete result for the
// ci-install action (routed via completedActionCIInstall).
func renderCIInstallComplete(m AppModel) string {
	var sb strings.Builder
	if m.ciInstallErr == nil {
		sb.WriteString("CI scan GitHub Action installed successfully.\n")
	} else {
		sb.WriteString("CI scan install failed: " + m.ciInstallErr.Error() + "\n")
	}
	hint := "\nPress Esc to return to the menu."
	if noColor() {
		sb.WriteString(hint)
		return sb.String() + "\n"
	}
	return accentStyle().Render(sb.String()) + mutedStyle().Render(hint) + "\n"
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
