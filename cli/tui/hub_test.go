package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/core"
)

// ─── NewHubModel construction tests ──────────────────────────────────────────

// TestNewHubModel_startsOnWelcomeScreen verifies the constructor sets ScreenWelcome.
func TestNewHubModel_startsOnWelcomeScreen(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	if m.screen != ScreenWelcome {
		t.Errorf("NewHubModel must start on ScreenWelcome, got %v", m.screen)
	}
}

// TestNewHubModel_hasMenuItems verifies menu items are populated.
func TestNewHubModel_hasMenuItems(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	if len(m.menuItems) == 0 {
		t.Error("NewHubModel must populate menuItems")
	}
}

// TestNewAppModel_unchangedByHubAdditions verifies that NewAppModel still
// starts on SplashScreen and is unaffected by the hub additions.
func TestNewAppModel_unchangedByHubAdditions(t *testing.T) {
	m := NewAppModel("v1.0.0", "/tmp/test")
	if m.screen != SplashScreen {
		t.Errorf("NewAppModel must still start on SplashScreen, got %v", m.screen)
	}
}

// ─── Menu navigation tests ────────────────────────────────────────────────────

// TestHubModel_cursorDownWraps verifies j/↓ navigation wraps at the bottom.
func TestHubModel_cursorDownWraps(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	n := len(m.menuItems)

	// Move to last item.
	for i := 0; i < n-1; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	if m.cursor != n-1 {
		t.Fatalf("expected cursor at %d, got %d", n-1, m.cursor)
	}

	// One more j → wraps to 0.
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	m = updated.(AppModel)
	if m.cursor != 0 {
		t.Errorf("cursor must wrap to 0 after passing last item, got %d", m.cursor)
	}
}

// TestHubModel_cursorDownArrowWraps verifies ↓ arrow navigation.
func TestHubModel_cursorDownArrowWraps(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	n := len(m.menuItems)

	for i := 0; i < n-1; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
		m = updated.(AppModel)
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m = updated.(AppModel)
	if m.cursor != 0 {
		t.Errorf("↓ must wrap to 0, got %d", m.cursor)
	}
}

// TestHubModel_cursorUpWraps verifies k/↑ navigation wraps at the top.
func TestHubModel_cursorUpWraps(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	if m.cursor != 0 {
		t.Fatalf("cursor must start at 0, got %d", m.cursor)
	}

	// k from first item → wraps to last.
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
	m = updated.(AppModel)
	if m.cursor != len(m.menuItems)-1 {
		t.Errorf("k from 0 must wrap to last item %d, got %d", len(m.menuItems)-1, m.cursor)
	}
}

// TestHubModel_cursorUpArrowWraps verifies ↑ arrow wraps.
func TestHubModel_cursorUpArrowWraps(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m = updated.(AppModel)
	if m.cursor != len(m.menuItems)-1 {
		t.Errorf("↑ from 0 must wrap to last item %d, got %d", len(m.menuItems)-1, m.cursor)
	}
}

// TestHubModel_cursorJKSequential verifies sequential j/k navigation.
func TestHubModel_cursorJKSequential(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")

	// j: 0→1→2
	for i := 1; i <= 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
		if m.cursor != i {
			t.Errorf("after %d j presses, cursor must be %d, got %d", i, i, m.cursor)
		}
	}

	// k: 2→1
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
	m = updated.(AppModel)
	if m.cursor != 1 {
		t.Errorf("after k, cursor must be 1, got %d", m.cursor)
	}
}

// ─── Enter / selection routing tests ─────────────────────────────────────────

// TestHubModel_enterItem0_routesToInstall verifies Enter on item 0 (Start installation)
// routes to the install flow (SplashScreen — AppModel install path starts with splash).
func TestHubModel_enterItem0_routesToInstall(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	// cursor is already at 0 (Start installation)
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	// "Start installation" routes into the existing install flow
	// which starts at SplashScreen (existing AppModel init)
	if m.screen != SplashScreen {
		t.Errorf("Enter on 'Start installation' must route to SplashScreen (install flow), got %v", m.screen)
	}
}

// TestHubModel_enterLastItem_quits verifies Enter on the last item (Quit) returns tea.Quit.
func TestHubModel_enterLastItem_quits(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	n := len(m.menuItems)

	// Navigate to last item.
	for i := 0; i < n-1; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}

	// Verify we're on the last item.
	if m.cursor != n-1 {
		t.Fatalf("cursor must be at last item %d, got %d", n-1, m.cursor)
	}

	// Press Enter — should return tea.Quit cmd.
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("Enter on Quit item must return a non-nil cmd (tea.Quit)")
	}
	// Execute the cmd — it should be tea.Quit which returns tea.QuitMsg.
	msg := cmd()
	if _, ok := msg.(tea.QuitMsg); !ok {
		t.Errorf("Enter on Quit item cmd must yield tea.QuitMsg, got %T", msg)
	}
}

// TestHubModel_enterProjectInstall_routesToSplashScreenWithProjectScope verifies
// item 1 ("Install (this project)") routes into the install flow (SplashScreen,
// same as "Start installation") but sets installScope to core.Project.
func TestHubModel_enterProjectInstall_routesToSplashScreenWithProjectScope(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	// Navigate to "Install (this project)" (item 1).
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	m = updated.(AppModel)

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if m.screen != SplashScreen {
		t.Errorf("Enter on 'Install (this project)' must route to SplashScreen (install flow), got %v", m.screen)
	}
	if m.installScope != core.Project {
		t.Errorf("Enter on 'Install (this project)' must set installScope=core.Project, got %v", m.installScope)
	}
}

// TestHubModel_enterUpgrade_routesToScreenUpgrade verifies item 2 (Upgrade) goes to ScreenUpgrade.
func TestHubModel_enterUpgrade_routesToScreenUpgrade(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	// Navigate to Upgrade (item 2 — after "Start installation" and
	// "Install (this project)").
	for i := 0; i < 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if m.screen != ScreenUpgrade {
		t.Errorf("Enter on Upgrade must route to ScreenUpgrade, got %v", m.screen)
	}
}

// TestHubModel_enterBackups_routesToScreenBackups verifies item 3 routes to ScreenBackups.
func TestHubModel_enterBackups_routesToScreenBackups(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	// Navigate to Manage backups (item 3).
	for i := 0; i < 3; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if m.screen != ScreenBackups {
		t.Errorf("Enter on Manage backups must route to ScreenBackups, got %v", m.screen)
	}
}

// TestHubModel_enterUninstall_routesToScreenUninstall verifies item 4 routes to ScreenUninstall.
func TestHubModel_enterUninstall_routesToScreenUninstall(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	// Navigate to Managed uninstall (item 4).
	for i := 0; i < 4; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if m.screen != ScreenUninstall {
		t.Errorf("Enter on Managed uninstall must route to ScreenUninstall, got %v", m.screen)
	}
}

// ─── Full menu navigation regression (PR3 — case-index cascade guard) ───────

// TestHubModel_menuLabelsMatchExpectedOrder is a belt-and-suspenders guard on
// the exact hubMenuItems order. If this test needs to change, every
// case-index in confirmSelectionHub (app.go) AND every navigation helper in
// this package's test files MUST be re-audited for the same shift — see the
// PR3 apply-progress note on the case-index cascade risk.
func TestHubModel_menuLabelsMatchExpectedOrder(t *testing.T) {
	want := []string{
		"Start installation",
		"Install (this project)",
		"Upgrade",
		"Manage backups",
		"Managed uninstall",
		"Quit",
	}
	m := NewHubModel("v1.0.0", "/tmp/test")
	if len(m.menuItems) != len(want) {
		t.Fatalf("expected %d menu items, got %d: %v", len(want), len(m.menuItems), m.menuItems)
	}
	for i, label := range want {
		if m.menuItems[i] != label {
			t.Errorf("menu item %d: expected %q, got %q", i, label, m.menuItems[i])
		}
	}
}

// TestHubModel_fullNavigationRegression walks every menu item via down-key
// navigation (confirming wrap-around across the now-6-item list), and for
// each item asserts BOTH the label at that cursor position AND the
// enter-routing destination — not just the new item. This is the explicit
// regression guard for the case-index cascade flagged by design (#917) and
// tasks (#918 T3.4): inserting "Install (this project)" at index 1 shifts
// every downstream case (Upgrade 1→2, Backups 2→3, Uninstall 3→4).
func TestHubModel_fullNavigationRegression(t *testing.T) {
	type step struct {
		wantLabel  string
		wantScreen Screen
		wantScope  core.InstallScope // only checked for install-flow items
	}
	steps := []step{
		{wantLabel: "Start installation", wantScreen: SplashScreen, wantScope: core.Global},
		{wantLabel: "Install (this project)", wantScreen: SplashScreen, wantScope: core.Project},
		{wantLabel: "Upgrade", wantScreen: ScreenUpgrade},
		{wantLabel: "Manage backups", wantScreen: ScreenBackups},
		{wantLabel: "Managed uninstall", wantScreen: ScreenUninstall},
		// Quit (index 5) is exercised separately by TestHubModel_enterLastItem_quits
		// since pressing Enter there yields tea.Quit, not a screen transition.
	}

	for cursorPos, st := range steps {
		t.Run(st.wantLabel, func(t *testing.T) {
			m := NewHubModel("v1.0.0", "/tmp/test")
			// Seams so any goroutine-firing action screen doesn't touch real
			// resources; this test only cares about routing, not side effects.
			m.upgradeOverride = func() tea.Msg { return nil }
			m.backupListOverride = func() ([]backup.SnapshotMeta, error) { return nil, nil }

			// Navigate down to cursorPos via 'j', verifying the label at each stop.
			for i := 0; i < cursorPos; i++ {
				updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
				m = updated.(AppModel)
			}
			if m.cursor != cursorPos {
				t.Fatalf("expected cursor at %d, got %d", cursorPos, m.cursor)
			}
			if m.menuItems[m.cursor] != st.wantLabel {
				t.Fatalf("cursor %d: expected label %q, got %q", cursorPos, st.wantLabel, m.menuItems[m.cursor])
			}

			updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
			m = updated.(AppModel)
			if m.screen != st.wantScreen {
				t.Errorf("Enter on %q: expected screen %v, got %v", st.wantLabel, st.wantScreen, m.screen)
			}
			if st.wantLabel == "Start installation" || st.wantLabel == "Install (this project)" {
				if m.installScope != st.wantScope {
					t.Errorf("Enter on %q: expected installScope %v, got %v", st.wantLabel, st.wantScope, m.installScope)
				}
			}
		})
	}

	// Wrap-around: from Quit (last item), one more 'j' must wrap to item 0.
	m := NewHubModel("v1.0.0", "/tmp/test")
	n := len(m.menuItems)
	for i := 0; i < n-1; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}
	if m.menuItems[m.cursor] != "Quit" {
		t.Fatalf("expected cursor on Quit before wrap, got %q", m.menuItems[m.cursor])
	}
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	m = updated.(AppModel)
	if m.cursor != 0 || m.menuItems[m.cursor] != "Start installation" {
		t.Errorf("j from Quit must wrap to 'Start installation' at cursor 0, got cursor=%d label=%q", m.cursor, m.menuItems[m.cursor])
	}

	// Wrap-around the other direction: 'k' from item 0 must wrap to Quit.
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
	m = updated.(AppModel)
	if m.menuItems[m.cursor] != "Quit" {
		t.Errorf("k from 'Start installation' must wrap to 'Quit', got %q", m.menuItems[m.cursor])
	}
}

// ─── q/ctrl+c quit from welcome ───────────────────────────────────────────────

// TestHubModel_qFromWelcome_quits verifies q quits from ScreenWelcome.
func TestHubModel_qFromWelcome_quits(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	if cmd == nil {
		t.Fatal("q from ScreenWelcome must return non-nil cmd (tea.Quit)")
	}
	msg := cmd()
	if _, ok := msg.(tea.QuitMsg); !ok {
		t.Errorf("q must yield tea.QuitMsg, got %T", msg)
	}
}

// TestHubModel_ctrlCFromWelcome_quits verifies ctrl+c quits from ScreenWelcome.
func TestHubModel_ctrlCFromWelcome_quits(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})
	if cmd == nil {
		t.Fatal("ctrl+c from ScreenWelcome must return non-nil cmd")
	}
	msg := cmd()
	if _, ok := msg.(tea.QuitMsg); !ok {
		t.Errorf("ctrl+c must yield tea.QuitMsg, got %T", msg)
	}
}

// ─── updateResult integration ─────────────────────────────────────────────────

// TestHubModel_updateResult_stored verifies that updateResultMsg updates the model.
func TestHubModel_updateResult_stored(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")

	result := core.UpdateResult{
		Available: true,
		LatestTag: "v9.9.9",
	}
	updated, _ := m.Update(updateResultMsg{result: result})
	m = updated.(AppModel)

	if !m.updateResult.Available {
		t.Error("updateResultMsg must set m.updateResult.Available = true")
	}
	if m.updateResult.LatestTag != "v9.9.9" {
		t.Errorf("updateResult.LatestTag must be v9.9.9, got %q", m.updateResult.LatestTag)
	}
}

// ─── ★ star marker and update line tests ─────────────────────────────────────

// TestHubModel_starAppearsOnUpgradeWhenUpdateAvailable verifies that when an
// updateResultMsg with Available=true is received, the Upgrade menu item in the
// rendered welcome view gains a ★ suffix.
func TestHubModel_starAppearsOnUpgradeWhenUpdateAvailable(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := NewHubModel("v1.0.0", "/tmp/test")

	// Initially, no update — ★ must NOT appear.
	viewBefore := renderWelcome(m)
	if containsAny(viewBefore, "★") {
		t.Error("★ must NOT appear in welcome view before update result is received")
	}

	// Inject update result via the updateResultMsg.
	result := core.UpdateResult{Available: true, LatestTag: "v9.9.9"}
	updated, _ := m.Update(updateResultMsg{result: result})
	m = updated.(AppModel)

	// After update result — ★ must appear on Upgrade item.
	viewAfter := renderWelcome(m)
	if !containsAny(viewAfter, "★") {
		t.Errorf("★ must appear in welcome view after updateResultMsg{Available:true}, got:\n%s", viewAfter)
	}
}

// TestHubModel_noStarWhenNoUpdate verifies that without an update the ★ is absent.
func TestHubModel_noStarWhenNoUpdate(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := NewHubModel("v1.0.0", "/tmp/test")

	// Inject a "no update" result.
	result := core.UpdateResult{Available: false}
	updated, _ := m.Update(updateResultMsg{result: result})
	m = updated.(AppModel)

	view := renderWelcome(m)
	if containsAny(view, "★") {
		t.Errorf("★ must NOT appear when no update is available, got:\n%s", view)
	}
}

// TestHubModel_updateLineAppearsAfterResult verifies the "Updates available" advisory
// line appears in the welcome view once the update result (Available=true) is received.
func TestHubModel_updateLineAppearsAfterResult(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := NewHubModel("v1.0.0", "/tmp/test")

	// Before result arrives — no update line.
	viewBefore := renderWelcome(m)
	if containsAny(viewBefore, "Updates available", "ui-craft v") {
		t.Errorf("update line must NOT appear before result arrives, got:\n%s", viewBefore)
	}

	// Inject update result.
	result := core.UpdateResult{Available: true, LatestTag: "v9.9.9"}
	updated, _ := m.Update(updateResultMsg{result: result})
	m = updated.(AppModel)

	// After result — update line must appear.
	viewAfter := renderWelcome(m)
	if !containsAny(viewAfter, "v9.9.9") {
		t.Errorf("update line must appear after updateResultMsg{Available:true, LatestTag:v9.9.9}, got:\n%s", viewAfter)
	}
}

// TestHubModel_offlineResultNoLine verifies that an offline (fail-open) result
// (Available=false) does not show an update line and does not crash.
func TestHubModel_offlineResultNoLine(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := NewHubModel("v1.0.0", "/tmp/test")

	// Simulate offline: Available=false, LatestTag="" (fail-open result).
	result := core.UpdateResult{Available: false, LatestTag: ""}
	updated, _ := m.Update(updateResultMsg{result: result})
	m = updated.(AppModel)

	view := renderWelcome(m)
	if containsAny(view, "★", "Updates available") {
		t.Errorf("offline result must produce no update line and no ★, got:\n%s", view)
	}
}

// TestHubModel_inFlightNoStar verifies that before the update check returns
// (in-flight state), neither ★ nor the update line appears.
func TestHubModel_inFlightNoStar(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	// A fresh NewHubModel has no updateResult (zero value = Available:false).
	m := NewHubModel("v1.0.0", "/tmp/test")

	view := renderWelcome(m)
	if containsAny(view, "★") {
		t.Errorf("★ must NOT appear while update check is in-flight (zero-value updateResult), got:\n%s", view)
	}
	if containsAny(view, "Updates available") {
		t.Errorf("update line must NOT appear while in-flight, got:\n%s", view)
	}
}

// ─── View non-panic tests ─────────────────────────────────────────────────────

// TestHubModel_viewNoPanic verifies that View() on ScreenWelcome does not panic.
func TestHubModel_viewNoPanic(t *testing.T) {
	t.Run("color mode", func(t *testing.T) {
		t.Setenv("NO_COLOR", "")
		t.Setenv("TERM", "xterm-256color")
		m := NewHubModel("v1.0.0", "/tmp/test")
		view := m.View()
		if view == "" {
			t.Error("View() on ScreenWelcome must return non-empty string")
		}
	})

	t.Run("NO_COLOR mode", func(t *testing.T) {
		t.Setenv("NO_COLOR", "1")
		m := NewHubModel("v1.0.0", "/tmp/test")
		view := m.View()
		if view == "" {
			t.Error("View() must return non-empty string in NO_COLOR mode")
		}
	})
}

// TestHubModel_viewContainsVersion verifies the version appears in the welcome view.
func TestHubModel_viewContainsVersion(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := NewHubModel("v1.2.3", "/tmp/test")
	view := m.View()
	if !containsAny(view, "v1.2.3", "1.2.3") {
		t.Errorf("welcome view must contain version string, got: %q", view)
	}
}

// containsAny returns true if s contains any of the provided substrings.
func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}
