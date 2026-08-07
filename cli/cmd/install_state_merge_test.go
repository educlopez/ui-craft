package cmd_test

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/spf13/cobra"

	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/harness"
)

// TestInstall_componentScopedRunKeepsEarlierComponentsInState covers a state bug with a
// delayed and silent consequence.
//
// install recorded installedComponents from the changes of the run that was happening. A run
// scoped with --components applies only those, so the entry was rewritten to just them and
// every component installed earlier disappeared from state while its files stayed on disk.
//
// Nothing breaks at that moment, which is why it went unnoticed. `update` is what reads this
// list: it skips anything absent with "not in saved state — skipping". So one
// `install --components mcp-gates` quietly stops `update` from ever refreshing
// skill+commands again — and that is how a real machine kept shipping skill files with
// frontmatter that a fix had already been released for.
//
// update.go merges for exactly this reason, with the comment "update does not un-install the
// components it didn't touch". install now follows the same rule: only uninstall removes.
func TestInstall_componentScopedRunKeepsEarlierComponentsInState(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("APPDATA", filepath.Join(home, "AppData", "Roaming"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "AppData", "Local"))

	restoreDetect := cmd.SetDetectAllFn(func(reg []harness.Harness) []core.DetectedHarness {
		for _, h := range reg {
			if h.Name() == "claude" {
				return []core.DetectedHarness{{
					Harness: h,
					Result:  harness.DetectResult{Installed: true, ConfigRoot: h.ConfigRoot()},
				}}
			}
		}
		return nil
	})
	defer restoreDetect()

	runInstall := func(t *testing.T, components []string) {
		t.Helper()
		restoreFlags := cmd.SetInstallFlagsForTest(cmd.InstallFlagsForTest{
			Harness:    "claude",
			Components: components,
			Yes:        true,
			Dir:        home,
			JSON:       true,
		})
		defer restoreFlags()

		var out bytes.Buffer
		root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
		root.AddCommand(cmd.MakeInstallCmd())
		root.SetOut(&out)
		root.SetErr(&out)
		root.SetArgs([]string{"install"})
		if err := root.Execute(); err != nil {
			t.Fatalf("install %v: %v\noutput: %s", components, err, out.String())
		}
	}

	readComponents := func(t *testing.T) []string {
		t.Helper()
		raw, err := os.ReadFile(filepath.Join(home, ".ui-craft", "state.json"))
		if err != nil {
			t.Fatalf("read state.json: %v", err)
		}
		var state struct {
			Harnesses []struct {
				Name                string   `json:"name"`
				InstalledComponents []string `json:"installedComponents"`
			} `json:"harnesses"`
		}
		if err := json.Unmarshal(raw, &state); err != nil {
			t.Fatalf("state.json is not valid JSON: %v\n%s", err, raw)
		}
		for _, h := range state.Harnesses {
			if h.Name == "claude" {
				return h.InstalledComponents
			}
		}
		t.Fatalf("state.json records no claude harness:\n%s", raw)
		return nil
	}

	runInstall(t, []string{"skill+commands"})
	first := readComponents(t)
	if !slices.Contains(first, "skill+commands") {
		t.Fatalf("first install did not record skill+commands; got %v — the test proves nothing", first)
	}

	// A second, narrower run. It must add, not replace.
	runInstall(t, []string{"mcp-gates"})
	after := readComponents(t)

	if !slices.Contains(after, "mcp-gates") {
		t.Errorf("state lost the component the second run installed; got %v", after)
	}
	if !slices.Contains(after, "skill+commands") {
		t.Errorf("installing mcp-gates erased skill+commands from state; got %v.\n"+
			"Its files are still on disk, so nothing looks wrong — but update reads this list "+
			"and will skip skill+commands from here on.", after)
	}
}
