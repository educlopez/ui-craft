package harness

import (
	"path/filepath"
	"testing"
)

// TestConfigPathsFor_projectScoped is a table-driven test asserting the exact
// project-local paths returned by ConfigPathsFor for each of the 5 harnesses,
// per design's confirmed component/path map (design #917) and the Codex-MCP
// full-parity update (Codex gets a project-local .codex/config.toml too —
// supersedes the original tasks doc's global-only-limitation language).
func TestConfigPathsFor_projectScoped(t *testing.T) {
	projectRoot := filepath.FromSlash("/tmp/my-project")

	tests := []struct {
		name    string
		harness Harness
		want    ConfigPaths
	}{
		{
			name:    "claude",
			harness: ClaudeHarness{},
			want: ConfigPaths{
				MCPConfig:   filepath.Join(projectRoot, ".mcp.json"),
				SkillsDir:   filepath.Join(projectRoot, ".claude", "skills"),
				CommandsDir: filepath.Join(projectRoot, ".claude", "commands"),
				AgentsDir:   filepath.Join(projectRoot, ".claude", "agents"),
				ProjectRoot: projectRoot,
			},
		},
		{
			name:    "codex",
			harness: CodexHarness{},
			want: ConfigPaths{
				MCPConfig:    filepath.Join(projectRoot, ".codex", "config.toml"),
				SkillsDir:    filepath.Join(projectRoot, ".codex", "skills"),
				AgentsDir:    "",
				AgentsMDPath: filepath.Join(projectRoot, "AGENTS.md"),
				ProjectRoot:  projectRoot,
			},
		},
		{
			name:    "cursor",
			harness: CursorHarness{},
			want: ConfigPaths{
				MCPConfig:   filepath.Join(projectRoot, ".cursor", "mcp.json"),
				SkillsDir:   filepath.Join(projectRoot, ".cursor", "rules"),
				AgentsDir:   "",
				ProjectRoot: projectRoot,
			},
		},
		{
			name:    "gemini",
			harness: GeminiHarness{},
			want: ConfigPaths{
				MCPConfig:    filepath.Join(projectRoot, ".gemini", "settings.json"),
				SkillsDir:    filepath.Join(projectRoot, ".gemini"),
				AgentsDir:    "",
				AgentsMDPath: filepath.Join(projectRoot, "GEMINI.md"),
				ProjectRoot:  projectRoot,
			},
		},
		{
			name:    "opencode",
			harness: OpenCodeHarness{},
			want: ConfigPaths{
				MCPConfig:   filepath.Join(projectRoot, "opencode.json"),
				SkillsDir:   filepath.Join(projectRoot, ".opencode", "skill"),
				CommandsDir: filepath.Join(projectRoot, ".opencode", "command"),
				AgentsDir:   filepath.Join(projectRoot, ".opencode", "agent"),
				ProjectRoot: projectRoot,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.harness.ConfigPathsFor(projectRoot)
			if got != tt.want {
				t.Errorf("ConfigPathsFor(%q) = %+v, want %+v", projectRoot, got, tt.want)
			}
		})
	}
}

// TestConfigPathsFor_emptyProjectRootMatchesGlobal verifies that calling
// ConfigPathsFor("") for every harness returns byte-identical output to the
// existing global ConfigPaths(). This is the regression guard proving
// ConfigPaths() can safely delegate to ConfigPathsFor("") without changing
// any existing global-install behavior.
func TestConfigPathsFor_emptyProjectRootMatchesGlobal(t *testing.T) {
	tests := []struct {
		name    string
		harness Harness
	}{
		{"claude", ClaudeHarness{}},
		{"codex", CodexHarness{}},
		{"cursor", CursorHarness{}},
		{"gemini", GeminiHarness{}},
		{"opencode", OpenCodeHarness{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			global := tt.harness.ConfigPaths()
			viaEmpty := tt.harness.ConfigPathsFor("")
			if global != viaEmpty {
				t.Errorf("ConfigPaths() = %+v, ConfigPathsFor(\"\") = %+v — must be identical", global, viaEmpty)
			}
		})
	}
}

// TestConfigPathsFor_codexMCPFullParity is a targeted regression test for the
// Codex-MCP full-parity decision (supersedes the tasks doc's original
// global-only-limitation language for T1.4): when a project root is given,
// Codex's MCPConfig MUST resolve to the project-local .codex/config.toml, NOT
// the global ~/.codex/config.toml.
func TestConfigPathsFor_codexMCPFullParity(t *testing.T) {
	projectRoot := filepath.FromSlash("/tmp/codex-project")
	got := CodexHarness{}.ConfigPathsFor(projectRoot)

	want := filepath.Join(projectRoot, ".codex", "config.toml")
	if got.MCPConfig != want {
		t.Errorf("Codex project-scoped MCPConfig = %q, want %q (full parity — Codex MCP is NOT global-only)", got.MCPConfig, want)
	}
}
