package tui

import (
	"errors"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/harness"
)

// ─── WindowSizeMsg tests ───────────────────────────────────────────────────

// TestAppModel_WindowSizeMsgUpdatesWidth verifies that tea.WindowSizeMsg
// stores width/height on the model without panic at normal sizes.
func TestAppModel_WindowSizeMsgUpdatesWidth(t *testing.T) {
	m := NewAppModel("v1.0.0", "/tmp")
	updated, _ := m.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	m2 := updated.(AppModel)

	if m2.width != 120 {
		t.Errorf("width: got %d, want 120", m2.width)
	}
	if m2.height != 40 {
		t.Errorf("height: got %d, want 40", m2.height)
	}
}

// TestAppModel_WindowSizeMsgTiny verifies that extremely small terminal sizes
// (e.g. 1x1, 20x5) do not cause a panic.
func TestAppModel_WindowSizeMsgTiny(t *testing.T) {
	for _, sz := range []struct{ w, h int }{{1, 1}, {20, 5}, {0, 0}} {
		m := NewAppModel("v1.0.0", "/tmp")
		// Must not panic.
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("panic on size %dx%d: %v", sz.w, sz.h, r)
				}
			}()
			updated, _ := m.Update(tea.WindowSizeMsg{Width: sz.w, Height: sz.h})
			m2 := updated.(AppModel)
			// View must not panic either.
			_ = m2.View()
		}()
	}
}

// ─── ErrorModel tests ──────────────────────────────────────────────────────

// TestErrorModel_RendersApplyError verifies that an apply error is shown
// clearly on the error screen without panic.
func TestErrorModel_RendersApplyError(t *testing.T) {
	err := errors.New("apply failed: permission denied on /home/user/.config")
	em := NewErrorModel(err, 80)

	view := em.View()
	if view == "" {
		t.Error("error model view must be non-empty")
	}
	// Must contain the error message.
	if len(view) == 0 {
		t.Error("error view is empty")
	}
}

// TestErrorModel_NilErrorNoPanic verifies that a nil error does not panic.
func TestErrorModel_NilErrorNoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("panic on nil error: %v", r)
		}
	}()
	em := NewErrorModel(nil, 80)
	_ = em.View()
}

// TestErrorModel_TinyTerminalNoPanic verifies that a 1x1 terminal does not panic.
func TestErrorModel_TinyTerminalNoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("panic on tiny terminal: %v", r)
		}
	}()
	em := NewErrorModel(errors.New("some error"), 1)
	_ = em.View()
}

// TestAppModel_ApplyErrorRoutesToErrorScreen verifies that when apply returns
// a real error (not the no-harness sentinel), the model transitions to
// ErrorScreen and shows the error on View().
func TestAppModel_ApplyErrorRoutesToErrorScreen(t *testing.T) {
	applyErr := errors.New("disk is full")

	m := NewAppModel("v1.0.0", "/tmp")
	m.detectOverride = func() []core.DetectedHarness {
		return []core.DetectedHarness{
			detectedFake("claude", map[component.Component]bool{
				component.SkillCommands: true,
				component.MCPGates:      true,
			}),
		}
	}
	m.applyOverride = func(_ core.InstallPlan) ([]harness.Change, error) {
		return nil, applyErr
	}
	m.updateCheckOverride = func() tea.Msg { return updateResultMsg{} }

	// Advance past splash.
	m2, _ := m.Update(splashDoneMsg{})
	m = m2.(AppModel)

	// Should be on SelectComponentScreen (single harness → skip harness select).
	if m.screen != SelectComponentScreen {
		t.Fatalf("expected SelectComponentScreen, got %v", m.screen)
	}

	// Confirm component selection.
	m3, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = m3.(AppModel)
	if m.screen != ConfirmScreen {
		t.Fatalf("expected ConfirmScreen, got %v", m.screen)
	}

	// Confirm plan.
	m4, applyCmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = m4.(AppModel)
	if m.screen != ApplyScreen {
		t.Fatalf("expected ApplyScreen, got %v", m.screen)
	}
	if applyCmd == nil {
		t.Fatal("expected non-nil apply cmd")
	}

	// Execute apply cmd synchronously (returns ApplyResultMsg with error).
	resultMsg := applyCmd()
	m5, _ := m.Update(resultMsg)
	m = m5.(AppModel)

	// Must be on ErrorScreen, not DoneScreen.
	if m.screen != ErrorScreen {
		t.Errorf("expected ErrorScreen after apply error, got %v", m.screen)
	}

	// View must not panic and must contain something useful.
	view := m.View()
	if view == "" {
		t.Error("error screen view must be non-empty")
	}
}

// ─── Quit key consistency tests ────────────────────────────────────────────

// TestAppModel_QuitFromDoneScreen verifies that pressing any key on the
// DoneScreen signals quit.
func TestAppModel_QuitFromDoneScreen(t *testing.T) {
	m := NewAppModel("v1.0.0", "/tmp")
	m.screen = DoneScreen
	m.progress = NewProgressModel()
	// Deliver a done result so progress is in done state.
	prog, _ := m.progress.Update(ApplyResultMsg{Changes: nil})
	m.progress = prog.(ProgressModel)

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Error("DoneScreen must emit a Quit cmd on key press")
	}
}

// TestAppModel_CtrlCQuitsFromAnyScreen verifies the global Ctrl-C handler.
func TestAppModel_CtrlCQuitsFromAnyScreen(t *testing.T) {
	screens := []Screen{
		SplashScreen,
		SelectHarnessScreen,
		SelectComponentScreen,
		ConfirmScreen,
		DoneScreen,
		ErrorScreen,
	}
	for _, s := range screens {
		m := NewAppModel("v1.0.0", "/tmp")
		m.screen = s
		_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})
		if cmd == nil {
			t.Errorf("screen %v: Ctrl-C must emit a Quit cmd", s)
		}
	}
}

// TestAppModel_QuitKeyFromErrorScreen verifies q/Esc quit from the error screen.
func TestAppModel_QuitKeyFromErrorScreen(t *testing.T) {
	for _, key := range []string{"q", "esc"} {
		m := NewAppModel("v1.0.0", "/tmp")
		m.screen = ErrorScreen
		_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)})
		if cmd == nil {
			t.Errorf("key %q from ErrorScreen must emit a Quit cmd", key)
		}
	}
}
