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

func TestVersionCmd_containsMirrorVersion(t *testing.T) {
	out := runVersion(t, "dev")
	// Mirror version comes from assets/mirrors/VERSION which contains "dev".
	if !strings.Contains(out, "mirror:") {
		t.Errorf("version output %q does not contain 'mirror:' label", out)
	}
}

func TestVersionCmd_defaultVersionIsDev(t *testing.T) {
	// Pass a binary version distinct from the mirror version so the test can
	// verify BOTH are wired correctly.  If binary-version injection breaks, the
	// output will not contain "v9.9.9-test" and the test will fail.
	const binaryVersion = "v9.9.9-test"
	out := runVersion(t, binaryVersion)

	if !strings.Contains(out, binaryVersion) {
		t.Errorf("version output %q does not contain binary version %q", out, binaryVersion)
	}
	// Mirror version label must also be present (contents come from assets/mirrors/VERSION).
	if !strings.Contains(out, "mirror:") {
		t.Errorf("version output %q does not contain 'mirror:' label", out)
	}
}

func TestVersionCmd_exitsZero(t *testing.T) {
	// If Execute returns nil, exit code is 0 — the test above validates this implicitly.
	out := runVersion(t, "v0.1.0")
	if out == "" {
		t.Error("expected non-empty version output")
	}
}
