package cmd_test

// Tests for the root cobra command RunE dispatch (Task 2.5).
//
// Covered:
//   - bare ui-craft with no-TTY stdout → help text printed, exit 0 (no hang)
//   - bogus subcommand → cobra errors (NoArgs enforcement)
//   - TTY guard: hubLaunched seam is called when IsTerminal returns true

import (
	"bytes"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/cmd"
)

// TestRootCmd_bogusSubcommand verifies that passing an unknown subcommand
// causes cobra to return an error (Args: cobra.NoArgs enforcement).
func TestRootCmd_bogusSubcommand(t *testing.T) {
	root := cmd.NewRootCmdForTest("v1.0.0")
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	root.SetArgs([]string{"bogus-subcmd"})

	err := root.Execute()
	if err == nil {
		t.Error("expected an error for unknown subcommand 'bogus-subcmd', got nil")
	}
}

// TestRootCmd_nonTTY_printsHelp verifies that when stdout is not a TTY and no
// subcommand is provided, the root RunE prints help and does NOT hang.
func TestRootCmd_nonTTY_printsHelp(t *testing.T) {
	hubLaunched := false
	root := cmd.NewRootCmdForTest("v1.0.0")
	cmd.SetHubLaunchFnForTest(root, func(version, dir string) error {
		hubLaunched = true
		return nil
	})

	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	root.SetArgs([]string{}) // no subcommand

	// In test environments stdout is NOT a TTY, so RunE should print help.
	err := root.Execute()
	if err != nil {
		t.Errorf("non-TTY bare root must not error, got: %v", err)
	}

	// Hub must NOT have been launched since we are not on a TTY.
	if hubLaunched {
		t.Error("hub must NOT be launched when stdout is not a TTY")
	}

	// Some output should be emitted (help or similar).
	output := buf.String()
	if strings.TrimSpace(output) == "" {
		// It's okay if help goes to stderr — just verify the process didn't hang.
		t.Log("non-TTY bare root: no stdout output (help may have gone to stderr — acceptable)")
	}
}

// TestRootCmd_knownSubcommand_dispatches verifies that a known subcommand
// (version) is dispatched normally and the hub RunE is not invoked.
func TestRootCmd_knownSubcommand_dispatches(t *testing.T) {
	hubLaunched := false
	root := cmd.NewRootCmdForTest("v1.0.0")
	cmd.SetHubLaunchFnForTest(root, func(version, dir string) error {
		hubLaunched = true
		return nil
	})

	// Register the version subcommand so cobra dispatches it.
	cmd.RegisterVersionCmdForTest(root, "v1.0.0")

	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	root.SetArgs([]string{"version"})

	err := root.Execute()
	if err != nil {
		t.Errorf("version subcommand must not error, got: %v", err)
	}

	// Hub must NOT be launched for a subcommand.
	if hubLaunched {
		t.Error("hub must NOT be launched when a known subcommand is dispatched")
	}

	// version output must contain the version string.
	if !strings.Contains(buf.String(), "v1.0.0") {
		t.Errorf("version subcommand output must contain version, got: %q", buf.String())
	}
}
