package assets_test

import (
	"io/fs"
	"testing"

	"github.com/educlopez/ui-craft/cli/assets"
)

// TestSkillsFS_knownHarness verifies SkillsFS returns non-nil for every harness
// and that the returned FS is rooted at <h>/skills (depth-1 entries).
func TestSkillsFS_knownHarness(t *testing.T) {
	harnesses := []string{"claude", "cursor", "codex", "gemini", "opencode"}
	for _, h := range harnesses {
		t.Run(h, func(t *testing.T) {
			sfs := assets.SkillsFS(h)
			if sfs == nil {
				t.Fatalf("SkillsFS(%q) returned nil", h)
			}
			// Walk the FS and verify ui-craft/SKILL.md is reachable at depth-1
			// (i.e. "ui-craft/SKILL.md", not "<h>/skills/ui-craft/SKILL.md").
			found := false
			_ = fs.WalkDir(sfs, ".", func(path string, d fs.DirEntry, err error) error {
				if path == "ui-craft/SKILL.md" {
					found = true
				}
				return err
			})
			if !found {
				t.Errorf("SkillsFS(%q): ui-craft/SKILL.md not found at depth-1", h)
			}
		})
	}
}

// TestSkillsFS_unknownHarness verifies SkillsFS returns nil for an unknown name.
func TestSkillsFS_unknownHarness(t *testing.T) {
	sfs := assets.SkillsFS("nonexistent-harness-xyz")
	if sfs != nil {
		t.Error("SkillsFS(nonexistent) should return nil")
	}
}

// TestCommandsFS_commandCapable verifies CommandsFS returns non-nil for claude
// and opencode, and contains at least one *.md entry.
func TestCommandsFS_commandCapable(t *testing.T) {
	for _, h := range []string{"claude", "opencode"} {
		t.Run(h, func(t *testing.T) {
			cfs := assets.CommandsFS(h)
			if cfs == nil {
				t.Fatalf("CommandsFS(%q) returned nil", h)
			}
			var mdCount int
			_ = fs.WalkDir(cfs, ".", func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return err
				}
				if !d.IsDir() && len(path) > 3 && path[len(path)-3:] == ".md" {
					mdCount++
				}
				return nil
			})
			if mdCount == 0 {
				t.Errorf("CommandsFS(%q): no .md files found", h)
			}
		})
	}
}

// TestCommandsFS_skillsOnly verifies CommandsFS returns nil for harnesses that
// have no commands dir (cursor, codex, gemini).
func TestCommandsFS_skillsOnly(t *testing.T) {
	for _, h := range []string{"cursor", "codex", "gemini"} {
		t.Run(h, func(t *testing.T) {
			cfs := assets.CommandsFS(h)
			if cfs != nil {
				t.Errorf("CommandsFS(%q) should return nil for skills-only harness", h)
			}
		})
	}
}
