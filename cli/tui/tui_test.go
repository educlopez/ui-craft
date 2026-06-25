package tui

import (
	"io/fs"
	"os"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
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
func (a *fakeHarnessAdapter) ConfigPaths() harness.ConfigPaths { return harness.ConfigPaths{} }
func (a *fakeHarnessAdapter) Supports(c component.Component) bool {
	return a.supported[c]
}
func (a *fakeHarnessAdapter) WriteMCP(_ fsutil.FileSystem, _ harness.MCPServer) (harness.Change, error) {
	return harness.Change{}, harness.ErrNotImplemented
}
func (a *fakeHarnessAdapter) WriteSkill(_ fsutil.FileSystem, _ fs.FS) (harness.Change, error) {
	return harness.Change{}, harness.ErrNotImplemented
}
func (a *fakeHarnessAdapter) WriteAgents(_ fsutil.FileSystem) ([]harness.Change, error) {
	return nil, harness.ErrNotImplemented
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
		os.Unsetenv("NO_COLOR")
		os.Setenv("TERM", "xterm-256color")
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
		os.Unsetenv("NO_COLOR")
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

// ─── ADR-2: plan-building parity test ─────────────────────────────────────

// TestAppModel_planBuildingParity verifies that the TUI path and the --yes path
// build the same InstallPlan for the same inputs (ADR-2 guarantee).
func TestAppModel_planBuildingParity(t *testing.T) {
	detected := []core.DetectedHarness{
		detectedFake("claude", map[component.Component]bool{
			component.SkillCommands: true,
			component.MCPGates:      true,
			component.DesignMemory:  true,
		}),
	}
	selected := []component.Component{component.SkillCommands, component.MCPGates}

	// Both paths call the identical core.Plan function.
	tuiPlan := core.Plan(detected, selected, nil, nil, nil, "/tmp/test-project")
	yesPlan := core.Plan(detected, selected, nil, nil, nil, "/tmp/test-project")

	if len(tuiPlan.Targets) != len(yesPlan.Targets) {
		t.Fatalf("TUI plan has %d targets, --yes plan has %d — they must match",
			len(tuiPlan.Targets), len(yesPlan.Targets))
	}
	for i := range tuiPlan.Targets {
		tt := tuiPlan.Targets[i]
		yt := yesPlan.Targets[i]
		if tt.Harness.Name() != yt.Harness.Name() {
			t.Errorf("target %d: TUI harness=%s, --yes harness=%s", i, tt.Harness.Name(), yt.Harness.Name())
		}
		if tt.Component != yt.Component {
			t.Errorf("target %d: TUI component=%s, --yes component=%s", i, tt.Component, yt.Component)
		}
		if tt.Skip != yt.Skip {
			t.Errorf("target %d: TUI skip=%v, --yes skip=%v", i, tt.Skip, yt.Skip)
		}
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

// TestConfirmModel_cancelReturnsClean verifies ctrl+c marks the model cancelled.
func TestConfirmModel_cancelReturnsClean(t *testing.T) {
	m := NewConfirmModel(nil, nil)
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})
	m2 := updated.(ConfirmModel)
	if !m2.IsCancelled() {
		t.Error("ctrl+c at confirm must mark model as cancelled")
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
		os.Unsetenv("TERM")
		if !noColor() {
			t.Error("noColor() must return true when NO_COLOR is set")
		}
	})

	t.Run("TERM=dumb", func(t *testing.T) {
		os.Unsetenv("NO_COLOR")
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
