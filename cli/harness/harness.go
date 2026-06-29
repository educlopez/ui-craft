// Package harness defines the Harness port and its associated types.
// Each AI coding tool (Claude Code, Cursor, Codex, Gemini, OpenCode) has a
// concrete adapter in its own file; all share the same interface.
package harness

import (
	"errors"
	"io/fs"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// ErrNotImplemented is returned by Write* methods that are stubbed in this
// slice and will be completed in later slices (4, 5, 8).
var ErrNotImplemented = errors.New("not implemented in this slice")

// ErrUnsupported is returned by WriteAgents for harnesses that have no native
// sub-agent format (Cursor, Codex, Gemini). core.Plan maps this to a skip notice
// so the exit code remains 0 (graceful-skip spec scenario).
var ErrUnsupported = errors.New("component not supported by this harness")

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
	// CommandsDir is the absolute path to the harness's slash-commands directory.
	// Non-empty only for command-capable harnesses (claude, opencode).
	// claude:    ~/.claude/commands
	// opencode:  ~/.config/opencode/commands
	// cursor/codex/gemini: "" (unsupported)
	CommandsDir string
	// ProjectRoot is the working project directory (may be empty for global
	// installs). Adapters that support project-scoped configs use this.
	ProjectRoot string
	// AgentsMDPath is the absolute path to the AGENTS.md file that receives
	// the managed block for Codex. Empty for all other harnesses.
	// When ProjectRoot is set, this is the project-local AGENTS.md; otherwise
	// it is the global ~/.codex/AGENTS.md.
	AgentsMDPath string
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
	// Component identifies which component produced this Change. Set by
	// core.Apply so callers can filter changes by component without path matching.
	Component string
	// HarnessName identifies which harness adapter produced this Change.
	// Set by core.Apply so callers can filter by harness name.
	HarnessName string
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

	// ConfigRoot returns the absolute path to the harness's primary config
	// directory (e.g. ~/.claude, ~/.cursor). Returns an empty string when the
	// root cannot be determined (e.g. missing APPDATA on Windows, empty HOME).
	// Callers should treat an empty string as "not available".
	ConfigRoot() string

	// WriteMCP writes the ui-craft MCP server entry into the harness's MCP config.
	WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error)

	// WriteSkill copies the embedded harness skills tree into the harness's skills dir.
	// mirror is the skills-rooted sub-FS from assets.SkillsFS() for the harness.
	// The CLI owns the top-level skill subdirs it installs; every file is written
	// via WriteFileAtomic (idempotent byte-compare).
	// For Codex, a second write target is the project AGENTS.md managed-block.
	WriteSkill(w fsutil.FileSystem, mirror fs.FS) (Change, error)

	// WriteAgents writes review agent definitions into the harness's agent dir.
	// agentsFS is the harness-specific sub-FS rooted at the agent definitions
	// directory. Each
	// .md file in the FS is written as a separate agent file.
	// Harnesses without a native sub-agent format (Cursor, Codex, Gemini) return
	// ErrUnsupported; core.Plan converts this to a graceful skip (exit code 0).
	WriteAgents(w fsutil.FileSystem, agentsFS fs.FS) ([]Change, error)

	// WriteCommands writes slash-command .md files flat into the harness's
	// commands directory (ConfigPaths().CommandsDir). commandsFS is the
	// harness-specific sub-FS from assets.CommandsFS(h), rooted at the commands
	// level so each entry is a flat <name>.md file.
	// Command-capable harnesses (claude, opencode) implement this; cursor, codex,
	// and gemini return ErrUnsupported. A nil commandsFS also returns ErrUnsupported.
	// Stale command files (owned by a prior install but absent from commandsFS)
	// are removed — cleanup is bounded to files derived from commandsFS, never
	// the entire CommandsDir (other user files are preserved).
	WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]Change, error)
}
