// Package tui — hub_uninstall.go
// Implements the Managed Uninstall screen (Slice 6): show what will be removed,
// a confirmation step, then run the uninstall with a spinner + Complete/result
// screen (removed summary + snapshot ID for rollback; failure → error).
//
// Architecture:
//   - ScreenUninstall has two sub-states:
//     1. Confirm step (uninstallRunning == false): show detected harnesses /
//        components that will be removed, prompt to confirm with Enter or cancel
//        with Esc.
//     2. Running step (uninstallRunning == true): spinner while the goroutine runs.
//   - uninstallDoneMsg is delivered when the goroutine completes.
//   - AppModel carries two injection seams:
//     uninstallSnapshotOverride func() (string, error)
//     uninstallOverride         func() ([]string, error)
//     When non-nil they replace the real backup snapshot / core.Uninstall calls;
//     production code leaves them nil and uses the real paths.
//   - A pre-uninstall snapshot is taken BEFORE any removal (transactional).
//   - Esc on the confirm step returns to ScreenWelcome without any removal.
package tui

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// ─── Messages ─────────────────────────────────────────────────────────────────

// uninstallDoneMsg is delivered when the uninstall goroutine completes.
// On success err is nil and removedPaths lists the FS paths that were removed.
// snapshotID is the backup ID created before removal.
type uninstallDoneMsg struct {
	snapshotID   string
	removedPaths []string
	err          error
}

// ─── Cmd builder ──────────────────────────────────────────────────────────────

// buildUninstallCmd returns a tea.Cmd that:
//  1. Takes a pre-uninstall backup snapshot (via snapshotOverride or real store).
//  2. Runs the FS removal (via uninstallOverride or real core.Uninstall).
//
// If the snapshot step fails, the uninstall is aborted and the error is
// surfaced in uninstallDoneMsg.err so the TUI can show it on ScreenComplete.
func buildUninstallCmd(
	version string,
	snapshotOverride func() (string, error),
	uninstallOverride func() ([]string, error),
) tea.Cmd {
	return func() tea.Msg {
		// ── Step 1: snapshot ────────────────────────────────────────────────────
		var snapID string
		if snapshotOverride != nil {
			id, err := snapshotOverride()
			if err != nil {
				return uninstallDoneMsg{err: fmt.Errorf("uninstall: snapshot failed: %w", err)}
			}
			snapID = id
		} else {
			id, err := realUninstallSnapshot(version)
			if err != nil {
				return uninstallDoneMsg{err: fmt.Errorf("uninstall: snapshot failed: %w", err)}
			}
			snapID = id
		}

		// ── Step 2: removal ─────────────────────────────────────────────────────
		var removedPaths []string
		if uninstallOverride != nil {
			paths, err := uninstallOverride()
			if err != nil {
				return uninstallDoneMsg{snapshotID: snapID, err: err}
			}
			removedPaths = paths
		} else {
			paths, err := realUninstall(version)
			if err != nil {
				return uninstallDoneMsg{snapshotID: snapID, err: err}
			}
			removedPaths = paths
		}

		return uninstallDoneMsg{snapshotID: snapID, removedPaths: removedPaths}
	}
}

// ─── Real (production) uninstall helpers ─────────────────────────────────────

// realUninstallSnapshot creates a backup snapshot of all detected harness config
// paths before any removal. This mirrors the cobra runUninstall snapshot logic.
func realUninstallSnapshot(version string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}

	fs := fsutil.OsFS{}
	stateRoot := filepath.Join(home, ".ui-craft")
	state, stateErr := core.LoadState(fs, stateRoot)
	if stateErr != nil {
		// A missing state file is normal (graceful — DetectAll path below).
		// A corrupt/unreadable state file is surfaced so the user knows.
		if !os.IsNotExist(stateErr) {
			fmt.Fprintf(io.Discard, "warning: could not read state.json (%v); falling back to harness detection\n", stateErr)
			// Log to stderr for visibility without blocking the uninstall.
			_, _ = fmt.Fprintf(os.Stderr, "ui-craft: warning: state.json unreadable (%v); continuing with harness detection\n", stateErr)
		}
	}

	allHarnesses := harness.All()
	var targetHarnesses []harness.Harness
	if len(state.Harnesses) > 0 {
		for _, hs := range state.Harnesses {
			for _, h := range allHarnesses {
				if h.Name() == hs.Name {
					targetHarnesses = append(targetHarnesses, h)
					break
				}
			}
		}
	} else {
		detected := core.DetectAll(allHarnesses)
		for _, dh := range detected {
			targetHarnesses = append(targetHarnesses, dh.Harness)
		}
	}

	if len(targetHarnesses) == 0 {
		// Nothing to snapshot.
		return "", nil
	}

	backupRoot := filepath.Join(home, ".ui-craft-backups")
	store := backup.NewStore(backupRoot, fs, nil)

	var snapTargets []backup.SnapshotTarget
	for _, h := range targetHarnesses {
		paths := h.ConfigPaths()
		for _, p := range []string{paths.MCPConfig, paths.SkillsDir, paths.AgentsDir, paths.AgentsMDPath} {
			if p == "" {
				continue
			}
			snapTargets = append(snapTargets, backup.SnapshotTarget{
				Harness:  h.Name(),
				OrigPath: p,
			})
		}
	}

	snapID, err := store.Snapshot(snapTargets, version, backup.SourceUninstall)
	if err != nil {
		return "", err
	}
	return string(snapID), nil
}

// realUninstall runs the real core.Uninstall over the OS filesystem.
// It detects the skills directory from the first detected harness and delegates
// all FS-level removal to core.Uninstall, which is the shared entry point also
// used by the cobra uninstall command.
func realUninstall(version string) ([]string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("resolve home dir: %w", err)
	}

	fs := fsutil.OsFS{}
	stateRoot := filepath.Join(home, ".ui-craft")
	state, stateErr := core.LoadState(fs, stateRoot)
	if stateErr != nil {
		// Missing state file is graceful — fall through to DetectAll.
		// Corrupt/unreadable state file is surfaced on stderr.
		if !os.IsNotExist(stateErr) {
			_, _ = fmt.Fprintf(os.Stderr, "ui-craft: warning: state.json unreadable (%v); continuing with harness detection\n", stateErr)
		}
	}

	allHarnesses := harness.All()
	var skillsDir string
	if len(state.Harnesses) > 0 {
		for _, hs := range state.Harnesses {
			for _, h := range allHarnesses {
				if h.Name() == hs.Name {
					paths := h.ConfigPaths()
					if paths.SkillsDir != "" {
						skillsDir = paths.SkillsDir
					}
					break
				}
			}
			if skillsDir != "" {
				break
			}
		}
	} else {
		detected := core.DetectAll(allHarnesses)
		for _, dh := range detected {
			paths := dh.Harness.ConfigPaths()
			if paths.SkillsDir != "" {
				skillsDir = paths.SkillsDir
				break
			}
		}
	}

	report, err := core.Uninstall(core.UninstallOpts{
		HomeDir:   home,
		SkillsDir: skillsDir,
		SnapshotFn: nil, // snapshot already taken in realUninstallSnapshot
		Output:    io.Discard,
	}, fs)
	if err != nil {
		return nil, err
	}
	return report.RemovedPaths, nil
}

// ─── Uninstall screen state helpers ──────────────────────────────────────────

// uninstallDetectedComponents returns a human-readable description of what
// will be removed. In the real path this queries state.json + harness detection;
// here we return a static description suitable for the confirm screen.
// Slice 6 keeps this simple; a future slice could enumerate real paths.
func uninstallDetectedComponents() []string {
	return []string{
		"ui-craft skills directory (~/.claude/skills/ui-craft/)",
		"ui-craft MCP server entry (from harness config)",
		"ui-craft review agents (design-reviewer.md, a11y-auditor.md)",
	}
}

// ─── renderUninstall ──────────────────────────────────────────────────────────

// renderUninstall renders the Managed Uninstall screen.
// When uninstallRunning is false it shows the confirmation step;
// when true it shows the spinner.
func renderUninstall(m AppModel) string {
	if m.uninstallRunning {
		return renderUninstallSpinner(m)
	}
	return renderUninstallConfirm(m)
}

// renderUninstallConfirm renders the confirmation prompt showing what will be removed.
func renderUninstallConfirm(m AppModel) string {
	var sb strings.Builder

	header := "Managed Uninstall"
	if noColor() {
		sb.WriteString(header)
	} else {
		sb.WriteString(accentStyle().Bold(true).Render(header))
	}
	sb.WriteString("\n\n")

	intro := "The following ui-craft components will be removed:"
	if noColor() {
		sb.WriteString(intro)
	} else {
		sb.WriteString(mutedStyle().Render(intro))
	}
	sb.WriteByte('\n')

	for _, item := range uninstallDetectedComponents() {
		line := "  • " + item
		if noColor() {
			sb.WriteString(line)
		} else {
			sb.WriteString(mutedStyle().Render(line))
		}
		sb.WriteByte('\n')
	}

	sb.WriteByte('\n')

	notice := "A backup snapshot will be created before removal (restore with: ui-craft rollback <id>)"
	if noColor() {
		sb.WriteString(notice)
	} else {
		sb.WriteString(mutedStyle().Render(notice))
	}
	sb.WriteByte('\n')
	sb.WriteByte('\n')

	confirm := "Press Enter to confirm uninstall, or Esc to cancel."
	if noColor() {
		sb.WriteString(confirm)
	} else {
		sb.WriteString(accentStyle().Render(confirm))
	}
	sb.WriteByte('\n')

	return sb.String()
}

// renderUninstallSpinner renders the spinner while the uninstall is running.
func renderUninstallSpinner(m AppModel) string {
	frame := spinnerFrames[m.spinnerFrame%len(spinnerFrames)]
	msg := frame + " Uninstalling ui-craft…"
	if noColor() {
		return msg + "\n"
	}
	return accentStyle().Render(msg) + "\n"
}

// ─── renderUninstallComplete ──────────────────────────────────────────────────

// renderUninstallComplete renders the Complete screen after an uninstall attempt.
func renderUninstallComplete(m AppModel) string {
	var sb strings.Builder

	if m.uninstallErr == nil {
		// Success path.
		title := "Uninstall complete."
		if noColor() {
			sb.WriteString(title)
		} else {
			sb.WriteString(accentStyle().Render(title))
		}
		sb.WriteByte('\n')

		if len(m.uninstallRemovedPaths) > 0 {
			sb.WriteByte('\n')
			removedLabel := "Removed:"
			if noColor() {
				sb.WriteString(removedLabel)
			} else {
				sb.WriteString(mutedStyle().Render(removedLabel))
			}
			sb.WriteByte('\n')
			for _, p := range m.uninstallRemovedPaths {
				line := "  " + p
				if noColor() {
					sb.WriteString(line)
				} else {
					sb.WriteString(mutedStyle().Render(line))
				}
				sb.WriteByte('\n')
			}
		}

		if m.uninstallSnapshotID != "" {
			sb.WriteByte('\n')
			rollbackHint := fmt.Sprintf("To restore: ui-craft rollback %s", m.uninstallSnapshotID)
			if noColor() {
				sb.WriteString(rollbackHint)
			} else {
				sb.WriteString(mutedStyle().Render(rollbackHint))
			}
			sb.WriteByte('\n')
		}
	} else {
		// Failure path.
		msg := "Uninstall failed: " + m.uninstallErr.Error()
		if noColor() {
			sb.WriteString(msg)
		} else {
			sb.WriteString(mutedStyle().Render(msg))
		}
		sb.WriteByte('\n')

		if m.uninstallSnapshotID != "" {
			sb.WriteByte('\n')
			notice := fmt.Sprintf("A snapshot was created before the attempt: %s", m.uninstallSnapshotID)
			if noColor() {
				sb.WriteString(notice)
			} else {
				sb.WriteString(mutedStyle().Render(notice))
			}
			sb.WriteByte('\n')
		}
	}

	hint := "\nPress Esc to return to the menu."
	if noColor() {
		sb.WriteString(hint)
		return sb.String() + "\n"
	}
	return sb.String() + mutedStyle().Render(hint) + "\n"
}
