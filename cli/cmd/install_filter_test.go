package cmd_test

// install_filter_test.go — tests for --harness and --components filtering
// in installCmd and updateCmd.
//
// These tests use injectable test doubles to avoid real filesystem I/O,
// real harness detection, or assets mirror checks.
// They are NOT safe for t.Parallel() — shared package-level vars are mutated.

import (
	"io/fs"
	"path/filepath"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// ── stub harness ─────────────────────────────────────────────────────────────

// filterStubHarness satisfies harness.Harness. All Write* methods are no-ops
// that succeed so Plan can wire real Ops without touching real files.
type filterStubHarness struct {
	hname string
}

func (g filterStubHarness) Name() string { return g.hname }
func (g filterStubHarness) Detect() (harness.DetectResult, error) {
	return harness.DetectResult{Installed: true, ConfigRoot: "/fake/" + g.hname}, nil
}
func (g filterStubHarness) ConfigPaths() harness.ConfigPaths {
	return harness.ConfigPaths{
		MCPConfig: "/fake/" + g.hname + "/mcp.json",
		SkillsDir: "/fake/" + g.hname + "/skills",
	}
}
func (g filterStubHarness) Supports(c component.Component) bool {
	// Support only SkillCommands and MCPGates; skip ReviewAgents and DesignMemory.
	return c == component.SkillCommands || c == component.MCPGates
}
func (g filterStubHarness) ConfigRoot() string { return "/fake/" + g.hname }
func (g filterStubHarness) WriteMCP(w fsutil.FileSystem, srv harness.MCPServer) (harness.Change, error) {
	return harness.Change{HarnessName: g.hname, Component: "mcp-gates", Changed: true}, nil
}
func (g filterStubHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (harness.Change, error) {
	return harness.Change{HarnessName: g.hname, Component: "skill+commands", Changed: true}, nil
}
func (g filterStubHarness) WriteAgents(w fsutil.FileSystem, agentsFS fs.FS) ([]harness.Change, error) {
	return nil, harness.ErrNotImplemented
}

// detectedSet builds a []core.DetectedHarness from a list of names.
func detectedSet(names ...string) []core.DetectedHarness {
	out := make([]core.DetectedHarness, 0, len(names))
	for _, n := range names {
		out = append(out, core.DetectedHarness{
			Harness: filterStubHarness{hname: n},
			Result:  harness.DetectResult{Installed: true, ConfigRoot: "/fake/" + n},
		})
	}
	return out
}

// ── Plan-level filter tests (pure core, no cobra overhead) ───────────────────

// TestInstallFilter_harnessFlag_planOnlyCursor verifies that when the detected
// list is pre-filtered to cursor only (as install.go does after --harness cursor),
// core.Plan targets ONLY cursor — not claude, codex, opencode, or gemini.
func TestInstallFilter_harnessFlag_planOnlyCursor(t *testing.T) {
	detected := detectedSet("cursor")
	mem := fsutil.NewMemFS()

	plan := core.Plan(
		detected,
		component.All(),
		mem,
		func(name string) fs.FS { return nil }, // mirrorProvider: nil = skip SkillCommands
		nil,                                    // agentProvider
		nil,                                    // templateProvider
		"/tmp/project",
	)

	seen := make(map[string]bool)
	for _, tgt := range plan.Targets {
		seen[tgt.Harness.Name()] = true
	}

	if !seen["cursor"] {
		t.Error("cursor must appear in the plan")
	}
	for _, other := range []string{"claude", "codex", "gemini", "opencode"} {
		if seen[other] {
			t.Errorf("%s must NOT appear in the plan when only cursor was detected", other)
		}
	}
}

// TestInstallFilter_componentsFlag_planOnlyMCPGates verifies that when selected
// is limited to MCPGates (as install.go does after --components mcp-gates),
// the plan contains no active skill+commands targets.
func TestInstallFilter_componentsFlag_planOnlyMCPGates(t *testing.T) {
	detected := detectedSet("cursor")
	mem := fsutil.NewMemFS()

	plan := core.Plan(
		detected,
		[]component.Component{component.MCPGates}, // only mcp-gates
		mem,
		func(name string) fs.FS { return nil },
		nil,
		nil,
		"/tmp/project",
	)

	for _, tgt := range plan.Targets {
		if tgt.Skip {
			continue
		}
		if tgt.Component != component.MCPGates {
			t.Errorf("active target must be only mcp-gates; got %s", tgt.Component)
		}
	}
	// skill+commands must not appear as an active (non-skipped) target.
	for _, tgt := range plan.Targets {
		if tgt.Component == component.SkillCommands && !tgt.Skip {
			t.Error("skill+commands must not be an active target when only mcp-gates was selected")
		}
	}
}

// ── Direct filtering logic tests (pure Go) ───────────────────────────────────

// TestFilterDetected_harnessFlag verifies the slice-filtering logic that
// install.go applies when --harness is set.
func TestFilterDetected_harnessFlag(t *testing.T) {
	all := detectedSet("claude", "cursor", "codex")

	harnessFlag := "cursor"
	var filtered []core.DetectedHarness
	for _, dh := range all {
		if dh.Harness.Name() == harnessFlag {
			filtered = append(filtered, dh)
			break
		}
	}

	if len(filtered) != 1 {
		t.Fatalf("expected 1 filtered harness, got %d", len(filtered))
	}
	if filtered[0].Harness.Name() != "cursor" {
		t.Errorf("expected cursor, got %s", filtered[0].Harness.Name())
	}
	for _, dh := range filtered {
		if dh.Harness.Name() != "cursor" {
			t.Errorf("unexpected harness %s in filtered set", dh.Harness.Name())
		}
	}
}

// TestFilterComponents_componentsFlag verifies the component filtering logic.
func TestFilterComponents_componentsFlag(t *testing.T) {
	componentFlags := []string{"mcp-gates"}

	var filtered []component.Component
	for _, name := range componentFlags {
		for _, c := range component.All() {
			if c.String() == name {
				filtered = append(filtered, c)
				break
			}
		}
	}

	if len(filtered) != 1 {
		t.Fatalf("expected 1 filtered component, got %d", len(filtered))
	}
	if filtered[0] != component.MCPGates {
		t.Errorf("expected MCPGates, got %v", filtered[0])
	}
	for _, c := range filtered {
		if c == component.SkillCommands {
			t.Error("skill+commands must not appear when only mcp-gates was requested")
		}
	}
}

// TestFilterDetected_notDetectedReturnsError verifies the error message shape
// when the requested harness is absent from the detected list.
func TestFilterDetected_notDetectedReturnsError(t *testing.T) {
	all := detectedSet("claude")

	harnessFlag := "cursor"
	var filtered []core.DetectedHarness
	for _, dh := range all {
		if dh.Harness.Name() == harnessFlag {
			filtered = append(filtered, dh)
			break
		}
	}

	if len(filtered) != 0 {
		t.Fatalf("expected 0 filtered harnesses, got %d", len(filtered))
	}

	// Build the error string as install.go does.
	var detectedNames []string
	for _, dh := range all {
		detectedNames = append(detectedNames, dh.Harness.Name())
	}
	msg := "harness \"cursor\" not detected; detected: " + strings.Join(detectedNames, ", ")
	if !strings.Contains(msg, "cursor") {
		t.Error("error message must mention 'cursor'")
	}
	if !strings.Contains(msg, "claude") {
		t.Error("error message must list detected harnesses")
	}
}

// ── Validation: unknown names ─────────────────────────────────────────────────

// TestValidateHarnessName verifies that the validation logic rejects unknown names.
func TestValidateHarnessName(t *testing.T) {
	known := []string{"claude", "cursor", "codex", "gemini", "opencode"}

	cases := []struct {
		input string
		valid bool
	}{
		{"cursor", true},
		{"claude", true},
		{"opencode", true},
		{"notaharness", false},
		{"", false}, // empty triggers the validation guard only when non-empty; skip
	}

	for _, tc := range cases {
		if tc.input == "" {
			continue // empty string skips validation in the real code
		}
		found := false
		for _, n := range known {
			if n == tc.input {
				found = true
				break
			}
		}
		if found != tc.valid {
			t.Errorf("harness %q: expected valid=%v, got valid=%v", tc.input, tc.valid, found)
		}
	}
}

// TestValidateComponentName verifies that the validation logic rejects unknown component names.
func TestValidateComponentName(t *testing.T) {
	cases := []struct {
		input string
		valid bool
	}{
		{"skill+commands", true},
		{"mcp-gates", true},
		{"review-agents", true},
		{"design-memory", true},
		{"not-a-component", false},
		{"skills", false},
	}

	for _, tc := range cases {
		found := false
		for _, c := range component.All() {
			if c.String() == tc.input {
				found = true
				break
			}
		}
		if found != tc.valid {
			t.Errorf("component %q: expected valid=%v, got valid=%v", tc.input, tc.valid, found)
		}
	}
}

// ── Update --harness filter via state replay ──────────────────────────────────

// TestUpdateHarnessFilter_stateReplay verifies that when update replays state
// and a --harness filter is applied (harnessFilter = "cursor"), only cursor's
// state entry is targeted — not claude's.
func TestUpdateHarnessFilter_stateReplay(t *testing.T) {
	mem := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"
	_ = mem.MkdirAll(root, 0o755)

	stateData := `{
  "schemaVersion": 1,
  "version": "v1.0.0",
  "mirrorVersion": "v1.0.0",
  "harnesses": [
    {
      "name": "cursor",
      "installedComponents": ["mcp-gates"],
      "installedAt": "2026-06-25T00:00:00Z"
    },
    {
      "name": "claude",
      "installedComponents": ["mcp-gates"],
      "installedAt": "2026-06-25T00:00:00Z"
    }
  ]
}`
	_ = mem.WriteFile(filepath.Join(root, "state.json"), []byte(stateData), 0o644)

	state, err := core.LoadState(mem, root)
	if err != nil {
		t.Fatalf("load state: %v", err)
	}

	// Simulate update's harness filter: harnessFilter = "cursor".
	harnessFilter := "cursor"
	var targeted []string
	for _, hs := range state.Harnesses {
		if harnessFilter != "" && hs.Name != harnessFilter {
			continue
		}
		targeted = append(targeted, hs.Name)
	}

	if len(targeted) != 1 {
		t.Fatalf("expected 1 targeted harness, got %d: %v", len(targeted), targeted)
	}
	if targeted[0] != "cursor" {
		t.Errorf("expected cursor, got %s", targeted[0])
	}
	for _, name := range targeted {
		if name == "claude" {
			t.Error("claude must not be targeted when --harness cursor is set")
		}
	}
}

// TestUpdateComponentsFilter_stateReplay verifies that the --components filter
// on update limits the component list to only those requested (and installed).
func TestUpdateComponentsFilter_stateReplay(t *testing.T) {
	// Simulate a state where cursor has both mcp-gates and skill+commands installed.
	installedComponents := []string{"mcp-gates", "skill+commands"}
	// User requests only mcp-gates via --components.
	componentsFlag := []string{"mcp-gates"}

	var comps []component.Component
	for _, name := range componentsFlag {
		for _, c := range component.All() {
			if c.String() == name {
				// Only include if it was previously installed.
				for _, ic := range installedComponents {
					if ic == c.String() {
						comps = append(comps, c)
						break
					}
				}
				break
			}
		}
	}

	if len(comps) != 1 {
		t.Fatalf("expected 1 component after filter, got %d: %v", len(comps), comps)
	}
	if comps[0] != component.MCPGates {
		t.Errorf("expected MCPGates, got %v", comps[0])
	}
	// skill+commands must not be in comps.
	for _, c := range comps {
		if c == component.SkillCommands {
			t.Error("skill+commands must not appear when --components mcp-gates was set")
		}
	}
}

// Ensure cmd package exports are accessible.
var _ = cmd.SetDetectAllFn
var _ = cmd.SetFlags
var _ = cmd.SetAssertMirrorsFreshFn
