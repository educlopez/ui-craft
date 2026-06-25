package core_test

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// --- test doubles ---

// stubHarness is a minimal harness for plan/apply tests.
type stubHarness struct {
	name string
}

func (s stubHarness) Name() string { return s.name }
func (s stubHarness) Detect() (harness.DetectResult, error) {
	return harness.DetectResult{Installed: true, ConfigRoot: "/home/user/." + s.name}, nil
}
func (s stubHarness) ConfigPaths() harness.ConfigPaths {
	return harness.ConfigPaths{
		MCPConfig: "/home/user/." + s.name + "/mcp.json",
		SkillsDir: "/home/user/." + s.name + "/skills",
	}
}
func (s stubHarness) Supports(c component.Component) bool {
	return c != component.ReviewAgents // stub doesn't support ReviewAgents
}
func (s stubHarness) WriteMCP(w fsutil.FileSystem, server harness.MCPServer) (harness.Change, error) {
	return harness.Change{}, harness.ErrNotImplemented
}
func (s stubHarness) WriteSkill(w fsutil.FileSystem) (harness.Change, error) {
	return harness.Change{}, harness.ErrNotImplemented
}
func (s stubHarness) WriteAgents(w fsutil.FileSystem) ([]harness.Change, error) {
	return nil, harness.ErrNotImplemented
}

// makeWriteOp creates a WriterOp that writes content to path on mem.
// It also writes to snapPath so the pre-snapshot captures the file state.
func makeWriteOp(mem *fsutil.MemFS, path, content string) core.WriterOp {
	return func() (harness.Change, error) {
		prior, readErr := mem.ReadFile(path)
		existed := readErr == nil
		if err := mem.WriteFile(path, []byte(content), 0o640); err != nil {
			return harness.Change{}, err
		}
		return harness.Change{
			FilePath:      path,
			PriorBytes:    prior,
			ExistedBefore: existed,
		}, nil
	}
}

// makeFailingOp creates a WriterOp that always returns an error.
var errForcedFailure = errors.New("forced write failure")

func makeFailingOp() core.WriterOp {
	return func() (harness.Change, error) {
		return harness.Change{}, errForcedFailure
	}
}

// fixedClock returns a deterministic clock for backup.NewStore.
func fixedClock(t time.Time) backup.Clock {
	return func() time.Time { return t }
}

// fakeHome is the synthetic home used so MemFS paths pass Restore validation.
const fakeHome = "/home/user"

func fakeHomeResolver() (string, error) { return fakeHome, nil }

// newTestStore creates a backup store with the fake home resolver for tests.
func newTestStore(root string, mem *fsutil.MemFS, clk backup.Clock) *backup.Store {
	return backup.NewStoreWithHome(root, mem, clk, fakeHomeResolver)
}

// --- tests ---

// TestApply_success verifies that a plan with two successful ops applies both
// changes and returns them in the result.
func TestApply_success(t *testing.T) {
	mem := fsutil.NewMemFS()
	backupRoot := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(backupRoot, 0o750)
	_ = mem.MkdirAll(home, 0o750)

	store := newTestStore(backupRoot, mem, fixedClock(time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)))
	h := stubHarness{name: "stub"}

	file1 := filepath.Join(home, "file1.json")
	file2 := filepath.Join(home, "file2.json")

	plan := core.InstallPlan{
		Targets: []core.ComponentTarget{
			{
				Harness:   h,
				Component: component.SkillCommands,
				Op:        makeWriteOp(mem, file1, "content1"),
				SnapPath:  file1,
			},
			{
				Harness:   h,
				Component: component.MCPGates,
				Op:        makeWriteOp(mem, file2, "content2"),
				SnapPath:  file2,
			},
		},
	}

	result, err := core.Apply(plan, mem, store, "v1.0.0")
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if len(result.Changes) != 2 {
		t.Errorf("expected 2 changes, got %d", len(result.Changes))
	}
	if result.SnapshotID == "" {
		t.Error("expected non-empty SnapshotID")
	}

	// Files should now exist.
	for _, f := range []string{file1, file2} {
		if _, err := mem.Stat(f); err != nil {
			t.Errorf("expected %s to exist after apply", f)
		}
	}
}

// TestApply_midPlanRollback is the key transactional scenario from the spec:
// a mid-plan failure must restore all already-written files and delete created ones.
func TestApply_midPlanRollback(t *testing.T) {
	mem := fsutil.NewMemFS()
	backupRoot := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(backupRoot, 0o750)
	_ = mem.MkdirAll(home, 0o750)

	// file1 existed before the plan with known content.
	file1 := filepath.Join(home, "existing.json")
	originalContent := `{"existing": true}`
	_ = mem.WriteFile(file1, []byte(originalContent), 0o640)

	// file2 is a new file that would be created by the plan.
	file2 := filepath.Join(home, "new.json")

	// Clock advances between snapshots so each gets a unique ID.
	clocks := []time.Time{
		time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC),
		time.Date(2026, 1, 1, 12, 0, 1, 0, time.UTC),
	}
	callIdx := 0
	multiClock := func() time.Time {
		t := clocks[callIdx%len(clocks)]
		callIdx++
		return t
	}

	store := newTestStore(backupRoot, mem, multiClock)
	h := stubHarness{name: "stub"}

	plan := core.InstallPlan{
		Targets: []core.ComponentTarget{
			{
				// Op 1: overwrites existing file.
				Harness:   h,
				Component: component.SkillCommands,
				Op:        makeWriteOp(mem, file1, "overwritten"),
				SnapPath:  file1,
			},
			{
				// Op 2: always fails.
				Harness:   h,
				Component: component.MCPGates,
				Op:        makeFailingOp(),
				SnapPath:  file2,
			},
			{
				// Op 3: would create file3 — should never run.
				Harness:   h,
				Component: component.DesignMemory,
				Op:        makeWriteOp(mem, filepath.Join(home, "file3.json"), "should-not-exist"),
				SnapPath:  filepath.Join(home, "file3.json"),
			},
		},
	}

	_, err := core.Apply(plan, mem, store, "v1.0.0")
	if err == nil {
		t.Fatal("Apply should have returned an error on mid-plan failure")
	}
	if !errors.Is(err, errForcedFailure) {
		// The error is wrapped but must chain to errForcedFailure.
		t.Errorf("expected error to wrap errForcedFailure; got: %v", err)
	}

	// file1 must be restored to its original content.
	restored, readErr := mem.ReadFile(file1)
	if readErr != nil {
		t.Fatalf("file1 not readable after rollback: %v", readErr)
	}
	if string(restored) != originalContent {
		t.Errorf("file1 content after rollback = %q; want %q", restored, originalContent)
	}

	// file2 was never created (op2 failed before writing), so it should not exist.
	if _, statErr := mem.Stat(file2); statErr == nil {
		t.Error("file2 should not exist after rollback of a failed op")
	}

	// file3 was never reached (op3 never ran), so it should not exist.
	file3 := filepath.Join(home, "file3.json")
	if _, statErr := mem.Stat(file3); statErr == nil {
		t.Error("file3 (unreached op) should not exist")
	}
}

// TestApply_skipsTargetsWithSkipTrue verifies that targets marked Skip are
// not executed and do not appear in the Changes list.
func TestApply_skipsTargetsWithSkipTrue(t *testing.T) {
	mem := fsutil.NewMemFS()
	backupRoot := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(backupRoot, 0o750)
	_ = mem.MkdirAll(home, 0o750)

	store := newTestStore(backupRoot, mem, fixedClock(time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)))
	h := stubHarness{name: "stub"}

	skippedFile := filepath.Join(home, "skipped.json")
	written := false
	plan := core.InstallPlan{
		Targets: []core.ComponentTarget{
			{
				Harness:    h,
				Component:  component.ReviewAgents,
				Skip:       true,
				SkipReason: "not supported",
				Op: func() (harness.Change, error) {
					written = true
					return harness.Change{}, nil
				},
				SnapPath: skippedFile,
			},
		},
	}

	result, err := core.Apply(plan, mem, store, "v1.0.0")
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if len(result.Changes) != 0 {
		t.Errorf("expected 0 changes for all-skip plan; got %d", len(result.Changes))
	}
	if written {
		t.Error("skipped op must not be executed")
	}
}

// TestApply_prunesAfterSuccess verifies that Prune is called on success by
// creating more than 5 prior snapshots and checking at most 5 remain.
func TestApply_prunesAfterSuccess(t *testing.T) {
	mem := fsutil.NewMemFS()
	backupRoot := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(backupRoot, 0o750)
	_ = mem.MkdirAll(home, 0o750)

	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	// Pre-create 6 unpinned snapshots directly.
	for i := 0; i < 6; i++ {
		f := fmt.Sprintf("%s/pre%d.txt", home, i)
		seed2(mem, f, fmt.Sprintf("pre%d", i))
		st := newTestStore(backupRoot, mem, fixedClock(baseTime.Add(time.Duration(i)*time.Minute)))
		targets := []backup.SnapshotTarget{{Harness: "h", OrigPath: f}}
		if _, err := st.Snapshot(targets, "v1", backup.SourceInstall); err != nil {
			t.Fatalf("pre-snapshot %d: %v", i, err)
		}
	}

	// Now run Apply — it will snapshot + prune, leaving at most 5+1=5 unpinned.
	applyFile := filepath.Join(home, "apply-target.json")
	seed2(mem, applyFile, "before")
	store := newTestStore(backupRoot, mem, fixedClock(baseTime.Add(10*time.Minute)))
	h := stubHarness{name: "stub"}
	plan := core.InstallPlan{
		Targets: []core.ComponentTarget{
			{
				Harness:   h,
				Component: component.SkillCommands,
				Op:        makeWriteOp(mem, applyFile, "after"),
				SnapPath:  applyFile,
			},
		},
	}

	if _, err := core.Apply(plan, mem, store, "v1.0.0"); err != nil {
		t.Fatalf("Apply: %v", err)
	}

	finalStore := newTestStore(backupRoot, mem, fixedClock(baseTime.Add(20*time.Minute)))
	metas, err := finalStore.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(metas) > backup.DefaultRetentionCount {
		t.Errorf("after Apply+Prune: got %d snapshots, want <= %d", len(metas), backup.DefaultRetentionCount)
	}
}

func seed2(mem *fsutil.MemFS, path, content string) {
	_ = mem.MkdirAll(filepath.Dir(path), 0o750)
	_ = mem.WriteFile(path, []byte(content), 0o640)
}

// TestApply_rollbackDeletesCreatedFiles verifies that files with
// ExistedBefore=false are deleted when rollback is triggered.
// (Spec: "Newly created files deleted on rollback")
//
// fakeHomeResolver is injected so that Restore path validation succeeds for
// /home/user paths — this makes the deletion assertion unconditional.
func TestApply_rollbackDeletesCreatedFiles(t *testing.T) {
	mem := fsutil.NewMemFS()
	backupRoot := "/backups"
	home := "/home/user"
	_ = mem.MkdirAll(backupRoot, 0o750)
	_ = mem.MkdirAll(home, 0o750)

	clocks := []time.Time{
		time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 1, 1, 0, 0, 1, 0, time.UTC),
	}
	callIdx := 0
	multiClock := func() time.Time {
		t := clocks[callIdx%len(clocks)]
		callIdx++
		return t
	}
	// newTestStore injects fakeHomeResolver so Restore accepts /home/user paths.
	store := newTestStore(backupRoot, mem, multiClock)
	h := stubHarness{name: "stub"}

	// newFile does not exist before the plan.
	newFile := filepath.Join(home, "created.json")
	// failPath is the path declared for the failing op (required by Apply pre-flight).
	failPath := filepath.Join(home, "fail-sentinel.json")

	plan := core.InstallPlan{
		Targets: []core.ComponentTarget{
			{
				// Op 1: creates newFile.
				Harness:   h,
				Component: component.SkillCommands,
				Op:        makeWriteOp(mem, newFile, "new content"),
				SnapPath:  newFile, // does not exist yet → ExistedBefore=false in snapshot
			},
			{
				// Op 2: fails → triggers rollback.
				Harness:   h,
				Component: component.MCPGates,
				Op:        makeFailingOp(),
				SnapPath:  failPath, // required by Apply pre-flight validation
			},
		},
	}

	_, err := core.Apply(plan, mem, store, "v1.0.0")
	if err == nil {
		t.Fatal("Apply should have returned an error")
	}

	// Restore MUST have been called and must have deleted newFile because
	// ExistedBefore=false. fakeHomeResolver ensures path validation passes.
	if _, statErr := mem.Stat(newFile); statErr == nil {
		t.Error("newFile (ExistedBefore=false) should be deleted after rollback, but still exists")
	}
}

// TestPlan_skipsUnsupportedComponents verifies that Plan marks unsupported
// components as Skip rather than creating an executable Op.
func TestPlan_skipsUnsupportedComponents(t *testing.T) {
	detected := []core.DetectedHarness{
		{Harness: stubHarness{name: "stub"}, Result: harness.DetectResult{Installed: true}},
	}
	selected := component.All()

	plan := core.Plan(detected, selected)

	for _, t2 := range plan.Targets {
		if t2.Component == component.ReviewAgents {
			if !t2.Skip {
				t.Error("ReviewAgents should be Skip=true for stubHarness")
			}
			if t2.SkipReason == "" {
				t.Error("Skip target must have a non-empty SkipReason")
			}
		}
	}
}

// stubOsHomeDir ensures the path we embed in tests resolves under real home.
// Used for tests that need the full restore path to succeed.
func homeRelPath(sub string) string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join("/home/user", sub)
	}
	return filepath.Join(home, ".ui-craft-test", sub)
}
