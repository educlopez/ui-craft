package cmd

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/educlopez/ui-craft/cli/tui"
	"github.com/spf13/cobra"
)

// supportedHarnessNames lists every harness by name for user-facing messages.
var supportedHarnessNames = []string{"claude", "cursor", "codex", "gemini", "opencode"}

// lookPathFn wraps exec.LookPath so tests can inject a fake implementation.
var lookPathFn = func(file string) (string, error) {
	return exec.LookPath(file)
}

// nativePluginDetectFn is injectable for testing. It checks whether a Claude
// Code native plugin install is present (Slice 10: plugin-coexistence warning).
var nativePluginDetectFn = detectNativeClaudePlugin

// stdinScanner is used for reading --force confirmation in non-interactive mode.
// Tests may replace this with a strings.NewReader-backed scanner.
var stdinReader = os.Stdin

// installCmd implements the detect → plan → apply pipeline.
var installCmd = &cobra.Command{
	Use:          "install",
	Short:        "Install ui-craft components into detected AI coding harnesses",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		out := cmd.OutOrStdout()

		// Freshness guard: prevent running with placeholder/empty embedded mirrors.
		// Must be first so users get a clear error before any detection or I/O.
		if err := assets.AssertMirrorsFresh(); err != nil {
			return err
		}

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
		// When stdout is a TTY AND --yes is not set → launch Bubble Tea TUI.
		// The TUI drives the same core.Plan + core.Apply path as non-interactive mode.
		// When not a TTY and --yes is not set → exit with a clear error (spec: non-TTY scenario).
		if !flags.Yes {
			if !tui.IsTerminal() {
				return fmt.Errorf("interactive mode requires a TTY; use --yes to skip prompts")
			}
			// Launch the TUI. It blocks until the user exits or completes.
			return tui.RunTUI(cmdVersion, projectDir)
		}

		// --- Non-interactive path (--yes flag set) ---

		// DetectAll is best-effort: one harness erroring does not abort the rest.
		detected := core.DetectAll(harness.All())

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

		// Build plan for all components.
		selected := component.All()
		osfs := fsutil.OsFS{}
		plan := core.Plan(detected, selected, osfs, assets.Mirror, assets.Agents, assets.TemplateFS, projectDir)

		// Backup store root: ~/.ui-craft-backups
		home, _ := os.UserHomeDir()
		backupRoot := filepath.Join(home, ".ui-craft-backups")
		backupStore := backup.NewStore(backupRoot, osfs, nil) // nil clock = time.Now

		// Execute transactional apply.
		result, applyErr := core.Apply(plan, osfs, backupStore, cmdVersion)
		if applyErr != nil {
			return fmt.Errorf("install: apply failed (all changes rolled back): %w", applyErr)
		}

		// Report skill-commands results.
		fmt.Fprintln(out, "\nSkill+commands results:")
		for _, t := range plan.Targets {
			if t.Component != component.SkillCommands {
				continue
			}
			if t.Skip {
				fmt.Fprintf(out, "  %s/skill+commands: skipped (%s)\n", t.Harness.Name(), t.SkipReason)
				continue
			}
			status := "installed"
			for _, ch := range result.Changes {
				if ch.HarnessName == t.Harness.Name() && ch.Component == component.SkillCommands.String() {
					if !ch.Changed {
						status = "already up-to-date"
					}
					break
				}
			}
			// Gotcha #7: advisory for Gemini/Codex if global npm detected.
			if (t.Harness.Name() == "gemini" || t.Harness.Name() == "codex") && status == "installed" {
				if !detectNVMOrVolta() {
					fmt.Fprintf(out, "  ADVISORY: %s uses global npm; consider nvm/fnm/volta to avoid permission issues.\n", t.Harness.Name())
				}
			}
			fmt.Fprintf(out, "  %s/skill+commands: %s\n", t.Harness.Name(), status)
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
			status := "configured"
			for _, ch := range result.Changes {
				if ch.FilePath == t.SnapPath {
					if !ch.Changed {
						status = "already configured (no change)"
					}
					if ch.MalformedBase {
						fmt.Fprintf(out, "  WARNING: %s was malformed JSON; original backed up before rewrite.\n", ch.FilePath)
					}
					break
				}
			}
			fmt.Fprintf(out, "  %s/mcp-gates: %s\n", t.Harness.Name(), status)
		}

		// Report design-memory results.
		designMemoryReported := false
		for _, t := range plan.Targets {
			if t.Component != component.DesignMemory {
				continue
			}
			if t.Skip {
				if !designMemoryReported {
					fmt.Fprintf(out, "\ndesign-memory: skipped (%s)\n", t.SkipReason)
					designMemoryReported = true
				}
				continue
			}
			if !designMemoryReported {
				status := "scaffolded"
				for _, ch := range result.Changes {
					if ch.Component == component.DesignMemory.String() && ch.HarnessName == t.Harness.Name() {
						if !ch.Changed {
							status = "already scaffolded"
						}
						break
					}
				}
				fmt.Fprintf(out, "\ndesign-memory: %s → %s/.ui-craft/\n", status, projectDir)
				designMemoryReported = true
			}
		}

		// --- Save state (Slice 10) ---
		// Persist the harness+component choices so `ui-craft update` can replay them.
		stateRoot := filepath.Join(home, ".ui-craft")
		state, _ := core.LoadState(osfs, stateRoot)
		state.Version = cmdVersion
		state.MirrorVersion = cmdMirrorVersion
		now := time.Now().UTC().Format(time.RFC3339)
		for _, dh := range detected {
			// Collect components that were successfully applied for this harness.
			var installedComps []string
			for _, c := range selected {
				if !dh.Harness.Supports(c) {
					continue
				}
				installedComps = append(installedComps, c.String())
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

// confirmFromStdin reads a single line from stdinReader and returns true if the
// user typed "y" or "yes" (case-insensitive). Used for non-interactive --force
// bypass prompts. Exported as a var so tests can inject a fake reader.
func confirmFromStdin(prompt string) bool {
	fmt.Fprint(os.Stderr, prompt)
	scanner := bufio.NewScanner(stdinReader)
	if scanner.Scan() {
		answer := strings.TrimSpace(strings.ToLower(scanner.Text()))
		return answer == "y" || answer == "yes"
	}
	return false
}

func init() {
	installCmd.Flags().Bool("force", false, "Bypass native plugin coexistence warning")
	rootCmd.AddCommand(installCmd)
}
