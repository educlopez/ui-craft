// Package harness defines the Harness port and its associated types.
// Each AI coding tool (Claude Code, Cursor, Codex, Gemini, OpenCode) has a
// concrete adapter in its own file; all share the same interface.
package harness

import (
	"errors"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// ErrNotImplemented is returned by Write* methods that are stubbed in this
// slice and will be completed in later slices (4, 5, 8).
var ErrNotImplemented = errors.New("not implemented in this slice")

// DetectResult describes whether a harness is installed and where.
type DetectResult struct {
	// Installed is true when the harness was detected on this machine.
	Installed bool
	// ConfigRoot is the absolute path to the harness's primary config directory
	// (e.g. ~/.claude, ~/.cursor). Empty when Installed is false.
	ConfigRoot string
	// BinaryPath is the resolved absolute path to the harness binary.
	// Empty when detection was directory-based (e.g. Cursor) or not installed.
	BinaryPath string
}

// ConfigPaths contains the canonical paths for each kind of file the CLI
// writes for a given harness.
type ConfigPaths struct {
	// MCPConfig is the absolute path to the harness's MCP server config file.
	MCPConfig string
	// SkillsDir is the absolute path to the harness's skills directory.
	SkillsDir string
	// AgentsDir is the absolute path to the harness's sub-agent directory.
	// Empty for harnesses that don't support review agents.
	AgentsDir string
	// ProjectRoot is the working project directory (may be empty for global
	// installs). Adapters that support project-scoped configs use this.
	ProjectRoot string
}

// WriteStrategy describes which merge algorithm a WriteMCP implementation uses.
type WriteStrategy int

const (
	// SeparateFiles writes a standalone JSON file per MCP server (Claude Code).
	SeparateFiles WriteStrategy = iota
	// ConfigFile merges into a shared JSON config file (Cursor).
	ConfigFile
	// MergeIntoSettings merges into the harness's main settings file (Gemini, OpenCode).
	MergeIntoSettings
	// TOMLFile upserts a server block into a TOML config file (Codex).
	TOMLFile
)

// Change records what a Write* method did to a file on disk (or would do in
// a dry-run). core.Apply collects Changes so a mid-plan failure can roll back.
type Change struct {
	// FilePath is the absolute path of the file that was (or would be) written.
	FilePath string
	// PriorBytes holds the file's contents before the write. Nil if the file
	// did not exist (ExistedBefore == false).
	PriorBytes []byte
	// ExistedBefore is true when the file already existed before this write.
	ExistedBefore bool
	// Changed is true when the file bytes actually changed (or were newly
	// created). False means the content was already identical — no write was
	// performed. Use this field (not a PriorBytes comparison) to decide whether
	// to report "configured" vs "already configured (no change)".
	Changed bool
	// MalformedBase is true when the harness's existing config file was present
	// but contained malformed JSON. The merge fell back to {} (the overlay was
	// still applied and a clean file was written), and callers should warn the
	// user that the original corrupt file was snapshotted before rewrite.
	MalformedBase bool
	// Strategy is the idempotency strategy that was applied.
	Strategy WriteStrategy
}

// MCPServer is the server definition injected into each harness's MCP config.
type MCPServer struct {
	// Name is the key used inside the harness's MCP server map (e.g. "ui-craft").
	Name string
	// Command is the executable (e.g. "npx").
	Command string
	// Args are the arguments passed to Command (e.g. ["-y", "ui-craft-mcp"]).
	Args []string
}

// Harness is the port that every AI coding tool adapter must implement.
// Write* methods are declared here; adapters in this slice return
// ErrNotImplemented — they will be completed in slices 4, 5, and 8.
type Harness interface {
	// Name returns the canonical lowercase harness name (e.g. "claude", "cursor").
	Name() string

	// Detect determines whether this harness is installed on the current machine.
	// It wraps exec.LookPath and os.Stat via package-level vars so tests can
	// inject fake implementations.
	Detect() (DetectResult, error)

	// ConfigPaths returns the set of filesystem paths relevant to this harness.
	// The returned paths reflect the discovered installation root, not hardcoded
	// defaults, satisfying gotcha #2 (OS/version path variance).
	ConfigPaths() ConfigPaths

	// Supports reports whether this harness can accept the given component.
	// It is the single source of truth for the capability matrix.
	Supports(c component.Component) bool

	// WriteMCP writes the ui-craft MCP server entry into the harness's MCP config.
	// Slice 2 adapters return ErrNotImplemented.
	WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error)

	// WriteSkill copies the embedded harness mirror into the harness's skills dir.
	// Slice 2 adapters return ErrNotImplemented.
	//
	// TODO(slice-5): this signature will gain a `mirror` parameter (the embedded
	// harness-specific asset bundle) once the assets package lands in Slice 5.
	// Update all adapter implementations and callers at that time.
	WriteSkill(w fsutil.FileSystem) (Change, error)

	// WriteAgents writes review agent definitions into the harness's agent dir.
	// Slice 2 adapters return ErrNotImplemented for all harnesses.
	WriteAgents(w fsutil.FileSystem) ([]Change, error)
}
