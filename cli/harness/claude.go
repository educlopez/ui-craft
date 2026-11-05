package harness

import (
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
)

// ClaudeHarness is the adapter for Claude Code (Anthropic).
//
// Config root: $CLAUDE_CONFIG_DIR when set, else ~/.claude on every OS
// (%USERPROFILE%\.claude on Windows; %APPDATA%\Claude belongs to Claude
// Desktop, not Claude Code).
// Detection:  config root dir OR "claude" on PATH.
// MCP config: user scope lives under "mcpServers" in ~/.claude.json
// ($CLAUDE_CONFIG_DIR/.claude.json when that variable is set); project scope
// under "mcpServers" in <project>/.mcp.json. Both files are shared, so
// WriteMCP merges one key and preserves everything else.
// Skills dir: <root>/skills/   Agents dir: <root>/agents/   Commands: <root>/commands/
// Supports:   SkillCommands, MCPGates, ReviewAgents, DesignMemory (all true).
type ClaudeHarness struct {
	// projectRoot is set via WithProjectRoot so ConfigPaths() resolves to
	// project-scoped paths. Empty (zero value) means global scope.
	projectRoot string
}

// Compile-time check: ClaudeHarness must satisfy Harness.
var _ Harness = ClaudeHarness{}

func (h ClaudeHarness) Name() string { return "claude" }

// WithProjectRoot returns a copy of ClaudeHarness scoped to projectRoot. See
// Harness.WithProjectRoot for why this exists.
func (h ClaudeHarness) WithProjectRoot(projectRoot string) Harness {
	h.projectRoot = projectRoot
	return h
}

// ConfigRoot returns Claude Code's config root. Satisfies the Harness interface.
func (h ClaudeHarness) ConfigRoot() string { return h.configRoot() }

// configRoot returns $CLAUDE_CONFIG_DIR when set to an absolute path, else
// ~/.claude. An unresolvable home dir yields "".
func (h ClaudeHarness) configRoot() string {
	if dir := envDir("CLAUDE_CONFIG_DIR"); dir != "" {
		return dir
	}
	home := homeDir()
	if home == "" {
		return ""
	}
	return filepath.Join(home, ".claude")
}

// userMCPConfig returns the file Claude Code reads user-scope MCP servers
// from: $CLAUDE_CONFIG_DIR/.claude.json when the variable is set, else
// ~/.claude.json (next to, not inside, ~/.claude).
func (h ClaudeHarness) userMCPConfig() string {
	if dir := envDir("CLAUDE_CONFIG_DIR"); dir != "" {
		return filepath.Join(dir, ".claude.json")
	}
	home := homeDir()
	if home == "" {
		return ""
	}
	return filepath.Join(home, ".claude.json")
}

// Detect checks for the config root directory or "claude" on PATH.
// It uses the package-level lookPath and statPath vars so tests can inject fakes.
// If configRoot() returns empty (empty home), the harness is reported as not
// installed rather than constructing a bogus path.
func (h ClaudeHarness) Detect() (DetectResult, error) {
	root := h.configRoot()
	if root == "" {
		return DetectResult{Installed: false}, nil
	}

	// Primary: check directory existence.
	if _, err := statPath(root); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
		}, nil
	}

	// Secondary: check binary on PATH.
	if bin, err := lookPath("claude"); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
			BinaryPath: bin,
		}, nil
	}

	return DetectResult{Installed: false}, nil
}

// ConfigPaths returns Claude Code's paths for this harness's scope: global
// (home-derived) by default, or project-scoped when constructed via
// WithProjectRoot. Equivalent to ConfigPathsFor(h.projectRoot).
func (h ClaudeHarness) ConfigPaths() ConfigPaths {
	return h.ConfigPathsFor(h.projectRoot)
}

// ConfigPathsFor returns Claude Code's paths, scoped to projectRoot when
// non-empty. Project-local targets: <projectRoot>/.claude/{skills,commands,agents}
// and <projectRoot>/.mcp.json.
func (h ClaudeHarness) ConfigPathsFor(projectRoot string) ConfigPaths {
	if projectRoot != "" {
		return ConfigPaths{
			MCPConfig:   filepath.Join(projectRoot, ".mcp.json"),
			SkillsDir:   filepath.Join(projectRoot, ".claude", "skills"),
			AgentsDir:   filepath.Join(projectRoot, ".claude", "agents"),
			CommandsDir: filepath.Join(projectRoot, ".claude", "commands"),
			ProjectRoot: projectRoot,
		}
	}
	root := h.configRoot()
	if root == "" {
		return ConfigPaths{}
	}
	return ConfigPaths{
		MCPConfig:   h.userMCPConfig(),
		SkillsDir:   filepath.Join(root, "skills"),
		AgentsDir:   filepath.Join(root, "agents"),
		CommandsDir: filepath.Join(root, "commands"),
	}
}

// Supports reports capability support. Claude Code supports all four components.
func (h ClaudeHarness) Supports(c component.Component) bool {
	switch c {
	case component.SkillCommands, component.MCPGates, component.ReviewAgents, component.DesignMemory:
		return true
	default:
		return false
	}
}

// WriteMCP merges the ui-craft server into "mcpServers" of ~/.claude.json
// (global) or <project>/.mcp.json (project):
//
//	{ ..., "mcpServers": { ..., "<name>": { "command": "...", "args": [...] } } }
//
// Both files belong to the user (~/.claude.json is Claude Code's own state
// file), so the merge keeps every other key's bytes and position, writes only
// when our entry actually changes, and refuses to touch a file that is not
// valid JSON (the error aborts the install and triggers rollback; nothing is
// written).
//
// Project scope also migrates the shape older ui-craft versions wrote to
// .mcp.json: a top-level "ui-craft" key with no "mcpServers" wrapper.
func (h ClaudeHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	target := h.ConfigPaths().MCPConfig
	if target == "" {
		return Change{}, errors.New("claude: cannot resolve the MCP config path (home directory unknown)")
	}

	prior, existed, err := readConfigFile(w, target)
	if err != nil {
		return Change{}, fmt.Errorf("claude: read MCP config %s: %w", target, err)
	}

	data := prior
	changed := false
	if h.projectRoot != "" && existed {
		if legacy := filemerge.LookupOrderedJSONKey(prior, "", server.Name); isLegacyServerEntry(legacy) {
			out, removed, err := filemerge.RemoveOrderedJSONKey(prior, "", server.Name)
			if err != nil {
				return Change{}, fmt.Errorf("claude: %s is not valid JSON; refusing to modify it: %w", target, err)
			}
			data, changed = out, removed
		}
	}

	// A struct keeps "command" before "args", the order `claude mcp add` uses.
	entry := struct {
		Command string   `json:"command"`
		Args    []string `json:"args"`
	}{server.Command, server.Args}
	out, upserted, err := filemerge.UpsertOrderedJSONKey(data, "mcpServers", server.Name, entry)
	if err != nil {
		return Change{}, fmt.Errorf("claude: %s is not valid JSON; refusing to modify it: %w", target, err)
	}
	changed = changed || upserted

	ch := Change{
		FilePath:      target,
		PriorBytes:    nil,
		ExistedBefore: existed,
		Strategy:      ConfigFile,
	}
	if existed {
		ch.PriorBytes = prior
	}
	if !changed {
		return ch, nil
	}
	// ~/.claude.json also holds Claude Code's account and session state, so a
	// new one is created private; an existing file keeps its own mode.
	newMode := fs.FileMode(0o644)
	if h.projectRoot == "" {
		newMode = 0o600
	}
	wr, err := writeConfigFile(w, target, out, newMode)
	if err != nil {
		return Change{}, fmt.Errorf("claude: write MCP config %s: %w", target, err)
	}
	ch.Changed = wr.Changed
	return ch, nil
}

// isLegacyServerEntry reports whether raw is the server object an older
// ui-craft version wrote at the top level of .mcp.json ({"command": ...}).
func isLegacyServerEntry(raw []byte) bool {
	if raw == nil {
		return false
	}
	return filemerge.LookupOrderedJSONKey(raw, "", "command") != nil
}

// legacyTargets lists what older ui-craft versions wrote where Claude Code
// never reads it: the per-server file under <root>/mcp/ and, on Windows,
// everything under %APPDATA%\Claude (Claude Desktop's directory).
// The project-scope .mcp.json shape is migrated inside WriteMCP itself.
func (h ClaudeHarness) legacyTargets(c component.Component) []legacyTarget {
	if h.projectRoot != "" {
		return nil
	}
	roots := []string{h.configRoot()}
	if appdata := windowsAppDataDir("Claude"); appdata != "" {
		roots = append(roots, appdata)
	}
	var out []legacyTarget
	for i, root := range roots {
		if root == "" {
			continue
		}
		switch c {
		case component.MCPGates:
			out = append(out, legacyTarget{path: filepath.Join(root, "mcp", "ui-craft.json"), kind: legacyFile, pruneDir: true})
		case component.SkillCommands:
			if i == 0 {
				continue // <root>/skills and <root>/commands are the current paths
			}
			out = append(out,
				legacyTarget{path: filepath.Join(root, "skills"), kind: legacySkillDirs, pruneDir: true},
				legacyTarget{path: filepath.Join(root, "commands"), kind: legacyCommandFiles, pruneDir: true},
			)
		case component.ReviewAgents:
			if i == 0 {
				continue
			}
			out = append(out, legacyTarget{path: filepath.Join(root, "agents"), kind: legacyAgentFiles, pruneDir: true})
		}
	}
	return out
}

// WriteSkill copies the embedded Claude skills tree into <root>/skills/.
// The mirror FS is rooted at the skills level (assets.SkillsFS("claude")),
// so walking it yields <id>/SKILL.md paths that land at depth-1:
// <root>/skills/<id>/SKILL.md (not <root>/skills/ui-craft/<id>/SKILL.md).
// The CLI has full ownership of each skill subdirectory it writes.
func (h ClaudeHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (Change, error) {
	destDir := h.ConfigPaths().SkillsDir
	ch, err := writeMirrorToDir(w, mirror, destDir)
	if err != nil {
		return Change{}, fmt.Errorf("claude: write skill mirror: %w", err)
	}
	return ch, nil
}

// WriteCommands writes slash-command .md files flat into <root>/commands/.
// commandsFS is the commands-rooted FS from assets.CommandsFS("claude"), where
// each entry is a flat <name>.md file. The CLI owns the command files it
// installs; stale files no longer in commandsFS are removed (scoped cleanup).
// A nil commandsFS returns ErrUnsupported.
func (h ClaudeHarness) WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]Change, error) {
	if commandsFS == nil {
		return nil, ErrUnsupported
	}
	commandsDir := h.ConfigPaths().CommandsDir
	return writeFlatMDToDir(w, commandsFS, commandsDir, "claude")
}

// WriteAgents writes the review agent definitions into Claude Code's native
// sub-agent directory (<root>/agents/). Each file in agentsFS is written
// as a separate agent file using WriteFileAtomic (idempotent byte-compare).
// The CLI has full-file ownership of each agent file it installs; a pre-existing
// user agent with a different name is never touched.
//
// agentsFS is the sub-FS rooted at assets/agents/claude/ (the Claude-format
// agent definitions). If agentsFS is nil, ErrUnsupported is returned.
func (h ClaudeHarness) WriteAgents(w fsutil.FileSystem, agentsFS fs.FS) ([]Change, error) {
	if agentsFS == nil {
		return nil, ErrUnsupported
	}
	agentsDir := h.ConfigPaths().AgentsDir
	return writeAgentsToDir(w, agentsFS, agentsDir, "claude")
}
