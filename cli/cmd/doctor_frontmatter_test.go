package cmd_test

import (
	"testing"

	"github.com/educlopez/ui-craft/cli/cmd"
)

// TestParseSkillFrontmatter covers parsing of the leading YAML frontmatter
// block in a SKILL.md file: opening "---" fence, name/description fields,
// closing "---" fence. Per spec, description validity threshold is >= 10
// non-whitespace characters after trimming (boundary-tested at 9 and 10).
func TestParseSkillFrontmatter(t *testing.T) {
	for _, tc := range []struct {
		name     string
		input    string
		wantName string
		wantDesc string
		wantOK   bool
	}{
		{
			name: "valid frontmatter with long-enough description",
			input: "---\n" +
				"name: ui-craft\n" +
				"description: SDD workflow orchestration skill\n" +
				"---\n" +
				"body content\n",
			wantName: "ui-craft",
			wantDesc: "SDD workflow orchestration skill",
			wantOK:   true,
		},
		{
			name: "missing opening fence",
			input: "name: ui-craft\n" +
				"description: SDD workflow orchestration skill\n" +
				"---\n" +
				"body content\n",
			wantOK: false,
		},
		{
			name: "unterminated fence (no closing ---)",
			input: "---\n" +
				"name: ui-craft\n" +
				"description: SDD workflow orchestration skill\n" +
				"body content, no closing fence\n",
			wantOK: false,
		},
		{
			name: "missing name field",
			input: "---\n" +
				"description: SDD workflow orchestration skill\n" +
				"---\n" +
				"body content\n",
			wantOK: false,
		},
		{
			name: "empty description",
			input: "---\n" +
				"name: ui-craft\n" +
				"description:\n" +
				"---\n" +
				"body content\n",
			wantOK: false,
		},
		{
			name: "whitespace-only description",
			input: "---\n" +
				"name: ui-craft\n" +
				"description:    \n" +
				"---\n" +
				"body content\n",
			wantOK: false,
		},
		{
			name: "description exactly 9 chars fails",
			input: "---\n" +
				"name: ui-craft\n" +
				"description: 123456789\n" +
				"---\n" +
				"body content\n",
			wantOK: false,
		},
		{
			name: "description exactly 10 chars passes",
			input: "---\n" +
				"name: ui-craft\n" +
				"description: 1234567890\n" +
				"---\n" +
				"body content\n",
			wantName: "ui-craft",
			wantDesc: "1234567890",
			wantOK:   true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gotName, gotDesc, gotOK := cmd.ParseSkillFrontmatter([]byte(tc.input))
			if gotOK != tc.wantOK {
				t.Fatalf("ok = %v, want %v (name=%q desc=%q)", gotOK, tc.wantOK, gotName, gotDesc)
			}
			if !tc.wantOK {
				return
			}
			if gotName != tc.wantName {
				t.Errorf("name = %q, want %q", gotName, tc.wantName)
			}
			if gotDesc != tc.wantDesc {
				t.Errorf("desc = %q, want %q", gotDesc, tc.wantDesc)
			}
		})
	}
}
