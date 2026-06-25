package cmd

import (
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
	"github.com/spf13/cobra"
)

// supportedHarnessNames lists every harness by name for user-facing messages.
var supportedHarnessNames = []string{"claude", "cursor", "codex", "gemini", "opencode"}

// lookPathFn wraps exec.LookPath so tests can inject a fake implementation.
var lookPathFn = func(file string) (string, error) {
	return exec.LookPath(file)
}

// installCmd implements the detect → plan → apply pipeline.
// Slice 2: detect harnesses and print results; plan/apply wired in later slices.
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

		// Resolve project directory for design-memory scaffolding.
		// --dir flag (flags.Dir) defaults to "." which may be relative;
		// resolve to an absolute path so scaffold writes land in the right place.
		projectDir := flags.Dir
		if projectDir == "" || projectDir == "." {
			if cwd, err := os.Getwd(); err == nil {
				projectDir = cwd
			}
		}

		// Build plan for all components, wiring MCP, SkillCommands, and DesignMemory ops.
		selected := component.All()
		osfs := fsutil.OsFS{}
		plan := core.Plan(detected, selected, osfs, assets.Mirror, assets.TemplateFS, projectDir)

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
			// Match by HarnessName + Component annotation set by core.Apply.
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
			// Determine if the file was already configured (no change) or newly written.
			// Use Change.Changed (set by WriteFileAtomic's byte-compare) rather than
			// re-reading and comparing bytes — the latter is unreliable for JSON because
			// key ordering may differ between MarshalIndent calls.
			status := "configured"
			for _, ch := range result.Changes {
				if ch.FilePath == t.SnapPath {
					if !ch.Changed {
						status = "already configured (no change)"
					}
					// Malformed-base warning: the user's existing config was corrupt.
					// The transactional snapshot already backed it up before rewrite.
					if ch.MalformedBase {
						fmt.Fprintf(out, "  WARNING: %s was malformed JSON; original backed up before rewrite.\n", ch.FilePath)
					}
					break
				}
			}
			fmt.Fprintf(out, "  %s/mcp-gates: %s\n", t.Harness.Name(), status)
		}

		// Report design-memory results.
		// DesignMemory is project-scoped (one .ui-craft/ per project dir, not per
		// harness), so we deduplicate: report on the first target that ran the op.
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
		return nil
	},
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
	rootCmd.AddCommand(installCmd)
}
