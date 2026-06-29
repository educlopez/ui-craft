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

	// Hub screens — additive; install flow above is byte-identical.
	ScreenWelcome   // welcome menu hub (bare `ui-craft` entry point)
	ScreenUpgrade   // upgrade / self-update screen (stub — Slice 4)
	ScreenBackups   // backup management screen (stub — Slice 5)
	ScreenUninstall // managed uninstall screen (stub — Slice 6)
	ScreenComplete  // action result / complete screen (stub — Slices 4-6)
)

// completedAction is the discriminator for ScreenComplete routing.
// It is set when entering each hub action screen so that ScreenComplete can
// route to the correct renderer without relying on field-presence heuristics
// (which break when, e.g., an uninstall completes with snapshotID=="" and err==nil).
type completedAction int

const (
	completedActionNone      completedAction = iota
	completedActionUpgrade                   // upgrade flow completed
	completedActionBackup                    // backup-restore flow completed
	completedActionUninstall                 // uninstall flow completed
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

	// Hub menu state — populated only when screen == ScreenWelcome.
	// Zero values are safe for the install-flow path (NewAppModel).
	menuItems []string
	cursor    int

	// ─── Upgrade screen state (Slice 4) ──────────────────────────────────────
	// spinnerFrame tracks the current spinner animation frame index.
	// It is advanced on every TickMsg while on ScreenUpgrade.
	spinnerFrame int

	// upgradeErr holds the error (or nil) from the last upgrade run.
	// Stored when upgradeDoneMsg is received; read by renderComplete.
	upgradeErr error

	// upgradeNewVersion is the version string reported by a successful direct
	// upgrade. Empty when upgrading via brew or when already up-to-date.
	upgradeNewVersion string

	// upgradeMethod records which upgrade path was taken: "brew" or "direct".
	// Set from upgradeDoneMsg.method; read by renderComplete.
	upgradeMethod string

	// upgradeGeneration is incremented each time the user enters ScreenUpgrade.
	// buildUpgradeCmd bakes the generation into upgradeDoneMsg so that stale
	// goroutine results from a prior interrupted run are silently discarded.
	upgradeGeneration int

	// upgradeOverride, when non-nil, is used instead of the real upgrade logic.
	// This is the primary injection seam for Slice 4 tests: set it before
	// pressing Enter on the Upgrade item and confirmSelectionHub will use it.
	upgradeOverride func() tea.Msg

	// lastCompletedAction is set when entering each hub action screen.
	// It is the authoritative discriminator for ScreenComplete routing —
	// replacing the fragile field-presence check that broke when an uninstall
	// completed with snapshotID=="" and err==nil.
	lastCompletedAction completedAction

	// ─── Backups screen state (Slice 5) ──────────────────────────────────────

	// backupList holds the snapshot metas loaded from the backup store.
	// Populated when backupsLoadedMsg is received on ScreenBackups.
	backupList []backup.SnapshotMeta

	// backupCursor is the currently-selected row in the backup list.
	backupCursor int

	// backupsLoaded is true once backupsLoadedMsg has been received (even if empty).
	backupsLoaded bool

	// backupLoadErr stores any error returned by the list cmd.
	backupLoadErr error

	// backupRestoreErr stores the error (or nil) from the last restore run.
	// Set when backupRestoreDoneMsg is received; read by renderBackupComplete.
	backupRestoreErr error

	// backupRestoredID is the ID of the snapshot that was restored (for the
	// success message on the Complete screen).
	backupRestoredID string

	// backupListOverride, when non-nil, replaces the real backup.Store.List()
	// call. This is the injection seam for Slice 5 tests: set it before
	// pressing Enter on "Manage backups" and buildBackupListCmd will use it.
	backupListOverride func() ([]backup.SnapshotMeta, error)

	// backupRestoreOverride, when non-nil, replaces the real backup.Store.Restore()
	// call. Set alongside backupListOverride in tests.
	backupRestoreOverride func(id backup.SnapshotID) error

	// ─── Uninstall screen state (Slice 6) ────────────────────────────────────

	// uninstallRunning is true while the uninstall goroutine is in progress.
	// When false, ScreenUninstall renders the confirmation step.
	uninstallRunning bool

	// uninstallErr holds the error (or nil) from the last uninstall run.
	// Stored when uninstallDoneMsg is received; read by renderUninstallComplete.
	uninstallErr error

	// uninstallSnapshotID is the snapshot ID created before the removal.
	// Shown on ScreenComplete so the user knows how to rollback.
	uninstallSnapshotID string

	// uninstallRemovedPaths lists the FS paths that were removed.
	// Shown on ScreenComplete as the removed summary.
	uninstallRemovedPaths []string

	// uninstallSnapshotOverride, when non-nil, replaces the real backup snapshot
	// creation step. This is an injection seam for Slice 6 tests: set it before
	// confirming so no real backup store is touched.
	uninstallSnapshotOverride func() (string, error)

	// uninstallOverride, when non-nil, replaces the real core.Uninstall FS removal.
	// This is the primary injection seam for Slice 6 tests: set it before
	// confirming so no real ~/.claude or FS removal is performed.
	uninstallOverride func() ([]string, error)

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

// hubMenuItems is the ordered list of hub menu entries.
var hubMenuItems = []string{
	"Start installation",
	"Upgrade",
	"Manage backups",
	"Managed uninstall",
	"Quit",
}

// NewHubModel creates the initial AppModel for the welcome hub entry point.
// version is the binary version string (from ldflags).
// projectDir is the project directory (--dir flag value or cwd).
// The model starts on ScreenWelcome and fires the background update-check on Init().
func NewHubModel(version, projectDir string) AppModel {
	return AppModel{
		screen:     ScreenWelcome,
		version:    version,
		projectDir: projectDir,
		menuItems:  hubMenuItems,
		cursor:     0,
	}
}

// RunHub starts the welcome hub Bubble Tea program and blocks until the user exits.
// version is the binary version string; projectDir is the project directory.
func RunHub(version, projectDir string) error {
	model := NewHubModel(version, projectDir)
	p := tea.NewProgram(model, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

// Init starts the Bubble Tea program. It fires the splash Init() and kicks off
// the background update-check goroutine concurrently.
// For the hub entry point (ScreenWelcome) the splash Init is skipped.
func (m AppModel) Init() tea.Cmd {
	updateCmd := updateCheckCmd(m.version)
	if m.updateCheckOverride != nil {
		updateCmd = m.updateCheckOverride
	}
	if m.screen == ScreenWelcome {
		// Hub path: skip splash; only run the update check.
		return updateCmd
	}
	return tea.Batch(m.splash.Init(), updateCmd)
}

// confirmSelectionHub dispatches the currently selected hub menu item to the
// appropriate screen or action.
func (m AppModel) confirmSelectionHub() (AppModel, tea.Cmd) {
	switch m.cursor {
	case 0: // Start installation — route into the existing install flow
		m.screen = SplashScreen
		m.splash = NewSplashModel(m.version)
		return m, m.splash.Init()
	case 1: // Upgrade — launch upgrade goroutine + spinner.
		m.screen = ScreenUpgrade
		m.spinnerFrame = 0
		m.lastCompletedAction = completedActionUpgrade
		// Bump generation so any stale goroutine result from a prior interrupted
		// run carries an outdated generation and will be discarded in Update().
		m.upgradeGeneration++
		// Reset upgrade fields and clear stale complete-screen fields from other actions.
		m.upgradeErr = nil
		m.upgradeNewVersion = ""
		m.upgradeMethod = ""
		// Reset backup and uninstall complete-screen fields to prevent cross-render.
		m.backupRestoredID = ""
		m.backupRestoreErr = nil
		m.uninstallSnapshotID = ""
		m.uninstallErr = nil
		m.uninstallRemovedPaths = nil
		upgradeCmd := buildUpgradeCmd(m.version, m.upgradeOverride, nil, m.upgradeGeneration)
		return m, tea.Batch(upgradeCmd, tickCmd())
	case 2: // Manage backups — load backup list then show ScreenBackups.
		m.screen = ScreenBackups
		m.backupCursor = 0
		m.backupsLoaded = false
		m.backupLoadErr = nil
		m.backupList = nil
		m.backupRestoredID = ""
		m.backupRestoreErr = nil
		m.lastCompletedAction = completedActionBackup
		// Reset stale complete-screen fields from other actions.
		m.upgradeErr = nil
		m.upgradeNewVersion = ""
		m.upgradeMethod = ""
		m.uninstallSnapshotID = ""
		m.uninstallErr = nil
		m.uninstallRemovedPaths = nil
		return m, buildBackupListCmd(m.backupListOverride)
	case 3: // Managed uninstall — show confirm step first (Slice 6).
		// NOTE: No cmd is fired here; the confirm step is a static render.
		// When the user presses Enter on ScreenUninstall, the uninstall cmd fires.
		m.screen = ScreenUninstall
		m.uninstallRunning = false
		m.uninstallErr = nil
		m.uninstallSnapshotID = ""
		m.uninstallRemovedPaths = nil
		m.lastCompletedAction = completedActionUninstall
		// Reset stale complete-screen fields from other actions.
		m.upgradeErr = nil
		m.upgradeNewVersion = ""
		m.upgradeMethod = ""
		m.backupRestoredID = ""
		m.backupRestoreErr = nil
		return m, nil
	default: // Quit (last item) or any out-of-range
		return m, tea.Quit
	}
}

// Update is the root message dispatcher.
func (m AppModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Global quit keybinding — intercept before sub-models.
	//
	// Esc routing table (Slice 7 — explicit per-screen scoping):
	//   ScreenWelcome        → no-op (no parent screen to return to)
	//   ScreenUpgrade        → handled locally (back to ScreenWelcome)
	//   ScreenBackups        → handled locally (back to ScreenWelcome)
	//   ScreenUninstall      → handled locally (back to ScreenWelcome on confirm step)
	//   ScreenComplete       → handled locally (back to ScreenWelcome)
	//   Install-flow screens → tea.Quit (install-flow esc semantics unchanged)
	//
	// Guard (Fix 8): 'q' is blocked while an upgrade or uninstall is actively
	// running to prevent partial state from a mid-binary-replace or mid-removal
	// quit. ctrl+c is not blocked (OS signal; user intent is stronger).
	if key, ok := msg.(tea.KeyMsg); ok {
		isHubScreen := m.screen == ScreenWelcome || m.screen == ScreenUpgrade ||
			m.screen == ScreenBackups || m.screen == ScreenUninstall || m.screen == ScreenComplete
		// isActionInFlight is true while an upgrade or uninstall goroutine is running.
		isActionInFlight := m.screen == ScreenUpgrade || (m.screen == ScreenUninstall && m.uninstallRunning)
		switch key.String() {
		case "ctrl+c":
			return m, tea.Quit
		case "q":
			// Block 'q' while a potentially destructive action is in flight.
			if isActionInFlight {
				return m, nil
			}
			return m, tea.Quit
		case "esc":
			if m.screen == ScreenWelcome {
				// No-op: welcome screen has no parent to return to.
				return m, nil
			}
			if !isHubScreen {
				// Install-flow screen: Esc quits (byte-identical to pre-hub behavior).
				return m, tea.Quit
			}
			// Hub action screen: fall through to screen-local Esc handler below.
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
	case ScreenWelcome:
		// Hub navigation — handle j/k/↑/↓/Enter in Update.
		// Note: q/ctrl+c/esc are already handled by the global quit above.
		if key, ok := msg.(tea.KeyMsg); ok {
			n := len(m.menuItems)
			switch key.String() {
			case "j", "down":
				m.cursor = (m.cursor + 1) % n
				return m, nil
			case "k", "up":
				m.cursor = (m.cursor - 1 + n) % n
				return m, nil
			case "enter":
				return m.confirmSelectionHub()
			}
		}
		return m, nil

	case ScreenUpgrade:
		// Handle upgrade goroutine result.
		// Guard: discard stale msgs from a prior interrupted goroutine (Fix 2).
		// A msg with generation == 0 is treated as "unversioned" (test injection
		// or legacy caller) and is always accepted. Only msgs with a non-zero
		// generation are checked against the current upgradeGeneration.
		if done, ok := msg.(upgradeDoneMsg); ok {
			if done.generation != 0 && done.generation != m.upgradeGeneration {
				// Stale result from a prior goroutine — discard silently.
				return m, nil
			}
			m.upgradeErr = done.err
			m.upgradeNewVersion = done.newVersion
			m.upgradeMethod = done.method
			m.screen = ScreenComplete
			return m, nil
		}
		// Advance spinner animation.
		if _, ok := msg.(TickMsg); ok {
			m.spinnerFrame = (m.spinnerFrame + 1) % len(spinnerFrames)
			return m, tickCmd()
		}
		// Esc → back to welcome.
		if key, ok := msg.(tea.KeyMsg); ok && key.String() == "esc" {
			m.screen = ScreenWelcome
			return m, nil
		}
		return m, nil

	case ScreenComplete:
		// Esc → back to welcome.
		if key, ok := msg.(tea.KeyMsg); ok && key.String() == "esc" {
			m.screen = ScreenWelcome
			return m, nil
		}
		return m, nil

	case ScreenBackups:
		// Handle backup list load result.
		if loaded, ok := msg.(backupsLoadedMsg); ok {
			m.backupsLoaded = true
			m.backupLoadErr = loaded.err
			if loaded.err == nil {
				m.backupList = loaded.metas
			}
			return m, nil
		}
		// Handle restore result.
		if done, ok := msg.(backupRestoreDoneMsg); ok {
			m.backupRestoreErr = done.err
			m.backupRestoredID = done.id
			m.screen = ScreenComplete
			return m, nil
		}
		// Spinner advance while restoring (reuse TickMsg from hub_actions.go).
		if _, ok := msg.(TickMsg); ok {
			m.spinnerFrame = (m.spinnerFrame + 1) % len(spinnerFrames)
			return m, tickCmd()
		}
		// Key handling.
		if key, ok := msg.(tea.KeyMsg); ok {
			switch key.String() {
			case "esc":
				m.screen = ScreenWelcome
				return m, nil
			case "j", "down":
				if len(m.backupList) > 0 {
					m.backupCursor = (m.backupCursor + 1) % len(m.backupList)
				}
				return m, nil
			case "k", "up":
				if len(m.backupList) > 0 {
					n := len(m.backupList)
					m.backupCursor = (m.backupCursor - 1 + n) % n
				}
				return m, nil
			case "enter":
				if len(m.backupList) > 0 {
					selected := m.backupList[m.backupCursor]
					m.spinnerFrame = 0
					return m, tea.Batch(
						buildBackupRestoreCmd(selected.ID, m.backupRestoreOverride),
						tickCmd(),
					)
				}
				return m, nil
			}
		}
		return m, nil

	case ScreenUninstall:
		// Handle uninstall goroutine result.
		if done, ok := msg.(uninstallDoneMsg); ok {
			m.uninstallRunning = false
			m.uninstallErr = done.err
			m.uninstallSnapshotID = done.snapshotID
			m.uninstallRemovedPaths = done.removedPaths
			m.screen = ScreenComplete
			return m, nil
		}
		// Spinner advance while running.
		if _, ok := msg.(TickMsg); ok && m.uninstallRunning {
			m.spinnerFrame = (m.spinnerFrame + 1) % len(spinnerFrames)
			return m, tickCmd()
		}
		// Key handling.
		if key, ok := msg.(tea.KeyMsg); ok {
			switch key.String() {
			case "esc":
				// Cancel — return to welcome (only allowed on confirm step).
				if !m.uninstallRunning {
					m.screen = ScreenWelcome
					return m, nil
				}
			case "enter":
				if !m.uninstallRunning {
					// Confirm: fire the uninstall cmd batched with tickCmd() so the
					// braille spinner animates reliably while the goroutine runs.
					// This mirrors ScreenUpgrade (case 1) and ScreenBackups (enter).
					m.uninstallRunning = true
					m.spinnerFrame = 0
					uninstallCmd := buildUninstallCmd(m.version, m.uninstallSnapshotOverride, m.uninstallOverride)
					return m, tea.Batch(uninstallCmd, tickCmd())
				}
			}
		}
		return m, nil

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
	case ScreenWelcome:
		return renderWelcome(m)
	case ScreenUpgrade:
		return renderUpgrade(m)
	case ScreenComplete:
		// Route to the appropriate complete renderer using the explicit discriminator
		// set when entering each action screen (in confirmSelectionHub).
		// This replaces the fragile field-presence check that broke when an uninstall
		// completed with snapshotID=="" and err==nil (Fix 1).
		switch m.lastCompletedAction {
		case completedActionBackup:
			return renderBackupComplete(m)
		case completedActionUninstall:
			return renderUninstallComplete(m)
		default:
			return renderComplete(m)
		}
	case ScreenBackups:
		return renderBackups(m)
	case ScreenUninstall:
		return renderUninstall(m)
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
			assets.SkillsFS,
			assets.Agents,
			assets.TemplateFS,
			assets.CommandsFS,
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
