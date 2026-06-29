package core

import (
	"errors"
	"io/fs"
	"testing"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// stubHarness is an in-test Harness that lets the test control Detect() output.
type stubHarness struct {
	name      string
	installed bool
	failWith  error
}

func (s stubHarness) Name() string { return s.name }

func (s stubHarness) Detect() (harness.DetectResult, error) {
	if s.failWith != nil {
		return harness.DetectResult{}, s.failWith
	}
	return harness.DetectResult{
		Installed:  s.installed,
		ConfigRoot: "/fake/" + s.name,
	}, nil
}

func (s stubHarness) ConfigPaths() harness.ConfigPaths {
	return harness.ConfigPaths{
		MCPConfig: "/fake/" + s.name + "/mcp.json",
		SkillsDir: "/fake/" + s.name + "/skills",
	}
}

func (s stubHarness) Supports(c component.Component) bool { return true }

func (s stubHarness) ConfigRoot() string { return "/fake/" + s.name }

func (s stubHarness) WriteMCP(w fsutil.FileSystem, srv harness.MCPServer) (harness.Change, error) {
	return harness.Change{}, harness.ErrNotImplemented
}

func (s stubHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (harness.Change, error) {
	return harness.Change{}, harness.ErrNotImplemented
}

func (s stubHarness) WriteAgents(w fsutil.FileSystem, agentsFS fs.FS) ([]harness.Change, error) {
	return nil, harness.ErrNotImplemented
}
func (s stubHarness) WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]harness.Change, error) {
	return nil, harness.ErrUnsupported
}

// TestDetect_allPresent asserts that Detect returns all installed harnesses.
func TestDetect_allPresent(t *testing.T) {
	reg := []harness.Harness{
		stubHarness{name: "claude", installed: true},
		stubHarness{name: "cursor", installed: true},
		stubHarness{name: "codex", installed: true},
	}
	got, err := Detect(reg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3 detected harnesses, got %d", len(got))
	}
}

// TestDetect_nonePresent asserts that Detect returns an empty slice when
// no harness is installed.
func TestDetect_nonePresent(t *testing.T) {
	reg := []harness.Harness{
		stubHarness{name: "claude", installed: false},
		stubHarness{name: "cursor", installed: false},
	}
	got, err := Detect(reg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected 0 detected harnesses, got %d", len(got))
	}
}

// TestDetect_partiallyPresent asserts that only installed harnesses are returned.
func TestDetect_partiallyPresent(t *testing.T) {
	reg := []harness.Harness{
		stubHarness{name: "claude", installed: true},
		stubHarness{name: "cursor", installed: false},
		stubHarness{name: "opencode", installed: true},
	}
	got, err := Detect(reg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 detected harnesses, got %d", len(got))
	}
	if got[0].Harness.Name() != "claude" {
		t.Errorf("first detected harness should be claude, got %s", got[0].Harness.Name())
	}
	if got[1].Harness.Name() != "opencode" {
		t.Errorf("second detected harness should be opencode, got %s", got[1].Harness.Name())
	}
}

// TestDetect_errorBubbles asserts that a Detect error for any harness is
// propagated immediately and stops detection.
func TestDetect_errorBubbles(t *testing.T) {
	sentinel := errors.New("detection failure")
	reg := []harness.Harness{
		stubHarness{name: "claude", installed: true},
		stubHarness{name: "cursor", failWith: sentinel},
	}
	_, err := Detect(reg)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected sentinel error, got: %v", err)
	}
}

// TestDetectAll_ignoresErrors asserts that DetectAll never returns an error
// even when a harness's Detect() fails.
func TestDetectAll_ignoresErrors(t *testing.T) {
	reg := []harness.Harness{
		stubHarness{name: "claude", installed: true},
		stubHarness{name: "cursor", failWith: errors.New("cursor crashed")},
		stubHarness{name: "opencode", installed: true},
	}
	got := DetectAll(reg)
	// Cursor's error is swallowed; claude and opencode should still appear.
	if len(got) != 2 {
		t.Fatalf("expected 2 harnesses from DetectAll, got %d", len(got))
	}
}
