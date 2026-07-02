// Package tui — hub_ciinstall_test.go
// Strict TDD tests for the ci-install follow-up prompt (PR4 — final slice of
// tui-project-scope-ci-install): shown after a project-scoped install
// completes successfully, iff the cwd's git origin is GitHub-hosted.
package tui

import (
	"errors"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/core"
)

// ─── buildCIInstallCmd: argv + spinner/ScreenComplete pattern ────────────────

// TestBuildCIInstallCmd_invokesNpxCIInstallWithCorrectArgv asserts the exact
// argv shape mirroring buildUpgradeCmd's execFn injection pattern.
func TestBuildCIInstallCmd_invokesNpxCIInstallWithCorrectArgv(t *testing.T) {
	var gotName string
	var gotArgs []string
	execFn := func(name string, args ...string) (string, error) {
		gotName = name
		gotArgs = args
		return "", nil
	}

	cmd := buildCIInstallCmd(nil, execFn, 1)
	msg := cmd()
	done, ok := msg.(ciInstallDoneMsg)
	if !ok {
		t.Fatalf("expected ciInstallDoneMsg, got %T", msg)
	}
	if done.err != nil {
		t.Fatalf("unexpected error: %v", done.err)
	}
	if gotName != "npx" {
		t.Errorf("exec name = %q, want %q", gotName, "npx")
	}
	wantArgs := []string{"ui-craft-detect@latest", "ci", "install", "--yes"}
	if len(gotArgs) != len(wantArgs) {
		t.Fatalf("argv = %v, want %v", gotArgs, wantArgs)
	}
	for i := range wantArgs {
		if gotArgs[i] != wantArgs[i] {
			t.Errorf("argv[%d] = %q, want %q", i, gotArgs[i], wantArgs[i])
		}
	}
}

// TestBuildCIInstallCmd_overrideIsUsed verifies the override injection seam
// bypasses the real exec entirely (mirrors upgradeOverride).
func TestBuildCIInstallCmd_overrideIsUsed(t *testing.T) {
	overrideCalled := false
	override := func() tea.Msg {
		overrideCalled = true
		return ciInstallDoneMsg{err: nil}
	}
	execFn := func(name string, args ...string) (string, error) {
		t.Fatal("real execFn must not be called when override is set")
		return "", nil
	}

	cmd := buildCIInstallCmd(override, execFn, 1)
	msg := cmd()
	if !overrideCalled {
		t.Error("override must have been called")
	}
	done, ok := msg.(ciInstallDoneMsg)
	if !ok {
		t.Fatalf("expected ciInstallDoneMsg, got %T", msg)
	}
	if done.err != nil {
		t.Errorf("unexpected error: %v", done.err)
	}
}

// TestBuildCIInstallCmd_generationIsStamped verifies the generation field is
// baked into the result (mirrors upgradeDoneMsg's stale-result discard guard).
func TestBuildCIInstallCmd_generationIsStamped(t *testing.T) {
	execFn := func(name string, args ...string) (string, error) { return "", nil }
	cmd := buildCIInstallCmd(nil, execFn, 7)
	msg := cmd()
	done, ok := msg.(ciInstallDoneMsg)
	if !ok {
		t.Fatalf("expected ciInstallDoneMsg, got %T", msg)
	}
	if done.generation != 7 {
		t.Errorf("generation = %d, want 7", done.generation)
	}
}

// TestBuildCIInstallCmd_npxFailureSurfacesErrorWithoutCrashing verifies that a
// non-zero exit / npx-missing error is surfaced on the result, not panicked.
func TestBuildCIInstallCmd_npxFailureSurfacesErrorWithoutCrashing(t *testing.T) {
	wantErr := errors.New("exec: \"npx\": executable file not found in $PATH")
	execFn := func(name string, args ...string) (string, error) {
		return "", wantErr
	}

	cmd := buildCIInstallCmd(nil, execFn, 1)
	msg := cmd() // must not panic
	done, ok := msg.(ciInstallDoneMsg)
	if !ok {
		t.Fatalf("expected ciInstallDoneMsg, got %T", msg)
	}
	if done.err == nil {
		t.Fatal("expected error to be surfaced on ciInstallDoneMsg, got nil")
	}
}

// ─── Conditional visibility: gated on scope + GitHub-remote detection ────────

// TestCIInstallPrompt_shownForProjectScopeWithGitHubRemote verifies that a
// successful project-scoped install with a GitHub-hosted origin routes to the
// ci-install prompt screen instead of straight to DoneScreen.
func TestCIInstallPrompt_shownForProjectScopeWithGitHubRemote(t *testing.T) {
	m := NewAppModel("v1.0.0", "/tmp/test")
	m.installScope = core.Project
	m.gitHubRemoteOverride = func() (bool, string) { return true, "org/repo" }

	m.screen = ApplyScreen
	m.progress = NewProgressModel()
	updated, _ := m.progress.Update(ApplyResultMsg{})
	m.progress = updated.(ProgressModel)

	updatedModel, _ := m.Update(ApplyResultMsg{})
	m = updatedModel.(AppModel)

	if m.screen != ScreenCIInstallPrompt {
		t.Errorf("expected ScreenCIInstallPrompt for project-scope + GitHub remote, got %v", m.screen)
	}
}

// TestCIInstallPrompt_hiddenForNonGitHubRemote verifies that a project-scoped
// install with a non-GitHub (or absent) origin routes straight to DoneScreen —
// per spec's fail-closed requirement, the prompt is not shown at all (not
// grayed out).
func TestCIInstallPrompt_hiddenForNonGitHubRemote(t *testing.T) {
	m := NewAppModel("v1.0.0", "/tmp/test")
	m.installScope = core.Project
	m.gitHubRemoteOverride = func() (bool, string) { return false, "" }

	m.screen = ApplyScreen
	m.progress = NewProgressModel()

	updatedModel, _ := m.Update(ApplyResultMsg{})
	m = updatedModel.(AppModel)

	if m.screen != DoneScreen {
		t.Errorf("expected DoneScreen when GitHub remote not detected, got %v", m.screen)
	}
}

// TestCIInstallPrompt_hiddenForGlobalScope verifies that even with a
// GitHub-hosted remote, a global-scope install never shows the ci-install
// prompt — it is scoped to the project-install flow only.
func TestCIInstallPrompt_hiddenForGlobalScope(t *testing.T) {
	m := NewAppModel("v1.0.0", "/tmp/test")
	// installScope zero value is core.Global.
	m.gitHubRemoteOverride = func() (bool, string) { return true, "org/repo" }

	m.screen = ApplyScreen
	m.progress = NewProgressModel()

	updatedModel, _ := m.Update(ApplyResultMsg{})
	m = updatedModel.(AppModel)

	if m.screen != DoneScreen {
		t.Errorf("expected DoneScreen for global scope regardless of GitHub remote, got %v", m.screen)
	}
}

// TestCIInstallPrompt_hiddenOnApplyError verifies that an apply error routes
// to the error/done path as before — the ci-install prompt never appears
// after a failed install, even for project scope + GitHub remote.
func TestCIInstallPrompt_hiddenOnApplyError(t *testing.T) {
	m := NewAppModel("v1.0.0", "/tmp/test")
	m.installScope = core.Project
	m.gitHubRemoteOverride = func() (bool, string) { return true, "org/repo" }

	m.screen = ApplyScreen
	m.progress = NewProgressModel()

	updatedModel, _ := m.Update(ApplyResultMsg{Err: errors.New("boom")})
	m = updatedModel.(AppModel)

	if m.screen == ScreenCIInstallPrompt {
		t.Errorf("ci-install prompt must never appear after a failed apply, got %v", m.screen)
	}
}

// ─── Prompt screen interaction: y/enter triggers install, n/esc skips ────────

// promptOnCIInstall drives an AppModel to ScreenCIInstallPrompt via a
// successful project-scoped apply with a GitHub remote detected.
func promptOnCIInstall(t *testing.T) AppModel {
	t.Helper()
	m := NewAppModel("v1.0.0", "/tmp/test")
	m.installScope = core.Project
	m.gitHubRemoteOverride = func() (bool, string) { return true, "org/repo" }
	m.screen = ApplyScreen
	m.progress = NewProgressModel()

	updatedModel, _ := m.Update(ApplyResultMsg{})
	m = updatedModel.(AppModel)
	if m.screen != ScreenCIInstallPrompt {
		t.Fatalf("precondition failed: expected ScreenCIInstallPrompt, got %v", m.screen)
	}
	return m
}

// TestCIInstallPrompt_yesTriggersInstallCmd verifies pressing y/enter fires
// the ci-install cmd and moves to a spinner state (ScreenComplete gated by
// lastCompletedAction, mirroring the upgrade/backup/uninstall pattern).
func TestCIInstallPrompt_yesTriggersInstallCmd(t *testing.T) {
	m := promptOnCIInstall(t)
	m.ciInstallOverride = func() tea.Msg { return ciInstallDoneMsg{err: nil} }

	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if cmd == nil {
		t.Fatal("expected non-nil cmd when confirming ci-install")
	}
	if m.lastCompletedAction != completedActionCIInstall {
		t.Errorf("expected lastCompletedAction=completedActionCIInstall, got %v", m.lastCompletedAction)
	}
}

// TestCIInstallPrompt_noSkipsToDoneScreen verifies pressing n/esc skips the
// ci-install entirely and routes to DoneScreen without firing any cmd that
// shells out.
func TestCIInstallPrompt_noSkipsToDoneScreen(t *testing.T) {
	m := promptOnCIInstall(t)
	updated, _ := m.Update(tea.KeyMsg{Runes: []rune{'n'}, Type: tea.KeyRunes})
	m = updated.(AppModel)
	if m.screen != DoneScreen {
		t.Errorf("expected DoneScreen after declining ci-install, got %v", m.screen)
	}
}

// TestCIInstallPrompt_escDeclinesWithoutTriggeringGlobalQuit verifies that
// Esc on ScreenCIInstallPrompt is handled LOCALLY (decline → DoneScreen), not
// routed through the global install-flow "Esc quits" branch. This guards
// against the exact class of latent hardcoded-screen-membership bug PR3
// found in welcome.go's ★-marker index: AppModel.Update's isHubScreen list
// must include every new hub screen or Esc silently does the wrong thing.
func TestCIInstallPrompt_escDeclinesWithoutTriggeringGlobalQuit(t *testing.T) {
	m := promptOnCIInstall(t)
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)
	if cmd != nil {
		if _, quit := cmd().(tea.QuitMsg); quit {
			t.Fatal("Esc on ScreenCIInstallPrompt must NOT trigger tea.Quit — it must decline locally")
		}
	}
	if m.screen != DoneScreen {
		t.Errorf("expected DoneScreen after Esc decline, got %v", m.screen)
	}
}

// TestCIInstallPrompt_qBlockedWhileRunning verifies that 'q' is blocked while
// the ci-install subprocess is in flight (mirrors the upgrade/uninstall
// in-flight guard) — prevents a mid-subprocess quit leaving orphaned state.
func TestCIInstallPrompt_qBlockedWhileRunning(t *testing.T) {
	m := promptOnCIInstall(t)
	m.ciInstallOverride = func() tea.Msg { return nil } // no-op; drive manually
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)
	if m.ciInstallGeneration == 0 {
		t.Fatalf("precondition failed: expected ciInstallGeneration > 0 after confirming")
	}

	updated, cmd := m.Update(tea.KeyMsg{Runes: []rune{'q'}, Type: tea.KeyRunes})
	m = updated.(AppModel)
	if cmd != nil {
		if _, quit := cmd().(tea.QuitMsg); quit {
			t.Fatal("'q' must be blocked while ci-install is in flight")
		}
	}
	if m.screen != ScreenCIInstallPrompt {
		t.Errorf("expected to remain on ScreenCIInstallPrompt while running, got %v", m.screen)
	}
}

// TestCIInstallPrompt_escInertWhileRunning verifies that Esc is a no-op while
// the ci-install subprocess is in flight — the user cannot cancel mid-run
// (mirrors ScreenUninstall's "only allowed on confirm step" guard).
func TestCIInstallPrompt_escInertWhileRunning(t *testing.T) {
	m := promptOnCIInstall(t)
	m.ciInstallOverride = func() tea.Msg { return nil } // no-op; drive manually
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = updated.(AppModel)
	if cmd != nil {
		if _, quit := cmd().(tea.QuitMsg); quit {
			t.Fatal("Esc must not trigger tea.Quit while ci-install is in flight")
		}
	}
	if m.screen != ScreenCIInstallPrompt {
		t.Errorf("expected to remain on ScreenCIInstallPrompt (Esc inert while running), got %v", m.screen)
	}
}

// TestCIInstallPrompt_ciInstallDoneRoutesToScreenComplete verifies that after
// confirming, receiving ciInstallDoneMsg transitions to ScreenComplete (success
// or failure both land there, mirroring buildUpgradeCmd's pattern).
func TestCIInstallPrompt_ciInstallDoneRoutesToScreenComplete(t *testing.T) {
	m := promptOnCIInstall(t)
	m.ciInstallOverride = func() tea.Msg { return ciInstallDoneMsg{err: nil} }
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	updated, _ = m.Update(ciInstallDoneMsg{err: nil, generation: m.ciInstallGeneration})
	m = updated.(AppModel)
	if m.screen != ScreenComplete {
		t.Errorf("expected ScreenComplete after ciInstallDoneMsg, got %v", m.screen)
	}
}

// TestCIInstallPrompt_failureDoesNotCrashTUI verifies that a failed ci-install
// (npx missing / non-zero exit) surfaces an error on ScreenComplete instead of
// crashing — the TUI must remain responsive.
func TestCIInstallPrompt_failureDoesNotCrashTUI(t *testing.T) {
	m := promptOnCIInstall(t)
	m.ciInstallOverride = func() tea.Msg {
		return ciInstallDoneMsg{err: errors.New("npx: command not found")}
	}
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(AppModel)

	if cmd == nil {
		t.Fatal("expected non-nil cmd")
	}
	msg := cmd()
	// cmd is a tea.Batch; execute all sub-cmds to find ciInstallDoneMsg.
	var doneMsg tea.Msg
	if batch, ok := msg.(tea.BatchMsg); ok {
		for _, sub := range batch {
			if sub == nil {
				continue
			}
			if d, ok := sub().(ciInstallDoneMsg); ok {
				doneMsg = d
			}
		}
	} else {
		doneMsg = msg
	}
	done, ok := doneMsg.(ciInstallDoneMsg)
	if !ok {
		t.Fatalf("expected ciInstallDoneMsg, got %T", doneMsg)
	}
	if done.err == nil {
		t.Fatal("expected error on ciInstallDoneMsg")
	}

	updated, _ = m.Update(done)
	m = updated.(AppModel) // must not panic
	if m.screen != ScreenComplete {
		t.Errorf("expected ScreenComplete even on failure, got %v", m.screen)
	}
}
