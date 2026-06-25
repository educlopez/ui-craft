package cmd

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/spf13/cobra"
)

// supportedHarnessNames lists every harness by name for user-facing messages.
var supportedHarnessNames = []string{"claude", "cursor", "codex", "gemini", "opencode"}

// installCmd implements the detect → plan → apply pipeline.
// Slice 2: detect harnesses and print results; plan/apply wired in later slices.
var installCmd = &cobra.Command{
	Use:          "install",
	Short:        "Install ui-craft components into detected AI coding harnesses",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		out := cmd.OutOrStdout()

		// DetectAll is best-effort: one harness erroring does not abort the rest.
		// This is a conscious policy: install must be resilient to partial failures.
		detected := core.DetectAll(harness.All())

		if len(detected) == 0 {
			fmt.Fprintln(out, "No supported AI coding harness detected.")
			fmt.Fprintf(out, "Supported harnesses: %s\n", strings.Join(supportedHarnessNames, ", "))
			fmt.Fprintln(out, "Install one of the above tools and re-run `ui-craft install`.")
			return fmt.Errorf("no harness detected")
		}

		fmt.Fprintln(out, "Detected harnesses:")
		for _, dh := range detected {
			paths := dh.Harness.ConfigPaths()
			fmt.Fprintf(out, "  %s\n", dh.Harness.Name())
			fmt.Fprintf(out, "    config root: %s\n", dh.Result.ConfigRoot)
			fmt.Fprintf(out, "    mcp config:  %s\n", paths.MCPConfig)
			fmt.Fprintf(out, "    skills dir:  %s\n", paths.SkillsDir)

			// Print per-component support.
			var supported, skipped []string
			for _, c := range component.All() {
				if dh.Harness.Supports(c) {
					supported = append(supported, c.String())
				} else {
					skipped = append(skipped, c.String())
				}
			}
			if len(supported) > 0 {
				fmt.Fprintf(out, "    supports:    %s\n", strings.Join(supported, ", "))
			}
			if len(skipped) > 0 {
				fmt.Fprintf(out, "    skipped:     %s (not supported by this harness)\n", strings.Join(skipped, ", "))
			}
		}

		// Build plan for all components, wiring MCP ops (Slice 4).
		selected := component.All()
		osfs := fsutil.OsFS{}
		plan := core.Plan(detected, selected, osfs)

		// Backup store root: ~/.ui-craft-backups
		home, _ := os.UserHomeDir()
		backupRoot := filepath.Join(home, ".ui-craft-backups")
		backupStore := backup.NewStore(backupRoot, osfs, nil) // nil clock = time.Now

		// Execute transactional apply.
		result, applyErr := core.Apply(plan, osfs, backupStore, cmdVersion)
		if applyErr != nil {
			return fmt.Errorf("install: apply failed (all changes rolled back): %w", applyErr)
		}

		// Report MCP results.
		fmt.Fprintln(out, "\nMCP wiring results:")
		for _, t := range plan.Targets {
			if t.Component != component.MCPGates {
				continue
			}
			if t.Skip {
				fmt.Fprintf(out, "  %s/mcp-gates: skipped (%s)\n", t.Harness.Name(), t.SkipReason)
				continue
			}
			// Determine if the file was already configured (no change) or newly written.
			status := "configured"
			for _, ch := range result.Changes {
				if ch.FilePath == t.SnapPath {
					// When PriorBytes equals the current file content, nothing changed.
					current, _ := osfs.ReadFile(ch.FilePath)
					if ch.ExistedBefore && bytes.Equal(ch.PriorBytes, current) {
						status = "already configured"
					}
					break
				}
			}
			fmt.Fprintf(out, "  %s/mcp-gates: %s\n", t.Harness.Name(), status)
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(installCmd)
}
