package core

import (
	"github.com/educlopez/ui-craft/cli/component"
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

// Plan builds an InstallPlan from the set of detected harnesses and the
// components the user selected. Targets whose harness does not support the
// component are marked Skip instead of being removed, so the confirm screen
// and final report can surface them explicitly.
func Plan(detected []DetectedHarness, selected []component.Component) InstallPlan {
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
			targets = append(targets, ComponentTarget{
				Harness:   dh.Harness,
				Component: c,
				Skip:      false,
			})
		}
	}
	return InstallPlan{Targets: targets}
}
