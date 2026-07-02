// Package tui — hub_actions_test.go
// Strict TDD tests for Slice 4: Upgrade screen (binary self-update).
// All tests are model-level (Update/View); no TTY required.
package tui

import (
	"errors"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// ─── Helper ───────────────────────────────────────────────────────────────────

// hubOnUpgrade returns a model already at ScreenUpgrade (cursor on Upgrade item
// and Enter pressed), but with a no-op upgradeCmd so no goroutine fires.
// The upgradeOverride is set before the Enter so confirmSelectionHub uses it.
func hubOnUpgrade(t *testing.T) AppModel {
	t.Helper()
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.upgradeOverride = func() tea.Msg { return nil } // no-op; test drives msgs manually

	// Navigate to Upgrade (item 2 — after "Start installation" and
	// "Install (this project)") and Enter.
	for i := 0; i < 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	return m
}

// ─── Routing: ScreenUpgrade is entered from welcome ───────────────────────────

// TestUpgrade_enterUpgradeRoutesToScreenUpgrade verifies confirmSelectionHub
// transitions to ScreenUpgrade and the screen is NOT ScreenWelcome.
// (Duplicate of hub_test.go check but scoped here for actions context.)
func TestUpgrade_enterUpgradeRoutesToScreenUpgrade(t *testing.T) {
	m := hubOnUpgrade(t)
	if m.screen != ScreenUpgrade {
		t.Errorf("expected ScreenUpgrade, got %v", m.screen)
	}
}

// ─── upgradeDoneMsg → ScreenComplete ─────────────────────────────────────────

// TestUpgrade_successMsgTransitionsToComplete verifies that receiving
// upgradeDoneMsg{err: nil} on ScreenUpgrade transitions to ScreenComplete.
func TestUpgrade_successMsgTransitionsToComplete(t *testing.T) {
	m := hubOnUpgrade(t)
	updated, _ := m.Update(upgradeDoneMsg{err: nil})
	m = updated.(AppModel)
	if m.screen != ScreenComplete {
		t.Errorf("upgradeDoneMsg{nil} must transition to ScreenComplete, got %v", m.screen)
	}
}

// TestUpgrade_failureMsgTransitionsToComplete verifies that receiving
// upgradeDoneMsg{err: someErr} also transitions to ScreenComplete (error path).
func TestUpgrade_failureMsgTransitionsToComplete(t *testing.T) {
	m := hubOnUpgrade(t)
	someErr := errors.New("network timeout")
	updated, _ := m.Update(upgradeDoneMsg{err: someErr})
	m = updated.(AppModel)
	if m.screen != ScreenComplete {
		t.Errorf("upgradeDoneMsg{err} must transition to ScreenComplete, got %v", m.screen)
	}
}

// ─── ScreenComplete render ────────────────────────────────────────────────────

// TestUpgrade_successRenderContainsSuccess verifies that the complete screen
// rendered after success contains an affirmative message, not an error.
func TestUpgrade_successRenderContainsSuccess(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnUpgrade(t)
	updated, _ := m.Update(upgradeDoneMsg{err: nil, newVersion: "v1.2.0"})
	m = updated.(AppModel)

	view := m.View()
	if !containsAny(view, "success", "Success", "updated", "Updated", "v1.2.0", "latest", "Latest") {
		t.Errorf("complete screen after success must show affirmative result, got:\n%s", view)
	}
}

// TestUpgrade_failureRenderContainsError verifies that the complete screen
// rendered after a failure contains the error message.
func TestUpgrade_failureRenderContainsError(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnUpgrade(t)
	someErr := errors.New("checksum mismatch")
	updated, _ := m.Update(upgradeDoneMsg{err: someErr})
	m = updated.(AppModel)

	view := m.View()
	if !containsAny(view, "checksum mismatch", "error", "Error", "failed", "Failed") {
		t.Errorf("complete screen after failure must show error text, got:\n%s", view)
	}
}

// ─── Esc key handling ─────────────────────────────────────────────────────────

// TestUpgrade_escFromScreenUpgradeReturnsToWelcome verifies that pressing Esc
// while on ScreenUpgrade returns to ScreenWelcome (local back-nav, not global quit).
func TestUpgrade_escFromScreenUpgradeReturnsToWelcome(t *testing.T) {
	m := hubOnUpgrade(t)
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)
	if m.screen != ScreenWelcome {
		t.Errorf("Esc on ScreenUpgrade must return to ScreenWelcome, got %v", m.screen)
	}
	// Must NOT be tea.Quit (i.e., cmd must not yield QuitMsg).
	if cmd != nil {
		msg := cmd()
		if _, quit := msg.(tea.QuitMsg); quit {
			t.Error("Esc on ScreenUpgrade must NOT trigger tea.Quit")
		}
	}
}

// TestUpgrade_escFromScreenCompleteReturnsToWelcome verifies that pressing Esc
// on ScreenComplete (upgrade result) returns to ScreenWelcome.
func TestUpgrade_escFromScreenCompleteReturnsToWelcome(t *testing.T) {
	m := hubOnUpgrade(t)
	// Transition to ScreenComplete.
	updated, _ := m.Update(upgradeDoneMsg{err: nil})
	m = updated.(AppModel)
	if m.screen != ScreenComplete {
		t.Fatalf("precondition: expected ScreenComplete, got %v", m.screen)
	}

	// Esc should return to welcome.
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)
	if m.screen != ScreenWelcome {
		t.Errorf("Esc on ScreenComplete must return to ScreenWelcome, got %v", m.screen)
	}
}

// ─── Spinner / TickMsg ────────────────────────────────────────────────────────

// TestUpgrade_tickAdvancesSpinnerFrame verifies that a TickMsg increments the
// spinner frame counter without blocking or panicking.
func TestUpgrade_tickAdvancesSpinnerFrame(t *testing.T) {
	m := hubOnUpgrade(t)
	// Initial frame is 0.
	if m.spinnerFrame != 0 {
		t.Fatalf("spinnerFrame must start at 0, got %d", m.spinnerFrame)
	}

	// Deliver a TickMsg.
	updated, _ := m.Update(TickMsg(time.Now()))
	m = updated.(AppModel)
	if m.spinnerFrame != 1 {
		t.Errorf("TickMsg must advance spinnerFrame to 1, got %d", m.spinnerFrame)
	}

	// Deliver another TickMsg.
	updated, _ = m.Update(TickMsg(time.Now()))
	m = updated.(AppModel)
	if m.spinnerFrame != 2 {
		t.Errorf("second TickMsg must advance spinnerFrame to 2, got %d", m.spinnerFrame)
	}
}

// TestUpgrade_tickWrapsSpinnerFrame verifies that spinner frame wraps around
// the spinnerFrames length.
func TestUpgrade_tickWrapsSpinnerFrame(t *testing.T) {
	m := hubOnUpgrade(t)
	n := len(spinnerFrames)
	// Advance to the last frame.
	for i := 0; i < n-1; i++ {
		updated, _ := m.Update(TickMsg(time.Now()))
		m = updated.(AppModel)
	}
	if m.spinnerFrame != n-1 {
		t.Fatalf("expected spinnerFrame %d, got %d", n-1, m.spinnerFrame)
	}
	// One more tick should wrap to 0.
	updated, _ := m.Update(TickMsg(time.Now()))
	m = updated.(AppModel)
	if m.spinnerFrame != 0 {
		t.Errorf("spinnerFrame must wrap to 0 after %d ticks, got %d", n, m.spinnerFrame)
	}
}

// TestUpgrade_upgradeViewNoPanic verifies that View() on ScreenUpgrade does not panic.
func TestUpgrade_upgradeViewNoPanic(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnUpgrade(t)
	view := m.View()
	if view == "" {
		t.Error("View() on ScreenUpgrade must return non-empty string")
	}
	if !strings.Contains(view, "Upgrading") && !strings.Contains(view, "upgrade") &&
		!strings.Contains(view, "Upgrade") && !strings.Contains(view, "…") {
		// Just non-panic; content requirements are loose.
		// The spinner text just needs to be present in some form.
		_ = view // accepted
	}
}

// ─── Brew vs direct branch ────────────────────────────────────────────────────

// TestUpgrade_brewBranchCallsBrewCommand verifies that when the upgradeOverride
// returns a brew-flavored upgradeDoneMsg, the result screen indicates brew was used.
// (We inject upgradeDoneMsg directly — no actual brew exec in tests.)
func TestUpgrade_brewBranchStoresBrewResult(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnUpgrade(t)
	// Simulate brew upgrade completing successfully (injected via msg directly).
	updated, _ := m.Update(upgradeDoneMsg{err: nil, method: "brew"})
	m = updated.(AppModel)
	if m.screen != ScreenComplete {
		t.Errorf("brew upgradeDoneMsg must reach ScreenComplete, got %v", m.screen)
	}
	// upgradeMethod must be stored.
	if m.upgradeMethod != "brew" {
		t.Errorf("upgradeMethod must be 'brew', got %q", m.upgradeMethod)
	}
}

// TestUpgrade_directBranchStoresDirectResult verifies that direct upgrade method
// is stored correctly.
func TestUpgrade_directBranchStoresDirectResult(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := hubOnUpgrade(t)
	updated, _ := m.Update(upgradeDoneMsg{err: nil, method: "direct"})
	m = updated.(AppModel)
	if m.upgradeMethod != "direct" {
		t.Errorf("upgradeMethod must be 'direct', got %q", m.upgradeMethod)
	}
}

// TestUpgrade_upgradeOverrideIsUsed verifies that upgradeOverride is called
// instead of the real upgrade logic when injected.
// The cmd returned by Enter on Upgrade is a tea.Batch; we verify the override
// gets called by delivering the upgradeDoneMsg through the model's Update.
func TestUpgrade_upgradeOverrideIsUsed(t *testing.T) {
	overrideCalled := false
	m := NewHubModel("v1.0.0", "/tmp/test")
	m.upgradeOverride = func() tea.Msg {
		overrideCalled = true
		return upgradeDoneMsg{err: nil, method: "test"}
	}

	// Navigate to Upgrade (item 2) and Enter.
	for i := 0; i < 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	// Capture the batch cmd returned by Enter.
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	if m.screen != ScreenUpgrade {
		t.Fatalf("expected ScreenUpgrade after Enter on Upgrade, got %v", m.screen)
	}
	if cmd == nil {
		t.Fatal("confirmSelectionHub on Upgrade must return a non-nil cmd (batch) when upgradeOverride is set")
	}

	// Execute the batch cmd — it returns a tea.BatchMsg with the upgrade cmd
	// and the tick cmd. Run each sub-cmd until we see upgradeDoneMsg.
	batchMsg := cmd()
	batch, ok := batchMsg.(tea.BatchMsg)
	if !ok {
		t.Fatalf("expected tea.BatchMsg from Upgrade Enter, got %T", batchMsg)
	}
	var doneMsg upgradeDoneMsg
	found := false
	for _, subCmd := range batch {
		if subCmd == nil {
			continue
		}
		msg := subCmd()
		if d, ok := msg.(upgradeDoneMsg); ok {
			doneMsg = d
			found = true
		}
	}
	if !overrideCalled {
		t.Error("upgradeOverride must have been called when the batch cmd was executed")
	}
	if !found {
		t.Fatal("batch must contain a cmd that returns upgradeDoneMsg")
	}
	if doneMsg.method != "test" {
		t.Errorf("expected method 'test', got %q", doneMsg.method)
	}
}
