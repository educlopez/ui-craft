// Package tui — hub_polish_test.go
// Strict TDD tests for Slice 7: global esc scoping, uninstall spinner batch,
// and ScreenComplete disambiguation across action sequences.
// All tests are model-level (Update/View); no TTY required.
package tui

import (
	"errors"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/backup"
)

// ══════════════════════════════════════════════════════════════════════════════
// Task 1 — Esc routing table (global esc scoping)
// ══════════════════════════════════════════════════════════════════════════════

// TestEsc_welcomeScreen_isNoOp verifies that pressing Esc on ScreenWelcome is a
// no-op (does NOT quit the application). The spec says Esc returns from a
// sub-screen to the welcome screen; on the welcome screen itself there is no
// parent to return to so Esc must be ignored.
func TestEsc_welcomeScreen_isNoOp(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	if m.screen != ScreenWelcome {
		t.Fatalf("precondition: expected ScreenWelcome, got %v", m.screen)
	}

	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)

	// Must remain on ScreenWelcome.
	if m.screen != ScreenWelcome {
		t.Errorf("Esc on ScreenWelcome must not navigate away, got %v", m.screen)
	}
	// Must NOT trigger tea.Quit.
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("Esc on ScreenWelcome must NOT trigger tea.Quit")
		}
	}
}

// TestEsc_installFlow_quits verifies that pressing Esc on a non-hub install
// flow screen (SplashScreen) still triggers tea.Quit — the install-flow esc
// semantics MUST remain byte-identical to before this change.
func TestEsc_installFlow_quits(t *testing.T) {
	// Use the install-flow model (NewAppModel), not the hub model.
	m := NewAppModel("v1.0.0", "/tmp/test")
	if m.screen != SplashScreen {
		t.Fatalf("precondition: NewAppModel must start on SplashScreen, got %v", m.screen)
	}

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	if cmd == nil {
		t.Fatal("Esc on SplashScreen (install flow) must return a non-nil cmd (tea.Quit)")
	}
	msg := cmd()
	if _, quit := msg.(tea.QuitMsg); !quit {
		t.Errorf("Esc on install flow SplashScreen must yield tea.QuitMsg, got %T", msg)
	}
}

// TestEsc_selectHarnessScreen_quits verifies Esc on SelectHarnessScreen quits
// (install-flow semantics unchanged).
func TestEsc_selectHarnessScreen_quits(t *testing.T) {
	m := NewAppModel("v1.0.0", "/tmp/test")
	m.screen = SelectHarnessScreen // force screen for testing

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	if cmd == nil {
		t.Fatal("Esc on SelectHarnessScreen must return a non-nil cmd (tea.Quit)")
	}
	msg := cmd()
	if _, quit := msg.(tea.QuitMsg); !quit {
		t.Errorf("Esc on SelectHarnessScreen must yield tea.QuitMsg, got %T", msg)
	}
}

// TestEsc_screenUpgrade_returnsToWelcome verifies Esc on ScreenUpgrade goes back.
// (Existing behavior — confirmed by this table test.)
func TestEsc_screenUpgrade_returnsToWelcome(t *testing.T) {
	m := hubOnUpgrade(t)
	if m.screen != ScreenUpgrade {
		t.Fatalf("precondition: expected ScreenUpgrade, got %v", m.screen)
	}

	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)

	if m.screen != ScreenWelcome {
		t.Errorf("Esc on ScreenUpgrade must return to ScreenWelcome, got %v", m.screen)
	}
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("Esc on ScreenUpgrade must NOT trigger tea.Quit")
		}
	}
}

// TestEsc_screenBackups_returnsToWelcome verifies Esc on ScreenBackups goes back.
func TestEsc_screenBackups_returnsToWelcome(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.backupListOverride = func() ([]backup.SnapshotMeta, error) { return nil, nil }
	// Navigate to Backups (item 3) and Enter.
	for i := 0; i < 3; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if m.screen != ScreenBackups {
		t.Fatalf("precondition: expected ScreenBackups, got %v", m.screen)
	}

	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)

	if m.screen != ScreenWelcome {
		t.Errorf("Esc on ScreenBackups must return to ScreenWelcome, got %v", m.screen)
	}
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("Esc on ScreenBackups must NOT trigger tea.Quit")
		}
	}
}

// TestEsc_screenUninstall_returnsToWelcome verifies Esc on ScreenUninstall (confirm step) goes back.
func TestEsc_screenUninstall_returnsToWelcome(t *testing.T) {
	m := hubOnUninstall(t, nil, nil)
	if m.screen != ScreenUninstall {
		t.Fatalf("precondition: expected ScreenUninstall, got %v", m.screen)
	}

	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)

	if m.screen != ScreenWelcome {
		t.Errorf("Esc on ScreenUninstall must return to ScreenWelcome, got %v", m.screen)
	}
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("Esc on ScreenUninstall must NOT trigger tea.Quit")
		}
	}
}

// TestEsc_screenComplete_returnsToWelcome verifies Esc on ScreenComplete goes back.
func TestEsc_screenComplete_returnsToWelcome(t *testing.T) {
	m := hubOnUpgrade(t)
	// Drive to ScreenComplete.
	updated, _ := m.Update(upgradeDoneMsg{err: nil})
	m = updated.(AppModel)
	if m.screen != ScreenComplete {
		t.Fatalf("precondition: expected ScreenComplete, got %v", m.screen)
	}

	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)

	if m.screen != ScreenWelcome {
		t.Errorf("Esc on ScreenComplete must return to ScreenWelcome, got %v", m.screen)
	}
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("Esc on ScreenComplete must NOT trigger tea.Quit")
		}
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// Task 2 — Uninstall spinner batch fix
// ══════════════════════════════════════════════════════════════════════════════

// TestUninstall_confirmEnterBatchesTickCmd verifies that when the user confirms
// the uninstall (Enter on the confirm step), the returned cmd is a tea.BatchMsg
// that contains BOTH the uninstall cmd AND a tick cmd (so the spinner animates).
//
// This mirrors the upgrade and backup-restore behavior that also batch tickCmd().
func TestUninstall_confirmEnterBatchesTickCmd(t *testing.T) {
	m := hubOnUninstall(t, nil, nil)
	if m.screen != ScreenUninstall {
		t.Fatalf("precondition: expected ScreenUninstall, got %v", m.screen)
	}

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("Enter on uninstall confirm must return a non-nil cmd (tea.Batch)")
	}

	// The cmd must be a batch.
	batchMsg := cmd()
	batch, ok := batchMsg.(tea.BatchMsg)
	if !ok {
		t.Fatalf("uninstall confirm cmd must return tea.BatchMsg (got %T) so the spinner animates", batchMsg)
	}

	// The batch must contain at least 2 sub-cmds.
	if len(batch) < 2 {
		t.Errorf("uninstall batch must have at least 2 sub-cmds (uninstall + tick), got %d", len(batch))
	}

	// At least one sub-cmd must return a TickMsg (the spinner tick).
	foundTick := false
	for _, subCmd := range batch {
		if subCmd == nil {
			continue
		}
		msg := subCmd()
		if _, ok := msg.(TickMsg); ok {
			foundTick = true
		}
	}
	if !foundTick {
		t.Error("uninstall batch must include a tickCmd() sub-cmd that returns TickMsg so the spinner works")
	}
}

// TestUninstall_tickAdvancesSpinnerWhileRunning verifies the TickMsg is handled
// while ScreenUninstall is in running state (spinner active).
func TestUninstall_tickAdvancesSpinnerWhileRunning(t *testing.T) {
	m := hubOnUninstall(t, nil, nil)
	// Simulate uninstall running (set flag directly — cmd is async in real code).
	m.uninstallRunning = true
	m.spinnerFrame = 0

	updated, _ := m.Update(TickMsg(time.Now()))
	m = updated.(AppModel)

	if m.spinnerFrame != 1 {
		t.Errorf("TickMsg while uninstallRunning must advance spinnerFrame to 1, got %d", m.spinnerFrame)
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// Task 3 — ScreenComplete disambiguation across action sequences
// ══════════════════════════════════════════════════════════════════════════════

// TestComplete_upgradeAfterBackup_showsUpgradeComplete verifies that running
// Upgrade after a completed Backup-restore does NOT show the backup complete
// screen. The cross-action sequence must reset stale backup fields.
//
// Sequence:
//  1. Backups → restore succeeds (backupRestoredID = "snap-backup-001")
//  2. Esc → ScreenWelcome
//  3. Upgrade → succeeds → ScreenComplete
//  4. View() must show upgrade complete, NOT backup complete.
func TestComplete_upgradeAfterBackup_showsUpgradeComplete(t *testing.T) {
	t.Setenv("NO_COLOR", "1")

	m := NewHubModel("v1.0.0", "/tmp/test")
	m.upgradeOverride = func() tea.Msg { return upgradeDoneMsg{err: nil, newVersion: "v2.0.0", method: "direct"} }
	m.backupListOverride = func() ([]backup.SnapshotMeta, error) { return nil, nil }

	// Step 1: Simulate backup restore completion with stale fields.
	m.backupRestoredID = "snap-backup-001"
	m.backupRestoreErr = nil

	// Step 2: User presses Esc from some sub-screen back to welcome.
	// Navigate to ScreenWelcome directly (simulate esc-back).
	m.screen = ScreenWelcome

	// Step 3a: Navigate to Upgrade (item 2) and Enter.
	for i := 0; i < 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	if m.screen != ScreenUpgrade {
		t.Fatalf("expected ScreenUpgrade after Enter on Upgrade, got %v", m.screen)
	}

	// Step 3b: Upgrade completes successfully.
	updated, _ = m.Update(upgradeDoneMsg{err: nil, newVersion: "v2.0.0", method: "direct"})
	m = updated.(AppModel)

	if m.screen != ScreenComplete {
		t.Fatalf("expected ScreenComplete after upgradeDoneMsg, got %v", m.screen)
	}

	// Step 4: View must show upgrade complete, NOT backup complete.
	view := m.View()
	// The upgrade complete view should mention upgrade-related terms.
	// The backup complete view mentions "Backup restored" or "restore".
	if containsAny(view, "Backup restored", "restored backup", "restore") {
		t.Errorf("after Upgrade, ScreenComplete must NOT show backup complete view; got:\n%s", view)
	}
}

// TestComplete_uninstallAfterBackup_showsUninstallComplete verifies that running
// Uninstall after a completed Backup-restore does NOT show backup complete.
//
// Sequence:
//  1. Stale: backupRestoredID = "snap-bak-001"
//  2. Navigate to Uninstall → confirm → receives uninstallDoneMsg → ScreenComplete
//  3. View() must show uninstall complete, NOT backup complete.
func TestComplete_uninstallAfterBackup_showsUninstallComplete(t *testing.T) {
	t.Setenv("NO_COLOR", "1")

	m := NewHubModel("v1.0.0", "/tmp/test")
	m.uninstallSnapshotOverride = func() (string, error) { return "snap-uninstall-002", nil }
	m.uninstallOverride = func() ([]string, error) {
		return []string{"/home/.claude/skills/ui-craft"}, nil
	}

	// Stale backup fields from a prior backup-restore session.
	m.backupRestoredID = "snap-bak-001"
	m.backupRestoreErr = nil

	// Navigate to Uninstall (item 4).
	for i := 0; i < 4; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	if m.screen != ScreenUninstall {
		t.Fatalf("expected ScreenUninstall, got %v", m.screen)
	}

	// Inject uninstall done.
	updated, _ = m.Update(uninstallDoneMsg{
		snapshotID:   "snap-uninstall-002",
		removedPaths: []string{"/home/.claude/skills/ui-craft"},
		err:          nil,
	})
	m = updated.(AppModel)

	if m.screen != ScreenComplete {
		t.Fatalf("expected ScreenComplete, got %v", m.screen)
	}

	// View must show uninstall complete.
	view := m.View()
	if !containsAny(view, "snap-uninstall-002", "Uninstall", "uninstall", "Removed", "removed") {
		t.Errorf("ScreenComplete after uninstall must show uninstall summary, got:\n%s", view)
	}
	// Must NOT show backup-specific text.
	if containsAny(view, "Backup restored", "snap-bak-001") {
		t.Errorf("ScreenComplete after uninstall must NOT show backup complete view, got:\n%s", view)
	}
}

// TestComplete_backupAfterUninstall_showsBackupComplete verifies that running
// Backup-restore after Uninstall does NOT show uninstall complete.
//
// Sequence:
//  1. Stale: uninstallSnapshotID = "snap-old-uninstall", uninstallErr = someErr
//  2. Navigate to Backups → receives backupRestoreDoneMsg → ScreenComplete
//  3. View() must show backup complete, NOT uninstall complete.
func TestComplete_backupAfterUninstall_showsBackupComplete(t *testing.T) {
	t.Setenv("NO_COLOR", "1")

	m := NewHubModel("v1.0.0", "/tmp/test")
	m.backupListOverride = func() ([]backup.SnapshotMeta, error) { return nil, nil }
	m.backupRestoreOverride = nil

	// Stale uninstall fields from a prior uninstall session.
	m.uninstallSnapshotID = "snap-old-uninstall"
	m.uninstallErr = errors.New("old uninstall error")

	// Navigate to Backups (item 3).
	for i := 0; i < 3; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	if m.screen != ScreenBackups {
		t.Fatalf("expected ScreenBackups, got %v", m.screen)
	}

	// Inject backup restore done.
	updated, _ = m.Update(backupRestoreDoneMsg{
		id:  "snap-new-backup-003",
		err: nil,
	})
	m = updated.(AppModel)

	if m.screen != ScreenComplete {
		t.Fatalf("expected ScreenComplete, got %v", m.screen)
	}

	// View must show backup complete, NOT uninstall complete.
	view := m.View()
	if !containsAny(view, "snap-new-backup-003", "Backup", "backup", "restored", "Restored") {
		t.Errorf("ScreenComplete after backup restore must show backup summary, got:\n%s", view)
	}
	// Must NOT show uninstall-specific text.
	if containsAny(view, "snap-old-uninstall", "old uninstall error") {
		t.Errorf("ScreenComplete after backup restore must NOT show old uninstall complete view, got:\n%s", view)
	}
}

// TestComplete_upgradeAfterUninstall_showsUpgradeComplete verifies that running
// Upgrade after Uninstall does NOT show uninstall complete.
func TestComplete_upgradeAfterUninstall_showsUpgradeComplete(t *testing.T) {
	t.Setenv("NO_COLOR", "1")

	m := NewHubModel("v1.0.0", "/tmp/test")
	m.upgradeOverride = func() tea.Msg { return upgradeDoneMsg{err: nil, newVersion: "v3.0.0", method: "direct"} }

	// Stale uninstall fields.
	m.uninstallSnapshotID = "snap-uninstall-stale"
	m.uninstallErr = errors.New("stale uninstall error")

	// Navigate to Upgrade (item 2) and Enter.
	for i := 0; i < 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	if m.screen != ScreenUpgrade {
		t.Fatalf("expected ScreenUpgrade, got %v", m.screen)
	}

	// Upgrade completes.
	updated, _ = m.Update(upgradeDoneMsg{err: nil, newVersion: "v3.0.0", method: "direct"})
	m = updated.(AppModel)

	if m.screen != ScreenComplete {
		t.Fatalf("expected ScreenComplete, got %v", m.screen)
	}

	view := m.View()
	// Upgrade complete renders upgrade-specific text.
	if containsAny(view, "snap-uninstall-stale", "stale uninstall error", "Uninstall complete") {
		t.Errorf("ScreenComplete after upgrade must NOT show uninstall complete, got:\n%s", view)
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// Fix 1 — ScreenComplete disambiguation: uninstall with empty snapshotID + nil err
// ══════════════════════════════════════════════════════════════════════════════

// TestComplete_uninstallNoSnapshot_showsUninstallComplete verifies that when an
// uninstall completes with snapshotID=="" and err==nil (nothing to snapshot),
// ScreenComplete routes to renderUninstallComplete — NOT renderComplete (upgrade).
//
// This is the BLOCKER bug: previously the View() routing fell through to the
// upgrade renderer because both uninstallSnapshotID=="" and uninstallErr==nil,
// so neither condition in the old field-presence check was true.
//
// The fix adds a lastCompletedAction discriminator field set when entering each
// action screen (in confirmSelectionHub), and routes ScreenComplete on it instead
// of field presence.
func TestComplete_uninstallNoSnapshot_showsUninstallComplete(t *testing.T) {
	t.Setenv("NO_COLOR", "1")

	m := NewHubModel("v1.0.0", "/tmp/test")
	// Uninstall succeeds with empty snapshotID (no harnesses to snapshot) and nil err.
	m.uninstallSnapshotOverride = func() (string, error) { return "", nil }
	m.uninstallOverride = func() ([]string, error) {
		return []string{"/home/.claude/skills/ui-craft"}, nil
	}

	// Navigate to Uninstall (item 4) and Enter.
	for i := 0; i < 4; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	if m.screen != ScreenUninstall {
		t.Fatalf("precondition: expected ScreenUninstall, got %v", m.screen)
	}

	// Inject uninstallDoneMsg with empty snapshotID and nil err.
	updated, _ = m.Update(uninstallDoneMsg{
		snapshotID:   "",
		removedPaths: []string{"/home/.claude/skills/ui-craft"},
		err:          nil,
	})
	m = updated.(AppModel)

	if m.screen != ScreenComplete {
		t.Fatalf("expected ScreenComplete after uninstallDoneMsg, got %v", m.screen)
	}

	view := m.View()
	// Must show uninstall complete, not upgrade "up to date".
	if containsAny(view, "ui-craft is up to date", "Homebrew upgraded", "Updated to") {
		t.Errorf("uninstall with snapshotID='' and err==nil must NOT show upgrade complete, got:\n%s", view)
	}
	// Must show uninstall-related content.
	if !containsAny(view, "Uninstall complete", "uninstall", "Removed", "removed") {
		t.Errorf("uninstall with snapshotID='' and err==nil must show uninstall complete, got:\n%s", view)
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// Fix 2 — Upgrade stale-goroutine race: generation counter
// ══════════════════════════════════════════════════════════════════════════════

// TestUpgrade_staleGenerationMsgIsIgnored verifies that an upgradeDoneMsg
// carrying an outdated generation number is silently discarded and does NOT
// transition to ScreenComplete or overwrite the model's result fields.
//
// Scenario: user presses Esc on ScreenUpgrade (generation bumped to 2) then
// re-enters it (generation is now 2). A stale upgradeDoneMsg from the first
// goroutine arrives with generation=1. It must be ignored.
func TestUpgrade_staleGenerationMsgIsIgnored(t *testing.T) {
	m := hubOnUpgrade(t)

	// The model entered ScreenUpgrade → generation is 1 (set by confirmSelectionHub).
	// Simulate what would happen if the user navigated away and re-entered:
	// generation is now 2.
	m.upgradeGeneration = 2
	m.screen = ScreenUpgrade

	// Deliver a stale upgradeDoneMsg from generation 1.
	staleDone := upgradeDoneMsg{
		err:        nil,
		newVersion: "v99.9.9",
		method:     "direct",
		generation: 1, // stale — does not match current generation 2
	}
	updated, cmd := m.Update(staleDone)
	m = updated.(AppModel)

	// Must NOT transition to ScreenComplete.
	if m.screen != ScreenUpgrade {
		t.Errorf("stale upgradeDoneMsg (gen=1, current=2) must NOT transition screen; got %v", m.screen)
	}
	// Must NOT update result fields.
	if m.upgradeNewVersion == "v99.9.9" {
		t.Error("stale upgradeDoneMsg must NOT overwrite upgradeNewVersion")
	}
	// Cmd may be nil or a tick — must NOT be a quit.
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("stale upgradeDoneMsg must NOT trigger tea.Quit")
		}
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// Fix 8 — Guard quit during in-flight binary-replace
// ══════════════════════════════════════════════════════════════════════════════

// TestQuit_blockedWhileUpgradeRunning verifies that pressing 'q' while the
// upgrade is actively running (ScreenUpgrade, goroutine in flight) does NOT
// trigger tea.Quit. The user must wait for the upgrade to complete.
func TestQuit_blockedWhileUpgradeRunning(t *testing.T) {
	m := hubOnUpgrade(t)
	// Simulate upgrade in flight: we're on ScreenUpgrade, spinner is ticking.
	// The upgradeOverride is set to no-op so no goroutine fired.
	// We keep the screen as ScreenUpgrade to represent "in flight".
	if m.screen != ScreenUpgrade {
		t.Fatalf("precondition: expected ScreenUpgrade, got %v", m.screen)
	}

	// Press 'q' while upgrade is running (on ScreenUpgrade).
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})

	// Must NOT trigger tea.Quit.
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("'q' during ScreenUpgrade (upgrade in flight) must NOT trigger tea.Quit")
		}
	}
}

// TestQuit_blockedWhileUninstallRunning verifies that pressing 'q' while
// uninstall is actively running does NOT trigger tea.Quit.
func TestQuit_blockedWhileUninstallRunning(t *testing.T) {
	m := hubOnUninstall(t, nil, nil)

	// Put the model into the "running" state (goroutine in flight).
	m.uninstallRunning = true

	// Press 'q' while uninstall is running.
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})

	// Must NOT trigger tea.Quit.
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("'q' during uninstall running must NOT trigger tea.Quit")
		}
	}
}

// TestQuit_allowedOnWelcomeScreen verifies 'q' still quits from ScreenWelcome
// (no in-flight action).
func TestQuit_allowedOnWelcomeScreen(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	if cmd == nil {
		t.Fatal("'q' on ScreenWelcome must return a non-nil cmd (tea.Quit)")
	}
	msg := cmd()
	if _, quit := msg.(tea.QuitMsg); !quit {
		t.Errorf("'q' on ScreenWelcome must yield tea.QuitMsg, got %T", msg)
	}
}
