package harness_test

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
)

// lockedTempFS refuses to delete our atomic-write temp files, the way Windows refuses to
// delete a file another process holds open. Defender scans every file we create, so on a
// real Windows machine this is the normal case, not a rare one.
type lockedTempFS struct {
	*fsutil.MemFS
	attempts *int
}

func (f lockedTempFS) Remove(name string) error {
	if strings.HasPrefix(filepath.Base(name), fsutil.TempPrefix) {
		*f.attempts++
		return &os.PathError{
			Op:   "remove",
			Path: name,
			Err:  errors.New("The process cannot access the file because it is being used by another process."),
		}
	}
	return f.MemFS.Remove(name)
}

// TestWriteSkill_leftoverTempFileDoesNotFailInstall covers the interaction that broke every
// realFS install test on Windows.
//
// WriteFileAtomic creates its temp file as a sibling of the destination, so temps live inside
// the mirror directory. The stale-file sweep removes anything in that directory that is not
// part of the new mirror — which a temp file never is. On POSIX that sweep succeeds and the
// damage is invisible. On Windows the delete fails whenever anything else has the file open,
// and the failure was fatal: it propagated out of WriteSkill and aborted the install with a
// message about a file the user never created and cannot find.
//
// A temp file is ours and transient. Failing to sweep one must not fail an install.
func TestWriteSkill_leftoverTempFileDoesNotFailInstall(t *testing.T) {
	mirror := fixtureMirror()

	for _, h := range []harness.Harness{
		harness.ClaudeHarness{},
		harness.OpenCodeHarness{},
	} {
		t.Run(h.Name(), func(t *testing.T) {
			mem := fsutil.NewMemFS()

			first, err := h.WriteSkill(mem, mirror)
			if err != nil {
				t.Fatalf("initial WriteSkill: %v", err)
			}

			// A temp left behind by an interrupted write, or one in flight right now.
			leftover := tempBeside(t, mirror, first.FilePath, "1060469423")
			if err := mem.WriteFile(leftover, []byte("partial"), 0o644); err != nil {
				t.Fatalf("plant leftover temp: %v", err)
			}

			attempts := 0
			locked := lockedTempFS{MemFS: mem, attempts: &attempts}

			if _, err := h.WriteSkill(locked, mirror); err != nil {
				t.Fatalf("WriteSkill failed over an undeletable temp file: %v", err)
			}
			if attempts == 0 {
				t.Fatal("the sweep never reached the temp file — the test proves nothing")
			}
		})
	}
}

// TestWriteSkill_leftoverTempIsNotAUserVisibleChange asserts the other half: sweeping a temp
// file is not a change to report. Counting it makes an idempotent re-install claim it
// modified the skill, which is what drives "changed" output and backup decisions.
func TestWriteSkill_leftoverTempIsNotAUserVisibleChange(t *testing.T) {
	mem := fsutil.NewMemFS()
	mirror := fixtureMirror()
	h := harness.ClaudeHarness{}

	first, err := h.WriteSkill(mem, mirror)
	if err != nil {
		t.Fatalf("initial WriteSkill: %v", err)
	}
	// Second write with no leftover: the baseline is "nothing changed".
	steady, err := h.WriteSkill(mem, mirror)
	if err != nil {
		t.Fatalf("second WriteSkill: %v", err)
	}
	if steady.Changed {
		t.Skip("writer is not idempotent here; the comparison below would be meaningless")
	}

	leftover := tempBeside(t, mirror, first.FilePath, "7")
	if err := mem.WriteFile(leftover, []byte("partial"), 0o644); err != nil {
		t.Fatalf("plant leftover temp: %v", err)
	}

	after, err := h.WriteSkill(mem, mirror)
	if err != nil {
		t.Fatalf("WriteSkill with leftover temp: %v", err)
	}
	if after.Changed {
		t.Error("removing our own temp file was reported as a change to the user's skill")
	}
}

// tempBeside returns a path for a leftover temp file sitting where WriteFileAtomic actually
// puts one: beside a destination file, inside the skill directory the mirror owns. The stale
// sweep only descends into owned top-level dirs, so a temp placed at destDir itself is never
// visited and would make this test vacuous.
func tempBeside(t *testing.T, mirror fs.FS, destDir, suffix string) string {
	t.Helper()
	var rel string
	err := fs.WalkDir(mirror, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if rel == "" && !d.IsDir() && d.Name() != ".gitkeep" {
			rel = p
		}
		return nil
	})
	if err != nil || rel == "" {
		t.Fatalf("fixture mirror has no files to sit beside (err=%v)", err)
	}
	return filepath.Join(destDir, filepath.Dir(filepath.FromSlash(rel)), fsutil.TempPrefix+suffix)
}
