package core

import (
	"io/fs"

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
	// SnapPath is the primary filesystem path that Op will write (used to
	// pre-snapshot the file/directory before execution). Empty for ops that
	// write multiple files or don't know their target path at plan time.
	// Deprecated in favour of SnapPaths — if both are set, SnapPaths is used.
	SnapPath string
	// SnapPaths is the ordered list of filesystem paths (files or directories)
	// to include in the pre-snapshot. It supersedes SnapPath when non-empty,
	// allowing a single Op to snapshot multiple locations (e.g. the skills
	// ui-craft subdir AND ~/.codex/AGENTS.md for CodexHarness).
	SnapPaths []string
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

// MirrorProvider is a function that returns the embedded fs.FS subtree for the
// named harness. In production callers pass assets.Mirror; in tests a fixture
// FS can be injected.
type MirrorProvider func(harnessName string) fs.FS

// Plan builds an InstallPlan from the set of detected harnesses and the
// components the user selected. Targets whose harness does not support the
// component are marked Skip instead of being removed, so the confirm screen
// and final report can surface them explicitly.
//
// For the MCPGates component, Plan wires the concrete WriteMCP op and sets
// SnapPath so that core.Apply can snapshot the config file before writing.
// For the SkillCommands component, Plan wires WriteSkill with the mirror
// returned by mirrorProvider(harness.Name()) and sets SnapPath to the
// …/skills/ui-craft subdir (the subtree the CLI owns, bounding rollback to it).
// When the mirror provider returns nil for a harness, the target is marked Skip.
// The filesystem parameter is the FileSystem implementation to use for writes.
func Plan(detected []DetectedHarness, selected []component.Component, filesystem fsutil.FileSystem, mirrorProvider MirrorProvider) InstallPlan {
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

			switch c {
			case component.MCPGates:
				// Wire the concrete write op for MCPGates.
				snapPath := dh.Harness.ConfigPaths().MCPConfig
				h := dh.Harness
				w := filesystem
				srv := mcpServer
				target.SnapPath = snapPath
				target.Op = func() (harness.Change, error) {
					return h.WriteMCP(w, srv)
				}

			case component.SkillCommands:
				// Wire the concrete write op for SkillCommands (Slice 5).
				// SnapPath is the ui-craft subdir within skills — we own only
				// that subtree, so rollback blast radius is bounded to it.
				paths := dh.Harness.ConfigPaths()
				uicraftSubDir := paths.SkillsDir + "/ui-craft"
				h := dh.Harness
				w := filesystem
				var mirror fs.FS
				if mirrorProvider != nil {
					mirror = mirrorProvider(h.Name())
				}
				// Nil-mirror safety: if the harness has no embedded mirror, mark
				// the target as skipped rather than wiring a WriteSkill op with a
				// nil fs.FS (which would panic inside writeMirrorToDir).
				if mirror == nil {
					target.Skip = true
					target.SkipReason = "mirror not embedded for " + h.Name()
					targets = append(targets, target)
					continue
				}
				// Build the snap path list. For Codex, AGENTS.md is also written
				// by WriteSkill, so it must be snapshotted to allow full rollback.
				snapPaths := []string{uicraftSubDir}
				if paths.AgentsMDPath != "" {
					snapPaths = append(snapPaths, paths.AgentsMDPath)
				}
				target.SnapPaths = snapPaths
				target.SnapPath = uicraftSubDir // keep for legacy callers that read SnapPath
				target.Op = func() (harness.Change, error) {
					return h.WriteSkill(w, mirror)
				}
			}
			// WriteAgents ops are wired in Slice 8.

			targets = append(targets, target)
		}
	}
	return InstallPlan{Targets: targets}
}
