package core_test

// apply_project_realfs_test.go is the full end-to-end, real-filesystem
// (t.TempDir(), OsFS{} — not MemFS) integration test for PR 2 of the
// project-scoped installer change (design #917, tasks #918 T2.4). It builds
// a project-scoped Plan rooted at a temp project directory, applies it
// across ALL 5 harnesses, and asserts:
//
//  1. Every harness's project-local files land at the correct project-local
//     paths (per design's confirmed component/path map and PR1's
//     ConfigPathsFor implementations).
//  2. The project-local backup dir (<projectRoot>/.ui-craft-backups/) and
//     state.json (<projectRoot>/.ui-craft/state.json) exist and are rooted
//     at the temp project dir, NOT at $HOME.
//  3. Nothing was written outside the temp project dir — a $HOME-untouched
//     assertion mirroring apply_realfs_test.go's global-installer regression
//     guard, but from the opposite direction: confirms project-install does
//     NOT leak into global paths.

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

func TestApplyProject_allHarnesses_realFS(t *testing.T) {
	projectRoot := t.TempDir()
	// Isolate $HOME to a separate temp dir so the $HOME-untouched assertion
	// below is meaningful (a real developer machine's actual $HOME must never
	// be touched by this test, and setting HOME here also lets us assert
	// nothing landed there).
	fakeHomeDir := t.TempDir()
	t.Setenv("HOME", fakeHomeDir)

	fs := fsutil.OsFS{}

	// Build a DetectedHarness list for all 5 harnesses without depending on
	// what's actually installed on the machine running this test — project
	// install should work regardless of global detection state.
	var detected []core.DetectedHarness
	for _, h := range harness.All() {
		detected = append(detected, core.DetectedHarness{
			Harness: h,
			Result:  harness.DetectResult{Installed: true},
		})
	}

	selected := component.All()

	plan := core.Plan(
		detected,
		selected,
		fs,
		assets.SkillsFS,
		assets.Agents,
		assets.TemplateFS,
		assets.CommandsFS,
		projectRoot, // projectDir: governs DesignMemory's scaffold location
		core.Project,
		projectRoot, // scopeProjectRoot: governs ConfigPathsFor for all harnesses
	)

	if len(plan.Targets) == 0 {
		t.Fatal("expected at least one plan target")
	}

	store := core.NewProjectBackupStore(projectRoot, fs, nil)
	result, err := core.Apply(plan, fs, store, "v1.0.0-test", false)
	if err != nil {
		t.Fatalf("Apply failed: %v", err)
	}
	if len(result.Changes) == 0 {
		t.Fatal("expected at least one applied change")
	}

	// --- Save project-local state, per design's Q1 resolution ---
	state := &core.InstallState{SchemaVersion: core.StateSchemaVersion}
	stateRoot := core.ProjectStateRoot(projectRoot)
	if err := core.SaveState(fs, stateRoot, state); err != nil {
		t.Fatalf("SaveState failed: %v", err)
	}

	// --- Assertion 1: every harness's project-local files exist at the
	// correct project-local paths (per design's confirmed component/path map). ---
	wantPaths := []string{
		// Claude
		filepath.Join(projectRoot, ".claude", "skills", "ui-craft", "SKILL.md"),
		filepath.Join(projectRoot, ".mcp.json"),
		// Codex
		filepath.Join(projectRoot, ".codex", "skills", "ui-craft", "SKILL.md"),
		filepath.Join(projectRoot, "AGENTS.md"),
		filepath.Join(projectRoot, ".codex", "config.toml"),
		// Cursor
		filepath.Join(projectRoot, ".cursor", "rules", "ui-craft", "SKILL.md"),
		filepath.Join(projectRoot, ".cursor", "mcp.json"),
		// Gemini
		filepath.Join(projectRoot, ".gemini", "ui-craft", "SKILL.md"),
		filepath.Join(projectRoot, "GEMINI.md"),
		filepath.Join(projectRoot, ".gemini", "settings.json"),
		// OpenCode
		filepath.Join(projectRoot, ".opencode", "skill", "ui-craft", "SKILL.md"),
		filepath.Join(projectRoot, "opencode.json"),
	}
	for _, p := range wantPaths {
		if _, statErr := os.Stat(p); statErr != nil {
			t.Errorf("expected project-local file to exist: %s (stat error: %v)", p, statErr)
		}
	}

	// --- Assertion 2: project-local backup dir + state.json exist, rooted at
	// projectRoot, not $HOME. ---
	backupRoot := core.ProjectBackupRoot(projectRoot)
	if _, statErr := os.Stat(backupRoot); statErr != nil {
		t.Errorf("expected project-local backup dir to exist: %s (stat error: %v)", backupRoot, statErr)
	}
	if got, want := backupRoot, filepath.Join(projectRoot, ".ui-craft-backups"); got != want {
		t.Errorf("ProjectBackupRoot = %q, want %q", got, want)
	}

	stateFile := filepath.Join(stateRoot, "state.json")
	if _, statErr := os.Stat(stateFile); statErr != nil {
		t.Errorf("expected project-local state.json to exist: %s (stat error: %v)", stateFile, statErr)
	}
	if got, want := stateRoot, filepath.Join(projectRoot, ".ui-craft"); got != want {
		t.Errorf("ProjectStateRoot = %q, want %q", got, want)
	}

	// --- Assertion 3: nothing was written outside projectRoot — specifically,
	// $HOME (faked above) must remain completely empty. This is the
	// opposite-direction regression guard from apply_realfs_test.go's global
	// installer test: here we confirm project-install does NOT leak into
	// global/home paths. ---
	homeEntries, err := os.ReadDir(fakeHomeDir)
	if err != nil {
		t.Fatalf("read fake $HOME dir: %v", err)
	}
	if len(homeEntries) != 0 {
		var names []string
		for _, e := range homeEntries {
			names = append(names, e.Name())
		}
		t.Errorf("project install leaked into $HOME (%s): found entries %v — project install must be fully self-contained under projectRoot", fakeHomeDir, names)
	}

	// --- Assertion 4: managed-block idempotency for Codex's AGENTS.md and
	// Gemini's GEMINI.md — a second full install run must not duplicate the
	// managed block or otherwise change file content beyond what's already
	// there (Changed=false for the SkillCommands target on the second run). ---
	plan2 := core.Plan(
		detected,
		selected,
		fs,
		assets.SkillsFS,
		assets.Agents,
		assets.TemplateFS,
		assets.CommandsFS,
		projectRoot,
		core.Project,
		projectRoot,
	)
	result2, err := core.Apply(plan2, fs, store, "v1.0.0-test", false)
	if err != nil {
		t.Fatalf("second Apply failed: %v", err)
	}
	for _, ch := range result2.Changes {
		if ch.Component == component.SkillCommands.String() && ch.Changed {
			t.Errorf("second install run: %s/%s reported Changed=true, want false (idempotency regression)", ch.HarnessName, ch.Component)
		}
	}

	agentsMD, err := os.ReadFile(filepath.Join(projectRoot, "AGENTS.md"))
	if err != nil {
		t.Fatalf("read AGENTS.md: %v", err)
	}
	if n := countOccurrences(string(agentsMD), "<!-- BEGIN ui-craft"); n != 1 {
		t.Errorf("AGENTS.md has %d BEGIN markers after 2 installs, want exactly 1 (idempotency regression)", n)
	}

	geminiMD, err := os.ReadFile(filepath.Join(projectRoot, "GEMINI.md"))
	if err != nil {
		t.Fatalf("read GEMINI.md: %v", err)
	}
	if n := countOccurrences(string(geminiMD), "<!-- BEGIN ui-craft"); n != 1 {
		t.Errorf("GEMINI.md has %d BEGIN markers after 2 installs, want exactly 1 (idempotency regression)", n)
	}
}

// countOccurrences is a tiny substring-counting helper local to this test file.
func countOccurrences(haystack, needle string) int {
	count := 0
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			count++
		}
	}
	return count
}
