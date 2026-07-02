package cmd_test

import (
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestCheckSkillFile covers the checkSkillFile function: presence,
// readability, content validity (0-byte / invalid UTF-8), frontmatter
// validity (integration with parseSkillFrontmatter from PR1), and staleness
// (byte-compare against the embedded mirror content). Per spec, only
// presence/readable/content/frontmatter are [fail]-level; staleness is
// always [warn] (never [fail]) and MUST NOT mutate the file.
func TestCheckSkillFile(t *testing.T) {
	const path = "/home/user/.claude/skills/ui-craft/SKILL.md"

	validContent := "---\n" +
		"name: ui-craft\n" +
		"description: SDD workflow orchestration skill\n" +
		"---\n" +
		"body content\n"

	for _, tc := range []struct {
		name string
		// setup writes fixtures into the MemFS and returns the embedded
		// (mirror) content to compare staleness against.
		setup         func(t *testing.T, fs *fsutil.MemFS) (embedded []byte)
		wantLabels    map[string]string // label -> level
		wantNoLabels  []string          // labels that must NOT appear
		wantAnyDetail map[string]string // label -> substring expected in detail
	}{
		{
			name: "missing file",
			setup: func(t *testing.T, fs *fsutil.MemFS) []byte {
				return []byte(validContent)
			},
			wantLabels: map[string]string{
				"skill-presence": "fail",
			},
			wantNoLabels: []string{"skill-readable", "skill-content", "skill-frontmatter", "skill-staleness"},
			wantAnyDetail: map[string]string{
				"skill-presence": "not found",
			},
		},
		{
			name: "zero-byte file",
			setup: func(t *testing.T, fs *fsutil.MemFS) []byte {
				if err := fs.WriteFile(path, []byte{}, 0o644); err != nil {
					t.Fatalf("WriteFile: %v", err)
				}
				return []byte(validContent)
			},
			wantLabels: map[string]string{
				"skill-presence": "ok",
				"skill-readable": "ok",
				"skill-content":  "fail",
			},
			wantNoLabels: []string{"skill-frontmatter", "skill-staleness"},
			wantAnyDetail: map[string]string{
				"skill-content": "empty (0 bytes)",
			},
		},
		{
			name: "invalid utf-8",
			setup: func(t *testing.T, fs *fsutil.MemFS) []byte {
				bad := []byte{0xff, 0xfe, 0xfd}
				if err := fs.WriteFile(path, bad, 0o644); err != nil {
					t.Fatalf("WriteFile: %v", err)
				}
				return []byte(validContent)
			},
			wantLabels: map[string]string{
				"skill-presence": "ok",
				"skill-readable": "ok",
				"skill-content":  "fail",
			},
			wantNoLabels: []string{"skill-frontmatter", "skill-staleness"},
			wantAnyDetail: map[string]string{
				"skill-content": "invalid UTF-8",
			},
		},
		{
			name: "valid content matching embedded mirror",
			setup: func(t *testing.T, fs *fsutil.MemFS) []byte {
				if err := fs.WriteFile(path, []byte(validContent), 0o644); err != nil {
					t.Fatalf("WriteFile: %v", err)
				}
				return []byte(validContent)
			},
			wantLabels: map[string]string{
				"skill-presence":    "ok",
				"skill-readable":    "ok",
				"skill-content":     "ok",
				"skill-frontmatter": "ok",
				"skill-staleness":   "ok",
			},
		},
		{
			name: "valid content differing from embedded mirror (staleness warn)",
			setup: func(t *testing.T, fs *fsutil.MemFS) []byte {
				installed := "---\n" +
					"name: ui-craft\n" +
					"description: an older installed description\n" +
					"---\n" +
					"body content\n"
				if err := fs.WriteFile(path, []byte(installed), 0o644); err != nil {
					t.Fatalf("WriteFile: %v", err)
				}
				return []byte(validContent) // embedded mirror differs
			},
			wantLabels: map[string]string{
				"skill-presence":    "ok",
				"skill-readable":    "ok",
				"skill-content":     "ok",
				"skill-frontmatter": "ok",
				"skill-staleness":   "warn",
			},
			wantAnyDetail: map[string]string{
				"skill-staleness": "differs from current ui-craft version",
			},
		},
		{
			name: "frontmatter invalid (unterminated fence) fails",
			setup: func(t *testing.T, fs *fsutil.MemFS) []byte {
				malformed := "---\n" +
					"name: ui-craft\n" +
					"description: SDD workflow orchestration skill\n" +
					"body content, no closing fence\n"
				if err := fs.WriteFile(path, []byte(malformed), 0o644); err != nil {
					t.Fatalf("WriteFile: %v", err)
				}
				return []byte(validContent)
			},
			wantLabels: map[string]string{
				"skill-presence":    "ok",
				"skill-readable":    "ok",
				"skill-content":     "ok",
				"skill-frontmatter": "fail",
			},
			wantAnyDetail: map[string]string{
				"skill-frontmatter": "not terminated",
			},
		},
		{
			name: "frontmatter invalid (short description) fails",
			setup: func(t *testing.T, fs *fsutil.MemFS) []byte {
				malformed := "---\n" +
					"name: ui-craft\n" +
					"description: hi\n" +
					"---\n" +
					"body content\n"
				if err := fs.WriteFile(path, []byte(malformed), 0o644); err != nil {
					t.Fatalf("WriteFile: %v", err)
				}
				return []byte(validContent)
			},
			wantLabels: map[string]string{
				"skill-frontmatter": "fail",
			},
			wantAnyDetail: map[string]string{
				"skill-frontmatter": "too short",
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fs := fsutil.NewMemFS()
			embedded := tc.setup(t, fs)

			results := cmd.CheckSkillFile(fs, path, embedded)

			got := make(map[string]string)
			details := make(map[string]string)
			for _, r := range results {
				got[r.Label()] = r.Level()
				details[r.Label()] = r.Detail()
			}

			for label, wantLevel := range tc.wantLabels {
				gotLevel, ok := got[label]
				if !ok {
					t.Errorf("expected label %q in results, got none (results: %+v)", label, results)
					continue
				}
				if gotLevel != wantLevel {
					t.Errorf("label %q level = %q, want %q", label, gotLevel, wantLevel)
				}
			}
			for _, label := range tc.wantNoLabels {
				if _, ok := got[label]; ok {
					t.Errorf("expected label %q to be absent, but it was present", label)
				}
			}
			for label, substr := range tc.wantAnyDetail {
				detail, ok := details[label]
				if !ok {
					t.Errorf("expected label %q to have a detail, got none", label)
					continue
				}
				if !strings.Contains(detail, substr) {
					t.Errorf("label %q detail = %q, want substring %q", label, detail, substr)
				}
			}
		})
	}
}

// TestCheckSkillFile_stalenessDoesNotWriteFile confirms that a staleness
// mismatch never mutates the installed file (spec's read-only guarantee).
func TestCheckSkillFile_stalenessDoesNotWriteFile(t *testing.T) {
	const path = "/home/user/.claude/skills/ui-craft/SKILL.md"
	installed := "---\nname: ui-craft\ndescription: old description here\n---\nbody\n"
	embedded := "---\nname: ui-craft\ndescription: new description here\n---\nbody\n"

	fs := fsutil.NewMemFS()
	if err := fs.WriteFile(path, []byte(installed), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	cmd.CheckSkillFile(fs, path, []byte(embedded))

	got, err := fs.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile after check: %v", err)
	}
	if string(got) != installed {
		t.Errorf("file content changed after checkSkillFile; got %q, want unchanged %q", got, installed)
	}
}
