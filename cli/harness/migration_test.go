package harness

import (
	"bufio"
	"encoding/json"
	"io/fs"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

var testServer = MCPServer{Name: "ui-craft", Command: "npx", Args: []string{"-y", "ui-craft-mcp@0.9.0"}}

func write(t *testing.T, mem *fsutil.MemFS, p, content string) {
	t.Helper()
	if err := mem.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := mem.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func read(t *testing.T, mem *fsutil.MemFS, p string) string {
	t.Helper()
	data, err := mem.ReadFile(p)
	if err != nil {
		t.Fatalf("read %s: %v", p, err)
	}
	return string(data)
}

func gone(mem *fsutil.MemFS, p string) bool {
	_, err := mem.Stat(p)
	return err != nil
}

func ownedFor(name string) OwnedAssets {
	return OwnedAssets{Skills: assets.SkillsFS(name), Commands: assets.CommandsFS(name), Agents: assets.Agents(name)}
}

// embeddedSkill returns the embedded SKILL.md of skill id for harness name.
func embeddedSkill(t *testing.T, name, id string) string {
	t.Helper()
	data, err := fs.ReadFile(assets.SkillsFS(name), id+"/SKILL.md")
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// ---------------------------------------------------------------------------
// Claude MCP: ~/.claude.json and .mcp.json merges
// ---------------------------------------------------------------------------

const claudeState = `{
  "numStartups": 7,
  "projects": {
    "/work/app": {
      "allowedTools": []
    }
  },
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  },
  "oauthAccount": {
    "emailAddress": "me@example.com"
  }
}
`

func TestClaudeWriteMCP_globalPreservesOtherKeysAndOrder(t *testing.T) {
	home := isolateHome(t)
	mem := fsutil.NewMemFS()
	target := filepath.Join(home, ".claude.json")
	write(t, mem, target, claudeState)

	ch, err := ClaudeHarness{}.WriteMCP(mem, testServer)
	if err != nil {
		t.Fatalf("WriteMCP: %v", err)
	}
	if ch.FilePath != target || !ch.Changed || !ch.ExistedBefore || string(ch.PriorBytes) != claudeState {
		t.Errorf("Change = %+v", ch)
	}
	got := read(t, mem, target)
	want := strings.Replace(claudeState, `      "url": "https://api.example.com/mcp"
    }
  },`, `      "url": "https://api.example.com/mcp"
    },
    "ui-craft": {
      "command": "npx",
      "args": [
        "-y",
        "ui-craft-mcp@0.9.0"
      ]
    }
  },`, 1)
	if got != want {
		t.Errorf("~/.claude.json after merge:\n%s\nwant:\n%s", got, want)
	}

	// Second run: no write at all.
	ch2, err := ClaudeHarness{}.WriteMCP(mem, testServer)
	if err != nil || ch2.Changed {
		t.Errorf("second run: changed=%v err=%v", ch2.Changed, err)
	}
	if read(t, mem, target) != want {
		t.Error("second run changed the bytes")
	}

	// Uninstall removes only our key and gives back the original bytes.
	rm, err := RemoveMCP(mem, ClaudeHarness{}, "ui-craft")
	if err != nil || !rm.Changed {
		t.Fatalf("RemoveMCP: changed=%v err=%v", rm.Changed, err)
	}
	if got := read(t, mem, target); got != claudeState {
		t.Errorf("after RemoveMCP:\n%s\nwant the original file back:\n%s", got, claudeState)
	}
}

func TestClaudeWriteMCP_malformedRefused(t *testing.T) {
	home := isolateHome(t)
	mem := fsutil.NewMemFS()
	target := filepath.Join(home, ".claude.json")
	const broken = `{"numStartups": 7, "mcpServers": {`
	write(t, mem, target, broken)

	if _, err := (ClaudeHarness{}).WriteMCP(mem, testServer); err == nil || !strings.Contains(err.Error(), "refusing to modify") {
		t.Fatalf("WriteMCP on malformed ~/.claude.json: err = %v, want a refusal", err)
	}
	if read(t, mem, target) != broken {
		t.Error("malformed ~/.claude.json was modified")
	}
	// Uninstall must not touch it either.
	rm, err := RemoveMCP(mem, ClaudeHarness{}, "ui-craft")
	if err != nil || rm.Changed || rm.Notice == "" {
		t.Errorf("RemoveMCP on malformed file: %+v err=%v (want no write and a notice)", rm, err)
	}
	if read(t, mem, target) != broken {
		t.Error("RemoveMCP modified a malformed file")
	}
}

func TestClaudeWriteMCP_projectMigratesLegacyShape(t *testing.T) {
	project := t.TempDir()
	mem := fsutil.NewMemFS()
	target := filepath.Join(project, ".mcp.json")
	// Old ui-craft wrote a top-level "ui-craft" key; the user also has a
	// properly wrapped server of their own.
	write(t, mem, target, `{
  "mcpServers": {
    "db": {
      "command": "pg-mcp"
    }
  },
  "ui-craft": {
    "command": "npx",
    "args": ["-y", "ui-craft-mcp@0.9.0"]
  }
}
`)
	h := ClaudeHarness{}.WithProjectRoot(project)
	ch, err := h.WriteMCP(mem, testServer)
	if err != nil || !ch.Changed {
		t.Fatalf("WriteMCP: changed=%v err=%v", ch.Changed, err)
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(read(t, mem, target)), &m); err != nil {
		t.Fatal(err)
	}
	if _, ok := m["ui-craft"]; ok {
		t.Error("legacy top-level ui-craft key survived")
	}
	servers := m["mcpServers"].(map[string]any)
	if servers["db"] == nil || servers["ui-craft"] == nil {
		t.Errorf("mcpServers = %v, want db and ui-craft", servers)
	}

	// Uninstall keeps .mcp.json and the user's server.
	if _, err := RemoveMCP(mem, h, "ui-craft"); err != nil {
		t.Fatal(err)
	}
	if got := read(t, mem, target); !strings.Contains(got, `"db"`) || strings.Contains(got, "ui-craft") {
		t.Errorf(".mcp.json after uninstall:\n%s", got)
	}
}

func TestClaudeWriteMCP_projectAbsentCreatesWrappedFile(t *testing.T) {
	project := t.TempDir()
	mem := fsutil.NewMemFS()
	h := ClaudeHarness{}.WithProjectRoot(project)
	if _, err := h.WriteMCP(mem, testServer); err != nil {
		t.Fatal(err)
	}
	want := "{\n  \"mcpServers\": {\n    \"ui-craft\": {\n      \"command\": \"npx\",\n      \"args\": [\n        \"-y\",\n        \"ui-craft-mcp@0.9.0\"\n      ]\n    }\n  }\n}\n"
	if got := read(t, mem, filepath.Join(project, ".mcp.json")); got != want {
		t.Errorf(".mcp.json:\n%s\nwant:\n%s", got, want)
	}
}

func TestRemoveMCP_otherHarnessesKeepFileAndOtherServers(t *testing.T) {
	home := isolateHome(t)
	withStat(t)
	mem := fsutil.NewMemFS()
	for _, h := range []Harness{CursorHarness{}, GeminiHarness{}, OpenCodeHarness{}} {
		if _, err := h.WriteMCP(mem, testServer); err != nil {
			t.Fatal(err)
		}
		target := h.ConfigPaths().MCPConfig
		parent := "mcpServers"
		if h.Name() == "opencode" {
			parent = "mcp"
		}
		// Add a user server next to ours.
		data := strings.Replace(read(t, mem, target), `"`+parent+`": {`, `"`+parent+`": {"mine": {"command": "x"},`, 1)
		write(t, mem, target, data)
		if _, err := RemoveMCP(mem, h, "ui-craft"); err != nil {
			t.Fatal(err)
		}
		got := read(t, mem, target)
		if strings.Contains(got, "ui-craft") || !strings.Contains(got, `"mine"`) {
			t.Errorf("%s after RemoveMCP:\n%s", h.Name(), got)
		}
	}
	_ = home
}

func TestOpenCodeWriteMCP_jsoncWithoutComments(t *testing.T) {
	home := isolateHome(t)
	jsonc := filepath.Join(home, ".config", "opencode", "opencode.jsonc")
	withStat(t, jsonc)
	mem := fsutil.NewMemFS()
	write(t, mem, jsonc, `{"theme": "dark"}`)

	ch, err := OpenCodeHarness{}.WriteMCP(mem, testServer)
	if err != nil || !ch.Changed || ch.FilePath != jsonc {
		t.Fatalf("WriteMCP: %+v err=%v", ch, err)
	}
	if !gone(mem, filepath.Join(home, ".config", "opencode", "opencode.json")) {
		t.Error("a second config file (opencode.json) was created next to opencode.jsonc")
	}
	if got := read(t, mem, jsonc); !strings.Contains(got, `"theme": "dark"`) || !strings.Contains(got, `"ui-craft"`) {
		t.Errorf("opencode.jsonc:\n%s", got)
	}
}

func TestOpenCodeWriteMCP_jsoncWithCommentsUntouched(t *testing.T) {
	home := isolateHome(t)
	jsonc := filepath.Join(home, ".config", "opencode", "opencode.jsonc")
	withStat(t, jsonc)
	mem := fsutil.NewMemFS()
	const src = "{\n  // keep me\n  \"theme\": \"dark\",\n}\n"
	write(t, mem, jsonc, src)

	ch, err := OpenCodeHarness{}.WriteMCP(mem, testServer)
	if err != nil || ch.Changed || ch.Notice == "" {
		t.Fatalf("WriteMCP: %+v err=%v (want no write and a notice)", ch, err)
	}
	if read(t, mem, jsonc) != src {
		t.Error("commented opencode.jsonc was rewritten")
	}
	rm, err := RemoveMCP(mem, OpenCodeHarness{}, "ui-craft")
	if err != nil || rm.Changed || rm.Notice == "" {
		t.Errorf("RemoveMCP: %+v err=%v (want no write and a notice)", rm, err)
	}
}

// ---------------------------------------------------------------------------
// Legacy sweeps: each removes only ui-craft content
// ---------------------------------------------------------------------------

func TestLegacy_claudeMCPFile(t *testing.T) {
	home := isolateHome(t)
	mem := fsutil.NewMemFS()
	mcpDir := filepath.Join(home, ".claude", "mcp")
	write(t, mem, filepath.Join(mcpDir, "ui-craft.json"), `{"ui-craft":{"command":"npx"}}`)

	removed, err := CleanupLegacy(mem, ClaudeHarness{}, component.MCPGates, OwnedAssets{}, false)
	if err != nil || len(removed) != 1 {
		t.Fatalf("removed=%v err=%v", removed, err)
	}
	if !gone(mem, mcpDir) {
		t.Error("empty legacy mcp/ dir was not pruned")
	}

	// With a user file next to it, only ours goes and the dir stays.
	write(t, mem, filepath.Join(mcpDir, "ui-craft.json"), `{}`)
	write(t, mem, filepath.Join(mcpDir, "other.json"), `{}`)
	if _, err := CleanupLegacy(mem, ClaudeHarness{}, component.MCPGates, OwnedAssets{}, false); err != nil {
		t.Fatal(err)
	}
	if !gone(mem, filepath.Join(mcpDir, "ui-craft.json")) || gone(mem, filepath.Join(mcpDir, "other.json")) {
		t.Error("legacy sweep removed the wrong file")
	}
}

func TestLegacy_cursorRules(t *testing.T) {
	project := t.TempDir()
	mem := fsutil.NewMemFS()
	rules := filepath.Join(project, ".cursor", "rules")
	write(t, mem, filepath.Join(rules, "ui-craft", "SKILL.md"), embeddedSkill(t, "cursor", "ui-craft"))
	write(t, mem, filepath.Join(rules, "ui-craft", "references", "accessibility.md"), "ref")
	write(t, mem, filepath.Join(rules, "audit", "SKILL.md"), embeddedSkill(t, "cursor", "audit"))
	// User content: a real rule, and a dir named like one of our ids that is not ours.
	write(t, mem, filepath.Join(rules, "team.mdc"), "---\ndescription: team\n---\n")
	write(t, mem, filepath.Join(rules, "polish", "SKILL.md"), "---\nname: polish\n---\nmy own polish skill\n")

	h := CursorHarness{}.WithProjectRoot(project)
	removed, err := CleanupLegacy(mem, h, component.SkillCommands, ownedFor("cursor"), false)
	if err != nil {
		t.Fatal(err)
	}
	if len(removed) != 2 || !gone(mem, filepath.Join(rules, "ui-craft")) || !gone(mem, filepath.Join(rules, "audit")) {
		t.Errorf("removed = %v", removed)
	}
	if gone(mem, filepath.Join(rules, "team.mdc")) || gone(mem, filepath.Join(rules, "polish", "SKILL.md")) {
		t.Error("user rule or user skill was removed")
	}
	// Global scope has no legacy targets.
	if got := LegacyPaths(CursorHarness{}, component.SkillCommands, ownedFor("cursor")); len(got) != 0 {
		t.Errorf("global cursor legacy paths = %v", got)
	}
}

func TestLegacy_geminiProjectSkillDirs(t *testing.T) {
	project := t.TempDir()
	mem := fsutil.NewMemFS()
	gem := filepath.Join(project, ".gemini")
	write(t, mem, filepath.Join(gem, "ui-craft", "SKILL.md"), embeddedSkill(t, "gemini", "ui-craft"))
	write(t, mem, filepath.Join(gem, "tokens", "SKILL.md"), embeddedSkill(t, "gemini", "tokens"))
	write(t, mem, filepath.Join(gem, "settings.json"), `{"theme":"x"}`)
	write(t, mem, filepath.Join(gem, "skills", "mine", "SKILL.md"), "---\nname: mine\n---\n")
	write(t, mem, filepath.Join(gem, "commands", "deploy.toml"), "prompt = 'x'")

	h := GeminiHarness{}.WithProjectRoot(project)
	removed, err := CleanupLegacy(mem, h, component.SkillCommands, ownedFor("gemini"), false)
	if err != nil || len(removed) != 2 {
		t.Fatalf("removed=%v err=%v", removed, err)
	}
	for _, keep := range []string{"settings.json", "skills/mine/SKILL.md", "commands/deploy.toml"} {
		if gone(mem, filepath.Join(gem, filepath.FromSlash(keep))) {
			t.Errorf("%s was removed", keep)
		}
	}
}

func TestLegacy_opencodeSingularDirs(t *testing.T) {
	home := isolateHome(t)
	withStat(t)
	mem := fsutil.NewMemFS()
	owned := ownedFor("opencode")
	agentBody, _ := fs.ReadFile(owned.Agents, "design-reviewer.md")
	cmdBody, _ := fs.ReadFile(owned.Commands, "audit.md")

	check := func(t *testing.T, h Harness, base string) {
		t.Helper()
		write(t, mem, filepath.Join(base, "skill", "ui-craft", "SKILL.md"), embeddedSkill(t, "opencode", "ui-craft"))
		write(t, mem, filepath.Join(base, "command", "audit.md"), string(cmdBody))
		write(t, mem, filepath.Join(base, "command", "mine.md"), "my command")
		write(t, mem, filepath.Join(base, "command", "polish.md"), "a user command that happens to share a name")
		write(t, mem, filepath.Join(base, "agent", "design-reviewer.md"), string(agentBody))

		for _, c := range []component.Component{component.SkillCommands, component.ReviewAgents} {
			if _, err := CleanupLegacy(mem, h, c, owned, false); err != nil {
				t.Fatal(err)
			}
		}
		for _, p := range []string{"skill", "agent", "command/audit.md"} {
			if !gone(mem, filepath.Join(base, filepath.FromSlash(p))) {
				t.Errorf("%s under %s survived", p, base)
			}
		}
		for _, p := range []string{"command/mine.md", "command/polish.md"} {
			if gone(mem, filepath.Join(base, filepath.FromSlash(p))) {
				t.Errorf("user file %s under %s was removed", p, base)
			}
		}
	}
	t.Run("global", func(t *testing.T) {
		check(t, OpenCodeHarness{}, filepath.Join(home, ".config", "opencode"))
	})
	t.Run("project", func(t *testing.T) {
		project := t.TempDir()
		check(t, OpenCodeHarness{}.WithProjectRoot(project), filepath.Join(project, ".opencode"))
	})
}

func TestLegacy_windowsAppData(t *testing.T) {
	home := isolateHome(t)
	withStat(t)
	withGOOS(t, "windows")
	appdata := filepath.Join(home, "AppData", "Roaming")
	t.Setenv("APPDATA", appdata)
	mem := fsutil.NewMemFS()

	// Claude Desktop's dir: our old files plus Desktop's own config.
	desktop := filepath.Join(appdata, "Claude")
	write(t, mem, filepath.Join(desktop, "claude_desktop_config.json"), `{"mcpServers":{}}`)
	write(t, mem, filepath.Join(desktop, "mcp", "ui-craft.json"), `{}`)
	write(t, mem, filepath.Join(desktop, "skills", "ui-craft", "SKILL.md"), embeddedSkill(t, "claude", "ui-craft"))
	oc := filepath.Join(appdata, "opencode")
	write(t, mem, filepath.Join(oc, "opencode.json"), `{"mcp":{"ui-craft":{"type":"local"},"x":{"type":"local"}}}`)

	for _, c := range []component.Component{component.MCPGates, component.SkillCommands} {
		if _, err := CleanupLegacy(mem, ClaudeHarness{}, c, ownedFor("claude"), false); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := CleanupLegacy(mem, OpenCodeHarness{}, component.MCPGates, OwnedAssets{}, false); err != nil {
		t.Fatal(err)
	}
	if !gone(mem, filepath.Join(desktop, "mcp")) || !gone(mem, filepath.Join(desktop, "skills")) {
		t.Error("legacy ui-craft files under %APPDATA%\\Claude survived")
	}
	if gone(mem, filepath.Join(desktop, "claude_desktop_config.json")) {
		t.Error("Claude Desktop's own config was removed")
	}
	if got := read(t, mem, filepath.Join(oc, "opencode.json")); strings.Contains(got, "ui-craft") || !strings.Contains(got, `"x"`) {
		t.Errorf("%%APPDATA%%\\opencode\\opencode.json after sweep:\n%s", got)
	}
}

func TestLegacy_dryRunRemovesNothing(t *testing.T) {
	home := isolateHome(t)
	mem := fsutil.NewMemFS()
	p := filepath.Join(home, ".claude", "mcp", "ui-craft.json")
	write(t, mem, p, `{}`)
	removed, err := CleanupLegacy(mem, ClaudeHarness{}, component.MCPGates, OwnedAssets{}, true)
	if err != nil || len(removed) != 1 || gone(mem, p) {
		t.Errorf("dry run: removed=%v err=%v gone=%v", removed, err, gone(mem, p))
	}
}

// ---------------------------------------------------------------------------
// Codex agent roles: the TOML parses and has the required fields
// ---------------------------------------------------------------------------

// parseAgentRoleTOML is a deliberately strict parser for the subset of TOML
// the agent-role files use: comments, `key = "basic string"` and
// `key = ”'multi-line literal”'`. Anything else is an error, so a stray
// key or a malformed string fails the test instead of slipping through.
func parseAgentRoleTOML(t *testing.T, src string) map[string]string {
	t.Helper()
	out := map[string]string{}
	keyRe := regexp.MustCompile(`^([A-Za-z_][A-Za-z0-9_-]*) = (.*)$`)
	sc := bufio.NewScanner(strings.NewReader(src))
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		if strings.TrimSpace(line) == "" || strings.HasPrefix(line, "#") {
			continue
		}
		m := keyRe.FindStringSubmatch(line)
		if m == nil {
			t.Fatalf("not a key/value line: %q", line)
		}
		key, val := m[1], m[2]
		if _, dup := out[key]; dup {
			t.Fatalf("duplicate key %q", key)
		}
		switch {
		case val == "'''":
			var b strings.Builder
			closed := false
			for sc.Scan() {
				l := sc.Text()
				if strings.HasSuffix(l, "'''") {
					b.WriteString(strings.TrimSuffix(l, "'''"))
					closed = true
					break
				}
				b.WriteString(l + "\n")
			}
			if !closed {
				t.Fatalf("unterminated ''' string for %q", key)
			}
			out[key] = b.String()
		case strings.HasPrefix(val, `"`):
			s, err := strconv.Unquote(val)
			if err != nil {
				t.Fatalf("bad basic string for %q: %v", key, err)
			}
			out[key] = s
		default:
			t.Fatalf("unsupported value for %q: %s", key, val)
		}
	}
	return out
}

func TestCodexAgentRoles_parseAndRequiredFields(t *testing.T) {
	codexFS := assets.Agents("codex")
	claudeFS := assets.Agents("claude")
	allowed := map[string]bool{"name": true, "description": true, "developer_instructions": true, "sandbox_mode": true}
	for _, name := range []string{"a11y-auditor", "design-reviewer"} {
		data, err := fs.ReadFile(codexFS, name+".toml")
		if err != nil {
			t.Fatalf("%s.toml not embedded: %v", name, err)
		}
		doc := parseAgentRoleTOML(t, string(data))
		for k := range doc {
			if !allowed[k] {
				t.Errorf("%s: unexpected key %q (Codex rejects unknown fields)", name, k)
			}
		}
		if doc["name"] != name {
			t.Errorf("%s: name = %q", name, doc["name"])
		}
		if strings.TrimSpace(doc["description"]) == "" {
			t.Errorf("%s: empty description", name)
		}
		if doc["sandbox_mode"] != "read-only" {
			t.Errorf("%s: sandbox_mode = %q, want read-only", name, doc["sandbox_mode"])
		}
		claudeMD, _ := fs.ReadFile(claudeFS, name+".md")
		parts := strings.SplitN(string(claudeMD), "\n---\n", 2)
		wantBody := strings.TrimLeft(parts[1], "\n")
		if withoutPathNote(doc["developer_instructions"]) != withoutPathNote(wantBody) {
			t.Errorf("%s: developer_instructions differs from the Claude agent body", name)
		}
		if !strings.Contains(doc["developer_instructions"], "relative to your Codex config: `~/.codex/`") {
			t.Errorf("%s: missing the Codex skill-path note", name)
		}
	}
}

// TestMarkdownAgents_sameBodyAsClaude guards against drift: the Cursor and
// Gemini agents are hand-authored copies whose body (everything after the
// frontmatter) must stay identical to the Claude agent's.
func TestMarkdownAgents_sameBodyAsClaude(t *testing.T) {
	body := func(t *testing.T, tree fs.FS, name string) string {
		t.Helper()
		data, err := fs.ReadFile(tree, name)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.HasPrefix(string(data), "---\n") {
			t.Fatalf("%s does not start with frontmatter", name)
		}
		parts := strings.SplitN(string(data), "\n---\n", 2)
		if len(parts) != 2 {
			t.Fatalf("%s: unterminated frontmatter", name)
		}
		return strings.TrimLeft(parts[1], "\n")
	}
	notes := map[string]string{
		"cursor":   "relative to your Cursor config: `~/.cursor/`",
		"gemini":   "relative to your Gemini CLI config: `~/.gemini/`",
		"opencode": "relative to your OpenCode config: `~/.config/opencode/`",
	}
	for h, note := range notes {
		for _, name := range []string{"a11y-auditor.md", "design-reviewer.md"} {
			got := body(t, assets.Agents(h), name)
			if withoutPathNote(got) != withoutPathNote(body(t, assets.Agents("claude"), name)) {
				t.Errorf("%s/%s body differs from claude/%s", h, name, name)
			}
			if !strings.Contains(got, note) {
				t.Errorf("%s/%s: missing its own skill-path note %q", h, name, note)
			}
		}
	}
}

// withoutPathNote drops the one paragraph that legitimately differs between
// harnesses: where the `skills/ui-craft/` paths resolve for that harness.
func withoutPathNote(body string) string {
	var keep []string
	lines := strings.Split(body, "\n")
	for i := 0; i < len(lines); i++ {
		if strings.Contains(lines[i], "paths are relative to") {
			if i+1 < len(lines) && lines[i+1] == "" {
				i++
			}
			continue
		}
		keep = append(keep, lines[i])
	}
	return strings.Join(keep, "\n")
}

// A legacy SKILL.md with CRLF line endings (Windows editor, or a checkout with
// core.autocrlf) must still be recognised as ui-craft's, or the old copy survives.
func TestIsOwnedSkillDir_acceptsCRLF(t *testing.T) {
	mem := fsutil.NewMemFS()
	dir := filepath.Join(string(filepath.Separator)+"p", ".gemini", "audit")
	if err := mem.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	body := "---\r\nname: audit\r\ndescription: ui-craft audit\r\n---\r\nbody\r\n"
	if err := mem.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	if !isOwnedSkillDir(mem, dir, "audit") {
		t.Fatal("CRLF SKILL.md not recognised as ui-craft-owned")
	}
	if isOwnedSkillDir(mem, dir, "polish") {
		t.Fatal("matched a different id")
	}
}
