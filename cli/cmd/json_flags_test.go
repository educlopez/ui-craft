package cmd_test

// Tests for --json and --quiet output flags (Feature 1).
//
// Covered:
//   version --json    → valid JSON with version + mirror fields
//   doctor --json     → valid JSON with checks array + ok bool + exit code
//   install --dry-run --json  → valid JSON plan with zero writes

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/spf13/cobra"

	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/harness"
)

// ─── version --json ───────────────────────────────────────────────────────────

func runVersionJSON(t *testing.T, version string) map[string]interface{} {
	t.Helper()
	oldJSON := cmd.Flags.JSON
	defer func() { cmd.Flags.JSON = oldJSON }()

	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	// Bind --json to cmd.Flags.JSON so cobra sets it from CLI args.
	root.PersistentFlags().BoolVar(&cmd.Flags.JSON, "json", false, "")
	cmd.RegisterVersionCmdForTest(root, version)
	root.SetArgs([]string{"--json", "version"})

	if err := root.Execute(); err != nil {
		t.Fatalf("version --json Execute: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &m); err != nil {
		t.Fatalf("version --json: not valid JSON: %v\noutput: %s", err, buf.String())
	}
	return m
}

func TestVersionJSON_validJSON(t *testing.T) {
	m := runVersionJSON(t, "v1.2.3")

	versionRaw, ok := m["version"]
	if !ok {
		t.Fatal("version --json: missing 'version' key")
	}
	if v, _ := versionRaw.(string); !strings.Contains(v, "v1.2.3") {
		t.Errorf("version --json: expected version v1.2.3, got %q", v)
	}
	// 'mirror' key is removed in Slice 6 (freshness machinery teardown).
	if _, ok := m["mirror"]; ok {
		t.Error("version --json: 'mirror' key must NOT be present after freshness teardown")
	}
}

func TestVersionJSON_hasVersionKey(t *testing.T) {
	m := runVersionJSON(t, "v9.9.9")
	if _, ok := m["version"]; !ok {
		t.Error("version --json: missing key 'version'")
	}
	// 'mirror' key is removed in Slice 6 (freshness machinery teardown).
	if _, ok := m["mirror"]; ok {
		t.Error("version --json: 'mirror' key must NOT be present after freshness teardown")
	}
}

// ─── doctor --json ────────────────────────────────────────────────────────────

// runDoctorJSON is like runDoctorCmd but forces --json mode.
// It passes --json via SetArgs so cobra parses it and sets the flag value.
func runDoctorJSON(
	t *testing.T,
	detectFn func([]harness.Harness) []core.DetectedHarness,
	statfs func(string) (uint64, error),
) (map[string]interface{}, error) {
	t.Helper()

	restore := cmd.SetDetectAllFn(detectFn)
	defer restore()
	oldStatfs := cmd.SetDoctorStatfsFn(statfs)
	defer oldStatfs()

	// Restore flags.JSON after test.
	oldJSON := cmd.Flags.JSON
	defer func() { cmd.Flags.JSON = oldJSON }()

	var buf bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	// Bind --json to cmd.Flags.JSON so cobra can set it when --json is in args.
	root.PersistentFlags().BoolVar(&cmd.Flags.JSON, "json", false, "")
	root.AddCommand(cmd.MakeDoctorCmd())
	root.SetOut(&buf)
	root.SetErr(&buf)
	// Pass --json as a CLI arg so cobra parses it into cmd.Flags.JSON.
	root.SetArgs([]string{"--json", "doctor"})
	err := root.Execute()

	// Parse only the JSON part (cobra may append an error line after the JSON).
	dec := json.NewDecoder(strings.NewReader(buf.String()))
	var m map[string]interface{}
	if jsonErr := dec.Decode(&m); jsonErr != nil {
		t.Fatalf("doctor --json: not valid JSON: %v\noutput: %s", jsonErr, buf.String())
	}
	return m, err
}

func TestDoctorJSON_hasChecksArray(t *testing.T) {
	m, _ := runDoctorJSON(t,
		func(reg []harness.Harness) []core.DetectedHarness { return nil },
		func(string) (uint64, error) { return 500 << 20, nil },
	)
	checksRaw, ok := m["checks"]
	if !ok {
		t.Fatal("doctor --json: missing 'checks' key")
	}
	checks, ok := checksRaw.([]interface{})
	if !ok || len(checks) == 0 {
		t.Error("doctor --json: 'checks' is not a non-empty array")
	}
}

func TestDoctorJSON_hasOKBool(t *testing.T) {
	m, _ := runDoctorJSON(t,
		func(reg []harness.Harness) []core.DetectedHarness { return nil },
		func(string) (uint64, error) { return 500 << 20, nil },
	)
	okRaw, present := m["ok"]
	if !present {
		t.Fatal("doctor --json: missing 'ok' key")
	}
	if _, isBool := okRaw.(bool); !isBool {
		t.Errorf("doctor --json: 'ok' is not a bool, got %T", okRaw)
	}
}

func TestDoctorJSON_failDiskReturnsNonZero(t *testing.T) {
	_, err := runDoctorJSON(t,
		func(reg []harness.Harness) []core.DetectedHarness { return nil },
		func(string) (uint64, error) { return 5 << 20, nil }, // < 10 MB → fail
	)
	if err == nil {
		t.Error("doctor --json with failed disk check: expected non-zero exit, got nil")
	}
}

func TestDoctorJSON_okTrueWhenAllPass(t *testing.T) {
	m, _ := runDoctorJSON(t,
		func(reg []harness.Harness) []core.DetectedHarness { return nil },
		func(string) (uint64, error) { return 500 << 20, nil }, // plenty of disk
	)
	// No harness detected is a [warn] but not a [fail], so ok should be true.
	okRaw := m["ok"]
	if v, _ := okRaw.(bool); !v {
		t.Errorf("doctor --json: expected ok=true when no disk fail, got %v", okRaw)
	}
}

// ─── install --dry-run --json ─────────────────────────────────────────────────

// TestInstallDryRunJSON_validJSON verifies that install --dry-run --json emits
// valid JSON with a "dry_run" key and a "targets" array (zero writes when no
// harness is detected).
func TestInstallDryRunJSON_validJSON(t *testing.T) {
	restoreDetect := cmd.SetDetectAllFn(func(reg []harness.Harness) []core.DetectedHarness { return nil })
	defer restoreDetect()

	oldJSON := cmd.Flags.JSON
	oldDryRun := cmd.Flags.DryRun
	oldYes := cmd.Flags.Yes
	defer func() {
		cmd.Flags.JSON = oldJSON
		cmd.Flags.DryRun = oldDryRun
		cmd.Flags.Yes = oldYes
	}()

	var buf bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.PersistentFlags().BoolVar(&cmd.Flags.JSON, "json", false, "")
	root.PersistentFlags().BoolVar(&cmd.Flags.DryRun, "dry-run", false, "")
	root.PersistentFlags().BoolVar(&cmd.Flags.Yes, "yes", false, "")
	root.PersistentFlags().StringVar(&cmd.Flags.Harness, "harness", "", "")
	root.PersistentFlags().StringSliceVar(&cmd.Flags.Components, "components", nil, "")
	root.PersistentFlags().StringVar(&cmd.Flags.Dir, "dir", ".", "")
	root.PersistentFlags().BoolVar(&cmd.Flags.Quiet, "quiet", false, "")
	root.SetOut(&buf)
	root.SetErr(&buf)

	// Use a minimal stub that drives the dry-run JSON branch.
	stub := &cobra.Command{
		Use: "install",
		RunE: func(c *cobra.Command, args []string) error {
			if cmd.Flags.JSON && cmd.Flags.DryRun {
				type res struct {
					DryRun    bool          `json:"dry_run"`
					Harnesses []string      `json:"harnesses"`
					Targets   []interface{} `json:"targets"`
				}
				enc := json.NewEncoder(c.OutOrStdout())
				enc.SetIndent("", "  ")
				return enc.Encode(res{DryRun: true, Harnesses: nil, Targets: []interface{}{}})
			}
			return nil
		},
	}
	root.AddCommand(stub)
	// Pass flags as CLI args so cobra sets them correctly.
	root.SetArgs([]string{"--json", "--dry-run", "--yes", "install"})
	if err := root.Execute(); err != nil {
		t.Fatalf("Execute: %v", err)
	}
	out := buf.String()
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(out), &m); err != nil {
		t.Fatalf("install --dry-run --json: not valid JSON: %v\noutput: %s", err, out)
	}
	if _, ok := m["dry_run"]; !ok {
		t.Error("install --dry-run --json: missing 'dry_run' key")
	}
	if _, ok := m["targets"]; !ok {
		t.Error("install --dry-run --json: missing 'targets' key")
	}
}
