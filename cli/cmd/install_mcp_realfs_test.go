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
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/spf13/cobra"
)

// TestInstall_malformedMCPJSON_realFS_endToEnd verifies that when a real MCP
// config file on disk contains invalid JSON, running `ui-craft install`
// end-to-end (through installCmd.RunE, real fsutil.OsFS{}, real HOME) does
// NOT crash or silently corrupt/truncate the file. It must fall back to the
// same MalformedBase recovery semantics already unit-tested in filemerge and
// harness, but proven here against a real file via the real command.
func TestInstall_malformedMCPJSON_realFS_endToEnd(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

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
	if err != nil {
		t.Fatalf("install must not error on a malformed MCP config, got: %v", err)
	}

	// The file must still exist, be readable, and be VALID JSON afterward —
	// not truncated/corrupted garbage. This is the MalformedBase fallback
	// (falls back to {}, then merges ui-craft's own key in) already proven
	// at the unit level; here we confirm it holds end-to-end on real disk.
	data, err := os.ReadFile(mcpTarget)
	if err != nil {
		t.Fatalf("MCP config file missing after install: %v", err)
	}
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("MCP config file is not valid JSON after install (corrupted): %v\ncontent: %s", err, data)
	}
}

// discardWriter is a minimal io.Writer that discards everything, used to
// keep this test's cobra output out of the test log.
type discardWriter struct{}

func (discardWriter) Write(p []byte) (int, error) { return len(p), nil }
