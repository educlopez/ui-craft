package harness_test

import (
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// fixtureAgentsFS returns an in-memory fs.FS with two agent .md files,
// mimicking the embedded mirrors/claude/agents/ or mirrors/opencode/agent/ subtree.
func fixtureAgentsFS() fs.FS {
	return fstest.MapFS{
		"design-reviewer.md": &fstest.MapFile{
			Data: []byte("---\nname: design-reviewer\ndescription: \"UI design reviewer\"\n---\n\nYou are a design reviewer.\n"),
		},
		"a11y-auditor.md": &fstest.MapFile{
			Data: []byte("---\nname: a11y-auditor\ndescription: \"Accessibility auditor\"\n---\n\nYou are an a11y auditor.\n"),
		},
	}
}

// TestWriteAgents_claudeCode verifies that ClaudeHarness.WriteAgents writes
// each .md file from the agentsFS into ~/.claude/agents/ and reports Changed:true.
func TestWriteAgents_claudeCode(t *testing.T) {
	mem := fsutil.NewMemFS()
	agentsFS := fixtureAgentsFS()

	h := harness.ClaudeHarness{}
	changes, err := h.WriteAgents(mem, agentsFS)
	if err != nil {
		t.Fatalf("WriteAgents: %v", err)
	}
	if len(changes) != 2 {
		t.Fatalf("expected 2 Change records, got %d", len(changes))
	}

	agentsDir := h.ConfigPaths().AgentsDir // ~/.claude/agents/

	// Both agent files must be written.
	for _, name := range []string{"design-reviewer.md", "a11y-auditor.md"} {
		p := filepath.Join(agentsDir, name)
		data, readErr := mem.ReadFile(p)
		if readErr != nil {
			t.Errorf("agent file %s missing: %v", p, readErr)
			continue
		}
		if !strings.Contains(string(data), "name:") {
			t.Errorf("agent file %s appears empty or missing frontmatter", name)
		}
	}

	// All changes must report Changed:true (first install).
	for _, ch := range changes {
		if !ch.Changed {
			t.Errorf("change for %s: expected Changed:true on first install", ch.FilePath)
		}
		if ch.ExistedBefore {
			t.Errorf("change for %s: ExistedBefore should be false on first install", ch.FilePath)
		}
	}
}

// TestWriteAgents_opencode verifies that OpenCodeHarness.WriteAgents writes
// each .md file from the agentsFS into ~/.config/opencode/agent/ and reports Changed:true.
func TestWriteAgents_opencode(t *testing.T) {
	mem := fsutil.NewMemFS()
	agentsFS := fixtureAgentsFS()

	h := harness.OpenCodeHarness{}
	changes, err := h.WriteAgents(mem, agentsFS)
	if err != nil {
		t.Fatalf("WriteAgents: %v", err)
	}
	if len(changes) != 2 {
		t.Fatalf("expected 2 Change records, got %d", len(changes))
	}

	agentsDir := h.ConfigPaths().AgentsDir // ~/.config/opencode/agent/

	for _, name := range []string{"design-reviewer.md", "a11y-auditor.md"} {
		p := filepath.Join(agentsDir, name)
		if _, statErr := mem.Stat(p); statErr != nil {
			t.Errorf("agent file %s missing: %v", p, statErr)
		}
	}

	for _, ch := range changes {
		if !ch.Changed {
			t.Errorf("change for %s: expected Changed:true on first install", ch.FilePath)
		}
	}
}

// TestWriteAgents_idempotent verifies that a second WriteAgents call with the
// same agentsFS produces Changed:false (idempotent re-run).
func TestWriteAgents_idempotent(t *testing.T) {
	for _, tc := range []struct {
		name    string
		harness harness.Harness
	}{
		{"claude", harness.ClaudeHarness{}},
		{"opencode", harness.OpenCodeHarness{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mem := fsutil.NewMemFS()
			agentsFS := fixtureAgentsFS()

			// First install — must be Changed:true.
			ch1, err := tc.harness.WriteAgents(mem, agentsFS)
			if err != nil {
				t.Fatalf("first WriteAgents: %v", err)
			}
			for _, ch := range ch1 {
				if !ch.Changed {
					t.Errorf("first run: expected Changed:true for %s", ch.FilePath)
				}
			}

			// Second install — same FS, must be Changed:false.
			ch2, err := tc.harness.WriteAgents(mem, agentsFS)
			if err != nil {
				t.Fatalf("second WriteAgents: %v", err)
			}
			for _, ch := range ch2 {
				if ch.Changed {
					t.Errorf("second run: expected Changed:false (idempotent) for %s", ch.FilePath)
				}
			}
		})
	}
}

// TestWriteAgents_cursorSkip verifies that CursorHarness.Supports(ReviewAgents)
// returns false and WriteAgents returns ErrUnsupported.
func TestWriteAgents_cursorSkip(t *testing.T) {
	h := harness.CursorHarness{}

	if h.Supports(component.ReviewAgents) {
		t.Error("CursorHarness.Supports(ReviewAgents) = true; want false")
	}

	_, err := h.WriteAgents(fsutil.NewMemFS(), fixtureAgentsFS())
	if err != harness.ErrUnsupported {
		t.Errorf("WriteAgents: got %v; want ErrUnsupported", err)
	}
}

// TestWriteAgents_codexSkip verifies that CodexHarness.Supports(ReviewAgents)
// returns false and WriteAgents returns ErrUnsupported.
func TestWriteAgents_codexSkip(t *testing.T) {
	h := harness.CodexHarness{}

	if h.Supports(component.ReviewAgents) {
		t.Error("CodexHarness.Supports(ReviewAgents) = true; want false")
	}

	_, err := h.WriteAgents(fsutil.NewMemFS(), fixtureAgentsFS())
	if err != harness.ErrUnsupported {
		t.Errorf("WriteAgents: got %v; want ErrUnsupported", err)
	}
}

// TestWriteAgents_geminiSkip verifies that GeminiHarness.Supports(ReviewAgents)
// returns false and WriteAgents returns ErrUnsupported.
func TestWriteAgents_geminiSkip(t *testing.T) {
	h := harness.GeminiHarness{}

	if h.Supports(component.ReviewAgents) {
		t.Error("GeminiHarness.Supports(ReviewAgents) = true; want false")
	}

	_, err := h.WriteAgents(fsutil.NewMemFS(), fixtureAgentsFS())
	if err != harness.ErrUnsupported {
		t.Errorf("WriteAgents: got %v; want ErrUnsupported", err)
	}
}

// TestWriteAgents_preExistingUserAgentSurvives verifies that a pre-existing
// user agent file with a different name is not removed or modified when
// WriteAgents installs the ui-craft review agents.
func TestWriteAgents_preExistingUserAgentSurvives(t *testing.T) {
	for _, tc := range []struct {
		name    string
		harness harness.Harness
	}{
		{"claude", harness.ClaudeHarness{}},
		{"opencode", harness.OpenCodeHarness{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mem := fsutil.NewMemFS()
			agentsDir := tc.harness.ConfigPaths().AgentsDir

			// Plant a user agent file that must survive.
			userAgentPath := filepath.Join(agentsDir, "user-custom-agent.md")
			userContent := []byte("---\nname: user-custom-agent\ndescription: \"My custom agent\"\n---\n\nUser-owned agent.\n")
			_ = mem.MkdirAll(agentsDir, 0o755)
			_ = mem.WriteFile(userAgentPath, userContent, 0o644)

			// Run WriteAgents.
			if _, err := tc.harness.WriteAgents(mem, fixtureAgentsFS()); err != nil {
				t.Fatalf("WriteAgents: %v", err)
			}

			// User agent must still exist with original content.
			got, err := mem.ReadFile(userAgentPath)
			if err != nil {
				t.Fatalf("user agent file missing after WriteAgents: %v", err)
			}
			if string(got) != string(userContent) {
				t.Errorf("user agent content changed:\nwant: %q\ngot:  %q", userContent, got)
			}
		})
	}
}

// TestWriteAgents_nilFSReturnsUnsupported verifies that passing nil as agentsFS
// returns ErrUnsupported (defensive guard for nil provider return values).
func TestWriteAgents_nilFSReturnsUnsupported(t *testing.T) {
	for _, tc := range []struct {
		name    string
		harness harness.Harness
	}{
		{"claude", harness.ClaudeHarness{}},
		{"opencode", harness.OpenCodeHarness{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tc.harness.WriteAgents(fsutil.NewMemFS(), nil)
			if err != harness.ErrUnsupported {
				t.Errorf("WriteAgents(nil fs): got %v; want ErrUnsupported", err)
			}
		})
	}
}

// claudeOnlyFrontmatterKeys is the set of frontmatter keys that are valid in
// Claude Code sub-agent format but must NOT appear in OpenCode agent files.
var claudeOnlyFrontmatterKeys = []string{"tools:", "model:", "color:"}

// TestRealEmbeddedAgents_opencodeLacksClaudeKeys verifies the REAL committed
// OpenCode agent files (assets.Agents("opencode")) do NOT contain Claude-only
// frontmatter keys. This guards against accidental promotion of Claude-format
// files into the opencode/ directory.
func TestRealEmbeddedAgents_opencodeLacksClaudeKeys(t *testing.T) {
	agentsFS := assets.Agents("opencode")
	if agentsFS == nil {
		t.Fatal("assets.Agents(\"opencode\") returned nil — opencode agent definitions not embedded")
	}

	const minBodyLength = 50 // non-trivial instruction body

	err := fs.WalkDir(agentsFS, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() || filepath.Ext(d.Name()) != ".md" {
			return nil
		}

		data, readErr := fs.ReadFile(agentsFS, path)
		if readErr != nil {
			return readErr
		}
		content := string(data)

		// Assert no Claude-only frontmatter keys appear in the file.
		for _, key := range claudeOnlyFrontmatterKeys {
			if strings.Contains(content, key) {
				t.Errorf("opencode agent %s contains Claude-only key %q (must not appear in OpenCode format)", path, key)
			}
		}

		// Assert non-trivial body length (agent must have meaningful instructions).
		if len(content) < minBodyLength {
			t.Errorf("opencode agent %s body too short (%d bytes < %d) — likely empty or stub", path, len(content), minBodyLength)
		}

		return nil
	})
	if err != nil {
		t.Fatalf("WalkDir opencode agents: %v", err)
	}
}

// TestRealEmbeddedAgents_claudeHasRequiredKeys verifies the REAL committed
// Claude agent files (assets.Agents("claude")) DO contain the required Claude
// sub-agent frontmatter keys (tools, model, color) and have a non-trivial body.
func TestRealEmbeddedAgents_claudeHasRequiredKeys(t *testing.T) {
	agentsFS := assets.Agents("claude")
	if agentsFS == nil {
		t.Fatal("assets.Agents(\"claude\") returned nil — claude agent definitions not embedded")
	}

	requiredKeys := []string{"tools:", "model:", "color:"}
	const minBodyLength = 50

	err := fs.WalkDir(agentsFS, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() || filepath.Ext(d.Name()) != ".md" {
			return nil
		}

		data, readErr := fs.ReadFile(agentsFS, path)
		if readErr != nil {
			return readErr
		}
		content := string(data)

		for _, key := range requiredKeys {
			if !strings.Contains(content, key) {
				t.Errorf("claude agent %s missing required frontmatter key %q", path, key)
			}
		}

		if len(content) < minBodyLength {
			t.Errorf("claude agent %s body too short (%d bytes < %d) — likely empty or stub", path, len(content), minBodyLength)
		}

		return nil
	})
	if err != nil {
		t.Fatalf("WalkDir claude agents: %v", err)
	}
}

// TestWriteAgents_opencodeFormatDiffers verifies that the OpenCode agent file
// does NOT contain Claude-specific frontmatter fields (tools, model, color)
// while the Claude agent file DOES contain them. This asserts the format
// adaptation between the two harnesses (design requirement).
func TestWriteAgents_opencodeFormatDiffers(t *testing.T) {
	claudeFS := fstest.MapFS{
		"design-reviewer.md": &fstest.MapFile{
			Data: []byte("---\nname: design-reviewer\ndescription: \"reviewer\"\ntools: Read, Grep\nmodel: sonnet\ncolor: purple\n---\n\nBody.\n"),
		},
	}
	opencodeFS := fstest.MapFS{
		"design-reviewer.md": &fstest.MapFile{
			Data: []byte("---\nname: design-reviewer\ndescription: \"reviewer\"\n---\n\nBody.\n"),
		},
	}

	claudeMem := fsutil.NewMemFS()
	opencodeMem := fsutil.NewMemFS()

	ch := harness.ClaudeHarness{}
	oc := harness.OpenCodeHarness{}

	if _, err := ch.WriteAgents(claudeMem, claudeFS); err != nil {
		t.Fatalf("claude WriteAgents: %v", err)
	}
	if _, err := oc.WriteAgents(opencodeMem, opencodeFS); err != nil {
		t.Fatalf("opencode WriteAgents: %v", err)
	}

	claudeAgentPath := filepath.Join(ch.ConfigPaths().AgentsDir, "design-reviewer.md")
	opencodeAgentPath := filepath.Join(oc.ConfigPaths().AgentsDir, "design-reviewer.md")

	claudeData, _ := claudeMem.ReadFile(claudeAgentPath)
	opencodeData, _ := opencodeMem.ReadFile(opencodeAgentPath)

	// Claude format must have tools/model/color.
	if !strings.Contains(string(claudeData), "tools:") {
		t.Error("Claude agent file missing 'tools:' frontmatter field")
	}
	if !strings.Contains(string(claudeData), "model:") {
		t.Error("Claude agent file missing 'model:' frontmatter field")
	}

	// OpenCode format must NOT have tools/model/color.
	if strings.Contains(string(opencodeData), "tools:") {
		t.Error("OpenCode agent file should not contain 'tools:' frontmatter field")
	}
	if strings.Contains(string(opencodeData), "model:") {
		t.Error("OpenCode agent file should not contain 'model:' frontmatter field")
	}
	// Both must have name and description.
	if !strings.Contains(string(opencodeData), "name:") {
		t.Error("OpenCode agent file missing 'name:' frontmatter field")
	}
	if !strings.Contains(string(opencodeData), "description:") {
		t.Error("OpenCode agent file missing 'description:' frontmatter field")
	}
}
