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

// ParityResult records the outcome of one parity check that was actually run.
type ParityResult struct {
	// CheckName is a short label identifying the check (e.g. "skill", "mcp", "agents").
	CheckName string
	// Passed is true when the check found the expected artifact on disk.
	Passed bool
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
// (e.g. ~/.claude).  Pass an empty string to auto-detect via ClaudeHarness.ConfigRoot().
//
// Returns (issues, results) where results lists every check that was actually run
// (only for installed components), and issues lists the checks that failed.
// Callers should use results to emit PASS/FAIL output — never emit PASS for a
// component that does not appear in results.
func VerifyClaudeCodeParity(filesystem fsutil.FileSystem, state *InstallState, claudeConfigRoot string) ([]ParityIssue, []ParityResult) {
	h := harness.ClaudeHarness{}

	// Resolve config root via the harness's own ConfigRoot() method — robust,
	// no path reversal required.
	if claudeConfigRoot == "" {
		claudeConfigRoot = h.ConfigRoot()
	}

	// Find the claude harness state.
	claudeState := FindHarness(state, "claude")
	if claudeState == nil {
		// Nothing recorded for claude — nothing to verify.
		return nil, nil
	}

	var issues []ParityIssue
	var results []ParityResult

	installed := map[string]bool{}
	for _, c := range claudeState.InstalledComponents {
		installed[c] = true
	}

	// Check skill+commands — only if it was recorded as installed.
	if installed[component.SkillCommands.String()] {
		skillDir := filepath.Join(claudeConfigRoot, "skills", "ui-craft")
		entries, err := fsutil.ReadDir(filesystem, skillDir)
		passed := err == nil && len(entries) > 0
		results = append(results, ParityResult{CheckName: "skill", Passed: passed})
		if !passed {
			issues = append(issues, ParityIssue{
				Check:       "skill",
				Description: fmt.Sprintf("expected at least one file in %s, got none (err: %v)", skillDir, err),
			})
		}
	}

	// Check mcp-gates — only if it was recorded as installed.
	if installed[component.MCPGates.String()] {
		mcpFile := filepath.Join(claudeConfigRoot, "mcp", "ui-craft.json")
		data, err := filesystem.ReadFile(mcpFile)
		passed := err == nil && len(data) > 0
		results = append(results, ParityResult{CheckName: "mcp", Passed: passed})
		if !passed {
			issues = append(issues, ParityIssue{
				Check:       "mcp",
				Description: fmt.Sprintf("expected non-empty %s (err: %v)", mcpFile, err),
			})
		}
	}

	// Check review-agents — only if it was recorded as installed.
	if installed[component.ReviewAgents.String()] {
		agentsDir := filepath.Join(claudeConfigRoot, "agents")
		entries, err := fsutil.ReadDir(filesystem, agentsDir)
		passed := false
		if err == nil {
			for _, e := range entries {
				if !e.IsDir() && filepath.Ext(e.Name()) == ".md" {
					passed = true
					break
				}
			}
		}
		results = append(results, ParityResult{CheckName: "agents", Passed: passed})
		if err != nil {
			issues = append(issues, ParityIssue{
				Check:       "agents",
				Description: fmt.Sprintf("expected agents dir %s to exist (err: %v)", agentsDir, err),
			})
		} else if !passed {
			issues = append(issues, ParityIssue{
				Check:       "agents",
				Description: fmt.Sprintf("expected at least one .md agent file in %s", agentsDir),
			})
		}
	}

	// design-memory has NO disk-presence check — do NOT append to results.
	// Never emit a PASS for design-memory here.

	return issues, results
}
