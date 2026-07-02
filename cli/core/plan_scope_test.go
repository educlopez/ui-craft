package core_test

// plan_scope_test.go covers core.InstallScope and the scope param threaded
// into core.Plan (PR 1 of the project-scoped installer change). Global scope
// (core.Global) MUST call Harness.ConfigPaths() (byte-identical existing
// behavior — regression guard). Project scope (core.Project) MUST call
// Harness.ConfigPathsFor(projectDir) instead.

import (
	"testing"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// TestPlan_globalScopeUsesConfigPaths verifies that core.Global scope wires
// the MCPGates op's SnapPath from Harness.ConfigPaths() (the existing global
// path), matching pre-scope-param behavior byte-for-byte.
func TestPlan_globalScopeUsesConfigPaths(t *testing.T) {
	h := stubHarness{name: "stub"}
	detected := []core.DetectedHarness{
		{Harness: h, Result: harness.DetectResult{Installed: true}},
	}
	selected := []component.Component{component.MCPGates}

	plan := core.Plan(detected, selected, fsutil.NewMemFS(), nil, nil, nil, nil, "", core.Global, "")

	if len(plan.Targets) != 1 {
		t.Fatalf("expected 1 target, got %d", len(plan.Targets))
	}
	want := h.ConfigPaths().MCPConfig
	if plan.Targets[0].SnapPath != want {
		t.Errorf("Global scope SnapPath = %q, want %q (from ConfigPaths())", plan.Targets[0].SnapPath, want)
	}
}

// TestPlan_projectScopeUsesConfigPathsFor verifies that core.Project scope
// wires the MCPGates op's SnapPath from Harness.ConfigPathsFor(projectDir)
// instead of the global ConfigPaths().
func TestPlan_projectScopeUsesConfigPathsFor(t *testing.T) {
	h := stubHarness{name: "stub"}
	detected := []core.DetectedHarness{
		{Harness: h, Result: harness.DetectResult{Installed: true}},
	}
	selected := []component.Component{component.MCPGates}
	projectRoot := "/tmp/my-project"

	plan := core.Plan(detected, selected, fsutil.NewMemFS(), nil, nil, nil, nil, "", core.Project, projectRoot)

	if len(plan.Targets) != 1 {
		t.Fatalf("expected 1 target, got %d", len(plan.Targets))
	}
	want := h.ConfigPathsFor(projectRoot).MCPConfig
	if plan.Targets[0].SnapPath != want {
		t.Errorf("Project scope SnapPath = %q, want %q (from ConfigPathsFor(%q))", plan.Targets[0].SnapPath, want, projectRoot)
	}
	// Global path must NOT be used in Project scope.
	globalPath := h.ConfigPaths().MCPConfig
	if plan.Targets[0].SnapPath == globalPath && want != globalPath {
		t.Errorf("Project scope leaked the global ConfigPaths() path: %q", globalPath)
	}
}

// TestInstallScope_zeroValueIsGlobal verifies core.Global is the zero value,
// so any caller that forgets to pass a scope (impossible now that it's a
// positional param, but defensively worth locking down) defaults to the safe,
// existing global behavior rather than silently going project-scoped.
func TestInstallScope_zeroValueIsGlobal(t *testing.T) {
	var zero core.InstallScope
	if zero != core.Global {
		t.Errorf("zero value of InstallScope = %v, want core.Global", zero)
	}
}
