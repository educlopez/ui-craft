// Package tui — hub_uninstall_test.go
// Strict TDD tests for Slice 6: Managed Uninstall screen.
// All tests are model-level (Update/View); no TTY required.
// Tests use an injected uninstall func and snapshot func — never real ~/.claude or real backups.
package tui

import (
	"errors"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

// ─── helpers ──────────────────────────────────────────────────────────────────

// runUninstallBatch executes a cmd that is expected to be a tea.Batch (from
// the uninstall confirm Enter handler). It runs each sub-cmd and returns the
// uninstallDoneMsg found within the batch. If no uninstallDoneMsg is found it
// returns a zero-value uninstallDoneMsg and ok=false.
//
// This helper is needed because the confirm Enter now returns
// tea.Batch(uninstallCmd, tickCmd()) to animate the spinner.
func runUninstallBatch(t *testing.T, cmd tea.Cmd) (uninstallDoneMsg, bool) {
	t.Helper()
	batchMsg := cmd()
	batch, ok := batchMsg.(tea.BatchMsg)
	if !ok {
		t.Fatalf("expected tea.BatchMsg from uninstall confirm Enter, got %T", batchMsg)
		return uninstallDoneMsg{}, false
	}
	for _, subCmd := range batch {
		if subCmd == nil {
			continue
		}
		msg := subCmd()
		if done, ok := msg.(uninstallDoneMsg); ok {
			return done, true
		}
	}
	return uninstallDoneMsg{}, false
}

// hubOnUninstall returns a model at ScreenUninstall with injection seams wired.
// snapshotErr controls the outcome of the pre-uninstall snapshot.
// uninstallErr controls the outcome of the uninstall operation.
func hubOnUninstall(t *testing.T, snapshotErr error, uninstallErr error) AppModel {
	t.Helper()
	m := NewHubModel("v1.0.0", "/tmp/test")

	// Inject snapshot function (no real backup store).
	m.uninstallSnapshotOverride = func() (string, error) {
		if snapshotErr != nil {
			return "", snapshotErr
		}
		return "snap-uninstall-001", nil
	}

	// Inject uninstall function (no real FS removal).
	m.uninstallOverride = func() ([]string, error) {
		if uninstallErr != nil {
			return nil, uninstallErr
		}
		return []string{"/home/user/.claude/skills/ui-craft", "/home/user/.claude/agents/design-reviewer.md"}, nil
	}

	// Navigate to "Managed uninstall" (item 4) and Enter.
	// j j j = cursor 3.
	for i := 0; i < 4; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	return m
}

// ─── Routing: selecting "Managed uninstall" routes to ScreenUninstall ─────────

// TestUninstall_enterRoutesToScreenUninstall verifies that pressing Enter on
// "Managed uninstall" transitions to ScreenUninstall.
func TestUninstall_enterRoutesToScreenUninstall(t *testing.T) {
	m := hubOnUninstall(t, nil, nil)
	if m.screen != ScreenUninstall {
		t.Errorf("Enter on Managed uninstall must transition to ScreenUninstall, got %v", m.screen)
	}
}

// TestUninstall_screenUninstallShowsWhatWillBeRemoved verifies that the
// uninstall screen renders what will be removed before confirmation.
func TestUninstall_screenUninstallShowsWhatWillBeRemoved(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnUninstall(t, nil, nil)
	view := m.View()
	// Must show confirmation prompt (not spinner) before user confirms.
	if !containsAny(view, "uninstall", "Uninstall", "remove", "Remove") {
		t.Errorf("ScreenUninstall View() must mention uninstall/remove before confirm, got:\n%s", view)
	}
}

// ─── Confirmation gate: no removal before confirm ─────────────────────────────

// TestUninstall_confirmGateBlocksWithoutEnter verifies the model stays on
// ScreenUninstall and the uninstallOverride is NOT called until confirmed.
func TestUninstall_confirmGateBlocksWithoutEnter(t *testing.T) {
	called := false
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.uninstallSnapshotOverride = func() (string, error) { return "snap-001", nil }
	m.uninstallOverride = func() ([]string, error) {
		called = true
		return nil, nil
	}

	// Navigate to Managed uninstall (item 4).
	for i := 0; i < 4; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	// Enter routes to the screen.
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	// Model should be at ScreenUninstall (confirm step, not running).
	if m.screen != ScreenUninstall {
		t.Fatalf("expected ScreenUninstall, got %v", m.screen)
	}
	// uninstall must NOT have run yet.
	if called {
		t.Error("uninstallOverride must NOT be called before the user confirms")
	}
}

// ─── Esc: back to welcome from uninstall confirm screen ───────────────────────

// TestUninstall_escFromConfirmReturnsToWelcome verifies that Esc on the
// confirmation step returns to ScreenWelcome without running any uninstall.
func TestUninstall_escFromConfirmReturnsToWelcome(t *testing.T) {
	called := false
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.uninstallSnapshotOverride = func() (string, error) { return "snap-001", nil }
	m.uninstallOverride = func() ([]string, error) {
		called = true
		return nil, nil
	}

	// Navigate and enter.
	for i := 0; i < 4; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	// Press Esc to cancel.
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)

	if m.screen != ScreenWelcome {
		t.Errorf("Esc on ScreenUninstall must return to ScreenWelcome, got %v", m.screen)
	}
	if called {
		t.Error("uninstallOverride must NOT be called after Esc")
	}
	// Must NOT be tea.Quit.
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("Esc on ScreenUninstall must NOT trigger tea.Quit")
		}
	}
}

// ─── Confirm: Enter on confirm dispatches uninstall cmd ───────────────────────

// TestUninstall_confirmEnterDispatchesUninstallCmd verifies that pressing Enter
// on the confirmation step dispatches a non-nil cmd (the uninstall cmd).
func TestUninstall_confirmEnterDispatchesUninstallCmd(t *testing.T) {
	m := hubOnUninstall(t, nil, nil)
	// m is already at ScreenUninstall confirm step.
	// Press Enter to confirm.
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Error("Enter on confirm must dispatch a non-nil cmd (the uninstall cmd)")
	}
}

// ─── Success: uninstallDoneMsg → ScreenComplete with summary ─────────────────

// TestUninstall_successTransitionsToComplete verifies that receiving
// uninstallDoneMsg{err: nil} transitions to ScreenComplete.
func TestUninstall_successTransitionsToComplete(t *testing.T) {
	m := hubOnUninstall(t, nil, nil)

	updated, _ := m.Update(uninstallDoneMsg{
		snapshotID:   "snap-001",
		removedPaths: []string{"/home/.claude/skills/ui-craft"},
		err:          nil,
	})
	m = updated.(AppModel)

	if m.screen != ScreenComplete {
		t.Errorf("uninstallDoneMsg{nil} must transition to ScreenComplete, got %v", m.screen)
	}
}

// TestUninstall_successRenderContainsSummary verifies the Complete screen after
// successful uninstall shows removed paths and the snapshot ID.
func TestUninstall_successRenderContainsSummary(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnUninstall(t, nil, nil)

	updated, _ := m.Update(uninstallDoneMsg{
		snapshotID:   "snap-uninstall-001",
		removedPaths: []string{"/home/.claude/skills/ui-craft"},
		err:          nil,
	})
	m = updated.(AppModel)

	view := m.View()
	if !containsAny(view, "removed", "Removed", "uninstalled", "Uninstalled", "complete", "Complete") {
		t.Errorf("complete screen must show removal summary, got:\n%s", view)
	}
}

// TestUninstall_successRenderShowsSnapshotID verifies that the snapshot ID is
// shown on the Complete screen so the user knows how to rollback.
func TestUninstall_successRenderShowsSnapshotID(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnUninstall(t, nil, nil)

	updated, _ := m.Update(uninstallDoneMsg{
		snapshotID:   "snap-uninstall-001",
		removedPaths: []string{"/home/.claude/skills/ui-craft"},
		err:          nil,
	})
	m = updated.(AppModel)

	view := m.View()
	if !strings.Contains(view, "snap-uninstall-001") {
		t.Errorf("complete screen must show snapshot ID for rollback, got:\n%s", view)
	}
}

// ─── Failure: uninstallDoneMsg{err} → ScreenComplete with error ───────────────

// TestUninstall_failureTransitionsToComplete verifies that receiving
// uninstallDoneMsg{err: someErr} also transitions to ScreenComplete.
func TestUninstall_failureTransitionsToComplete(t *testing.T) {
	m := hubOnUninstall(t, nil, nil)

	updated, _ := m.Update(uninstallDoneMsg{
		err: errors.New("permission denied"),
	})
	m = updated.(AppModel)

	if m.screen != ScreenComplete {
		t.Errorf("uninstallDoneMsg{err} must transition to ScreenComplete, got %v", m.screen)
	}
}

// TestUninstall_failureRenderContainsError verifies the Complete screen shows
// the error message after a failed uninstall.
func TestUninstall_failureRenderContainsError(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnUninstall(t, nil, nil)

	updated, _ := m.Update(uninstallDoneMsg{
		err: errors.New("permission denied"),
	})
	m = updated.(AppModel)

	view := m.View()
	if !containsAny(view, "permission denied", "error", "Error", "failed", "Failed") {
		t.Errorf("complete screen after uninstall failure must show error text, got:\n%s", view)
	}
}

// ─── Pre-uninstall snapshot is taken ──────────────────────────────────────────

// TestUninstall_snapshotTakenBeforeRemoval verifies that when the user confirms
// the uninstall, the cmd returned calls the snapshotOverride (not skips it).
func TestUninstall_snapshotTakenBeforeRemoval(t *testing.T) {
	snapshotCalled := false
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.uninstallSnapshotOverride = func() (string, error) {
		snapshotCalled = true
		return "snap-snap-001", nil
	}
	m.uninstallOverride = func() ([]string, error) {
		return []string{"/home/.claude/skills/ui-craft"}, nil
	}

	// Navigate to Managed uninstall (item 4) and enter.
	for i := 0; i < 4; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	// Confirm the uninstall.
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("confirm must return a non-nil cmd")
	}

	// Execute the batch cmd — uninstall confirm returns tea.Batch(uninstallCmd, tickCmd()).
	// We must unwrap the batch to trigger the uninstall sub-cmd.
	_, _ = runUninstallBatch(t, cmd)

	// Snapshot must have been called by the cmd.
	if !snapshotCalled {
		t.Error("uninstallSnapshotOverride must be called during the uninstall cmd (before removal)")
	}
}

// TestUninstall_snapshotFailureReturnsError verifies that if the snapshot fails
// the uninstallDoneMsg carries the snapshot error and uninstall does not proceed.
func TestUninstall_snapshotFailureReturnsError(t *testing.T) {
	uninstallCalled := false
	snapErr := errors.New("no space left on device")
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.uninstallSnapshotOverride = func() (string, error) {
		return "", snapErr
	}
	m.uninstallOverride = func() ([]string, error) {
		uninstallCalled = true
		return nil, nil
	}

	// Navigate to Managed uninstall (item 4) and enter.
	for i := 0; i < 4; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	// Confirm the uninstall.
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("confirm must return a non-nil cmd")
	}

	// Unwrap the batch (uninstall confirm returns tea.Batch(uninstallCmd, tickCmd())).
	done, found := runUninstallBatch(t, cmd)
	if !found {
		t.Fatal("batch must contain a cmd that returns uninstallDoneMsg")
	}

	// Snapshot failure must bubble up as an error in uninstallDoneMsg.
	if done.err == nil {
		t.Error("snapshot failure must set err in uninstallDoneMsg")
	}
	// Uninstall must NOT run when snapshot fails.
	if uninstallCalled {
		t.Error("uninstallOverride must NOT be called when snapshot fails")
	}
}

// ─── View: non-panic guarantee ────────────────────────────────────────────────

// TestUninstall_viewNoPanicOnScreenUninstall verifies View() does not panic
// on ScreenUninstall in any state.
func TestUninstall_viewNoPanicOnScreenUninstall(t *testing.T) {
	t.Setenv("NO_COLOR", "1")

	// State 1: confirm step.
	m := hubOnUninstall(t, nil, nil)
	_ = m.View()

	// State 2: spinner (running state).
	m.uninstallRunning = true
	_ = m.View()
}

// ─── Injection seam verification ─────────────────────────────────────────────

// TestUninstall_injectedFnsUsedNotRealFS verifies that the injected
// uninstallOverride is called (not the real core.Uninstall / real FS).
func TestUninstall_injectedFnsUsedNotRealFS(t *testing.T) {
	overrideCalled := false
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.uninstallSnapshotOverride = func() (string, error) { return "snap-inject-001", nil }
	m.uninstallOverride = func() ([]string, error) {
		overrideCalled = true
		return []string{"/injected/path/removed"}, nil
	}

	// Navigate to Managed uninstall (item 4) and enter.
	for i := 0; i < 4; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	// Confirm the uninstall.
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("confirm must return a non-nil cmd")
	}

	// Unwrap the batch (uninstall confirm returns tea.Batch(uninstallCmd, tickCmd())).
	done, found := runUninstallBatch(t, cmd)
	if !found {
		t.Fatal("batch must contain a cmd that returns uninstallDoneMsg")
	}
	if !overrideCalled {
		t.Error("uninstallOverride must be called, not real core.Uninstall")
	}

	if done.err != nil {
		t.Errorf("injected override returned success, but err=%v", done.err)
	}
	if len(done.removedPaths) != 1 || done.removedPaths[0] != "/injected/path/removed" {
		t.Errorf("removedPaths must carry injected result, got %+v", done.removedPaths)
	}
}
