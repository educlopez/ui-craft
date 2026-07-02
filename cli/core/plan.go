package core

import (
	"errors"
	"io/fs"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// InstallScope selects which set of Harness config paths Plan resolves when
// building an InstallPlan: Global (home-derived, the existing behavior) or
// Project (cwd-rooted, project-scoped installer).
//
// Global is the zero value so any caller that constructs an InstallScope
// without an explicit value defaults to the existing, safe global behavior
// rather than silently going project-scoped.
type InstallScope int

const (
	// Global resolves every Harness's paths via Harness.ConfigPaths() — the
	// existing home-derived behavior. Zero value; existing callers pass this
	// explicitly to keep global-install behavior byte-for-byte unchanged.
	Global InstallScope = iota
	// Project resolves every Harness's paths via Harness.ConfigPathsFor(projectDir)
	// instead of the global ConfigPaths(). projectDir must be non-empty when
	// scope is Project (callers are responsible for validating this before
	// calling Plan; Plan itself does not error on an empty projectDir here —
	// it simply forwards whatever projectDir the harness adapter receives).
	Project
)

// TemplateProvider is a function that returns the embedded fs.FS containing
// the design-memory scaffold templates. In production callers pass
// assets.TemplateFS; in tests a fixture FS can be injected.
type TemplateProvider func() fs.FS

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

// SkillsProvider is a function that returns the skills-rooted embedded fs.FS
// subtree for the named harness. In production callers pass assets.SkillsFS;
// in tests a fixture FS can be injected.
type SkillsProvider func(harnessName string) fs.FS

// AgentProvider is a function that returns the embedded fs.FS containing the
// review agent definitions for the named harness. The returned FS is rooted at
// the agent definitions directory for that harness (e.g. assets/agents/claude/).
// Returns nil when no agent definitions exist for the harness (e.g. Cursor, Codex,
// Gemini — which have Supports(ReviewAgents)=false and are already skipped before
// AgentProvider is called). In production callers pass assets.Agents; in tests a
// fixture FS can be injected.
type AgentProvider func(harnessName string) fs.FS

// CommandsProvider is a function that returns the commands-rooted fs.FS for the
// named harness. In production callers pass assets.CommandsFS; in tests a fixture
// FS can be injected. Returns nil for harnesses that have no embedded commands
// (cursor, codex, gemini).
type CommandsProvider func(harnessName string) fs.FS

// Plan builds an InstallPlan from the set of detected harnesses and the
// components the user selected. Targets whose harness does not support the
// component are marked Skip instead of being removed, so the confirm screen
// and final report can surface them explicitly.
//
// For the MCPGates component, Plan wires the concrete WriteMCP op and sets
// SnapPath so that core.Apply can snapshot the config file before writing.
// For the SkillCommands component, Plan wires WriteSkill with the skills FS
// returned by skillsProvider(harness.Name()) and then chains WriteCommands
// for command-capable harnesses (claude, opencode). CommandsDir is added to
// SnapPaths for harnesses that support commands. For harnesses where WriteCommands
// returns ErrUnsupported, the commands step is silently skipped (skills-only mode).
// When the skills provider returns nil for a harness, the target is marked Skip.
// For the DesignMemory component, Plan wires ScaffoldDesignMemory with the
// template FS returned by templateProvider() and sets SnapPath to the
// .ui-craft/ subdir inside projectDir. When templateProvider is nil or
// returns nil, the target is marked Skip.
// For the ReviewAgents component, Plan wires WriteAgents with the agent FS
// returned by agentProvider(harness.Name()) and sets SnapPaths to the agents
// directory so rollback removes only the created agent files, never the user's
// other agents. When agentProvider is nil or returns nil for a harness, the
// target is marked Skip.
// The filesystem parameter is the FileSystem implementation to use for writes.
// projectDir is the target project directory (--dir flag value or cwd) used
// for the DesignMemory component's scaffold location.
// scope selects which Harness config paths are resolved: Global calls
// Harness.ConfigPaths() (existing, home-derived behavior, byte-for-byte
// unchanged); Project calls Harness.ConfigPathsFor(scopeProjectRoot) instead.
// scopeProjectRoot is the project root passed to ConfigPathsFor when scope is
// Project; it is ignored when scope is Global. NOTE: scopeProjectRoot is
// deliberately a separate parameter from projectDir — projectDir governs
// DesignMemory's scaffold location (unrelated to harness config-path scoping)
// and the two may differ in future callers, so they are not conflated here.
// NOTE: templateProvider must return the templates/-rooted sub-FS (i.e.
// assets.TemplateFS(), not the raw embed.FS). If the raw embed.FS were used,
// ScaffoldDesignMemory would write files under a "templates/" prefix inside
// .ui-craft/, producing wrong destination paths.
func Plan(detected []DetectedHarness, selected []component.Component, filesystem fsutil.FileSystem, skillsProvider SkillsProvider, agentProvider AgentProvider, templateProvider TemplateProvider, commandsProvider CommandsProvider, projectDir string, scope InstallScope, scopeProjectRoot string) InstallPlan {
	// configPathsFor resolves a single Harness's ConfigPaths according to scope,
	// so every switch-case below shares one code path instead of duplicating
	// the Global/Project branch per component.
	configPathsFor := func(h harness.Harness) harness.ConfigPaths {
		if scope == Project {
			return h.ConfigPathsFor(scopeProjectRoot)
		}
		return h.ConfigPaths()
	}

	var targets []ComponentTarget
	for _, dh := range detected {
		// Resolve the Harness instance whose Write* closures will actually be
		// invoked. Every Write* method (WriteMCP, WriteSkill, WriteCommands,
		// WriteAgents) resolves its own target paths internally via
		// h.ConfigPaths() on its OWN receiver — it does NOT take a paths
		// parameter. So for Project scope, the harness value used to build
		// every WriterOp closure below MUST be constructed via
		// WithProjectRoot(scopeProjectRoot) first; otherwise every Write* call
		// would silently fall through to global ConfigPaths() regardless of
		// scope, and configPathsFor's Project-scoped ConfigPathsFor(...)
		// result (used only for SnapPath/SnapPaths bookkeeping above) would
		// disagree with what actually gets written to disk.
		h := dh.Harness
		if scope == Project {
			h = h.WithProjectRoot(scopeProjectRoot)
		}
		for _, c := range selected {
			if !h.Supports(c) {
				targets = append(targets, ComponentTarget{
					Harness:    h,
					Component:  c,
					Skip:       true,
					SkipReason: c.String() + " not supported by " + h.Name(),
				})
				continue
			}

			target := ComponentTarget{
				Harness:   h,
				Component: c,
				Skip:      false,
			}

			switch c {
			case component.MCPGates:
				// Wire the concrete write op for MCPGates.
				snapPath := configPathsFor(h).MCPConfig
				hh := h
				w := filesystem
				srv := mcpServer
				target.SnapPath = snapPath
				target.Op = func() (harness.Change, error) {
					return hh.WriteMCP(w, srv)
				}

			case component.SkillCommands:
				// Wire the concrete write op for SkillCommands.
				// SnapPath is the skills dir — WriteSkill now uses depth-1 layout,
				// writing each skill as a peer subdirectory directly under SkillsDir.
				// The CLI owns only the subdirs it installs; rollback removes those.
				// For command-capable harnesses (claude, opencode), WriteCommands is
				// also called after WriteSkill, and CommandsDir is added to SnapPaths.
				paths := configPathsFor(h)
				skillsDir := paths.SkillsDir
				hh := h
				w := filesystem
				var mirror fs.FS
				if skillsProvider != nil {
					mirror = skillsProvider(h.Name())
				}
				// Nil-skills safety: if the harness has no embedded skills tree, mark
				// the target as skipped rather than wiring a WriteSkill op with a
				// nil fs.FS (which would panic inside writeSkillsToDir).
				if mirror == nil {
					target.Skip = true
					target.SkipReason = "skills not embedded for " + h.Name()
					targets = append(targets, target)
					continue
				}
				// Resolve the commands FS for this harness (nil for cursor/codex/gemini).
				var commandsFS fs.FS
				if commandsProvider != nil {
					commandsFS = commandsProvider(h.Name())
				}
				// Build the snap path list. For Codex, AGENTS.md is also written
				// by WriteSkill, so it must be snapshotted to allow full rollback.
				// For command-capable harnesses, CommandsDir is also snapshotted.
				snapPaths := []string{skillsDir}
				if paths.AgentsMDPath != "" {
					snapPaths = append(snapPaths, paths.AgentsMDPath)
				}
				if commandsFS != nil && paths.CommandsDir != "" {
					snapPaths = append(snapPaths, paths.CommandsDir)
				}
				target.SnapPaths = snapPaths
				target.SnapPath = skillsDir // keep for legacy callers that read SnapPath
				cFS := commandsFS           // capture for closure
				target.Op = func() (harness.Change, error) {
					ch, err := hh.WriteSkill(w, mirror)
					if err != nil {
						return ch, err
					}
					// Chain WriteCommands for command-capable harnesses.
					// ErrUnsupported is silently skipped (skills-only mode).
					if cFS != nil {
						cmdChanges, cmdErr := hh.WriteCommands(w, cFS)
						if cmdErr != nil && !errors.Is(cmdErr, harness.ErrUnsupported) {
							return ch, cmdErr
						}
						// If any command file changed, mark the aggregate Change as changed.
						for _, cc := range cmdChanges {
							if cc.Changed {
								ch.Changed = true
								break
							}
						}
					}
					return ch, nil
				}

			case component.DesignMemory:
				// Wire the concrete write op for DesignMemory (Slice 6).
				// SnapPath is the .ui-craft/ subdir inside projectDir — rollback
				// only deletes files created by this run (ExistedBefore=false).
				var tmplFS fs.FS
				if templateProvider != nil {
					tmplFS = templateProvider()
				}
				if tmplFS == nil {
					target.Skip = true
					target.SkipReason = "design-memory templates not embedded"
					targets = append(targets, target)
					continue
				}
				dir := projectDir
				if dir == "" {
					dir = "."
				}
				w := filesystem
				// filepath.Join avoids platform-specific string concatenation.
				snapPath := filepath.Join(dir, ".ui-craft")
				target.SnapPath = snapPath
				target.Op = func() (harness.Change, error) {
					result, err := harness.ScaffoldDesignMemory(w, tmplFS, dir)
					if err != nil {
						return harness.Change{}, err
					}
					// Summarise: Changed if any file was newly created.
					anyChanged := false
					for _, ch := range result.Changes {
						if ch.Changed {
							anyChanged = true
							break
						}
					}
					// ExistedBefore is always true for the aggregate Change so that
					// rollback does NOT wholesale-RemoveAll the .ui-craft/ directory.
					// The backup store's per-file snapshot metadata governs which
					// individual files get deleted on restore (only those with
					// ExistedBefore=false in the snapshot, i.e. files created this run).
					// Pre-existing user files (ExistedBefore=true in snapshot) are
					// restored to their original content and never deleted.
					return harness.Change{
						FilePath:      snapPath,
						ExistedBefore: true,
						Changed:       anyChanged,
					}, nil
				}

			case component.ReviewAgents:
				// Wire the concrete write op for ReviewAgents (Slice 8).
				// SnapPaths is set to the agents directory so the backup store
				// can snapshot it; rollback removes only agent files created by
				// this run (ExistedBefore=false), never the user's other agents.
				// On a fresh install where the agents dir did not previously exist,
				// the aggregate Change reflects ExistedBefore=false so callers know
				// the directory itself was created by this run (and rollback will
				// remove it via the tombstone entry in the backup store).
				var agentsFS fs.FS
				if agentProvider != nil {
					agentsFS = agentProvider(h.Name())
				}
				// Nil agentsFS: mark as skip (no agent definitions embedded for this harness).
				if agentsFS == nil {
					target.Skip = true
					target.SkipReason = "review-agents: agent definitions not embedded for " + h.Name()
					targets = append(targets, target)
					continue
				}
				agentsDir := configPathsFor(h).AgentsDir
				hh := h
				w := filesystem
				// Check whether the agents directory already exists before wiring the
				// write op. This result is captured in the aggregate Change so callers
				// receive an accurate ExistedBefore value. The backup store's per-file
				// snapshot metadata independently governs rollback behaviour.
				_, statErr := filesystem.Stat(agentsDir)
				agentsDirExisted := statErr == nil
				// Snapshot the agents directory so rollback can remove only the
				// agent files we created, leaving the user's other agents intact.
				// SnapPaths supersedes SnapPath; the deprecated SnapPath field is
				// intentionally omitted here (see SnapPath deprecation notice).
				target.SnapPaths = []string{agentsDir}
				aFS := agentsFS
				target.Op = func() (harness.Change, error) {
					changes, err := hh.WriteAgents(w, aFS)
					if err != nil {
						return harness.Change{}, err
					}
					// Aggregate: Changed if any agent file changed or was created.
					anyChanged := false
					for _, ch := range changes {
						if ch.Changed {
							anyChanged = true
							break
						}
					}
					return harness.Change{
						FilePath:      agentsDir,
						ExistedBefore: agentsDirExisted,
						Changed:       anyChanged,
						Component:     component.ReviewAgents.String(),
						HarnessName:   hh.Name(),
					}, nil
				}
			}

			targets = append(targets, target)
		}
	}
	return InstallPlan{Targets: targets}
}
