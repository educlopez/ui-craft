package harness

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
)

// OpenCodeHarness is the adapter for OpenCode.
//
// Global root: $OPENCODE_CONFIG_DIR when set, else $XDG_CONFIG_HOME/opencode
// when set, else ~/.config/opencode — on every OS, Windows included.
// Detection:  global root dir OR "opencode" on PATH.
// MCP config: top-level "mcp" key of opencode.json (or of an existing
// opencode.jsonc when there is no opencode.json), global or project root.
// Dirs:       skills/, agents/, commands/ under the global root or under
// <project>/.opencode/. The plural names are canonical; the singular ones
// older ui-craft versions used are only read for backward compatibility and
// are swept by the legacy cleanup.
// Supports:   SkillCommands, MCPGates, ReviewAgents, DesignMemory (all true).
type OpenCodeHarness struct {
	// projectRoot is set via WithProjectRoot so ConfigPaths() resolves to
	// project-scoped paths. Empty (zero value) means global scope.
	projectRoot string
}

// Compile-time check: OpenCodeHarness must satisfy Harness.
var _ Harness = OpenCodeHarness{}

func (h OpenCodeHarness) Name() string { return "opencode" }

// WithProjectRoot returns a copy of OpenCodeHarness scoped to projectRoot. See
// Harness.WithProjectRoot for why this exists.
func (h OpenCodeHarness) WithProjectRoot(projectRoot string) Harness {
	h.projectRoot = projectRoot
	return h
}

// ConfigRoot returns OpenCode's global config root. Satisfies the Harness interface.
func (h OpenCodeHarness) ConfigRoot() string { return h.configRoot() }

// configRoot resolves the global root the way OpenCode does: an explicit
// $OPENCODE_CONFIG_DIR, then $XDG_CONFIG_HOME/opencode, then
// ~/.config/opencode. An unresolvable home dir yields "".
func (h OpenCodeHarness) configRoot() string {
	if dir := envDirFromCwd("OPENCODE_CONFIG_DIR"); dir != "" {
		return dir
	}
	if xdg := envDir("XDG_CONFIG_HOME"); xdg != "" {
		return filepath.Join(xdg, "opencode")
	}
	home := homeDir()
	if home == "" {
		return ""
	}
	return filepath.Join(home, ".config", "opencode")
}

// Detect checks for the global root directory or "opencode" on PATH.
// If configRoot() returns empty (empty home), the harness is reported as not
// installed rather than constructing a bogus path.
func (h OpenCodeHarness) Detect() (DetectResult, error) {
	root := h.configRoot()
	if root == "" {
		return DetectResult{Installed: false}, nil
	}

	// Primary: config root directory.
	if _, err := statPath(root); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
		}, nil
	}

	// Secondary: binary on PATH.
	if bin, err := lookPath("opencode"); err == nil {
		return DetectResult{
			Installed:  true,
			ConfigRoot: root,
			BinaryPath: bin,
		}, nil
	}

	return DetectResult{Installed: false}, nil
}

// ConfigPaths returns OpenCode's paths for this harness's scope: global
// (home-derived) by default, or project-scoped when constructed via
// WithProjectRoot. Equivalent to ConfigPathsFor(h.projectRoot).
func (h OpenCodeHarness) ConfigPaths() ConfigPaths {
	return h.ConfigPathsFor(h.projectRoot)
}

// ConfigPathsFor returns OpenCode's paths, scoped to projectRoot when
// non-empty: <projectRoot>/.opencode/{skills,agents,commands} and the project
// config file. Global: the same names under the global root.
func (h OpenCodeHarness) ConfigPathsFor(projectRoot string) ConfigPaths {
	if projectRoot != "" {
		dir := filepath.Join(projectRoot, ".opencode")
		return ConfigPaths{
			MCPConfig:   opencodeConfigFile(projectRoot),
			SkillsDir:   filepath.Join(dir, "skills"),
			AgentsDir:   filepath.Join(dir, "agents"),
			CommandsDir: filepath.Join(dir, "commands"),
			ProjectRoot: projectRoot,
		}
	}
	root := h.configRoot()
	if root == "" {
		return ConfigPaths{}
	}
	return ConfigPaths{
		MCPConfig:   opencodeConfigFile(root),
		SkillsDir:   filepath.Join(root, "skills"),
		AgentsDir:   filepath.Join(root, "agents"),
		CommandsDir: filepath.Join(root, "commands"),
	}
}

// opencodeConfigFile picks the config file in dir: opencode.json, unless only
// opencode.jsonc exists, in which case that file is used instead of creating
// a second, competing config.
func opencodeConfigFile(dir string) string {
	jsonPath := filepath.Join(dir, "opencode.json")
	jsoncPath := filepath.Join(dir, "opencode.jsonc")
	if _, err := statPath(jsonPath); err != nil {
		if _, err := statPath(jsoncPath); err == nil {
			return jsoncPath
		}
	}
	return jsonPath
}

// Supports reports capability support. OpenCode supports all four components.
func (h OpenCodeHarness) Supports(c component.Component) bool {
	switch c {
	case component.SkillCommands, component.MCPGates, component.ReviewAgents, component.DesignMemory:
		return true
	default:
		return false
	}
}

// legacyTargets lists the singular skill/, agent/, command/ dirs older
// ui-craft versions wrote (global and project) and, on Windows, the
// %APPDATA%\opencode root OpenCode never reads.
func (h OpenCodeHarness) legacyTargets(c component.Component) []legacyTarget {
	type dirs struct{ skills, commands, agents string }
	var sets []dirs
	var mcpFiles []string
	if h.projectRoot != "" {
		base := filepath.Join(h.projectRoot, ".opencode")
		sets = append(sets, dirs{filepath.Join(base, "skill"), filepath.Join(base, "command"), filepath.Join(base, "agent")})
	} else {
		if root := h.configRoot(); root != "" {
			sets = append(sets, dirs{filepath.Join(root, "skill"), filepath.Join(root, "command"), filepath.Join(root, "agent")})
		}
		if appdata := windowsAppDataDir("opencode"); appdata != "" {
			sets = append(sets, dirs{filepath.Join(appdata, "skills"), filepath.Join(appdata, "commands"), filepath.Join(appdata, "agent")})
			mcpFiles = append(mcpFiles, filepath.Join(appdata, "opencode.json"))
		}
	}
	var out []legacyTarget
	for _, s := range sets {
		switch c {
		case component.SkillCommands:
			out = append(out,
				legacyTarget{path: s.skills, kind: legacySkillDirs, pruneDir: true},
				legacyTarget{path: s.commands, kind: legacyCommandFiles, pruneDir: true},
			)
		case component.ReviewAgents:
			out = append(out, legacyTarget{path: s.agents, kind: legacyAgentFiles, pruneDir: true})
		}
	}
	if c == component.MCPGates {
		for _, f := range mcpFiles {
			out = append(out, legacyTarget{path: f, kind: legacyJSONKey, parent: "mcp", key: "ui-craft"})
		}
	}
	return out
}

// WriteMCP merges the ui-craft server into the "mcp" key of opencode.json
// (or opencode.jsonc, see opencodeConfigFile):
//
//	{ "mcp": { "<name>": { "type": "local", "command": ["<cmd>", "<arg>", ...] } } }
//
// OpenCode configs may be JSONC. A file that only parses once comments or
// trailing commas are removed is NOT rewritten (that would silently delete
// the user's comments): the Change carries a Notice with the snippet to add
// by hand instead. A file that is not JSON at all keeps the shared
// malformed-base behaviour (backed up, then replaced; MalformedBase is set).
func (h OpenCodeHarness) WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error) {
	target := h.ConfigPaths().MCPConfig
	if target == "" {
		return Change{}, fmt.Errorf("opencode: cannot resolve the config path (home directory unknown)")
	}

	existing, existed, readErr := readConfigFile(w, target)
	if readErr != nil {
		return Change{}, fmt.Errorf("opencode: read %s: %w", target, readErr)
	}
	if !existed {
		existing = []byte("{}")
	}

	// OpenCode wants the full command line as a single array.
	cmd := append([]string{server.Command}, server.Args...)
	entry := map[string]any{
		"type":    "local",
		"command": cmd,
	}

	if existed && !json.Valid(existing) && hasJSONCSyntaxOnly(existing) {
		snippet, err := json.MarshalIndent(map[string]any{server.Name: entry}, "", "  ")
		if err != nil {
			return Change{}, fmt.Errorf("opencode: marshal MCP snippet: %w", err)
		}
		return Change{
			FilePath:      target,
			PriorBytes:    existing,
			ExistedBefore: true,
			Strategy:      MergeIntoSettings,
			Notice: fmt.Sprintf("%s has comments or trailing commas, so ui-craft left it untouched. "+
				"Copy the \"%s\" key and its value below into the top-level \"mcp\" object "+
				"(add \"mcp\": {} if the file has none):\n%s", target, server.Name, snippet),
		}, nil
	}

	overlay := map[string]any{
		"mcp": map[string]any{
			server.Name: map[string]any{"__replace__": entry},
		},
	}
	overlayJSON, err := json.Marshal(overlay)
	if err != nil {
		return Change{}, fmt.Errorf("opencode: marshal MCP overlay: %w", err)
	}

	mr, err := filemerge.MergeJSONObjectsEx(existing, overlayJSON)
	if err != nil {
		return Change{}, fmt.Errorf("opencode: merge %s: %w", filepath.Base(target), err)
	}

	prior := existing
	if !existed {
		prior = nil
	}

	wr, err := writeConfigFile(w, target, mr.Data, 0o644)
	if err != nil {
		return Change{}, fmt.Errorf("opencode: write %s: %w", target, err)
	}

	return Change{
		FilePath:      target,
		PriorBytes:    prior,
		ExistedBefore: existed,
		Changed:       wr.Changed,
		MalformedBase: mr.MalformedBase,
		Strategy:      MergeIntoSettings,
	}, nil
}

// hasJSONCSyntaxOnly reports whether src is valid JSON once JSONC comments
// and trailing commas are removed.
func hasJSONCSyntaxOnly(src []byte) bool {
	mr, err := filemerge.MergeJSONObjectsEx(src, []byte("{}"))
	return err == nil && !mr.MalformedBase
}

// WriteSkill copies the embedded OpenCode skills tree into the skills dir.
// The mirror FS is rooted at the skills level (assets.SkillsFS("opencode")),
// so walking it yields <id>/SKILL.md paths that land at depth-1.
func (h OpenCodeHarness) WriteSkill(w fsutil.FileSystem, mirror fs.FS) (Change, error) {
	destDir := h.ConfigPaths().SkillsDir
	ch, err := writeMirrorToDir(w, mirror, destDir)
	if err != nil {
		return Change{}, fmt.Errorf("opencode: write skill mirror: %w", err)
	}
	return ch, nil
}

// WriteCommands writes slash-command .md files flat into the commands dir.
// commandsFS is the commands-rooted FS from assets.CommandsFS("opencode").
// Stale command files no longer in commandsFS are removed (scoped cleanup).
// A nil commandsFS returns ErrUnsupported.
func (h OpenCodeHarness) WriteCommands(w fsutil.FileSystem, commandsFS fs.FS) ([]Change, error) {
	if commandsFS == nil {
		return nil, ErrUnsupported
	}
	return writeFlatMDToDir(w, commandsFS, h.ConfigPaths().CommandsDir, "opencode")
}

// WriteAgents writes the OpenCode-format review agents (assets/agents/opencode/)
// into the agents dir. Each file is written with WriteFileAtomic (idempotent
// byte-compare); other user agents are never touched. A nil agentsFS returns
// ErrUnsupported.
func (h OpenCodeHarness) WriteAgents(w fsutil.FileSystem, agentsFS fs.FS) ([]Change, error) {
	if agentsFS == nil {
		return nil, ErrUnsupported
	}
	return writeAgentsToDir(w, agentsFS, h.ConfigPaths().AgentsDir, "opencode")
}
