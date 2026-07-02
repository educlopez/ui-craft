package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/spf13/cobra"
)

// updateDetectAllFn is injectable for testing. It wraps core.DetectAll so tests
// can supply a controlled set of detected harnesses without filesystem side effects.
var updateDetectAllFn = func(reg []harness.Harness) []core.DetectedHarness {
	return core.DetectAll(reg)
}

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
is idempotent: if the embedded assets match what is on disk, no file is touched.

Use --component to limit the update to a single component; omit it to update all
installed components for the harness.`,
	Args:         cobra.MaximumNArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		out := cmd.OutOrStdout()

		compFlag, _ := cmd.Flags().GetString("component")

		// Validate --harness flag before any work.
		if flags.Harness != "" {
			validHarnesses := []string{"claude", "cursor", "codex", "gemini", "opencode"}
			valid := false
			for _, name := range validHarnesses {
				if flags.Harness == name {
					valid = true
					break
				}
			}
			if !valid {
				return fmt.Errorf("unknown harness %q; valid values: %s", flags.Harness, strings.Join(validHarnesses, ", "))
			}
		}

		// Validate --components flag (plural, persistent) before any work.
		if len(flags.Components) > 0 {
			for _, name := range flags.Components {
				found := false
				for _, c := range component.All() {
					if c.String() == name {
						found = true
						break
					}
				}
				if !found {
					return fmt.Errorf("unknown component %q; valid values: skill+commands, mcp-gates, review-agents, design-memory", name)
				}
			}
		}

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
		detected := updateDetectAllFn(harness.All())
		if len(detected) == 0 {
			if len(state.Harnesses) > 0 {
				// State records harnesses that were installed, but none are currently
				// detected. This typically means the tool was uninstalled.
				return fmt.Errorf("harness(es) recorded in state.json are not currently detected on this machine")
			}
			return fmt.Errorf("no supported AI coding harness detected")
		}

		// Filter by harness name: positional arg takes precedence, then --harness flag.
		harnessFilter := ""
		if len(args) == 1 {
			harnessFilter = args[0]
		} else if flags.Harness != "" {
			harnessFilter = flags.Harness
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
			// Priority: --components (plural, persistent) > --component (singular, local) > all installed.
			var comps []component.Component
			if len(flags.Components) > 0 {
				// --components flag (persistent) limits to a named set.
				for _, name := range flags.Components {
					for _, c := range component.All() {
						if c.String() == name {
							// Only include if it was previously installed.
							for _, ic := range hs.InstalledComponents {
								if ic == c.String() {
									comps = append(comps, c)
									break
								}
							}
							break
						}
					}
				}
				if len(comps) == 0 {
					fmt.Fprintf(out, "  %s: none of the requested components are in saved state — skipping\n", hs.Name)
					continue
				}
			} else if compFlag != "" {
				// --component flag (singular, local) limits to a single component.
				var matchedComp component.Component
				found := false
				for _, c := range component.All() {
					if c.String() == compFlag {
						matchedComp = c
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
					if ic == matchedComp.String() {
						installed = true
						break
					}
				}
				if !installed {
					fmt.Fprintf(out, "  %s/%s: not in saved state — skipping\n", hs.Name, matchedComp.String())
					continue
				}
				comps = []component.Component{matchedComp}
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

		// --- Dry-run: print what would happen and exit without writing ---
		if flags.DryRun {
			fmt.Fprint(out, "\n[dry-run] No files will be written. Showing what would change:\n\n")
			for _, ut := range updateTargets {
				plan := core.Plan([]core.DetectedHarness{ut.dh}, ut.components, osfs, assets.SkillsFS, assets.Agents, assets.TemplateFS, assets.CommandsFS, projectDir, core.Global, "")
				for _, t := range plan.Targets {
					if t.Skip {
						fmt.Fprintf(out, "  would skip    %s/%s (%s)\n", t.Harness.Name(), t.Component.String(), t.SkipReason)
						continue
					}
					if t.Op == nil {
						continue
					}
					fmt.Fprintf(out, "  would configure %s/%s\n", t.Harness.Name(), t.Component.String())
				}
			}
			fmt.Fprintln(out, "\n[dry-run] Re-run without --dry-run to apply changes.")
			return nil
		}

		// Execute per-target update (each target is a harness+components slice).
		for _, ut := range updateTargets {
			plan := core.Plan([]core.DetectedHarness{ut.dh}, ut.components, osfs, assets.SkillsFS, assets.Agents, assets.TemplateFS, assets.CommandsFS, projectDir, core.Global, "")

			result, applyErr := core.Apply(plan, osfs, backupStore, cmdVersion, false)
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
			// Preserve the full installed component list from state (the source of truth)
			// even when --component narrows this particular update run. A partial
			// update does not un-install the components it didn't touch.
			existing := core.FindHarness(state, ut.dh.Harness.Name())
			var installedComps []string
			if existing != nil {
				installedComps = existing.InstalledComponents
			}
			core.UpsertHarnessState(state, core.HarnessState{
				Name:                ut.dh.Harness.Name(),
				InstalledComponents: installedComps,
				InstalledAt:         core.Now().UTC().Format("2006-01-02T15:04:05Z07:00"),
			})
		}

		// Persist updated state.
		state.Version = cmdVersion
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
