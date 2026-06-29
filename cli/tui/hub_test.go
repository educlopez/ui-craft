package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
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

// TestHubModel_enterUpgrade_routesToScreenUpgrade verifies item 1 (Upgrade) goes to ScreenUpgrade.
func TestHubModel_enterUpgrade_routesToScreenUpgrade(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	// Navigate to Upgrade (item 1).
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	m = updated.(AppModel)

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if m.screen != ScreenUpgrade {
		t.Errorf("Enter on Upgrade must route to ScreenUpgrade, got %v", m.screen)
	}
}

// TestHubModel_enterBackups_routesToScreenBackups verifies item 2 routes to ScreenBackups.
func TestHubModel_enterBackups_routesToScreenBackups(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	// Navigate to Manage backups (item 2).
	for i := 0; i < 2; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if m.screen != ScreenBackups {
		t.Errorf("Enter on Manage backups must route to ScreenBackups, got %v", m.screen)
	}
}

// TestHubModel_enterUninstall_routesToScreenUninstall verifies item 3 routes to ScreenUninstall.
func TestHubModel_enterUninstall_routesToScreenUninstall(t *testing.T) {
	m := NewHubModel("v1.0.0", "/tmp/test")
	// Navigate to Managed uninstall (item 3).
	for i := 0; i < 3; i++ {
		updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = updated.(AppModel)
	}

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if m.screen != ScreenUninstall {
		t.Errorf("Enter on Managed uninstall must route to ScreenUninstall, got %v", m.screen)
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
