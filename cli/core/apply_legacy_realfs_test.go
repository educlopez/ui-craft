package core_test

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

func seed(t *testing.T, p, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func embedded(t *testing.T, tree fs.FS, p string) string {
	t.Helper()
	data, err := fs.ReadFile(tree, p)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// TestApplyProject_migratesLegacyPaths installs into a project that holds an
// older ui-craft project install (skills in .cursor/rules and straight under
// .gemini, singular .opencode dirs, the unwrapped .mcp.json entry) next to
// user content. The install must move ui-craft to the new paths, remove only
// ui-craft's legacy copies, and the pre-install snapshot must bring every
// legacy file back on restore (rollback safety).
func TestApplyProject_migratesLegacyPaths(t *testing.T) {
	projectRoot := t.TempDir()
	fakeHome := t.TempDir()
	t.Setenv("HOME", fakeHome)
	t.Setenv("USERPROFILE", fakeHome)

	legacy := map[string]string{
		filepath.Join(projectRoot, ".cursor", "rules", "ui-craft", "SKILL.md"):   embedded(t, assets.SkillsFS("cursor"), "ui-craft/SKILL.md"),
		filepath.Join(projectRoot, ".gemini", "audit", "SKILL.md"):               embedded(t, assets.SkillsFS("gemini"), "audit/SKILL.md"),
		filepath.Join(projectRoot, ".opencode", "skill", "ui-craft", "SKILL.md"): embedded(t, assets.SkillsFS("opencode"), "ui-craft/SKILL.md"),
		filepath.Join(projectRoot, ".opencode", "agent", "a11y-auditor.md"):      embedded(t, assets.Agents("opencode"), "a11y-auditor.md"),
		filepath.Join(projectRoot, ".opencode", "command", "polish.md"):          embedded(t, assets.CommandsFS("opencode"), "polish.md"),
	}
	for p, c := range legacy {
		seed(t, p, c)
	}
	user := map[string]string{
		filepath.Join(projectRoot, ".cursor", "rules", "team.mdc"):     "---\ndescription: team rule\n---\n",
		filepath.Join(projectRoot, ".opencode", "command", "mine.md"):  "my command\n",
		filepath.Join(projectRoot, ".gemini", "commands", "x.toml"):    "prompt = 'x'\n",
		filepath.Join(projectRoot, ".claude", "agents", "my-agent.md"): "---\nname: my-agent\n---\n",
	}
	for p, c := range user {
		seed(t, p, c)
	}
	mcpJSON := filepath.Join(projectRoot, ".mcp.json")
	seed(t, mcpJSON, `{"mcpServers":{"db":{"command":"pg-mcp"}},"ui-craft":{"command":"npx","args":["-y","ui-craft-mcp@0.9.0"]}}`)

	var detected []core.DetectedHarness
	for _, h := range harness.All() {
		detected = append(detected, core.DetectedHarness{Harness: h, Result: harness.DetectResult{Installed: true}})
	}
	osfs := fsutil.OsFS{}
	plan := core.Plan(detected, []component.Component{component.SkillCommands, component.MCPGates, component.ReviewAgents},
		osfs, assets.SkillsFS, assets.Agents, assets.TemplateFS, assets.CommandsFS, projectRoot, core.Project, projectRoot)

	// Every legacy file must be covered by some target's snapshot paths.
	var snaps []string
	for _, tg := range plan.Targets {
		snaps = append(snaps, tg.SnapPaths...)
		snaps = append(snaps, tg.SnapPath)
	}
	for p := range legacy {
		covered := false
		for _, s := range snaps {
			if s != "" && (p == s || strings.HasPrefix(p, s+string(filepath.Separator))) {
				covered = true
				break
			}
		}
		if !covered {
			t.Errorf("legacy file %s is not covered by any snapshot path", p)
		}
	}

	store := core.NewProjectBackupStore(projectRoot, osfs, nil)
	result, err := core.Apply(plan, osfs, store, "v-test", false)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}

	for p := range legacy {
		if _, err := os.Stat(p); err == nil {
			t.Errorf("legacy file survived the install: %s", p)
		}
	}
	for p, c := range user {
		if got, err := os.ReadFile(p); err != nil || string(got) != c {
			t.Errorf("user file changed or removed: %s", p)
		}
	}
	for _, p := range []string{
		filepath.Join(projectRoot, ".cursor", "skills", "ui-craft", "SKILL.md"),
		filepath.Join(projectRoot, ".gemini", "skills", "audit", "SKILL.md"),
		filepath.Join(projectRoot, ".opencode", "skills", "ui-craft", "SKILL.md"),
		filepath.Join(projectRoot, ".opencode", "agents", "a11y-auditor.md"),
		filepath.Join(projectRoot, ".opencode", "commands", "polish.md"),
	} {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("new path missing: %s", p)
		}
	}
	got, _ := os.ReadFile(mcpJSON)
	var mcp map[string]map[string]any
	if err := json.Unmarshal(got, &mcp); err != nil {
		t.Fatalf(".mcp.json is not a {key: object} document after install: %v\n%s", err, got)
	}
	if _, legacyKey := mcp["ui-craft"]; legacyKey || mcp["mcpServers"]["db"] == nil || mcp["mcpServers"]["ui-craft"] == nil {
		t.Errorf(".mcp.json after install:\n%s", got)
	}

	// Rollback: the snapshot taken before the install restores every legacy file.
	if err := store.Restore(result.SnapshotID); err != nil {
		t.Fatalf("Restore: %v", err)
	}
	for p, c := range legacy {
		if got, err := os.ReadFile(p); err != nil || string(got) != c {
			t.Errorf("legacy file not restored by rollback: %s (err %v)", p, err)
		}
	}
}
