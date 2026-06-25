package core

import (
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// WriterOp is a function type that performs one file-write operation for a
// ComponentTarget. It returns the Change that was applied and any error.
// Slice 3 uses a test-double WriteOp; real writers (WriteMCP, WriteSkill,
// WriteAgents) will be wired in Slices 4, 5, and 8.
type WriterOp func() (harness.Change, error)

// ComponentTarget binds together one harness adapter, the component being
// installed, and the concrete write operation that delivers it.
type ComponentTarget struct {
	Harness   harness.Harness
	Component component.Component
	// Skip is set by Plan when Harness.Supports(Component) returns false.
	Skip       bool
	SkipReason string
	// Op is nil when Skip is true.
	Op WriterOp
	// SnapPath is the filesystem path that Op will write (used to pre-snapshot
	// the file before execution). Empty for ops that write multiple files or
	// don't know their target path at plan time.
	SnapPath string
}

// InstallPlan is the ordered set of writes that core.Apply will execute.
type InstallPlan struct {
	Targets []ComponentTarget
}

// mcpServer is the canonical MCP server definition injected by every WriteMCP
// implementation. Declared here so it is consistent across all callers.
var mcpServer = harness.MCPServer{
	Name:    "ui-craft",
	Command: "npx",
	Args:    []string{"-y", "ui-craft-mcp"},
}

// Plan builds an InstallPlan from the set of detected harnesses and the
// components the user selected. Targets whose harness does not support the
// component are marked Skip instead of being removed, so the confirm screen
// and final report can surface them explicitly.
//
// For the MCPGates component, Plan wires the concrete WriteMCP op and sets
// SnapPath so that core.Apply can snapshot the config file before writing.
// The fs parameter is the filesystem implementation to use for writes (pass
// fsutil.OsFS{} for real installs, a MemFS for tests).
func Plan(detected []DetectedHarness, selected []component.Component, fs fsutil.FileSystem) InstallPlan {
	var targets []ComponentTarget
	for _, dh := range detected {
		for _, c := range selected {
			if !dh.Harness.Supports(c) {
				targets = append(targets, ComponentTarget{
					Harness:    dh.Harness,
					Component:  c,
					Skip:       true,
					SkipReason: c.String() + " not supported by " + dh.Harness.Name(),
				})
				continue
			}

			target := ComponentTarget{
				Harness:   dh.Harness,
				Component: c,
				Skip:      false,
			}

			// Wire the concrete write op for MCPGates (Slice 4).
			if c == component.MCPGates {
				snapPath := dh.Harness.ConfigPaths().MCPConfig
				h := dh.Harness
				w := fs
				srv := mcpServer
				target.SnapPath = snapPath
				target.Op = func() (harness.Change, error) {
					return h.WriteMCP(w, srv)
				}
			}
			// WriteSkill and WriteAgents ops are wired in Slices 5 and 8.

			targets = append(targets, target)
		}
	}
	return InstallPlan{Targets: targets}
}
