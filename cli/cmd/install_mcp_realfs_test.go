package cmd_test

// install_mcp_realfs_test.go — real-fs, end-to-end coverage for the
// "Malformed MCP JSON" scenario in the installer-hardening spec.
//
// Existing coverage before this file (confirmed by reading the source, not
// re-derived): filemerge.MergeJSONObjects has a unit-level malformed-base
// fallback test (internal/filemerge/json_test.go, TestMergeJSONObjects_malformedBase,
// falls back to {}), and harness/mcp_test.go exercises MalformedBase per-harness
// (TestWriteMCP_cursorMalformedBase, TestWriteMCP_geminiMalformedBase,
// TestWriteMCP_opencodeMalformedBase) against fsutil.MemFS via the harness's
// WriteMCP method directly. Neither test runs through the actual `ui-craft
// install` command (RunE, detect → plan → apply) against a real on-disk file.
// This file closes exactly that gap: net-new, not a duplicate.
import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/spf13/cobra"
)

// TestInstall_malformedMCPJSON_realFS_endToEnd verifies that when Claude
// Code's ~/.claude.json on disk contains invalid JSON, running `ui-craft
// install` end-to-end (through installCmd.RunE, real fsutil.OsFS{}, real
// HOME) refuses to touch it: the install fails, everything is rolled back and
// the file keeps its exact bytes. ~/.claude.json holds Claude Code's account
// and per-project state, so the MalformedBase "replace with {}" recovery the
// other harnesses use would destroy it.
func TestInstall_malformedMCPJSON_realFS_endToEnd(t *testing.T) {
	home := t.TempDir()
	// os.UserHomeDir reads %USERPROFILE% on Windows and $HOME everywhere else, so
	// setting only HOME leaves Windows pointed at the real user profile — these tests
	// were reading and writing the actual ui-craft install there.
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("APPDATA", filepath.Join(home, "AppData", "Roaming"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "AppData", "Local"))

	h := harness.ClaudeHarness{}
	mcpTarget := h.ConfigPaths().MCPConfig

	// Seed a real, on-disk, INVALID JSON MCP config file.
	if err := os.MkdirAll(filepath.Dir(mcpTarget), 0o755); err != nil {
		t.Fatalf("setup MkdirAll: %v", err)
	}
	malformed := []byte(`{not valid json, definitely broken`)
	if err := os.WriteFile(mcpTarget, malformed, 0o644); err != nil {
		t.Fatalf("setup WriteFile: %v", err)
	}

	// Restrict detection to claude only, real-fs, real install path.
	restoreDetect := cmd.SetDetectAllFn(func(reg []harness.Harness) []core.DetectedHarness {
		for _, hh := range reg {
			if hh.Name() == "claude" {
				return []core.DetectedHarness{{
					Harness: hh,
					Result:  harness.DetectResult{Installed: true, ConfigRoot: hh.ConfigPaths().SkillsDir},
				}}
			}
		}
		return nil
	})
	defer restoreDetect()

	restoreFlags := cmd.SetInstallFlagsForTest(cmd.InstallFlagsForTest{
		Harness: "claude",
		Yes:     true,
		Dir:     home,
		Quiet:   true,
	})
	defer restoreFlags()

	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.AddCommand(cmd.MakeInstallCmd())
	root.SetOut(new(discardWriter))
	root.SetErr(new(discardWriter))
	root.SetArgs([]string{"install"})

	err := root.Execute()
	if err == nil {
		t.Fatal("install must fail on a malformed ~/.claude.json, got nil error")
	}
	if !strings.Contains(err.Error(), "refusing to modify") || !strings.Contains(err.Error(), "rolled back") {
		t.Errorf("error should say the file was refused and the install rolled back, got: %v", err)
	}

	data, err := os.ReadFile(mcpTarget)
	if err != nil {
		t.Fatalf("~/.claude.json missing after a refused install: %v", err)
	}
	if !bytes.Equal(data, malformed) {
		t.Errorf("~/.claude.json was modified:\n got: %s\nwant: %s", data, malformed)
	}
	if _, statErr := os.Stat(filepath.Join(home, ".claude", "skills", "ui-craft", "SKILL.md")); statErr == nil {
		t.Error("skills were left behind: the failed install should have been rolled back")
	}
}

func TestInstallJSONPersistsState(t *testing.T) {
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
					Result: harness.DetectResult{
						Installed:  true,
						ConfigRoot: h.ConfigRoot(),
					},
				}}
			}
		}
		return nil
	})
	defer restoreDetect()

	restoreFlags := cmd.SetInstallFlagsForTest(cmd.InstallFlagsForTest{
		Harness: "claude",
		Yes:     true,
		Dir:     home,
		JSON:    true,
	})
	defer restoreFlags()

	var out bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.AddCommand(cmd.MakeInstallCmd())
	root.SetOut(&out)
	root.SetErr(&out)
	root.SetArgs([]string{"install"})

	if err := root.Execute(); err != nil {
		t.Fatalf("install --json: %v\noutput: %s", err, out.String())
	}

	var result map[string]any
	if err := json.Unmarshal(out.Bytes(), &result); err != nil {
		t.Fatalf("install --json emitted invalid JSON: %v\noutput: %s", err, out.String())
	}

	statePath := filepath.Join(home, ".ui-craft", "state.json")
	data, err := os.ReadFile(statePath)
	if err != nil {
		t.Fatalf("install --json did not persist state: %v", err)
	}
	var state core.InstallState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("persisted state is invalid JSON: %v", err)
	}
	if len(state.Harnesses) != 1 || state.Harnesses[0].Name != "claude" {
		t.Fatalf("persisted harnesses = %+v, want only claude", state.Harnesses)
	}
	if len(state.Harnesses[0].InstalledComponents) == 0 {
		t.Fatal("persisted claude state has no installed components")
	}
}

func TestInstallJSONStateWarningStaysOnStderr(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("APPDATA", filepath.Join(home, "AppData", "Roaming"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "AppData", "Local"))

	// A regular file at the state-root path makes SaveState fail without
	// interfering with the selected MCP-only install target.
	if err := os.WriteFile(filepath.Join(home, ".ui-craft"), []byte("not a directory"), 0o644); err != nil {
		t.Fatalf("seed invalid state root: %v", err)
	}

	restoreDetect := cmd.SetDetectAllFn(func(reg []harness.Harness) []core.DetectedHarness {
		for _, h := range reg {
			if h.Name() == "claude" {
				return []core.DetectedHarness{{
					Harness: h,
					Result: harness.DetectResult{
						Installed:  true,
						ConfigRoot: h.ConfigRoot(),
					},
				}}
			}
		}
		return nil
	})
	defer restoreDetect()

	restoreFlags := cmd.SetInstallFlagsForTest(cmd.InstallFlagsForTest{
		Harness:    "claude",
		Components: []string{"mcp-gates"},
		Yes:        true,
		Dir:        home,
		JSON:       true,
	})
	defer restoreFlags()

	var stdout, stderr bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.AddCommand(cmd.MakeInstallCmd())
	root.SetOut(&stdout)
	root.SetErr(&stderr)
	root.SetArgs([]string{"install"})

	if err := root.Execute(); err != nil {
		t.Fatalf("install --json: %v\nstdout: %s\nstderr: %s", err, stdout.String(), stderr.String())
	}

	var result map[string]any
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		t.Fatalf("stdout must remain valid JSON: %v\nstdout: %s\nstderr: %s", err, stdout.String(), stderr.String())
	}
	if strings.Contains(stdout.String(), "could not save state.json") {
		t.Fatalf("state warning leaked into JSON stdout: %s", stdout.String())
	}
	if !strings.Contains(stderr.String(), "warning: could not save state.json") {
		t.Fatalf("expected state warning on stderr, got: %s", stderr.String())
	}
}

// discardWriter is a minimal io.Writer that discards everything, used to
// keep this test's cobra output out of the test log.
type discardWriter struct{}

func (discardWriter) Write(p []byte) (int, error) { return len(p), nil }

// An OpenCode config with comments is left untouched and the user is told what to
// add. That is not an install: --json must say "manual-action-needed" and carry
// the notice, and state.json must not record mcp-gates (or `update` would treat a
// server that is not configured as installed).
func TestInstallJSON_commentedOpenCodeConfigIsManualAction(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("APPDATA", filepath.Join(home, "AppData", "Roaming"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "AppData", "Local"))

	cfgDir := filepath.Join(home, ".config", "opencode")
	if err := os.MkdirAll(cfgDir, 0o755); err != nil {
		t.Fatal(err)
	}
	jsonc := []byte("{\n  // my servers\n  \"mcp\": {}\n}\n")
	cfg := filepath.Join(cfgDir, "opencode.jsonc")
	if err := os.WriteFile(cfg, jsonc, 0o644); err != nil {
		t.Fatal(err)
	}
	// An earlier run recorded mcp-gates (and skill+commands) for OpenCode; the
	// config was since replaced by a commented .jsonc without the entry.
	prior := &core.InstallState{Harnesses: []core.HarnessState{{
		Name:                "opencode",
		InstalledComponents: []string{"skill+commands", "mcp-gates"},
	}}}
	if err := core.SaveState(fsutil.OsFS{}, filepath.Join(home, ".ui-craft"), prior); err != nil {
		t.Fatal(err)
	}

	restoreDetect := cmd.SetDetectAllFn(func(reg []harness.Harness) []core.DetectedHarness {
		for _, h := range reg {
			if h.Name() == "opencode" {
				return []core.DetectedHarness{{
					Harness: h,
					Result:  harness.DetectResult{Installed: true, ConfigRoot: h.ConfigRoot()},
				}}
			}
		}
		return nil
	})
	defer restoreDetect()

	restoreFlags := cmd.SetInstallFlagsForTest(cmd.InstallFlagsForTest{
		Harness:    "opencode",
		Components: []string{"mcp-gates"},
		Yes:        true,
		Dir:        home,
		JSON:       true,
	})
	defer restoreFlags()

	var out, errOut bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.AddCommand(cmd.MakeInstallCmd())
	root.SetOut(&out)
	root.SetErr(&errOut)
	root.SetArgs([]string{"install"})
	if err := root.Execute(); err != nil {
		t.Fatalf("install --json: %v\nstdout: %s\nstderr: %s", err, out.String(), errOut.String())
	}

	var res struct {
		Targets []struct {
			Component string `json:"component"`
			Status    string `json:"status"`
			Notice    string `json:"notice"`
		} `json:"targets"`
	}
	if err := json.Unmarshal(out.Bytes(), &res); err != nil {
		t.Fatalf("invalid JSON: %v\n%s", err, out.String())
	}
	found := false
	for _, tg := range res.Targets {
		if tg.Component != "mcp-gates" {
			continue
		}
		found = true
		if tg.Status != "manual-action-needed" {
			t.Errorf("status = %q, want manual-action-needed", tg.Status)
		}
		if !strings.Contains(tg.Notice, "ui-craft-mcp@") {
			t.Errorf("notice must carry the entry to add, got %q", tg.Notice)
		}
	}
	if !found {
		t.Fatalf("no mcp-gates target in %s", out.String())
	}

	if got, _ := os.ReadFile(cfg); !bytes.Equal(got, jsonc) {
		t.Errorf("commented opencode.jsonc was rewritten:\n%s", got)
	}
	if _, err := os.Stat(filepath.Join(cfgDir, "opencode.json")); err == nil {
		t.Error("a second config, opencode.json, was created next to opencode.jsonc")
	}
	if data, err := os.ReadFile(filepath.Join(home, ".ui-craft", "state.json")); err == nil {
		var state core.InstallState
		if err := json.Unmarshal(data, &state); err != nil {
			t.Fatal(err)
		}
		keptSkills := false
		for _, h := range state.Harnesses {
			for _, c := range h.InstalledComponents {
				if h.Name == "opencode" && c == "mcp-gates" {
					t.Error("state.json still records opencode mcp-gates although it now needs manual action")
				}
				if h.Name == "opencode" && c == "skill+commands" {
					keptSkills = true
				}
			}
		}
		if !keptSkills {
			t.Error("an unrelated component (skill+commands) was dropped from state.json")
		}
	} else {
		t.Fatalf("state.json not written: %v", err)
	}
}

// A config root moved outside HOME by an env var is outside the backup store's
// trust boundary, so rollback cannot restore it. Install must say so, on
// stderr, keeping --json stdout parseable.
func TestInstall_configRootOutsideHomeWarns(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("APPDATA", filepath.Join(home, "AppData", "Roaming"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "AppData", "Local"))
	codexHome := t.TempDir() // a sibling of home, not inside it
	t.Setenv("CODEX_HOME", codexHome)

	restoreDetect := cmd.SetDetectAllFn(func(reg []harness.Harness) []core.DetectedHarness {
		for _, h := range reg {
			if h.Name() == "codex" {
				return []core.DetectedHarness{{
					Harness: h,
					Result:  harness.DetectResult{Installed: true, ConfigRoot: h.ConfigRoot()},
				}}
			}
		}
		return nil
	})
	defer restoreDetect()

	restoreFlags := cmd.SetInstallFlagsForTest(cmd.InstallFlagsForTest{
		Harness:    "codex",
		Components: []string{"mcp-gates"},
		Yes:        true,
		Dir:        home,
		JSON:       true,
	})
	defer restoreFlags()

	var out, errOut bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.AddCommand(cmd.MakeInstallCmd())
	root.SetOut(&out)
	root.SetErr(&errOut)
	root.SetArgs([]string{"install"})
	_ = root.Execute() // the outcome of the write itself is not under test here

	if !strings.Contains(errOut.String(), "outside your home folder; rollback cannot restore") {
		t.Errorf("no outside-HOME warning on stderr:\nstderr: %s\nstdout: %s", errOut.String(), out.String())
	}
	if strings.Contains(out.String(), "NOTE:") {
		t.Errorf("warning leaked into --json stdout: %s", out.String())
	}
}
