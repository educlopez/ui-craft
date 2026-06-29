package tui

import (
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// TestSplashInit_returnsNonNilCmd asserts that Init() returns a non-nil command.
func TestSplashInit_returnsNonNilCmd(t *testing.T) {
	m := NewSplashModel("test-version")
	cmd := m.Init()
	if cmd == nil {
		t.Fatal("Init() returned nil cmd; expected a non-nil tea.Cmd")
	}
}

// TestSplashInit_cmdDoesNotFireImmediately asserts that the command returned by
// Init() does NOT produce splashDoneMsg immediately (i.e. it has a dwell delay).
// We execute the cmd in a goroutine and assert it does not complete within a
// short deadline (50 ms) — if it were an instant func() tea.Msg it would finish
// well within that window; a real tea.Tick for 1500 ms will not.
func TestSplashInit_cmdDoesNotFireImmediately(t *testing.T) {
	m := NewSplashModel("test-version")
	cmd := m.Init()

	type result struct{ msg tea.Msg }
	ch := make(chan result, 1)
	go func() {
		ch <- result{msg: cmd()}
	}()

	select {
	case r := <-ch:
		// The command finished quickly — check if it returned splashDoneMsg.
		if _, ok := r.msg.(splashDoneMsg); ok {
			t.Fatal("Init() cmd fired splashDoneMsg immediately; expected a tick with a dwell delay (1500 ms)")
		}
		// Some other fast message type is unexpected too, but not a hard failure
		// for this specific assertion.
	case <-time.After(50 * time.Millisecond):
		// Good — cmd is still blocked after 50 ms, confirming it has a real delay.
		// We don't wait the full 1500 ms; this is sufficient for CI.
		t.Log("cmd did not complete within 50 ms — tick dwell confirmed")
	}
}

// TestSplashUpdate_keyMsgSkips asserts that any tea.KeyMsg delivered to
// Update sets done=true, implementing the keypress-skip behaviour.
func TestSplashUpdate_keyMsgSkips(t *testing.T) {
	m := NewSplashModel("test-version")
	if m.IsDone() {
		t.Fatal("model should not be done before any input")
	}

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	splash, ok := updated.(SplashModel)
	if !ok {
		t.Fatalf("Update returned unexpected type %T", updated)
	}
	if !splash.IsDone() {
		t.Fatal("IsDone() should be true after a tea.KeyMsg")
	}
}

// TestSplashUpdate_splashDoneMsg asserts that a splashDoneMsg sets done=true.
func TestSplashUpdate_splashDoneMsg(t *testing.T) {
	m := NewSplashModel("test-version")
	updated, cmd := m.Update(splashDoneMsg{})
	splash, ok := updated.(SplashModel)
	if !ok {
		t.Fatalf("Update returned unexpected type %T", updated)
	}
	if !splash.IsDone() {
		t.Fatal("IsDone() should be true after splashDoneMsg")
	}
	if cmd != nil {
		t.Fatalf("expected nil cmd after splashDoneMsg, got non-nil")
	}
}
