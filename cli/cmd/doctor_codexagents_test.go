package cmd_test

import (
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
)

// TestCheckCodexAgentsMD covers the checkCodexAgentsMD function: AGENTS.md
// missing entirely, well-formed managed block (BEGIN before END), and
// orphan markers (BEGIN without END, or END without BEGIN). Per spec, a
// missing file or malformed/orphan markers are [fail]; a well-formed block
// is [ok]. This check reuses filemerge.BeginMarker/EndMarker directly (no
// duplicated marker strings).
func TestCheckCodexAgentsMD(t *testing.T) {
	const path = "/home/user/.codex/AGENTS.md"

	for _, tc := range []struct {
		name       string
		setup      func(t *testing.T, fs *fsutil.MemFS)
		wantLevel  string
		wantDetail string
	}{
		{
			name:       "AGENTS.md missing entirely",
			setup:      func(t *testing.T, fs *fsutil.MemFS) {},
			wantLevel:  "fail",
			wantDetail: "AGENTS.md not found at " + path,
		},
		{
			name: "both markers present in order (well-formed)",
			setup: func(t *testing.T, fs *fsutil.MemFS) {
				content := "# AGENTS.md\n\nsome preamble\n\n" +
					filemerge.BeginMarker + "\n" +
					"# ui-craft skill\n\nThe ui-craft skill is installed at: /home/user/.codex/skills/ui-craft\n" +
					filemerge.EndMarker + "\n"
				if err := fs.WriteFile(path, []byte(content), 0o644); err != nil {
					t.Fatalf("WriteFile: %v", err)
				}
			},
			wantLevel: "ok",
		},
		{
			name: "orphan BEGIN marker only (no END)",
			setup: func(t *testing.T, fs *fsutil.MemFS) {
				content := "# AGENTS.md\n\n" + filemerge.BeginMarker + "\nstray content\n"
				if err := fs.WriteFile(path, []byte(content), 0o644); err != nil {
					t.Fatalf("WriteFile: %v", err)
				}
			},
			wantLevel:  "fail",
			wantDetail: "managed block markers malformed (orphan marker)",
		},
		{
			name: "orphan END marker only (no BEGIN)",
			setup: func(t *testing.T, fs *fsutil.MemFS) {
				content := "# AGENTS.md\n\nstray content\n" + filemerge.EndMarker + "\n"
				if err := fs.WriteFile(path, []byte(content), 0o644); err != nil {
					t.Fatalf("WriteFile: %v", err)
				}
			},
			wantLevel:  "fail",
			wantDetail: "managed block markers malformed (orphan marker)",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fs := fsutil.NewMemFS()
			tc.setup(t, fs)

			result := cmd.CheckCodexAgentsMD(fs, path)

			if result.Label() != "codex-agents-md" {
				t.Errorf("Label() = %q, want %q", result.Label(), "codex-agents-md")
			}
			if result.Level() != tc.wantLevel {
				t.Errorf("Level() = %q, want %q (detail: %q)", result.Level(), tc.wantLevel, result.Detail())
			}
			if tc.wantDetail != "" && !strings.Contains(result.Detail(), tc.wantDetail) {
				t.Errorf("Detail() = %q, want substring %q", result.Detail(), tc.wantDetail)
			}
			if tc.wantLevel == "fail" && result.Remedy() == "" {
				t.Errorf("expected non-empty remedy for fail-level result")
			}
		})
	}
}
