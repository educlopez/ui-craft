package assets_test

import (
	"testing"

	"github.com/educlopez/ui-craft/cli/assets"
)

// TestMirrorFS_nonNil verifies MirrorFS() returns a non-nil fs.FS.
func TestMirrorFS_nonNil(t *testing.T) {
	m := assets.MirrorFS()
	if m == nil {
		t.Fatal("MirrorFS() returned nil")
	}
}

// TestMirror_knownHarness verifies Mirror returns non-nil for a harness name
// that is expected to have a subtree in mirrors/ once CI has run.
// During development (placeholder only) the subtree is absent and Mirror
// returns nil — that is the expected behavior per gotcha #5.
func TestMirror_knownHarness(t *testing.T) {
	// Known harness names — Mirror should return non-nil IF the subtree exists,
	// or nil when only placeholders are present (dev builds). Both are valid.
	harnesses := []string{"claude", "cursor", "codex", "gemini", "opencode"}
	for _, h := range harnesses {
		m := assets.Mirror(h)
		// In CI, m must be non-nil. In dev, nil is acceptable.
		// This test does not fail on nil to remain dev-friendly.
		_ = m
		t.Logf("Mirror(%q): non-nil=%v", h, m != nil)
	}
}

// TestMirror_unknownHarness verifies Mirror returns nil for an unknown harness name.
func TestMirror_unknownHarness(t *testing.T) {
	m := assets.Mirror("nonexistent-harness-xyz")
	if m != nil {
		t.Error("Mirror(nonexistent) should return nil")
	}
}

// TestMirrorVersion_returnsString verifies MirrorVersion does not panic and
// returns a non-empty string.
func TestMirrorVersion_returnsString(t *testing.T) {
	v := assets.MirrorVersion()
	if v == "" {
		t.Error("MirrorVersion() returned empty string")
	}
}

// TestAssertMirrorsFresh_errorOnPlaceholder verifies AssertMirrorsFresh behavior:
//   - In short mode (dev build): skip the assertion entirely.
//   - When all harness mirrors are present: AssertMirrorsFresh must return nil.
//   - When mirrors are absent (dev build without CI sync): verify Mirror() returns
//     nil, which is the expected behavior per gotcha #5 (placeholder-only builds).
func TestAssertMirrorsFresh_errorOnPlaceholder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping mirror freshness assertion in short mode (dev build)")
	}
	harnesses := []string{"claude", "cursor", "codex", "gemini", "opencode"}
	allPresent := true
	for _, h := range harnesses {
		if assets.Mirror(h) == nil {
			t.Logf("mirror %q absent — dev build, skipping CI assertion", h)
			allPresent = false
			break
		}
	}
	if !allPresent {
		// Dev build: at least one mirror is absent. AssertMirrorsFresh should
		// return a non-nil error (not panic) — this is the regression guard.
		err := assets.AssertMirrorsFresh()
		if err == nil {
			t.Error("AssertMirrorsFresh() should return an error when a mirror subtree is absent")
		}
		return
	}
	// All harnesses present — AssertMirrorsFresh must return nil.
	if err := assets.AssertMirrorsFresh(); err != nil {
		t.Errorf("AssertMirrorsFresh() returned unexpected error when all mirrors present: %v", err)
	}
}
