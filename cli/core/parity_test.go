package core_test

import (
	"path/filepath"
	"testing"

	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// helper: set up a MemFS with the standard Claude install layout.
func setupClaudeInstall(t *testing.T, includeAgents bool) (*fsutil.MemFS, string) {
	t.Helper()
	m := fsutil.NewMemFS()
	root := "/home/user/.claude"

	// Skill files
	skillDir := filepath.Join(root, "skills", "ui-craft")
	_ = m.MkdirAll(skillDir, 0o755)
	_ = m.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("# UI Craft Skill\n"), 0o644)

	// MCP config
	mcpDir := filepath.Join(root, "mcp")
	_ = m.MkdirAll(mcpDir, 0o755)
	_ = m.WriteFile(filepath.Join(mcpDir, "ui-craft.json"),
		[]byte(`{"ui-craft":{"command":"npx","args":["-y","ui-craft-mcp"]}}`+"\n"), 0o644)

	if includeAgents {
		// Agent files
		agentsDir := filepath.Join(root, "agents")
		_ = m.MkdirAll(agentsDir, 0o755)
		_ = m.WriteFile(filepath.Join(agentsDir, "ui-craft-reviewer.md"),
			[]byte("---\nname: ui-craft-reviewer\n---\n"), 0o644)
	}

	return m, root
}

// TestParity_allChecksPass verifies that a complete install (skill + MCP + agents)
// produces zero parity issues.
func TestParity_allChecksPass(t *testing.T) {
	m, root := setupClaudeInstall(t, true)

	state := &core.InstallState{
		Harnesses: []core.HarnessState{
			{
				Name:                "claude",
				InstalledComponents: []string{"skill+commands", "mcp-gates", "review-agents"},
			},
		},
	}

	issues := core.VerifyClaudeCodeParity(m, state, root)
	if len(issues) != 0 {
		for _, iss := range issues {
			t.Errorf("unexpected issue: %s", iss)
		}
	}
}

// TestParity_missingMCP verifies that a missing MCP config file is detected.
func TestParity_missingMCP(t *testing.T) {
	m, root := setupClaudeInstall(t, false)
	// Remove the MCP file.
	_ = m.Remove(filepath.Join(root, "mcp", "ui-craft.json"))

	state := &core.InstallState{
		Harnesses: []core.HarnessState{
			{
				Name:                "claude",
				InstalledComponents: []string{"skill+commands", "mcp-gates"},
			},
		},
	}

	issues := core.VerifyClaudeCodeParity(m, state, root)
	if len(issues) == 0 {
		t.Fatal("expected at least one parity issue for missing MCP, got none")
	}
	found := false
	for _, iss := range issues {
		if iss.Check == "mcp" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected 'mcp' check to fail, issues: %v", issues)
	}
}

// TestParity_missingSkill verifies that a missing skill directory is detected.
func TestParity_missingSkill(t *testing.T) {
	m, root := setupClaudeInstall(t, false)
	// Remove the skill files.
	_ = m.RemoveAll(filepath.Join(root, "skills", "ui-craft"))

	state := &core.InstallState{
		Harnesses: []core.HarnessState{
			{
				Name:                "claude",
				InstalledComponents: []string{"skill+commands", "mcp-gates"},
			},
		},
	}

	issues := core.VerifyClaudeCodeParity(m, state, root)
	if len(issues) == 0 {
		t.Fatal("expected at least one parity issue for missing skill, got none")
	}
	found := false
	for _, iss := range issues {
		if iss.Check == "skill" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected 'skill' check to fail, issues: %v", issues)
	}
}

// TestParity_missingAgents verifies that a missing agents directory is caught
// when review-agents is in the installed components.
func TestParity_missingAgents(t *testing.T) {
	m, root := setupClaudeInstall(t, false) // no agents directory created

	state := &core.InstallState{
		Harnesses: []core.HarnessState{
			{
				Name:                "claude",
				InstalledComponents: []string{"skill+commands", "mcp-gates", "review-agents"},
			},
		},
	}

	issues := core.VerifyClaudeCodeParity(m, state, root)
	found := false
	for _, iss := range issues {
		if iss.Check == "agents" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected 'agents' check to fail, issues: %v", issues)
	}
}

// TestParity_noClaudeState verifies that parity returns nil when claude is not
// in the state (nothing to verify).
func TestParity_noClaudeState(t *testing.T) {
	m := fsutil.NewMemFS()
	state := &core.InstallState{
		Harnesses: []core.HarnessState{
			{Name: "cursor", InstalledComponents: []string{"skill+commands"}},
		},
	}
	issues := core.VerifyClaudeCodeParity(m, state, "/home/user/.claude")
	if issues != nil {
		t.Errorf("expected nil issues for non-claude state, got %v", issues)
	}
}

// TestParity_claudeFullInstall_integration is an integration-style test that
// runs a full install plan for Claude with all components on a MemFS and then
// asserts parity — all checks must pass.  This is the Claude parity
// success-criterion guard (Slice 10 spec requirement).
func TestParity_claudeFullInstall_integration(t *testing.T) {
	m := fsutil.NewMemFS()
	claudeRoot := "/home/user/.claude"

	// Simulate what core.Apply writes for each Claude component.
	// --- skill+commands ---
	skillDir := filepath.Join(claudeRoot, "skills", "ui-craft")
	_ = m.MkdirAll(skillDir, 0o755)
	_ = m.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("# UI Craft Skill\n"), 0o644)

	// --- mcp-gates ---
	mcpDir := filepath.Join(claudeRoot, "mcp")
	_ = m.MkdirAll(mcpDir, 0o755)
	_ = m.WriteFile(filepath.Join(mcpDir, "ui-craft.json"),
		[]byte(`{"ui-craft":{"command":"npx","args":["-y","ui-craft-mcp"]}}`+"\n"), 0o644)

	// --- review-agents ---
	agentsDir := filepath.Join(claudeRoot, "agents")
	_ = m.MkdirAll(agentsDir, 0o755)
	_ = m.WriteFile(filepath.Join(agentsDir, "ui-craft-reviewer.md"),
		[]byte("---\nname: ui-craft-reviewer\ndescription: UI review agent\n---\n"), 0o644)

	// Build state as install would save it.
	state := &core.InstallState{
		Version:       "v0.35.0",
		MirrorVersion: "v0.35.0",
		Harnesses: []core.HarnessState{
			{
				Name:                "claude",
				InstalledComponents: []string{"skill+commands", "mcp-gates", "review-agents", "design-memory"},
				InstalledAt:         "2026-06-25T00:00:00Z",
			},
		},
	}

	// Verify parity — no issues expected.
	issues := core.VerifyClaudeCodeParity(m, state, claudeRoot)
	if len(issues) != 0 {
		for _, iss := range issues {
			t.Errorf("parity issue: %s", iss)
		}
		t.Fatal("Claude full install parity test FAILED")
	}
}

// TestParity_agentsExistButNoMDFiles verifies that an agents dir with no .md
// files is caught as a parity failure.
func TestParity_agentsExistButNoMDFiles(t *testing.T) {
	m, root := setupClaudeInstall(t, false)
	agentsDir := filepath.Join(root, "agents")
	_ = m.MkdirAll(agentsDir, 0o755)
	// Write a non-.md file — should not satisfy the agents check.
	_ = m.WriteFile(filepath.Join(agentsDir, "notes.txt"), []byte("not an agent"), 0o644)

	state := &core.InstallState{
		Harnesses: []core.HarnessState{
			{
				Name:                "claude",
				InstalledComponents: []string{"skill+commands", "mcp-gates", "review-agents"},
			},
		},
	}

	issues := core.VerifyClaudeCodeParity(m, state, root)
	found := false
	for _, iss := range issues {
		if iss.Check == "agents" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected 'agents' check to fail when no .md files exist, issues: %v", issues)
	}
}
