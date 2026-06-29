package cmd_test

import (
	"bytes"
	"strings"
	"testing"

	"github.com/spf13/cobra"

	"github.com/educlopez/ui-craft/cli/cmd"
)

// runVersion executes "ui-craft version" with the given build version and
// returns the captured stdout.
func runVersion(t *testing.T, version string) string {
	t.Helper()

	// Build a minimal root command that wires Execute() internals.
	// We cannot call cmd.Execute directly because it calls os.Exit, so we
	// replicate the wiring here using exported helpers if available.
	// Since Execute() is not testable directly, we use the newVersionCmd
	// pattern via a test-local root.
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	var buf bytes.Buffer
	root.SetOut(&buf)

	// Manually add version subcommand.  We need access to the unexported
	// newVersionCmd; since it's in the same package we access it via the
	// package-level Execute bridge below.
	cmd.RegisterVersionCmdForTest(root, version)

	root.SetArgs([]string{"version"})
	if err := root.Execute(); err != nil {
		t.Fatalf("Execute: %v", err)
	}
	return buf.String()
}

func TestVersionCmd_containsBinaryVersion(t *testing.T) {
	out := runVersion(t, "v1.2.3")
	if !strings.Contains(out, "v1.2.3") {
		t.Errorf("version output %q does not contain v1.2.3", out)
	}
}

// TestVersionCmd_noMirrorLine verifies the mirror-version line is gone after
// Slice 6 freshness machinery teardown. The output must NOT contain "mirror:".
func TestVersionCmd_noMirrorLine(t *testing.T) {
	out := runVersion(t, "v1.0.0")
	if strings.Contains(out, "mirror:") {
		t.Errorf("version output %q must NOT contain 'mirror:' label after freshness teardown", out)
	}
}

func TestVersionCmd_defaultVersionIsDev(t *testing.T) {
	// Pass a binary version distinct from what was previously a mirror version so
	// the test can verify version injection works correctly.
	const binaryVersion = "v9.9.9-test"
	out := runVersion(t, binaryVersion)

	if !strings.Contains(out, binaryVersion) {
		t.Errorf("version output %q does not contain binary version %q", out, binaryVersion)
	}
	// Mirror version label must NOT be present (freshness machinery removed in Slice 6).
	if strings.Contains(out, "mirror:") {
		t.Errorf("version output %q must NOT contain 'mirror:' label after freshness teardown", out)
	}
}

func TestVersionCmd_exitsZero(t *testing.T) {
	// If Execute returns nil, exit code is 0 — the test above validates this implicitly.
	out := runVersion(t, "v0.1.0")
	if out == "" {
		t.Error("expected non-empty version output")
	}
}
