// Package cmd — uninstall command.
// ui-craft uninstall cleanly removes ui-craft's wired configuration from AI
// coding harnesses. It snapshots before removing (so rollback works), removes
// only ui-craft entries while preserving all user content, and updates state.json.
//
// For each targeted harness:
//   - MCP: removes only the "ui-craft" server key; other servers are preserved.
//   - skills: removes ~/.claude/skills/ui-craft/ (or equivalent) subtree only.
//   - agents: removes design-reviewer.md + a11y-auditor.md from agents dir only.
//   - AGENTS.md (Codex): removes our managed block; rest of file preserved.
//   - design-memory (.ui-craft/): NOT removed by default; requires
//     --components design-memory and shows a warning.
package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
	"github.com/spf13/cobra"
)

var uninstallCmd = &cobra.Command{
	Use:   "uninstall",
	Short: "Remove ui-craft configuration from AI coding harnesses",
	Long: `Remove ui-craft's wired configuration from harnesses.

A snapshot is created before any removal so the change is reversible with
ui-craft rollback.

Flags:
  --harness      Limit removal to one harness (default: all installed)
  --components   Comma-separated components to remove (skill+commands, mcp-gates,
                 review-agents, design-memory). Default: all except design-memory.

WARNING: design-memory (.ui-craft/) contains your design notes. It is NOT
removed unless you explicitly pass --components design-memory.`,
	SilenceUsage: true,
	RunE:         runUninstall,
}

func init() {
	rootCmd.AddCommand(uninstallCmd)
}

// uninstallableComponents are the components we attempt to remove by default.
// design-memory is excluded unless explicitly requested.
var uninstallableComponents = []component.Component{
	component.SkillCommands,
	component.MCPGates,
	component.ReviewAgents,
}

func runUninstall(cmd *cobra.Command, _ []string) error {
	out := cmd.OutOrStdout()
	fs := fsutil.OsFS{}

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("uninstall: could not determine home directory: %w", err)
	}

	// --- Resolve which harnesses to target ---
	stateRoot := filepath.Join(home, ".ui-craft")
	state, _ := core.LoadState(fs, stateRoot)

	var targetHarnesses []harness.Harness
	allHarnesses := harness.All()

	if flags.Harness != "" {
		// Single harness from --harness flag.
		found := false
		for _, h := range allHarnesses {
			if h.Name() == flags.Harness {
				targetHarnesses = append(targetHarnesses, h)
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("unknown harness %q; valid values: %s", flags.Harness, strings.Join(supportedHarnessNames, ", "))
		}
	} else if len(state.Harnesses) > 0 {
		// Use state.json to determine installed harnesses.
		for _, hs := range state.Harnesses {
			for _, h := range allHarnesses {
				if h.Name() == hs.Name {
					targetHarnesses = append(targetHarnesses, h)
					break
				}
			}
		}
	} else {
		// No state — fall back to detection.
		detected := core.DetectAll(allHarnesses)
		for _, dh := range detected {
			targetHarnesses = append(targetHarnesses, dh.Harness)
		}
	}

	if len(targetHarnesses) == 0 {
		fmt.Fprintln(out, "No harnesses to uninstall from. Nothing to do.")
		return nil
	}

	// --- Resolve which components to remove ---
	removeDesignMemory := false
	selectedComponents := uninstallableComponents
	if len(flags.Components) > 0 {
		var selected []component.Component
		for _, name := range flags.Components {
			switch name {
			case component.SkillCommands.String():
				selected = append(selected, component.SkillCommands)
			case component.MCPGates.String():
				selected = append(selected, component.MCPGates)
			case component.ReviewAgents.String():
				selected = append(selected, component.ReviewAgents)
			case component.DesignMemory.String():
				removeDesignMemory = true
				selected = append(selected, component.DesignMemory)
			default:
				return fmt.Errorf("unknown component %q; valid values: skill+commands, mcp-gates, review-agents, design-memory", name)
			}
		}
		selectedComponents = selected
	}

	// Warn if design-memory is being removed.
	if removeDesignMemory {
		fmt.Fprintln(out, "WARNING: design-memory (.ui-craft/) contains your design notes (brief.md, tokens.md, etc.).")
		fmt.Fprintln(out, "         These files will be permanently deleted.")
		fmt.Fprintln(out)
		if !flags.Yes {
			fmt.Fprint(out, "Continue? [y/N] ")
			var answer string
			if _, err := fmt.Fscan(cmd.InOrStdin(), &answer); err != nil || !strings.EqualFold(strings.TrimSpace(answer), "y") {
				fmt.Fprintln(out, "Aborted.")
				return nil
			}
		}
	}

	// --- Snapshot before removal ---
	backupRoot := filepath.Join(home, ".ui-craft-backups")
	store := backup.NewStore(backupRoot, fs, nil)

	var snapTargets []backup.SnapshotTarget
	for _, h := range targetHarnesses {
		paths := h.ConfigPaths()
		for _, p := range []string{paths.MCPConfig, paths.SkillsDir, paths.AgentsDir, paths.AgentsMDPath} {
			if p == "" {
				continue
			}
			snapTargets = append(snapTargets, backup.SnapshotTarget{
				Harness:  h.Name(),
				OrigPath: p,
			})
		}
		// Also snapshot design-memory if requested.
		if removeDesignMemory {
			dmPath := filepath.Join(flags.Dir, ".ui-craft")
			if flags.Dir == "" || flags.Dir == "." {
				if cwd, err := os.Getwd(); err == nil {
					dmPath = filepath.Join(cwd, ".ui-craft")
				}
			}
			snapTargets = append(snapTargets, backup.SnapshotTarget{
				Harness:  h.Name(),
				OrigPath: dmPath,
			})
		}
	}

	snapID, err := store.Snapshot(snapTargets, cmdVersion, backup.SourceUninstall)
	if err != nil {
		return fmt.Errorf("uninstall: snapshot failed: %w", err)
	}
	fmt.Fprintf(out, "Snapshot created: %s (restore with: ui-craft rollback %s)\n\n", snapID, snapID)

	// --- Remove per-harness ---
	removedHarnesses := map[string]bool{}
	for _, h := range targetHarnesses {
		paths := h.ConfigPaths()
		hName := h.Name()

		for _, comp := range selectedComponents {
			switch comp {
			case component.MCPGates:
				if err := removeMCP(fs, out, hName, h, paths); err != nil {
					fmt.Fprintf(out, "  %s/mcp-gates: error: %v\n", hName, err)
				}

			case component.SkillCommands:
				skillDir := filepath.Join(paths.SkillsDir, "ui-craft")
				if err := removeDir(fs, skillDir); err != nil {
					fmt.Fprintf(out, "  %s/skill+commands: error: %v\n", hName, err)
				} else {
					fmt.Fprintf(out, "  %s/skill+commands: removed %s\n", hName, skillDir)
				}
				// For Codex: also remove the managed block from AGENTS.md
				if hName == "codex" && paths.AgentsMDPath != "" {
					if err := removeAgentsMDBlock(fs, paths.AgentsMDPath); err != nil {
						fmt.Fprintf(out, "  %s/AGENTS.md managed block: error: %v\n", hName, err)
					} else {
						fmt.Fprintf(out, "  %s/AGENTS.md: managed block removed\n", hName)
					}
				}

			case component.ReviewAgents:
				if !h.Supports(component.ReviewAgents) {
					fmt.Fprintf(out, "  %s/review-agents: skipped (not supported by this harness)\n", hName)
					continue
				}
				if paths.AgentsDir == "" {
					continue
				}
				count := 0
				for _, name := range []string{"design-reviewer.md", "a11y-auditor.md"} {
					p := filepath.Join(paths.AgentsDir, name)
					if err := fs.Remove(p); err == nil {
						count++
					}
				}
				fmt.Fprintf(out, "  %s/review-agents: removed %d agent file(s)\n", hName, count)

			case component.DesignMemory:
				dmDir := flags.Dir
				if dmDir == "" || dmDir == "." {
					if cwd, err := os.Getwd(); err == nil {
						dmDir = cwd
					}
				}
				if absDir, err := filepath.Abs(dmDir); err == nil {
					dmDir = absDir
				}
				uiCraftDir := filepath.Join(dmDir, ".ui-craft")
				if err := removeDir(fs, uiCraftDir); err != nil {
					fmt.Fprintf(out, "  design-memory: error: %v\n", err)
				} else {
					fmt.Fprintf(out, "  design-memory: removed %s\n", uiCraftDir)
				}
			}
		}
		removedHarnesses[hName] = true
	}

	// --- Update state.json ---
	if flags.Harness != "" {
		// Remove just this harness's state entry (or its selected components).
		if len(flags.Components) == 0 || removeDesignMemory {
			// Full harness removal.
			var kept []core.HarnessState
			for _, hs := range state.Harnesses {
				if hs.Name != flags.Harness {
					kept = append(kept, hs)
				}
			}
			state.Harnesses = kept
		} else {
			// Partial removal: strip selected components from harness state.
			removedSet := map[string]bool{}
			for _, c := range selectedComponents {
				removedSet[c.String()] = true
			}
			for i, hs := range state.Harnesses {
				if hs.Name == flags.Harness {
					var kept []string
					for _, c := range hs.InstalledComponents {
						if !removedSet[c] {
							kept = append(kept, c)
						}
					}
					state.Harnesses[i].InstalledComponents = kept
					break
				}
			}
		}
	} else {
		// Removed all targeted harnesses.
		var kept []core.HarnessState
		for _, hs := range state.Harnesses {
			if !removedHarnesses[hs.Name] {
				kept = append(kept, hs)
			}
		}
		state.Harnesses = kept
	}

	if err := core.SaveState(fs, stateRoot, state); err != nil {
		fmt.Fprintf(out, "\nwarning: could not update state.json: %v\n", err)
	}

	fmt.Fprintf(out, "\nUninstall complete. To restore: ui-craft rollback %s\n", snapID)
	return nil
}

// removeMCP removes only the ui-craft server entry from the harness's MCP config
// while preserving all other servers.
func removeMCP(fs fsutil.FileSystem, out interface{ Write([]byte) (int, error) }, hName string, h harness.Harness, paths harness.ConfigPaths) error {
	target := paths.MCPConfig
	if target == "" {
		return nil
	}

	existing, err := fs.ReadFile(target)
	if err != nil {
		// File doesn't exist — nothing to remove.
		fmt.Fprintf(out, "  %s/mcp-gates: no MCP config found at %s\n", hName, target)
		return nil
	}

	var updated []byte
	switch h.Name() {
	case "claude":
		// Claude uses a separate file per server — just remove the whole file.
		if err := fs.Remove(target); err != nil {
			return fmt.Errorf("remove %s: %w", target, err)
		}
		fmt.Fprintf(out, "  %s/mcp-gates: removed %s\n", hName, target)
		return nil

	case "cursor", "gemini":
		// JSON/JSONC — remove "mcpServers"."ui-craft".
		result, err := filemerge.RemoveJSONKey(existing, "mcpServers", "ui-craft")
		if err != nil {
			return err
		}
		updated = result

	case "opencode":
		// JSONC — remove "mcp"."ui-craft".
		result, err := filemerge.RemoveJSONKey(existing, "mcp", "ui-craft")
		if err != nil {
			return err
		}
		updated = result

	case "codex":
		// TOML — remove [mcp_servers.ui-craft] block.
		content := string(existing)
		content = filemerge.RemoveTOMLTable(content, "mcp_servers", "ui-craft")
		updated = []byte(content)
	}

	if updated != nil {
		if _, err := fsutil.WriteFileAtomic(fs, target, updated, 0o644); err != nil {
			return fmt.Errorf("write %s: %w", target, err)
		}
		fmt.Fprintf(out, "  %s/mcp-gates: removed ui-craft server entry from %s\n", hName, target)
	}
	return nil
}

// removeAgentsMDBlock removes the ui-craft managed block from an AGENTS.md file,
// preserving all other content.
func removeAgentsMDBlock(fs fsutil.FileSystem, agentsMDPath string) error {
	existing, err := fs.ReadFile(agentsMDPath)
	if err != nil {
		return nil // file doesn't exist — nothing to do
	}
	updated := filemerge.RemoveManagedBlock(string(existing))
	if _, err := fsutil.WriteFileAtomic(fs, agentsMDPath, []byte(updated), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", agentsMDPath, err)
	}
	return nil
}

// removeDir removes a directory tree. Returns nil if the directory doesn't exist.
func removeDir(fs fsutil.FileSystem, dir string) error {
	if _, err := fs.Stat(dir); err != nil {
		return nil // doesn't exist — nothing to remove
	}
	return os.RemoveAll(dir)
}
