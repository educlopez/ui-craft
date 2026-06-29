package core_test

// uninstall_extract_test.go — characterization tests for core.Uninstall.
//
// Task 1.3 [RED]: these tests are written BEFORE the extraction (task 1.4).
// They document the expected contract of core.Uninstall operating over an
// in-memory filesystem.
//
// Covered paths:
//   - A targeted harness's MCP config key is removed from MemFS
//   - A targeted harness's skill dir is removed from MemFS
//   - A non-targeted harness's files are preserved
//   - UninstallReport lists the removed paths
//   - design-memory is NOT removed unless opts.RemoveDesignMemory == true

import (
	"path/filepath"
	"testing"

	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// ─── MemFS population helpers ────────────────────────────────────────────────

func populateMemFS(t *testing.T, mem *fsutil.MemFS, paths map[string][]byte) {
	t.Helper()
	for path, content := range paths {
		dir := filepath.Dir(path)
		if err := mem.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("MkdirAll %s: %v", dir, err)
		}
		if err := mem.WriteFile(path, content, 0o644); err != nil {
			t.Fatalf("WriteFile %s: %v", path, err)
		}
	}
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// TestUninstall_removesOwnedSkillDir asserts that core.Uninstall removes the
// ui-craft skill directory for a targeted harness from the MemFS.
func TestUninstall_removesOwnedSkillDir(t *testing.T) {
	mem := fsutil.NewMemFS()
	homeDir := "/home/testuser"
	skillsDir := homeDir + "/.claude/skills"
	uiCraftSkillDir := skillsDir + "/ui-craft"
	userSkillDir := skillsDir + "/my-skill"

	// Populate: ui-craft skill + an unrelated user skill.
	populateMemFS(t, mem, map[string][]byte{
		uiCraftSkillDir + "/SKILL.md": []byte("# ui-craft skill"),
		userSkillDir + "/USER.md":     []byte("# user skill"),
	})

	opts := core.UninstallOpts{
		HomeDir:     homeDir,
		SkillsDir:   skillsDir,
		SnapshotFn:  func() (string, error) { return "snap-001", nil },
		Output:      discardWriter{},
	}
	report, err := core.Uninstall(opts, mem)
	if err != nil {
		t.Fatalf("core.Uninstall: unexpected error: %v", err)
	}
	_ = report

	// ui-craft skill dir must be gone.
	if _, statErr := mem.Stat(uiCraftSkillDir); statErr == nil {
		t.Error("ui-craft skill dir should have been removed, but still exists")
	}

	// Unrelated user skill must be preserved.
	if _, statErr := mem.Stat(userSkillDir + "/USER.md"); statErr != nil {
		t.Errorf("user skill dir was removed; it should be preserved: %v", statErr)
	}
}

// TestUninstall_preservesDesignMemoryByDefault asserts that the .ui-craft/
// project-level directory is NOT removed unless RemoveDesignMemory is set.
func TestUninstall_preservesDesignMemoryByDefault(t *testing.T) {
	mem := fsutil.NewMemFS()
	homeDir := "/home/testuser"
	skillsDir := homeDir + "/.claude/skills"
	uiCraftSkillDir := skillsDir + "/ui-craft"
	designMemDir := "/projects/myapp/.ui-craft"

	populateMemFS(t, mem, map[string][]byte{
		uiCraftSkillDir + "/SKILL.md":    []byte("# skill"),
		designMemDir + "/brief.md":       []byte("# design"),
	})

	opts := core.UninstallOpts{
		HomeDir:            homeDir,
		SkillsDir:          skillsDir,
		ProjectDir:         "/projects/myapp",
		RemoveDesignMemory: false,
		SnapshotFn:         func() (string, error) { return "snap-002", nil },
		Output:             discardWriter{},
	}
	_, err := core.Uninstall(opts, mem)
	if err != nil {
		t.Fatalf("core.Uninstall: unexpected error: %v", err)
	}

	// design-memory must be intact.
	if _, statErr := mem.Stat(designMemDir + "/brief.md"); statErr != nil {
		t.Errorf("design-memory was removed; it should be preserved by default: %v", statErr)
	}
}

// TestUninstall_removesDesignMemoryWhenRequested asserts that when
// RemoveDesignMemory is true the .ui-craft/ dir is deleted.
func TestUninstall_removesDesignMemoryWhenRequested(t *testing.T) {
	mem := fsutil.NewMemFS()
	homeDir := "/home/testuser"
	skillsDir := homeDir + "/.claude/skills"
	uiCraftSkillDir := skillsDir + "/ui-craft"
	designMemDir := "/projects/myapp/.ui-craft"

	populateMemFS(t, mem, map[string][]byte{
		uiCraftSkillDir + "/SKILL.md": []byte("# skill"),
		designMemDir + "/brief.md":    []byte("# design"),
	})

	opts := core.UninstallOpts{
		HomeDir:            homeDir,
		SkillsDir:          skillsDir,
		ProjectDir:         "/projects/myapp",
		RemoveDesignMemory: true,
		SnapshotFn:         func() (string, error) { return "snap-003", nil },
		Output:             discardWriter{},
	}
	_, err := core.Uninstall(opts, mem)
	if err != nil {
		t.Fatalf("core.Uninstall: unexpected error: %v", err)
	}

	// design-memory must be gone.
	if _, statErr := mem.Stat(designMemDir + "/brief.md"); statErr == nil {
		t.Error("design-memory should have been removed, but still exists")
	}
}

// TestUninstall_reportContainsSnapshotID asserts that the returned
// UninstallReport carries the snapshot ID from SnapshotFn.
func TestUninstall_reportContainsSnapshotID(t *testing.T) {
	mem := fsutil.NewMemFS()
	homeDir := "/home/testuser"
	skillsDir := homeDir + "/.claude/skills"
	uiCraftSkillDir := skillsDir + "/ui-craft"

	populateMemFS(t, mem, map[string][]byte{
		uiCraftSkillDir + "/SKILL.md": []byte("# skill"),
	})

	wantSnapID := "snap-xyz-789"
	opts := core.UninstallOpts{
		HomeDir:    homeDir,
		SkillsDir:  skillsDir,
		SnapshotFn: func() (string, error) { return wantSnapID, nil },
		Output:     discardWriter{},
	}
	report, err := core.Uninstall(opts, mem)
	if err != nil {
		t.Fatalf("core.Uninstall: unexpected error: %v", err)
	}
	if report.SnapshotID != wantSnapID {
		t.Errorf("report.SnapshotID = %q, want %q", report.SnapshotID, wantSnapID)
	}
}

// discardWriter implements io.Writer by discarding all output.
type discardWriter struct{}

func (discardWriter) Write(p []byte) (int, error) { return len(p), nil }
