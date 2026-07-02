package tui

import (
	"fmt"
	"io/fs"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// ─── fakeHarnessAdapter ─────────────────────────────────────────────────────

// fakeHarnessAdapter implements harness.Harness for testing without touching disk.
type fakeHarnessAdapter struct {
	name      string
	supported map[component.Component]bool
}

func (a *fakeHarnessAdapter) Name() string { return a.name }
func (a *fakeHarnessAdapter) Detect() (harness.DetectResult, error) {
	return harness.DetectResult{Installed: true}, nil
}
func (a *fakeHarnessAdapter) ConfigPaths() harness.ConfigPaths { return a.ConfigPathsFor("") }
func (a *fakeHarnessAdapter) ConfigPathsFor(projectRoot string) harness.ConfigPaths {
	return harness.ConfigPaths{ProjectRoot: projectRoot}
}
func (a *fakeHarnessAdapter) ConfigRoot() string               { return "/fake/" + a.name }
func (a *fakeHarnessAdapter) Supports(c component.Component) bool {
	return a.supported[c]
}
func (a *fakeHarnessAdapter) WriteMCP(_ fsutil.FileSystem, _ harness.MCPServer) (harness.Change, error) {
	return harness.Change{}, harness.ErrNotImplemented
}
func (a *fakeHarnessAdapter) WriteSkill(_ fsutil.FileSystem, _ fs.FS) (harness.Change, error) {
	return harness.Change{}, harness.ErrNotImplemented
}
func (a *fakeHarnessAdapter) WriteAgents(_ fsutil.FileSystem, _ fs.FS) ([]harness.Change, error) {
	return nil, harness.ErrNotImplemented
}
func (a *fakeHarnessAdapter) WriteCommands(_ fsutil.FileSystem, _ fs.FS) ([]harness.Change, error) {
	return nil, harness.ErrUnsupported
}

// detectedFake wraps a fakeHarnessAdapter as core.DetectedHarness.
func detectedFake(name string, supported map[component.Component]bool) core.DetectedHarness {
	return core.DetectedHarness{
		Harness: &fakeHarnessAdapter{name: name, supported: supported},
		Result:  harness.DetectResult{Installed: true},
	}
}

// ─── Splash tests ──────────────────────────────────────────────────────────

// TestSplashModel_rendersWithoutPanic ensures SplashModel.View() does not panic
// in both color and no-color modes.
func TestSplashModel_rendersWithoutPanic(t *testing.T) {
	t.Run("color mode", func(t *testing.T) {
		t.Setenv("NO_COLOR", "")
		t.Setenv("TERM", "xterm-256color")
		m := NewSplashModel("v1.0.0")
		view := m.View()
		if view == "" {
			t.Error("expected non-empty view in color mode")
		}
	})

	t.Run("NO_COLOR mode", func(t *testing.T) {
		t.Setenv("NO_COLOR", "1")
		m := NewSplashModel("v1.0.0")
		view := m.View()
		if view == "" {
			t.Error("expected non-empty view in NO_COLOR mode")
		}
		// Must not contain ANSI escape codes.
		if strings.Contains(view, "\x1b[") {
			t.Error("NO_COLOR mode must not emit ANSI escape codes")
		}
	})

	t.Run("TERM=dumb mode", func(t *testing.T) {
		t.Setenv("NO_COLOR", "")
		t.Setenv("TERM", "dumb")
		m := NewSplashModel("v0.9.0")
		view := m.View()
		if view == "" {
			t.Error("expected non-empty view in TERM=dumb mode")
		}
		// Must not contain ANSI escape codes.
		if strings.Contains(view, "\x1b[") {
			t.Error("TERM=dumb mode must not emit ANSI escape codes")
		}
	})
}

// TestSplashModel_autoAdvances verifies that sending splashDoneMsg marks the model done.
func TestSplashModel_autoAdvances(t *testing.T) {
	m := NewSplashModel("v1.0.0")
	if m.IsDone() {
		t.Fatal("fresh splash model must not be done")
	}
	// Simulate receiving the splashDoneMsg.
	updated, _ := m.Update(splashDoneMsg{})
	m2 := updated.(SplashModel)
	if !m2.IsDone() {
		t.Error("splash model must be done after receiving splashDoneMsg")
	}
}

// ─── HarnessSelectModel tests ──────────────────────────────────────────────

// TestHarnessSelectModel_singleHarnessShouldSkip verifies that a single detected
// harness causes the harness selection screen to skip (spec: single-harness scenario).
func TestHarnessSelectModel_singleHarnessShouldSkip(t *testing.T) {
	detected := []core.DetectedHarness{
		detectedFake("claude", map[component.Component]bool{
			component.SkillCommands: true,
			component.MCPGates:      true,
		}),
	}
	m := NewHarnessSelectModel(detected)
	if !m.ShouldSkip() {
		t.Error("single harness should trigger auto-skip of harness selection")
	}
}

// TestHarnessSelectModel_multipleHarnessesNoSkip verifies that multiple detected
// harnesses do NOT auto-skip.
func TestHarnessSelectModel_multipleHarnessesNoSkip(t *testing.T) {
	detected := []core.DetectedHarness{
		detectedFake("claude", nil),
		detectedFake("cursor", nil),
	}
	m := NewHarnessSelectModel(detected)
	if m.ShouldSkip() {
		t.Error("multiple harnesses should not auto-skip the selection screen")
	}
}

// ─── SelectComponentModel tests ────────────────────────────────────────────

// TestSelectComponent_greyOutUnsupported verifies that components not supported
// by any selected harness appear as disabled (ADR-1 guarantee).
func TestSelectComponent_greyOutUnsupported(t *testing.T) {
	// Cursor does not support ReviewAgents.
	detected := []core.DetectedHarness{
		detectedFake("cursor", map[component.Component]bool{
			component.SkillCommands: true,
			component.MCPGates:      true,
			component.DesignMemory:  true,
			// ReviewAgents: deliberately absent (false)
		}),
	}
	m := NewSelectComponentModel(detected)

	// Find the ReviewAgents item and assert it is disabled.
	found := false
	for _, item := range m.items {
		if item.comp == component.ReviewAgents {
			found = true
			if item.supported {
				t.Error("ReviewAgents should be disabled for Cursor harness")
			}
			if item.reason == "" {
				t.Error("disabled component must carry a non-empty reason")
			}
			break
		}
	}
	if !found {
		t.Error("ReviewAgents component not found in select model items")
	}
}

// TestSelectComponent_zeroSelectionRejected verifies the zero-selection guard.
func TestSelectComponent_zeroSelectionRejected(t *testing.T) {
	detected := []core.DetectedHarness{
		detectedFake("claude", map[component.Component]bool{
			component.SkillCommands: true,
			component.MCPGates:      true,
		}),
	}
	m := NewSelectComponentModel(detected)

	// Deselect everything that is pre-checked.
	for i := range m.items {
		if m.selected[i] {
			// Move cursor to item i.
			for m.cursor < i {
				updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
				m = updated.(SelectComponentModel)
			}
			// Toggle off.
			updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{' '}})
			m = updated.(SelectComponentModel)
		}
	}

	// Try to confirm with nothing selected.
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(SelectComponentModel)

	if m.IsConfirmed() {
		t.Error("confirm must be rejected when zero components are selected")
	}
	if m.errMsg == "" {
		t.Error("an error message must be shown when zero components are selected")
	}
}

// ─── ADR-2: real plan-building parity test ────────────────────────────────

// driveToApply drives AppModel through the full TUI flow (splash → detect →
// [harness-select if multiple] → component-select → confirm) and returns the
// model at the moment it transitions to ApplyScreen and fires runApplyCmd.
// It uses detectOverride and applyOverride as test seams.
//
// The test asserts that the InstallPlan the TUI builds (captured via planCapture)
// matches the plan the --yes non-interactive path would produce for the same
// harness/component selection — proving ADR-2: TUI does not diverge from core.Apply.
func TestAppModel_planBuildingParity(t *testing.T) {
	// Supported components for this fake harness — only SkillCommands + MCPGates.
	supported := map[component.Component]bool{
		component.SkillCommands: true,
		component.MCPGates:      true,
	}
	fakeDetected := []core.DetectedHarness{
		detectedFake("claude", supported),
	}

	// applyInvoked tracks whether applyOverride was called (i.e. core.Apply path reached).
	applyInvoked := false
	var capturedPlan core.InstallPlan

	m := NewAppModel("v1.0.0", "/tmp/parity-test")
	m.detectOverride = func() []core.DetectedHarness { return fakeDetected }
	m.planCapture = &capturedPlan
	m.applyOverride = func(plan core.InstallPlan) ([]harness.Change, error) {
		applyInvoked = true
		return nil, nil
	}

	// Step 1: Advance past splash → detect transition.
	m2, _ := m.Update(splashDoneMsg{})
	m = m2.(AppModel)

	// After splashDoneMsg: single harness → should skip harness selection,
	// land directly on SelectComponentScreen.
	if m.screen != SelectComponentScreen {
		t.Fatalf("expected SelectComponentScreen after single-harness detect, got %v", m.screen)
	}

	// Step 2: Confirm component selection with defaults (SkillCommands + MCPGates pre-checked).
	m3, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = m3.(AppModel)

	// Should advance to ConfirmScreen.
	if m.screen != ConfirmScreen {
		t.Fatalf("expected ConfirmScreen after component confirm, got %v", m.screen)
	}

	// Step 3: Confirm the plan.
	m4, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = m4.(AppModel)

	// Should advance to ApplyScreen and emit the apply Cmd.
	if m.screen != ApplyScreen {
		t.Fatalf("expected ApplyScreen after confirm, got %v", m.screen)
	}
	if cmd == nil {
		t.Fatal("expected a non-nil cmd from confirm → apply transition")
	}

	// Execute the cmd synchronously to trigger applyOverride and planCapture.
	msg := cmd()
	if !applyInvoked {
		t.Error("applyOverride was not invoked — core.Apply path was never reached")
	}

	// Deliver the result to the model to advance to DoneScreen.
	resultMsg, ok := msg.(ApplyResultMsg)
	if !ok {
		t.Fatalf("expected ApplyResultMsg, got %T", msg)
	}
	m5, _ := m.Update(resultMsg)
	m = m5.(AppModel)

	// Step 4: Build the reference plan the --yes non-interactive path would produce
	// for the same inputs, using the same core.Plan function.
	// The TUI's selected harnesses and components are m.selected and m.components.
	refPlan := core.Plan(
		m.selected,
		m.components,
		nil, // no FS needed — Plan only uses FS for write ops, not target building
		assets.SkillsFS,
		assets.Agents,
		assets.TemplateFS,
		assets.CommandsFS,
		"/tmp/parity-test",
		core.Global,
		"",
	)

	// Step 5: Compare the TUI plan (capturedPlan) with the reference plan (refPlan).
	// Both must have the same number of targets with identical harness/component/skip.
	if len(capturedPlan.Targets) != len(refPlan.Targets) {
		t.Fatalf("TUI plan has %d targets, ref plan has %d — ADR-2 violated",
			len(capturedPlan.Targets), len(refPlan.Targets))
	}
	for i := range capturedPlan.Targets {
		tt := capturedPlan.Targets[i]
		rt := refPlan.Targets[i]
		if tt.Harness.Name() != rt.Harness.Name() {
			t.Errorf("target %d: TUI harness=%s, ref harness=%s", i, tt.Harness.Name(), rt.Harness.Name())
		}
		if tt.Component != rt.Component {
			t.Errorf("target %d: TUI component=%s, ref component=%s", i, tt.Component, rt.Component)
		}
		if tt.Skip != rt.Skip {
			t.Errorf("target %d: TUI skip=%v, ref skip=%v", i, tt.Skip, rt.Skip)
		}
	}
}

// ─── No-harness path test ─────────────────────────────────────────────────

// TestAppModel_noHarnessPath verifies that when DetectAll returns no harnesses:
//   - The model transitions directly to DoneScreen (not a crash).
//   - View() does not panic.
//   - core.Apply (applyOverride) is NEVER invoked.
//   - The View does NOT claim a rollback occurred.
func TestAppModel_noHarnessPath(t *testing.T) {
	applyInvoked := false

	m := NewAppModel("v1.0.0", "/tmp/no-harness-test")
	m.detectOverride = func() []core.DetectedHarness { return nil } // empty
	m.applyOverride = func(_ core.InstallPlan) ([]harness.Change, error) {
		applyInvoked = true
		return nil, nil
	}

	// Advance past splash.
	m2, _ := m.Update(splashDoneMsg{})
	m = m2.(AppModel)

	// Must land on DoneScreen immediately.
	if m.screen != DoneScreen {
		t.Fatalf("expected DoneScreen when no harnesses detected, got %v", m.screen)
	}

	// View must not panic.
	view := m.View()

	// View must NOT claim a rollback.
	if strings.Contains(strings.ToLower(view), "rolled back") {
		t.Errorf("no-harness view must not say 'rolled back'; got: %q", view)
	}

	// core.Apply must not have been called.
	if applyInvoked {
		t.Error("core.Apply must not be invoked when no harnesses are detected")
	}

	// View should mention that nothing was detected / nothing to install.
	if !strings.Contains(strings.ToLower(view), "no supported") {
		t.Errorf("no-harness view should mention no harness found; got: %q", view)
	}
}

// ─── AppModel initial screen test ─────────────────────────────────────────

// TestAppModel_suppressSplashOnVersion verifies AppModel starts on SplashScreen.
// (Non-interactive commands like version/help are handled by Cobra before the
// TUI ever runs; the AppModel itself always starts with SplashScreen.)
func TestAppModel_suppressSplashOnVersion(t *testing.T) {
	m := NewAppModel("v1.0.0", "/tmp")
	if m.screen != SplashScreen {
		t.Errorf("initial screen must be SplashScreen, got %v", m.screen)
	}
	view := m.View()
	if view == "" {
		t.Error("initial view (splash) must be non-empty")
	}
}

// ─── ConfirmModel tests ────────────────────────────────────────────────────

// TestConfirmModel_cancelReturnsClean verifies "q" marks the model cancelled.
// Note: ctrl+c is intercepted globally by AppModel.Update before reaching
// ConfirmModel, so it is not handled in ConfirmModel.Update.
func TestConfirmModel_cancelReturnsClean(t *testing.T) {
	m := NewConfirmModel(nil, nil)
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	m2 := updated.(ConfirmModel)
	if !m2.IsCancelled() {
		t.Error("'q' at confirm must mark model as cancelled")
	}
	if m2.IsConfirmed() {
		t.Error("cancelled confirm must not also be confirmed")
	}
}

// ─── NO_COLOR / styles tests ───────────────────────────────────────────────

// TestNoColorDetection verifies that noColor() detects NO_COLOR and TERM=dumb.
func TestNoColorDetection(t *testing.T) {
	t.Run("NO_COLOR set", func(t *testing.T) {
		t.Setenv("NO_COLOR", "1")
		t.Setenv("TERM", "xterm-256color")
		if !noColor() {
			t.Error("noColor() must return true when NO_COLOR is set")
		}
	})

	t.Run("TERM=dumb", func(t *testing.T) {
		t.Setenv("NO_COLOR", "")
		t.Setenv("TERM", "dumb")
		if !noColor() {
			t.Error("noColor() must return true when TERM=dumb")
		}
	})
}

// ─── ProgressModel tests ───────────────────────────────────────────────────

// TestProgressModel_rendersApplyingState verifies ProgressModel shows "applying"
// before results arrive.
func TestProgressModel_rendersApplyingState(t *testing.T) {
	m := NewProgressModel()
	view := m.View()
	if !strings.Contains(strings.ToLower(view), "applying") {
		t.Errorf("progress model initial view should say 'Applying', got: %q", view)
	}
	if m.IsDone() {
		t.Error("fresh progress model must not be done")
	}
}

// TestProgressModel_rendersResultOnDone verifies ApplyResultMsg transitions the model.
func TestProgressModel_rendersResultOnDone(t *testing.T) {
	m := NewProgressModel()
	changes := []harness.Change{
		{HarnessName: "claude", Component: "mcp-gates", Changed: true},
		{HarnessName: "claude", Component: "skill+commands", Changed: false},
	}
	updated, _ := m.Update(ApplyResultMsg{Changes: changes})
	m2 := updated.(ProgressModel)
	if !m2.IsDone() {
		t.Error("progress model must be done after ApplyResultMsg")
	}
	view := m2.View()
	if !strings.Contains(view, "claude") {
		t.Errorf("done view should contain harness name, got: %q", view)
	}
}

// TestProgressModel_noHarnessMessage verifies that a no-harness error does NOT
// produce a "rolled back" message and DOES show the "nothing to install" message.
func TestProgressModel_noHarnessMessage(t *testing.T) {
	m := NewProgressModel()
	updated, _ := m.Update(ApplyResultMsg{
		Err: fmt.Errorf("%s", errNoHarness),
	})
	m2 := updated.(ProgressModel)
	if !m2.IsDone() {
		t.Error("progress model must be done after error ApplyResultMsg")
	}
	view := m2.View()
	if strings.Contains(strings.ToLower(view), "rolled back") {
		t.Errorf("no-harness view must not say 'rolled back'; got: %q", view)
	}
	if !strings.Contains(strings.ToLower(view), "no supported") {
		t.Errorf("no-harness view must say 'no supported ...'; got: %q", view)
	}
}
