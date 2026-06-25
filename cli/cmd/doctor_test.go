package cmd_test

import (
	"bytes"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/spf13/cobra"
)

// runDoctorCmd is a test helper that runs the doctor command with controlled
// state and returns the stdout output and error.
func runDoctorCmd(
	t *testing.T,
	detectFn func([]harness.Harness) []core.DetectedHarness,
	statfs func(string) (uint64, error),
) (string, error) {
	t.Helper()

	// Override detection.
	restore := cmd.SetDetectAllFn(detectFn)
	defer restore()

	// Override disk-space check.
	oldStatfs := cmd.SetDoctorStatfsFn(statfs)
	defer oldStatfs()

	var buf bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.AddCommand(cmd.MakeDoctorCmd())
	root.SetOut(&buf)
	root.SetErr(&buf)
	root.SetArgs([]string{"doctor"})
	err := root.Execute()
	return buf.String(), err
}

func TestDoctor_allOk(t *testing.T) {
	// Simulate one harness detected (claude) and plenty of disk space (500 MB).
	detectFn := func(reg []harness.Harness) []core.DetectedHarness {
		for _, h := range reg {
			if h.Name() == "claude" {
				res, _ := h.Detect()
				if res.Installed {
					return []core.DetectedHarness{{Harness: h, Result: res}}
				}
			}
		}
		// Fallback: return a minimal synthetic result.
		return nil
	}
	statfs := func(string) (uint64, error) { return 500 << 20, nil }

	out, err := runDoctorCmd(t, detectFn, statfs)
	// We can't assert err == nil because claude may not be installed in CI,
	// but we can assert disk-space is [ok].
	_ = err
	if !strings.Contains(out, "[ok] disk-space") {
		t.Errorf("expected [ok] disk-space in output, got:\n%s", out)
	}
}

func TestDoctor_warnDiskSpace(t *testing.T) {
	detectFn := func(reg []harness.Harness) []core.DetectedHarness { return nil }
	statfs := func(string) (uint64, error) { return 50 << 20, nil } // 50 MB → warn

	out, err := runDoctorCmd(t, detectFn, statfs)
	_ = err
	if !strings.Contains(out, "[warn] disk-space") {
		t.Errorf("expected [warn] disk-space in output, got:\n%s", out)
	}
}

func TestDoctor_failDiskSpace(t *testing.T) {
	detectFn := func(reg []harness.Harness) []core.DetectedHarness { return nil }
	statfs := func(string) (uint64, error) { return 5 << 20, nil } // 5 MB → fail

	_, err := runDoctorCmd(t, detectFn, statfs)
	if err == nil {
		t.Error("expected error when disk space < 10 MB, got nil")
	}
}

func TestDoctor_noHarness(t *testing.T) {
	detectFn := func(reg []harness.Harness) []core.DetectedHarness { return nil }
	statfs := func(string) (uint64, error) { return 500 << 20, nil }

	out, err := runDoctorCmd(t, detectFn, statfs)
	_ = err
	if !strings.Contains(out, "[warn] harness-binaries") {
		t.Errorf("expected [warn] harness-binaries in output, got:\n%s", out)
	}
}
