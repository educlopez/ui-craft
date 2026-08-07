package backup_test

import (
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// TestRestore_keepsUserFilesWhenSentinelPathIsSpelledDifferently covers a data-loss bug.
//
// A directory sentinel records "this directory was snapshotted"; on rollback, any file under
// it that was not in the snapshot is treated as install-added and deleted. Membership was
// decided by strings.HasPrefix over raw paths — but the sentinel's path is whatever the
// caller passed, while each file's path was rebuilt with filepath.Join during the snapshot
// walk. When the two spellings differ, no file matches its sentinel, the set of
// "was present before" comes out empty, and rollback deletes the user's own files.
//
// On Windows the two always differed: forward slashes on one side, backslashes on the other.
// TestReviewAgents_rollbackPreservesUserAgent caught it there, reporting only that a file
// "does not exist" — the diagnostic that named the cause was an empty directory listing.
//
// This reproduces it on every platform by passing an equivalent but differently spelled
// directory, which is the same fault in general form.
func TestRestore_keepsUserFilesWhenSentinelPathIsSpelledDifferently(t *testing.T) {
	base := t.TempDir()
	root := filepath.Join(base, "backups")
	agentsDir := filepath.Join(base, ".claude", "agents")

	mem := fsutil.NewMemFS()
	_ = mem.MkdirAll(root, 0o750)

	userAgent := filepath.Join(agentsDir, "user-custom-agent.md")
	userContent := "# the user's own agent, not ours"
	seed(mem, userAgent, userContent)

	store := backup.NewStoreWithHome(
		root, mem,
		fixedClock(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)),
		func() (string, error) { return base, nil },
	)

	id, err := store.Snapshot(
		[]backup.SnapshotTarget{{Harness: "claude", OrigPath: agentsDir}},
		"v1", backup.SourceInstall,
	)
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}

	// Respell the sentinel's path in the manifest: same directory, different string. This is
	// written straight into the manifest because that is where the two spellings actually
	// meet — the sentinel path travels through the manifest while each file's path is rebuilt
	// by the snapshot walk, and on Windows those two routes disagree on the separator. An
	// earlier version of this test passed a trailing separator to Snapshot instead and was
	// normalised somewhere before the comparison, so it passed with the bug reintroduced and
	// proved nothing.
	manifestPath := filepath.Join(root, string(id), "manifest.json")
	raw, err := mem.ReadFile(manifestPath)
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	var manifest map[string]any
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatalf("unmarshal manifest: %v", err)
	}
	respelled := 0
	for _, entry := range manifest["files"].([]any) {
		e := entry.(map[string]any)
		if e["isDirSentinel"] == true {
			e["origPath"] = e["origPath"].(string) + string(filepath.Separator) + "."
			respelled++
		}
	}
	if respelled == 0 {
		t.Fatal("no dir sentinel in the manifest — this test would prove nothing")
	}
	tampered, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("marshal manifest: %v", err)
	}
	if err := mem.WriteFile(manifestPath, tampered, 0o640); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	// The install adds its own agent afterwards; rollback should remove only this one.
	installed := filepath.Join(agentsDir, "design-reviewer.md")
	seed(mem, installed, "# installed by ui-craft")

	if err := store.Restore(id); err != nil {
		t.Fatalf("Restore: %v", err)
	}

	got, err := mem.ReadFile(userAgent)
	if err != nil {
		t.Fatalf("rollback deleted the user's pre-existing agent: %v", err)
	}
	if string(got) != userContent {
		t.Errorf("user agent content changed:\n  got:  %q\n  want: %q", got, userContent)
	}
	if _, err := mem.Stat(installed); err == nil {
		t.Error("rollback kept the install-added agent; the cleanup did not run at all")
	}
}
