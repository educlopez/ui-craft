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

// TestMirror_knownHarness verifies Mirror returns non-nil for every expected
// harness. Mirrors are committed (gentle-ai model), so they must always be
// present — both in dev and CI builds.
func TestMirror_knownHarness(t *testing.T) {
	harnesses := []string{"claude", "cursor", "codex", "gemini", "opencode"}
	for _, h := range harnesses {
		m := assets.Mirror(h)
		if m == nil {
			t.Errorf("Mirror(%q) returned nil — harness mirrors must be committed and always present", h)
		}
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
