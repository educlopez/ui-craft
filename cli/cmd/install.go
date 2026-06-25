package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/educlopez/ui-craft/cli/tui"
	"github.com/spf13/cobra"
)

// installJSONTarget is the per-target outcome in --json output.
type installJSONTarget struct {
	Harness    string `json:"harness"`
	Component  string `json:"component"`
	Status     string `json:"status"` // "installed", "already-up-to-date", "skipped", "dry-run"
	Skip       bool   `json:"skip,omitempty"`
	SkipReason string `json:"skip_reason,omitempty"`
}

// installJSONResult is the top-level --json result for install/update/uninstall.
type installJSONResult struct {
	DryRun    bool                `json:"dry_run"`
	Harnesses []string            `json:"harnesses"`
	Targets   []installJSONTarget `json:"targets"`
}

// supportedHarnessNames lists every harness by name for user-facing messages.
var supportedHarnessNames = []string{"claude", "cursor", "codex", "gemini", "opencode"}

// lookPathFn wraps exec.LookPath so tests can inject a fake implementation.
var lookPathFn = func(file string) (string, error) {
	return exec.LookPath(file)
}

// nativePluginDetectFn is injectable for testing. It checks whether a Claude
// Code native plugin install is present (Slice 10: plugin-coexistence warning).
var nativePluginDetectFn = detectNativeClaudePlugin

// detectAllFn is injectable for testing. It wraps core.DetectAll so tests can
// supply a controlled set of detected harnesses without filesystem side effects.
var detectAllFn = func(reg []harness.Harness) []core.DetectedHarness {
	return core.DetectAll(reg)
}

// installCmd implements the detect → plan → apply pipeline.
var installCmd = &cobra.Command{
	Use:          "install",
	Short:        "Install ui-craft components into detected AI coding harnesses",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		out := cmd.OutOrStdout()

		// Resolve project directory early so both TUI and non-interactive paths
		// use the same value.
		projectDir := flags.Dir
		if projectDir == "" || projectDir == "." {
			if cwd, err := os.Getwd(); err == nil {
				projectDir = cwd
			}
		}
		if absDir, err := filepath.Abs(projectDir); err == nil {
			projectDir = absDir
		}

		// TUI routing (Slice 7 — ADR-2):
		// When stdout is a TTY AND --yes/--json is not set → launch Bubble Tea TUI.
		// --json implies non-interactive (machine-readable output, no TUI).
		// When not a TTY and --yes/--json is not set → exit with a clear error.
		nonInteractive := flags.Yes || flags.JSON
		if !nonInteractive {
			if !tui.IsTerminal() {
				return fmt.Errorf("interactive mode requires a TTY; use --yes to skip prompts")
			}
			// Launch the TUI. It blocks until the user exits or completes.
			return tui.RunTUI(cmdVersion, projectDir)
		}

		// --- Non-interactive path (--yes flag set) ---

		// Validate --harness flag before detection so unknown names fail fast.
		if flags.Harness != "" {
			valid := false
			for _, name := range supportedHarnessNames {
				if flags.Harness == name {
					valid = true
					break
				}
			}
			if !valid {
				return fmt.Errorf("unknown harness %q; valid values: %s", flags.Harness, strings.Join(supportedHarnessNames, ", "))
			}
		}

		// Validate --components flag before any work.
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

		// DetectAll is best-effort: one harness erroring does not abort the rest.
		detected := detectAllFn(harness.All())

		// Honor --harness: filter detected list to only the requested harness.
		if flags.Harness != "" {
			var filtered []core.DetectedHarness
			for _, dh := range detected {
				if dh.Harness.Name() == flags.Harness {
					filtered = append(filtered, dh)
					break
				}
			}
			if len(filtered) == 0 {
				// Build a helpful error listing what was actually detected.
				var detectedNames []string
				for _, dh := range detected {
					detectedNames = append(detectedNames, dh.Harness.Name())
				}
				if len(detectedNames) == 0 {
					return fmt.Errorf("harness %q not detected; no harnesses detected on this machine", flags.Harness)
				}
				return fmt.Errorf("harness %q not detected; detected: %s", flags.Harness, strings.Join(detectedNames, ", "))
			}
			detected = filtered
		}

		if len(detected) == 0 {
			fmt.Fprintln(out, "No supported AI coding harness detected.")
			fmt.Fprintf(out, "Supported harnesses: %s\n", strings.Join(supportedHarnessNames, ", "))
			fmt.Fprintln(out, "Install one of the above tools and re-run `ui-craft install`.")
			return fmt.Errorf("no harness detected")
		}

		// --- Plugin coexistence warning (Slice 10) ---
		// If the Claude Code native plugin is detected, warn the user and require
		// --force to proceed (or interactive confirmation).
		forceFlag, _ := cmd.Flags().GetBool("force")
		claudeDetected := false
		for _, dh := range detected {
			if dh.Harness.Name() == "claude" {
				claudeDetected = true
				break
			}
		}
		if claudeDetected && nativePluginDetectFn() && !forceFlag {
			fmt.Fprintln(out, "WARNING: Native Claude Code plugin detected — CLI install may overlap.")
			fmt.Fprintln(out, "Both installs write to the same skills and agents directories.")
			fmt.Fprintln(out, "To proceed anyway, re-run with --force.")
			return fmt.Errorf("native plugin detected: use --force to override")
		}

		if !flags.JSON && !flags.Quiet {
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
		}

		// Honor --components: restrict to the requested subset.
		selected := component.All()
		if len(flags.Components) > 0 {
			var filtered []component.Component
			for _, name := range flags.Components {
				for _, c := range component.All() {
					if c.String() == name {
						filtered = append(filtered, c)
						break
					}
				}
			}
			selected = filtered
		}
		osfs := fsutil.OsFS{}
		plan := core.Plan(detected, selected, osfs, assets.Mirror, assets.Agents, assets.TemplateFS, projectDir)

		// --- Dry-run: print what would happen and exit without writing ---
		if flags.DryRun {
			if flags.JSON {
				var harnessNames []string
				for _, dh := range detected {
					harnessNames = append(harnessNames, dh.Harness.Name())
				}
				var targets []installJSONTarget
				for _, t := range plan.Targets {
					jt := installJSONTarget{
						Harness:   t.Harness.Name(),
						Component: t.Component.String(),
						Status:    "dry-run",
					}
					if t.Skip {
						jt.Skip = true
						jt.SkipReason = t.SkipReason
						jt.Status = "skipped"
					}
					targets = append(targets, jt)
				}
				res := installJSONResult{DryRun: true, Harnesses: harnessNames, Targets: targets}
				enc := json.NewEncoder(out)
				enc.SetIndent("", "  ")
				return enc.Encode(res)
			}
			if !flags.Quiet {
				fmt.Fprint(out, "\n[dry-run] No files will be written. Showing what would change:\n\n")
			}
			for _, t := range plan.Targets {
				if t.Skip {
					if !flags.Quiet {
						fmt.Fprintf(out, "  would skip   %s/%s (%s)\n", t.Harness.Name(), t.Component.String(), t.SkipReason)
					}
					continue
				}
				if t.Op == nil {
					continue
				}
				if !flags.Quiet {
					fmt.Fprintf(out, "  would install %s/%s\n", t.Harness.Name(), t.Component.String())
				}
			}
			if !flags.Quiet {
				fmt.Fprintln(out, "\n[dry-run] Re-run without --dry-run to apply changes.")
			}
			return nil
		}

		// Backup store root: ~/.ui-craft-backups
		home, _ := os.UserHomeDir()
		backupRoot := filepath.Join(home, ".ui-craft-backups")
		backupStore := backup.NewStore(backupRoot, osfs, nil) // nil clock = time.Now

		// Execute transactional apply.
		result, applyErr := core.Apply(plan, osfs, backupStore, cmdVersion, false)
		if applyErr != nil {
			return fmt.Errorf("install: apply failed (all changes rolled back): %w", applyErr)
		}

		// Build status for each target from plan + result.Changes.
		targetStatus := func(t core.ComponentTarget) string {
			if t.Skip {
				return "skipped"
			}
			for _, ch := range result.Changes {
				if ch.HarnessName == t.Harness.Name() && ch.Component == t.Component.String() {
					if !ch.Changed {
						return "already-up-to-date"
					}
					return "installed"
				}
				// MCP uses file path as key
				if ch.FilePath == t.SnapPath {
					if !ch.Changed {
						return "already-up-to-date"
					}
					return "installed"
				}
			}
			return "installed"
		}

		// --json: emit machine-readable result and return.
		if flags.JSON {
			var harnessNames []string
			seen := map[string]bool{}
			for _, dh := range detected {
				if !seen[dh.Harness.Name()] {
					harnessNames = append(harnessNames, dh.Harness.Name())
					seen[dh.Harness.Name()] = true
				}
			}
			var targets []installJSONTarget
			for _, t := range plan.Targets {
				status := targetStatus(t)
				jt := installJSONTarget{
					Harness:   t.Harness.Name(),
					Component: t.Component.String(),
					Status:    status,
				}
				if t.Skip {
					jt.Skip = true
					jt.SkipReason = t.SkipReason
				}
				targets = append(targets, jt)
			}
			res := installJSONResult{DryRun: false, Harnesses: harnessNames, Targets: targets}
			enc := json.NewEncoder(out)
			enc.SetIndent("", "  ")
			return enc.Encode(res)
		}

		// Report skill-commands results.
		if !flags.Quiet {
			fmt.Fprintln(out, "\nSkill+commands results:")
		}
		for _, t := range plan.Targets {
			if t.Component != component.SkillCommands {
				continue
			}
			if t.Skip {
				if !flags.Quiet {
					fmt.Fprintf(out, "  %s/skill+commands: skipped (%s)\n", t.Harness.Name(), t.SkipReason)
				}
				continue
			}
			status := targetStatus(t)
			// Gotcha #7: advisory for Gemini/Codex if global npm detected.
			if (t.Harness.Name() == "gemini" || t.Harness.Name() == "codex") && status == "installed" {
				if !detectNVMOrVolta() && !flags.Quiet {
					fmt.Fprintf(out, "  ADVISORY: %s uses global npm; consider nvm/fnm/volta to avoid permission issues.\n", t.Harness.Name())
				}
			}
			if !flags.Quiet {
				fmt.Fprintf(out, "  %s/skill+commands: %s\n", t.Harness.Name(), status)
			}
		}

		// Report MCP results.
		if !flags.Quiet {
			fmt.Fprintln(out, "\nMCP wiring results:")
		}
		for _, t := range plan.Targets {
			if t.Component != component.MCPGates {
				continue
			}
			if t.Skip {
				if !flags.Quiet {
					fmt.Fprintf(out, "  %s/mcp-gates: skipped (%s)\n", t.Harness.Name(), t.SkipReason)
				}
				continue
			}
			status := targetStatus(t)
			for _, ch := range result.Changes {
				if ch.FilePath == t.SnapPath && ch.MalformedBase && !flags.Quiet {
					fmt.Fprintf(out, "  WARNING: %s was malformed JSON; original backed up before rewrite.\n", ch.FilePath)
				}
			}
			if !flags.Quiet {
				fmt.Fprintf(out, "  %s/mcp-gates: %s\n", t.Harness.Name(), status)
			}
		}

		// Report design-memory results.
		designMemoryReported := false
		for _, t := range plan.Targets {
			if t.Component != component.DesignMemory {
				continue
			}
			if t.Skip {
				if !designMemoryReported && !flags.Quiet {
					fmt.Fprintf(out, "\ndesign-memory: skipped (%s)\n", t.SkipReason)
					designMemoryReported = true
				}
				continue
			}
			if !designMemoryReported {
				status := targetStatus(t)
				if !flags.Quiet {
					fmt.Fprintf(out, "\ndesign-memory: %s → %s/.ui-craft/\n", status, projectDir)
				}
				designMemoryReported = true
			}
		}

		// --- Save state (Slice 10) ---
		// Persist the harness+component choices so `ui-craft update` can replay them.
		// We derive the installed list from result.Changes (components that actually
		// produced a Change for this harness), so skipped components are never recorded
		// as installed. A skipped target never produces a Change, so it is absent here.
		stateRoot := filepath.Join(home, ".ui-craft")
		state, _ := core.LoadState(osfs, stateRoot)
		state.Version = cmdVersion
		state.MirrorVersion = cmdMirrorVersion
		now := core.Now().UTC().Format("2006-01-02T15:04:05Z07:00")
		for _, dh := range detected {
			// Collect components that were actually applied (appear in result.Changes)
			// for this harness. Using Changes avoids recording skipped components.
			seen := map[string]bool{}
			var installedComps []string
			for _, ch := range result.Changes {
				if ch.HarnessName == dh.Harness.Name() && !seen[ch.Component] {
					seen[ch.Component] = true
					installedComps = append(installedComps, ch.Component)
				}
			}
			core.UpsertHarnessState(state, core.HarnessState{
				Name:                dh.Harness.Name(),
				InstalledComponents: installedComps,
				InstalledAt:         now,
			})
		}
		if err := core.SaveState(osfs, stateRoot, state); err != nil {
			// Non-fatal: log but do not fail the command.
			fmt.Fprintf(out, "\nwarning: could not save state.json: %v\n", err)
		}

		// --quiet: emit the single final outcome line now that state is saved.
		if flags.Quiet {
			fmt.Fprintln(out, "install: ok")
		}

		return nil
	},
}

// detectNativeClaudePlugin returns true when a Claude Code native plugin install
// for ui-craft is detected. It checks for the presence of the plugin manifest
// directory that the npm-based plugin install creates (~/.claude/plugins/ui-craft/).
// This is a best-effort heuristic: false negatives are safe (no unnecessary blocking).
func detectNativeClaudePlugin() bool {
	home, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	pluginDir := filepath.Join(home, ".claude", "plugins", "ui-craft")
	if _, err := os.Stat(pluginDir); err == nil {
		return true
	}
	return false
}

// detectNVMOrVolta returns true when nvm, fnm, or volta is detectable on PATH
// or via well-known environment variables. Used for gotcha #7 advisory.
func detectNVMOrVolta() bool {
	for _, tool := range []string{"nvm", "fnm", "volta"} {
		if _, err := lookPathFn(tool); err == nil {
			return true
		}
	}
	// Also check NVM_DIR / VOLTA_HOME environment variables as secondary signals.
	if os.Getenv("NVM_DIR") != "" || os.Getenv("VOLTA_HOME") != "" || os.Getenv("FNM_DIR") != "" {
		return true
	}
	return false
}

func init() {
	installCmd.Flags().Bool("force", false, "Bypass native plugin coexistence warning")
	rootCmd.AddCommand(installCmd)
}
