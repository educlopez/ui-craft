// Package tui — hub_backups.go
// Implements the Manage Backups screen (Slice 5): list existing backup manifests,
// navigate with j/k, select to restore, spinner while restore runs, Complete screen.
//
// Architecture:
//   - backupsLoadedMsg is delivered by the list cmd when the store returns results.
//   - backupRestoreDoneMsg is delivered by the restore cmd on success or failure.
//   - AppModel carries two injection seams:
//     backupListOverride func() ([]backup.SnapshotMeta, error)
//     backupRestoreOverride func(id backup.SnapshotID) error
//     When non-nil they replace the real backup.Store calls; production code
//     leaves them nil and uses the real store rooted at ~/.ui-craft-backups.
//   - Esc on ScreenBackups routes back to ScreenWelcome (local back-nav).
package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// ─── Messages ─────────────────────────────────────────────────────────────────

// backupsLoadedMsg is delivered when the backup list cmd completes.
// metas is nil (not empty slice) when err is set; callers should check err first.
type backupsLoadedMsg struct {
	metas []backup.SnapshotMeta
	err   error
}

// backupRestoreDoneMsg is delivered when the restore cmd completes.
type backupRestoreDoneMsg struct {
	id  string
	err error
}

// ─── Cmd builders ─────────────────────────────────────────────────────────────

// buildBackupListCmd returns a tea.Cmd that lists backups using the injected fn
// or the real store when no override is set.
func buildBackupListCmd(override func() ([]backup.SnapshotMeta, error)) tea.Cmd {
	return func() tea.Msg {
		var listFn func() ([]backup.SnapshotMeta, error)
		if override != nil {
			listFn = override
		} else {
			listFn = func() ([]backup.SnapshotMeta, error) {
				store, err := defaultBackupStoreForTUI()
				if err != nil {
					return nil, err
				}
				return store.List()
			}
		}
		metas, err := listFn()
		return backupsLoadedMsg{metas: metas, err: err}
	}
}

// buildBackupRestoreCmd returns a tea.Cmd that restores the snapshot with the
// given ID using the injected fn or the real store when no override is set.
func buildBackupRestoreCmd(id backup.SnapshotID, override func(backup.SnapshotID) error) tea.Cmd {
	return func() tea.Msg {
		var restoreFn func(backup.SnapshotID) error
		if override != nil {
			restoreFn = override
		} else {
			restoreFn = func(snapID backup.SnapshotID) error {
				store, err := defaultBackupStoreForTUI()
				if err != nil {
					return err
				}
				return store.Restore(snapID)
			}
		}
		err := restoreFn(id)
		return backupRestoreDoneMsg{id: string(id), err: err}
	}
}

// defaultBackupStoreForTUI opens the real backup store rooted at ~/.ui-craft-backups.
func defaultBackupStoreForTUI() (*backup.Store, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("tui: resolve home dir: %w", err)
	}
	root := filepath.Join(home, ".ui-craft-backups")
	return backup.NewStore(root, fsutil.OsFS{}, nil), nil
}

// ─── renderBackups ─────────────────────────────────────────────────────────────

// renderBackups renders the Manage Backups screen.
// It shows a header, the list of snapshot metas (with cursor highlight),
// or an "no backups" message when the list is empty.
func renderBackups(m AppModel) string {
	var sb strings.Builder

	// Header.
	header := "Manage Backups"
	if noColor() {
		sb.WriteString(header)
	} else {
		sb.WriteString(accentStyle().Bold(true).Render(header))
	}
	sb.WriteString("\n\n")

	switch {
	case m.backupLoadErr != nil:
		// Load failed.
		errMsg := "Error loading backups: " + m.backupLoadErr.Error()
		if noColor() {
			sb.WriteString(errMsg)
		} else {
			sb.WriteString(mutedStyle().Render(errMsg))
		}
		sb.WriteByte('\n')

	case len(m.backupList) == 0 && m.backupsLoaded:
		// Empty list.
		empty := "No backups found."
		if noColor() {
			sb.WriteString(empty)
		} else {
			sb.WriteString(mutedStyle().Render(empty))
		}
		sb.WriteByte('\n')

	case !m.backupsLoaded:
		// Still loading.
		loading := "Loading backups…"
		if noColor() {
			sb.WriteString(loading)
		} else {
			sb.WriteString(mutedStyle().Render(loading))
		}
		sb.WriteByte('\n')

	default:
		// Render list.
		for i, meta := range m.backupList {
			line := fmt.Sprintf("%s  %s  %s  %d files",
				meta.ID,
				meta.CreatedAt.Local().Format("2006-01-02 15:04"),
				meta.Source,
				meta.FileCount,
			)
			if meta.Pinned {
				line += "  [pinned]"
			}
			if i == m.backupCursor {
				if noColor() {
					sb.WriteString("> " + line)
				} else {
					sb.WriteString(accentStyle().Bold(true).Render("> " + line))
				}
			} else {
				if noColor() {
					sb.WriteString("  " + line)
				} else {
					sb.WriteString(mutedStyle().Render("  " + line))
				}
			}
			sb.WriteByte('\n')
		}
	}

	sb.WriteByte('\n')

	// Footer.
	footer := "j/k: navigate • enter: restore • esc: back"
	if len(m.backupList) == 0 {
		footer = "esc: back"
	}
	if noColor() {
		sb.WriteString(footer)
	} else {
		sb.WriteString(mutedStyle().Render(footer))
	}
	sb.WriteByte('\n')

	return sb.String()
}

// ─── renderBackupComplete ──────────────────────────────────────────────────────

// renderBackupComplete renders the Complete screen after a backup restore attempt.
func renderBackupComplete(m AppModel) string {
	var sb strings.Builder

	if m.backupRestoreErr == nil {
		msg := "Restored successfully."
		if m.backupRestoredID != "" {
			msg = "Restored snapshot " + m.backupRestoredID + " successfully."
		}
		if noColor() {
			sb.WriteString(msg)
		} else {
			sb.WriteString(accentStyle().Render(msg))
		}
	} else {
		msg := "Restore failed: " + m.backupRestoreErr.Error()
		if noColor() {
			sb.WriteString(msg)
		} else {
			sb.WriteString(mutedStyle().Render(msg))
		}
	}
	sb.WriteByte('\n')

	hint := "\nPress Esc to return to the menu."
	if noColor() {
		sb.WriteString(hint)
		return sb.String() + "\n"
	}
	return sb.String() + mutedStyle().Render(hint) + "\n"
}
