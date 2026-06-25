package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/spf13/cobra"
)

var updateCmd = &cobra.Command{
	Use:   "update [harness]",
	Short: "Update installed ui-craft components to the current embedded version",
	Long: `Re-runs WriteSkill (and optionally WriteMCP) for the specified harness,
updating installed components to the version embedded in this binary.

A backup is taken before any write. Use --component to limit the update
to a specific component; omit it to update all installed components.`,
	Args:         cobra.MaximumNArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		out := cmd.OutOrStdout()

		// Freshness guard: prevent running with placeholder/empty embedded mirrors.
		// Must be first so users get a clear error before any detection or I/O.
		if err := assets.AssertMirrorsFresh(); err != nil {
			return err
		}

		compFlag, _ := cmd.Flags().GetString("component")

		// Detect harnesses.
		detected := core.DetectAll(harness.All())
		if len(detected) == 0 {
			return fmt.Errorf("no supported AI coding harness detected")
		}

		// Filter by harness name argument if provided.
		if len(args) == 1 {
			name := args[0]
			filtered := detected[:0]
			for _, dh := range detected {
				if dh.Harness.Name() == name {
					filtered = append(filtered, dh)
				}
			}
			if len(filtered) == 0 {
				return fmt.Errorf("harness %q not detected on this machine", name)
			}
			detected = filtered
		}

		// Determine which components to update.
		selected := component.All()
		if compFlag != "" {
			// Map the flag string to a Component.
			var matched component.Component
			found := false
			for _, c := range component.All() {
				if c.String() == compFlag {
					matched = c
					found = true
					break
				}
			}
			if !found {
				return fmt.Errorf("unknown component %q; valid values: skill+commands, mcp-gates, review-agents, design-memory", compFlag)
			}
			selected = []component.Component{matched}
		}

		// Resolve project directory for design-memory scaffolding.
		// --dir flag (flags.Dir) defaults to "." which may be relative;
		// resolve to an absolute path so scaffold writes land in the right place
		// regardless of how the flag was passed (e.g. --dir=myproject).
		projectDir := flags.Dir
		if projectDir == "" || projectDir == "." {
			if cwd, err := os.Getwd(); err == nil {
				projectDir = cwd
			}
		}
		if absDir, err := filepath.Abs(projectDir); err == nil {
			projectDir = absDir
		}

		osfs := fsutil.OsFS{}
		plan := core.Plan(detected, selected, osfs, assets.Mirror, assets.TemplateFS, projectDir)

		// Backup store root: ~/.ui-craft-backups
		home, _ := os.UserHomeDir()
		backupRoot := filepath.Join(home, ".ui-craft-backups")
		backupStore := backup.NewStore(backupRoot, osfs, nil)

		result, applyErr := core.Apply(plan, osfs, backupStore, cmdVersion)
		if applyErr != nil {
			return fmt.Errorf("update: apply failed (all changes rolled back): %w", applyErr)
		}

		// Report results per target.
		for _, t := range plan.Targets {
			if t.Skip {
				fmt.Fprintf(out, "  %s/%s: skipped (%s)\n", t.Harness.Name(), t.Component.String(), t.SkipReason)
				continue
			}
			// Find the matching change by annotation.
			status := "updated"
			for _, ch := range result.Changes {
				if ch.HarnessName == t.Harness.Name() && ch.Component == t.Component.String() {
					if !ch.Changed {
						status = "already up-to-date"
					}
					break
				}
			}
			fmt.Fprintf(out, "  %s/%s: %s\n", t.Harness.Name(), t.Component.String(), status)
		}

		return nil
	},
}

func init() {
	updateCmd.Flags().StringP("component", "c", "", "component to update (skill+commands, mcp-gates, review-agents, design-memory)")
	rootCmd.AddCommand(updateCmd)
}
