// Package core — parity.go
// VerifyClaudeCodeParity checks that a CLI install into Claude Code produced
// the same surface as the native plugin: skill in skills dir, MCP entry in
// the standalone config file, and agents in the agents dir (if installed).
// This is the success-criterion guard for the Claude parity requirement
// (cli-installer §Claude Code Install Parity, Slice 10).
package core

import (
	"fmt"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// ParityIssue describes one failing parity check.
type ParityIssue struct {
	// Check is a short label identifying the check (e.g. "skill", "mcp", "agents").
	Check string
	// Description explains what was expected and what was found.
	Description string
}

func (p ParityIssue) String() string {
	return fmt.Sprintf("FAIL [%s]: %s", p.Check, p.Description)
}

// VerifyClaudeCodeParity verifies that all Claude-Code components recorded in
// state are actually present on disk.  It checks:
//   - skill+commands: at least one file under ~/.claude/skills/ui-craft/
//   - mcp-gates:      ~/.claude/mcp/ui-craft.json exists and is non-empty
//   - review-agents:  at least one .md file under ~/.claude/agents/ (only when
//     "review-agents" appears in the saved state for the claude harness)
//
// The filesystem parameter allows tests to inject a MemFS.
// claudeConfigRoot is the absolute path to the Claude config directory
// (e.g. ~/.claude).  Pass an empty string to auto-detect via ClaudeHarness.
func VerifyClaudeCodeParity(filesystem fsutil.FileSystem, state *InstallState, claudeConfigRoot string) []ParityIssue {
	h := harness.ClaudeHarness{}

	// Resolve config root.
	if claudeConfigRoot == "" {
		paths := h.ConfigPaths()
		claudeConfigRoot = filepath.Dir(filepath.Dir(paths.MCPConfig)) // ~/.claude
	}

	// Find the claude harness state.
	claudeState := FindHarness(state, "claude")
	if claudeState == nil {
		// Nothing recorded for claude — nothing to verify.
		return nil
	}

	var issues []ParityIssue

	installed := map[string]bool{}
	for _, c := range claudeState.InstalledComponents {
		installed[c] = true
	}

	// Check skill+commands.
	if installed[component.SkillCommands.String()] {
		skillDir := filepath.Join(claudeConfigRoot, "skills", "ui-craft")
		entries, err := fsutil.ReadDir(filesystem, skillDir)
		if err != nil || len(entries) == 0 {
			issues = append(issues, ParityIssue{
				Check:       "skill",
				Description: fmt.Sprintf("expected at least one file in %s, got none (err: %v)", skillDir, err),
			})
		}
	}

	// Check mcp-gates.
	if installed[component.MCPGates.String()] {
		mcpFile := filepath.Join(claudeConfigRoot, "mcp", "ui-craft.json")
		data, err := filesystem.ReadFile(mcpFile)
		if err != nil || len(data) == 0 {
			issues = append(issues, ParityIssue{
				Check:       "mcp",
				Description: fmt.Sprintf("expected non-empty %s (err: %v)", mcpFile, err),
			})
		}
	}

	// Check review-agents.
	if installed[component.ReviewAgents.String()] {
		agentsDir := filepath.Join(claudeConfigRoot, "agents")
		entries, err := fsutil.ReadDir(filesystem, agentsDir)
		if err != nil {
			issues = append(issues, ParityIssue{
				Check:       "agents",
				Description: fmt.Sprintf("expected agents dir %s to exist (err: %v)", agentsDir, err),
			})
		} else {
			// Check for at least one .md agent file.
			found := false
			for _, e := range entries {
				if !e.IsDir() && filepath.Ext(e.Name()) == ".md" {
					found = true
					break
				}
			}
			if !found {
				issues = append(issues, ParityIssue{
					Check:       "agents",
					Description: fmt.Sprintf("expected at least one .md agent file in %s", agentsDir),
				})
			}
		}
	}

	return issues
}
