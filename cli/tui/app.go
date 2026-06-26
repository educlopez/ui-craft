package tui

import (
	"fmt"
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// Screen enumerates the TUI flow states.
type Screen int

const (
	SplashScreen          Screen = iota // Aren dog art
	DetectScreen                        // (internal — no separate view; transitions immediately)
	SelectHarnessScreen                 // harness multi-select
	SelectComponentScreen               // component multi-select
	ConfirmScreen                       // plan summary + confirmation
	ApplyScreen                         // progress during apply
	DoneScreen                          // success/failure summary
	ErrorScreen                         // dedicated error display
)

// AppModel is the Bubble Tea root model. It routes to the appropriate
// sub-model based on the current Screen. The TUI never writes files itself —
// it builds an InstallPlan and hands it to core.Apply (ADR-2).
type AppModel struct {
	screen     Screen
	version    string
	projectDir string

	// Terminal dimensions — updated on every tea.WindowSizeMsg.
	width  int
	height int

	// Sub-models
	splash          SplashModel
	harnessSelect   HarnessSelectModel
	componentSelect SelectComponentModel
	confirm         ConfirmModel
	progress        ProgressModel
	errorModel      ErrorModel

	// State shared across screens
	detected   []core.DetectedHarness
	selected   []core.DetectedHarness
	components []component.Component
	err        error

	// updateResult holds the outcome of the background update-check goroutine.
	updateResult core.UpdateResult

	// planCapture is set by runApplyCmd just before dispatching to core.Apply.
	// Tests that inject applyOverride can read this to verify the plan the TUI
	// passed — the ADR-2 parity seam.
	planCapture *core.InstallPlan

	// applyOverride, when non-nil, replaces the full runApplyCmd implementation.
	// Signature: given the InstallPlan the TUI built, return (changes, error).
	// Production code leaves this nil and uses core.Apply via the default path.
	applyOverride func(plan core.InstallPlan) ([]harness.Change, error)

	// detectOverride, when non-nil, replaces core.DetectAll(harness.All()) in
	// the splash → detect transition. This is the injection seam for tests that
	// need to control which harnesses are "detected" without real disk probing.
	detectOverride func() []core.DetectedHarness

	// updateCheckOverride, when non-nil, replaces updateCheckCmd in Init().
	// Tests inject this to avoid real network calls.
	updateCheckOverride tea.Cmd
}

// NewAppModel creates the initial AppModel.
// version is the binary version string (from ldflags).
// projectDir is the --dir flag value (or cwd), used for DesignMemory scaffolding.
func NewAppModel(version, projectDir string) AppModel {
	return AppModel{
		screen:     SplashScreen,
		version:    version,
		projectDir: projectDir,
		splash:     NewSplashModel(version),
	}
}

// Init starts the Bubble Tea program. It fires the splash Init() and kicks off
// the background update-check goroutine concurrently.
func (m AppModel) Init() tea.Cmd {
	updateCmd := updateCheckCmd(m.version)
	if m.updateCheckOverride != nil {
		updateCmd = m.updateCheckOverride
	}
	return tea.Batch(m.splash.Init(), updateCmd)
}

// Update is the root message dispatcher.
func (m AppModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Global quit keybinding — intercept before sub-models.
	if key, ok := msg.(tea.KeyMsg); ok {
		switch key.String() {
		case "ctrl+c", "q", "esc":
			return m, tea.Quit
		}
	}

	// Handle terminal resize globally — store dimensions and propagate.
	if ws, ok := msg.(tea.WindowSizeMsg); ok {
		m.width = ws.Width
		m.height = ws.Height
		// Propagate to sub-models that care about width.
		m.splash = m.splash.WithWidth(ws.Width)
		m.progress = m.progress.WithWidth(ws.Width)
		m.errorModel = m.errorModel.WithWidth(ws.Width)
		return m, nil
	}

	// Handle background update-check result.
	if ur, ok := msg.(updateResultMsg); ok {
		m.updateResult = ur.result
		return m, nil
	}

	switch m.screen {
	case SplashScreen:
		updated, cmd := m.splash.Update(msg)
		m.splash = updated.(SplashModel)
		if m.splash.IsDone() {
			// Auto-detect harnesses and advance to harness-select.
			if m.detectOverride != nil {
				m.detected = m.detectOverride()
			} else {
				m.detected = core.DetectAll(harness.All())
			}
			if len(m.detected) == 0 {
				// No harnesses found — show informational message on done screen.
				// Use errNoHarness sentinel so ProgressModel shows the correct
				// "nothing to install" message (not a false rollback message).
				m.err = fmt.Errorf("%s", errNoHarness)
				m.screen = DoneScreen
				m.progress = NewProgressModel()
				// Mark progress as done with error by delivering an ApplyResultMsg.
				updatedProg, _ := m.progress.Update(ApplyResultMsg{Err: m.err})
				m.progress = updatedProg.(ProgressModel)
				return m, nil
			}
			m.harnessSelect = NewHarnessSelectModel(m.detected)
			if m.harnessSelect.ShouldSkip() {
				// Single harness — skip harness selection screen.
				m.selected = m.harnessSelect.SelectedHarnesses()
				m.componentSelect = NewSelectComponentModel(m.selected)
				m.screen = SelectComponentScreen
				return m, nil
			}
			m.screen = SelectHarnessScreen
		}
		return m, cmd

	case SelectHarnessScreen:
		updated, cmd := m.harnessSelect.Update(msg)
		m.harnessSelect = updated.(HarnessSelectModel)
		if m.harnessSelect.IsConfirmed() {
			m.selected = m.harnessSelect.SelectedHarnesses()
			m.componentSelect = NewSelectComponentModel(m.selected)
			m.screen = SelectComponentScreen
		}
		return m, cmd

	case SelectComponentScreen:
		updated, cmd := m.componentSelect.Update(msg)
		m.componentSelect = updated.(SelectComponentModel)
		if m.componentSelect.IsConfirmed() {
			m.components = m.componentSelect.SelectedComponents()
			m.confirm = NewConfirmModel(m.selected, m.components)
			m.screen = ConfirmScreen
		}
		return m, cmd

	case ConfirmScreen:
		updated, cmd := m.confirm.Update(msg)
		m.confirm = updated.(ConfirmModel)
		if m.confirm.IsCancelled() {
			return m, tea.Quit
		}
		if m.confirm.IsConfirmed() {
			m.progress = NewProgressModel()
			m.screen = ApplyScreen
			// Kick off apply asynchronously.
			return m, m.runApplyCmd()
		}
		return m, cmd

	case ApplyScreen:
		updated, cmd := m.progress.Update(msg)
		m.progress = updated.(ProgressModel)
		if m.progress.IsDone() {
			if m.progress.HasError() && !m.progress.IsNoHarness() {
				// Route real apply errors to the dedicated error screen.
				m.errorModel = NewErrorModel(m.progress.Err(), m.width)
				m.screen = ErrorScreen
				return m, nil
			}
			m.screen = DoneScreen
		}
		return m, cmd

	case DoneScreen:
		if _, ok := msg.(tea.KeyMsg); ok {
			return m, tea.Quit
		}
		return m, nil

	case ErrorScreen:
		// Any key quits from the error screen.
		if _, ok := msg.(tea.KeyMsg); ok {
			return m, tea.Quit
		}
		return m, nil
	}

	return m, nil
}

// View delegates rendering to the active sub-model.
func (m AppModel) View() string {
	switch m.screen {
	case SplashScreen:
		return m.splash.View()
	case SelectHarnessScreen:
		return m.harnessSelect.View()
	case SelectComponentScreen:
		return m.componentSelect.View()
	case ConfirmScreen:
		return m.confirm.View()
	case ApplyScreen:
		return m.progress.View()
	case DoneScreen:
		v := m.progress.View()
		// Append update advisory when available (non-blocking, shown after result).
		if line := core.UpdateAdvisoryLine(m.updateResult); line != "" {
			v += "\n" + accentStyle().Render(line) + "\n"
		}
		return v
	case ErrorScreen:
		return m.errorModel.View()
	}
	return ""
}

// runApplyCmd returns a Bubble Tea Cmd that calls core.Plan + core.Apply
// and delivers an ApplyResultMsg to the model.
// This is the ADR-2 guarantee: the identical core.Apply path used by --yes.
//
// When m.applyOverride is non-nil (test seam), the plan is still built via
// core.Plan (same as production) and captured in m.planCapture; then the
// override is called instead of core.Apply. This lets tests assert that the
// TUI produces the identical plan the --yes path would produce.
func (m AppModel) runApplyCmd() tea.Cmd {
	// Capture selected/components before entering the goroutine so the closure
	// is safe against any future mutations.
	selected := m.selected
	components := m.components
	projectDir := m.projectDir
	version := m.version
	override := m.applyOverride
	planPtr := m.planCapture

	return func() tea.Msg {
		osfs := fsutil.OsFS{}

		plan := core.Plan(
			selected,
			components,
			osfs,
			assets.Mirror,
			assets.Agents,
			assets.TemplateFS,
			projectDir,
		)

		// Capture the plan for test assertions (planCapture is a pointer set by
		// the test before calling runApplyCmd).
		if planPtr != nil {
			*planPtr = plan
		}

		if override != nil {
			changes, err := override(plan)
			if err != nil {
				return ApplyResultMsg{Err: err}
			}
			return ApplyResultMsg{Changes: changes}
		}

		home, _ := os.UserHomeDir()
		backupRoot := filepath.Join(home, ".ui-craft-backups")
		backupStore := backup.NewStore(backupRoot, osfs, nil)

		result, err := core.Apply(plan, osfs, backupStore, version, false)
		if err != nil {
			return ApplyResultMsg{Err: err}
		}
		return ApplyResultMsg{
			Changes:    result.Changes,
			SnapshotID: string(result.SnapshotID),
		}
	}
}

// RunTUI starts the Bubble Tea program and blocks until the user exits.
// version is the binary version string; projectDir is the --dir value.
// Returns a non-nil error when the TUI cannot run (no terminal) or when
// the TUI itself fails. cmd/install.go already routes non-TTY / --yes to
// the non-interactive path before calling RunTUI.
func RunTUI(version, projectDir string) error {
	if noColor() || !IsTerminal() {
		return fmt.Errorf("interactive TUI requires a terminal; use --yes for non-interactive install")
	}

	model := NewAppModel(version, projectDir)
	p := tea.NewProgram(model)
	_, err := p.Run()
	return err
}
