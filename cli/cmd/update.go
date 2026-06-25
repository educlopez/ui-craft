package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

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
	Long: `Re-applies WriteSkill (and optionally WriteMCP) for the specified harness,
updating installed components to the version embedded in this binary.

The saved install choices in ~/.ui-craft/state.json are used to determine which
harness+component combinations were previously installed. If no state.json exists,
update reports "nothing installed yet — run install first".

A backup is taken before any write. User edits outside managed blocks are always
preserved (managed-block and structured-merge writers guarantee this). The update
is idempotent: if the embedded mirror matches what is on disk, no file is touched.

Use --component to limit the update to a single component; omit it to update all
installed components for the harness.`,
	Args:         cobra.MaximumNArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		out := cmd.OutOrStdout()

		// Freshness guard: prevent running with placeholder/empty embedded mirrors.
		if err := assets.AssertMirrorsFresh(); err != nil {
			return err
		}

		compFlag, _ := cmd.Flags().GetString("component")

		// Resolve state root: ~/.ui-craft/
		home, _ := os.UserHomeDir()
		stateRoot := filepath.Join(home, ".ui-craft")
		osfs := fsutil.OsFS{}

		// Load install state. A missing/malformed state.json is not an error;
		// we report "nothing installed yet" gracefully (gotcha #2).
		state, _ := core.LoadState(osfs, stateRoot)
		if len(state.Harnesses) == 0 {
			fmt.Fprintln(out, "nothing installed yet — run install first")
			return nil
		}

		// Detect currently installed harnesses.
		detected := core.DetectAll(harness.All())
		if len(detected) == 0 {
			return fmt.Errorf("no supported AI coding harness detected")
		}

		// Filter by harness name argument if provided.
		harnessFilter := ""
		if len(args) == 1 {
			harnessFilter = args[0]
		}

		// Build the set of (harness, components) to update from saved state.
		// If a harness is in state but not currently detected, skip it with a
		// notice (the user may have uninstalled the tool since last install).
		type updateTarget struct {
			dh         core.DetectedHarness
			components []component.Component
		}
		var updateTargets []updateTarget

		for _, hs := range state.Harnesses {
			if harnessFilter != "" && hs.Name != harnessFilter {
				continue
			}
			if len(hs.InstalledComponents) == 0 {
				continue
			}

			// Match to a detected harness.
			var matched *core.DetectedHarness
			for i := range detected {
				if detected[i].Harness.Name() == hs.Name {
					matched = &detected[i]
					break
				}
			}
			if matched == nil {
				fmt.Fprintf(out, "  %s: not currently detected — skipping\n", hs.Name)
				continue
			}

			// Determine which components to update.
			var comps []component.Component
			if compFlag != "" {
				// --component flag limits to a single component.
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
				// Only include this component if it was previously installed.
				installed := false
				for _, ic := range hs.InstalledComponents {
					if ic == matched.String() {
						installed = true
						break
					}
				}
				if !installed {
					fmt.Fprintf(out, "  %s/%s: not in saved state — skipping\n", hs.Name, matched.String())
					continue
				}
				comps = []component.Component{matched}
			} else {
				// No component filter: update all installed components.
				for _, icName := range hs.InstalledComponents {
					for _, c := range component.All() {
						if c.String() == icName {
							comps = append(comps, c)
							break
						}
					}
				}
			}

			updateTargets = append(updateTargets, updateTarget{dh: *matched, components: comps})
		}

		if len(updateTargets) == 0 {
			if harnessFilter != "" {
				// The requested harness had no state entry — it was never installed.
				fmt.Fprintf(out, "nothing installed yet for %q — run install first\n", harnessFilter)
			} else {
				fmt.Fprintln(out, "nothing installed yet — run install first")
			}
			return nil
		}

		// Resolve project directory for design-memory scaffolding.
		projectDir := flags.Dir
		if projectDir == "" || projectDir == "." {
			if cwd, err := os.Getwd(); err == nil {
				projectDir = cwd
			}
		}
		if absDir, err := filepath.Abs(projectDir); err == nil {
			projectDir = absDir
		}

		// Backup store root: ~/.ui-craft-backups
		backupRoot := filepath.Join(home, ".ui-craft-backups")
		backupStore := backup.NewStore(backupRoot, osfs, nil) // nil clock = time.Now

		// Execute per-target update (each target is a harness+components slice).
		for _, ut := range updateTargets {
			plan := core.Plan([]core.DetectedHarness{ut.dh}, ut.components, osfs, assets.Mirror, assets.Agents, assets.TemplateFS, projectDir)

			result, applyErr := core.Apply(plan, osfs, backupStore, cmdVersion)
			if applyErr != nil {
				return fmt.Errorf("update %s: apply failed (all changes rolled back): %w", ut.dh.Harness.Name(), applyErr)
			}

			// Report per-component results.
			for _, t := range plan.Targets {
				if t.Skip {
					fmt.Fprintf(out, "  %s/%s: skipped (%s)\n", t.Harness.Name(), t.Component.String(), t.SkipReason)
					continue
				}
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

			// Update state: refresh InstalledAt to now for this harness.
			core.UpsertHarnessState(state, core.HarnessState{
				Name: ut.dh.Harness.Name(),
				InstalledComponents: func() []string {
					hs := core.FindHarness(state, ut.dh.Harness.Name())
					if hs != nil {
						return hs.InstalledComponents
					}
					return nil
				}(),
				InstalledAt: time.Now().UTC().Format(time.RFC3339),
			})
		}

		// Persist updated state.
		state.Version = cmdVersion
		state.MirrorVersion = cmdMirrorVersion
		if err := core.SaveState(osfs, stateRoot, state); err != nil {
			// Non-fatal: log but do not fail the command.
			fmt.Fprintf(out, "  warning: could not save state.json: %v\n", err)
		}

		return nil
	},
}

func init() {
	updateCmd.Flags().StringP("component", "c", "", "component to update (skill+commands, mcp-gates, review-agents, design-memory)")
	rootCmd.AddCommand(updateCmd)
}
