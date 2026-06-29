// Package tui — hub_backups_test.go
// Strict TDD tests for Slice 5: Manage Backups screen.
// All tests are model-level (Update/View); no TTY required.
// Tests use an injected list/restore func — never the real ~/.ui-craft-backups dir.
package tui

import (
	"errors"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/backup"
)

// ─── helpers ──────────────────────────────────────────────────────────────────

// makeSnapMeta builds a fake SnapshotMeta for tests.
func makeSnapMeta(id string, source backup.Source) backup.SnapshotMeta {
	return backup.SnapshotMeta{
		ID:        backup.SnapshotID(id),
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
		Source:    source,
		FileCount: 3,
	}
}

// hubOnBackups returns a model at ScreenBackups with the list already loaded
// via an injected backupListOverride that returns the given metas.
// backupRestoreOverride is set to a no-op so tests can control restore outcomes.
func hubOnBackups(t *testing.T, metas []backup.SnapshotMeta, restoreErr error) AppModel {
	t.Helper()
	m := NewHubModel("v1.0.0", "/tmp/test")

	// Inject list function.
	m.backupListOverride = func() ([]backup.SnapshotMeta, error) {
		return metas, nil
	}
	// Inject restore function (records call; returns restoreErr).
	m.backupRestoreOverride = func(_ backup.SnapshotID) error {
		return restoreErr
	}

	// Navigate to "Manage backups" (item 2) and Enter.
	// j j = cursor 2.
	for i := 0; i < 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	return m
}

// ─── Routing: selecting "Manage backups" routes to ScreenBackups ──────────────

// TestBackups_enterBackupsRoutesToScreenBackups verifies that pressing Enter on
// "Manage backups" transitions to ScreenBackups and fires the load cmd.
func TestBackups_enterBackupsRoutesToScreenBackups(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.backupListOverride = func() ([]backup.SnapshotMeta, error) { return nil, nil }
	m.backupRestoreOverride = func(_ backup.SnapshotID) error { return nil }

	// Navigate to item 2.
	for i := 0; i < 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	if m.screen != ScreenBackups {
		t.Errorf("Enter on Manage backups must transition to ScreenBackups, got %v", m.screen)
	}
	if cmd == nil {
		t.Error("Enter on Manage backups must return a non-nil cmd (to load backups)")
	}
}

// ─── List: backupsLoadedMsg populates the list ────────────────────────────────

// TestBackups_listLoadsManifests verifies that receiving backupsLoadedMsg
// with metas populates backupList in the model.
func TestBackups_listLoadsManifests(t *testing.T) {
	metas := []backup.SnapshotMeta{
		makeSnapMeta("20260115T100000-000000000", backup.SourceInstall),
		makeSnapMeta("20260114T100000-000000000", backup.SourceManual),
	}
	m := hubOnBackups(t, metas, nil)

	// Deliver the loaded message.
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)

	if len(m.backupList) != 2 {
		t.Errorf("backupsLoadedMsg must populate backupList with 2 entries, got %d", len(m.backupList))
	}
}

// TestBackups_listErrorStaysOnScreen verifies that a load error keeps the model
// on ScreenBackups (so the user can see an error or press Esc back).
func TestBackups_listErrorStaysOnScreen(t *testing.T) {
	m := hubOnBackups(t, nil, nil)

	loadErr := errors.New("disk error")
	updated, _ := m.Update(backupsLoadedMsg{metas: nil, err: loadErr})
	m = updated.(AppModel)

	if m.screen != ScreenBackups {
		t.Errorf("load error must keep model on ScreenBackups, got %v", m.screen)
	}
	if m.backupLoadErr == nil {
		t.Error("load error must be stored in backupLoadErr")
	}
}

// ─── Render: list shows manifests ─────────────────────────────────────────────

// TestBackups_renderShowsManifests verifies that View() on ScreenBackups renders
// the snapshot IDs when metas are loaded.
func TestBackups_renderShowsManifests(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	metas := []backup.SnapshotMeta{
		makeSnapMeta("20260115T100000-000000001", backup.SourceInstall),
	}
	m := hubOnBackups(t, metas, nil)

	// Deliver the loaded message.
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)

	view := m.View()
	if !strings.Contains(view, "20260115T100000-000000001") {
		t.Errorf("View on ScreenBackups must show snapshot IDs, got:\n%s", view)
	}
}

// ─── Render: empty-list shows "no backups" message ───────────────────────────

// TestBackups_emptyListShowsNoBackupsMessage verifies that View() renders an
// appropriate "no backups" message when the list is empty.
func TestBackups_emptyListShowsNoBackupsMessage(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnBackups(t, []backup.SnapshotMeta{}, nil)

	// Deliver empty list.
	updated, _ := m.Update(backupsLoadedMsg{metas: []backup.SnapshotMeta{}, err: nil})
	m = updated.(AppModel)

	view := m.View()
	if !containsAny(view, "No backups", "no backups", "no backup") {
		t.Errorf("empty list must show 'no backups' message, got:\n%s", view)
	}
}

// ─── j/k navigation within the list ─────────────────────────────────────────

// TestBackups_jkNavigatesItems verifies j/k keys move the cursor in the backup list.
func TestBackups_jkNavigatesItems(t *testing.T) {
	metas := []backup.SnapshotMeta{
		makeSnapMeta("snap-001", backup.SourceInstall),
		makeSnapMeta("snap-002", backup.SourceManual),
		makeSnapMeta("snap-003", backup.SourceSync),
	}
	m := hubOnBackups(t, metas, nil)
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)

	// Initial cursor is 0.
	if m.backupCursor != 0 {
		t.Fatalf("initial backupCursor must be 0, got %d", m.backupCursor)
	}
	// j → cursor 1.
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	m = updated.(AppModel)
	if m.backupCursor != 1 {
		t.Errorf("j must advance backupCursor to 1, got %d", m.backupCursor)
	}
	// j → cursor 2.
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	m = updated.(AppModel)
	if m.backupCursor != 2 {
		t.Errorf("j must advance backupCursor to 2, got %d", m.backupCursor)
	}
	// k → back to 1.
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
	m = updated.(AppModel)
	if m.backupCursor != 1 {
		t.Errorf("k must decrease backupCursor to 1, got %d", m.backupCursor)
	}
}

// TestBackups_jkNavigationWraps verifies cursor wraps at boundaries.
func TestBackups_jkNavigationWraps(t *testing.T) {
	metas := []backup.SnapshotMeta{
		makeSnapMeta("snap-a", backup.SourceInstall),
		makeSnapMeta("snap-b", backup.SourceManual),
	}
	m := hubOnBackups(t, metas, nil)
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)

	// k from position 0 → wraps to last.
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
	m = updated.(AppModel)
	if m.backupCursor != 1 {
		t.Errorf("k at position 0 must wrap to last (%d), got %d", 1, m.backupCursor)
	}

	// j from last → wraps to 0.
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	m = updated.(AppModel)
	if m.backupCursor != 0 {
		t.Errorf("j at last position must wrap to 0, got %d", m.backupCursor)
	}
}

// ─── Esc returns to welcome ───────────────────────────────────────────────────

// TestBackups_escReturnsToWelcome verifies Esc on ScreenBackups returns to ScreenWelcome.
func TestBackups_escReturnsToWelcome(t *testing.T) {
	m := hubOnBackups(t, nil, nil)
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)

	if m.screen != ScreenWelcome {
		t.Errorf("Esc on ScreenBackups must return to ScreenWelcome, got %v", m.screen)
	}
	// Must NOT be tea.Quit.
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("Esc on ScreenBackups must NOT trigger tea.Quit")
		}
	}
}

// TestBackups_escFromEmptyListReturnsToWelcome verifies Esc works on the empty-list state.
func TestBackups_escFromEmptyListReturnsToWelcome(t *testing.T) {
	m := hubOnBackups(t, []backup.SnapshotMeta{}, nil)
	updated, _ := m.Update(backupsLoadedMsg{metas: []backup.SnapshotMeta{}, err: nil})
	m = updated.(AppModel)

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)
	if m.screen != ScreenWelcome {
		t.Errorf("Esc on empty-list ScreenBackups must return to ScreenWelcome, got %v", m.screen)
	}
}

// ─── Restore: Enter confirms and runs restore cmd ────────────────────────────

// TestBackups_enterOnItemDispatchesRestoreCmd verifies that pressing Enter on a
// backup item in the list dispatches a cmd (the restore cmd).
func TestBackups_enterOnItemDispatchesRestoreCmd(t *testing.T) {
	metas := []backup.SnapshotMeta{
		makeSnapMeta("snap-restore-001", backup.SourceInstall),
	}
	m := hubOnBackups(t, metas, nil)
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)

	// Press Enter to confirm restore.
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	if cmd == nil {
		t.Error("Enter on backup item must dispatch a non-nil cmd (restore)")
	}
}

// ─── Restore success → ScreenComplete ─────────────────────────────────────────

// TestBackups_restoreSuccessTransitionsToComplete verifies that receiving
// backupRestoreDoneMsg{err: nil} transitions to ScreenComplete.
func TestBackups_restoreSuccessTransitionsToComplete(t *testing.T) {
	metas := []backup.SnapshotMeta{
		makeSnapMeta("snap-001", backup.SourceInstall),
	}
	m := hubOnBackups(t, metas, nil)
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)

	updated, _ = m.Update(backupRestoreDoneMsg{id: "snap-001", err: nil})
	m = updated.(AppModel)

	if m.screen != ScreenComplete {
		t.Errorf("backupRestoreDoneMsg{nil} must transition to ScreenComplete, got %v", m.screen)
	}
}

// TestBackups_restoreSuccessRenderContainsSummary verifies the complete screen
// shows a success message after restore.
func TestBackups_restoreSuccessRenderContainsSummary(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	metas := []backup.SnapshotMeta{
		makeSnapMeta("snap-001", backup.SourceInstall),
	}
	m := hubOnBackups(t, metas, nil)
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)

	updated, _ = m.Update(backupRestoreDoneMsg{id: "snap-001", err: nil})
	m = updated.(AppModel)

	view := m.View()
	if !containsAny(view, "restored", "Restored", "success", "Success") {
		t.Errorf("complete screen after restore must show success summary, got:\n%s", view)
	}
}

// ─── Restore failure → ScreenComplete with error ──────────────────────────────

// TestBackups_restoreFailureTransitionsToComplete verifies that receiving
// backupRestoreDoneMsg{err: someErr} also transitions to ScreenComplete.
func TestBackups_restoreFailureTransitionsToComplete(t *testing.T) {
	metas := []backup.SnapshotMeta{
		makeSnapMeta("snap-001", backup.SourceInstall),
	}
	m := hubOnBackups(t, metas, nil)
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)

	restoreErr := errors.New("permission denied")
	updated, _ = m.Update(backupRestoreDoneMsg{id: "snap-001", err: restoreErr})
	m = updated.(AppModel)

	if m.screen != ScreenComplete {
		t.Errorf("backupRestoreDoneMsg{err} must transition to ScreenComplete, got %v", m.screen)
	}
}

// TestBackups_restoreFailureRenderContainsError verifies the complete screen
// shows the error message after a failed restore.
func TestBackups_restoreFailureRenderContainsError(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	metas := []backup.SnapshotMeta{
		makeSnapMeta("snap-001", backup.SourceInstall),
	}
	m := hubOnBackups(t, metas, nil)
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)

	restoreErr := errors.New("permission denied")
	updated, _ = m.Update(backupRestoreDoneMsg{id: "snap-001", err: restoreErr})
	m = updated.(AppModel)

	view := m.View()
	if !containsAny(view, "permission denied", "error", "Error", "failed", "Failed") {
		t.Errorf("complete screen after restore failure must show error text, got:\n%s", view)
	}
}

// ─── View: non-panic guarantee ────────────────────────────────────────────────

// TestBackups_viewNoPanicOnScreenBackups verifies View() does not panic when
// on ScreenBackups in any state (loading, loaded, empty).
func TestBackups_viewNoPanicOnScreenBackups(t *testing.T) {
	t.Setenv("NO_COLOR", "1")

	// State 1: just entered (loading).
	m := hubOnBackups(t, nil, nil)
	_ = m.View()

	// State 2: loaded with items.
	metas := []backup.SnapshotMeta{makeSnapMeta("snap-001", backup.SourceInstall)}
	updated, _ := m.Update(backupsLoadedMsg{metas: metas, err: nil})
	m = updated.(AppModel)
	_ = m.View()

	// State 3: empty list.
	updated, _ = m.Update(backupsLoadedMsg{metas: []backup.SnapshotMeta{}, err: nil})
	m = updated.(AppModel)
	_ = m.View()
}

// TestBackups_injectedStoreNotRealDir verifies that tests use the injected
// list fn and never access the real ~/.ui-craft-backups directory.
// The list fn returns controlled data; if the real dir were accessed we'd
// get different results or a missing-dir error.
func TestBackups_injectedStoreNotRealDir(t *testing.T) {
	called := false
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.backupListOverride = func() ([]backup.SnapshotMeta, error) {
		called = true
		return []backup.SnapshotMeta{makeSnapMeta("injected-snap", backup.SourceManual)}, nil
	}
	m.backupRestoreOverride = func(_ backup.SnapshotID) error { return nil }

	// Navigate to backups and enter.
	for i := 0; i < 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})

	if cmd == nil {
		t.Fatal("Enter must return a cmd")
	}
	// Execute the cmd — this triggers the injected list fn.
	msg := cmd()
	if !called {
		t.Error("the injected backupListOverride must be called, not the real store")
	}
	loaded, ok := msg.(backupsLoadedMsg)
	if !ok {
		t.Fatalf("cmd must return backupsLoadedMsg, got %T", msg)
	}
	if len(loaded.metas) != 1 || string(loaded.metas[0].ID) != "injected-snap" {
		t.Errorf("backupsLoadedMsg must carry injected metas, got %+v", loaded.metas)
	}
}
