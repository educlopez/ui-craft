package backup

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// The two tests that covered validateUnderHome both went through Restore, and both were
// silently broken on Windows — one tampered a manifest with a raw string replace that never
// matched JSON-escaped backslashes, the other planted its "outside HOME" file in TEMP, which
// on Windows lives *inside* the user profile. Neither exercised the check there, so it had no
// working coverage on the one platform whose path rules differ.
//
// This tests the function directly, with paths built for the running platform. It is an
// internal test because validateUnderHome is unexported and the containment rule — not
// Restore's plumbing — is what matters.

// under joins a home directory with path segments using the platform separator.
func under(home string, parts ...string) string {
	return filepath.Join(append([]string{home}, parts...)...)
}

func TestValidateUnderHome_containment(t *testing.T) {
	// A home that exists, so resolveCandidate resolves rather than falling back to Clean.
	home := t.TempDir()

	// A sibling sharing home's textual prefix. This is the classic prefix bug: without the
	// trailing separator, HasPrefix("/h/user-evil", "/h/user") is true and the escape passes.
	sibling := home + "-evil"

	cases := []struct {
		name   string
		path   string
		reject bool
	}{
		{"home itself", home, false},
		{"direct child", under(home, "config.json"), false},
		{"nested child", under(home, ".config", "ui-craft", "state.json"), false},
		{"child that does not exist yet", under(home, "not-created-yet", "file.json"), false},
		{"sibling sharing the prefix", under(sibling, "secret"), true},
		{"sibling itself", sibling, true},
		{"parent of home", filepath.Dir(home), true},
		{"traversal out of home", under(home, "..", "escaped.json"), true},
		{"absolute path elsewhere", systemPath(), true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateUnderHome(tc.path, home)
			if tc.reject && err == nil {
				t.Errorf("validateUnderHome(%q, %q) accepted a path outside home", tc.path, home)
			}
			if !tc.reject && err != nil {
				t.Errorf("validateUnderHome(%q, %q) rejected a path inside home: %v", tc.path, home, err)
			}
		})
	}
}

// TestValidateUnderHome_windowsCaseInsensitive covers the rule that makes Windows different:
// its filesystem is case-insensitive, so C:\Users\Bob and c:\users\bob are one directory. A
// byte-wise prefix comparison denies the user their own files whenever the two spellings
// disagree — which they do, because HOME comes from the environment while the resolved path
// comes from the filesystem.
func TestValidateUnderHome_windowsCaseInsensitive(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("case-insensitive path comparison is a Windows rule")
	}
	home := t.TempDir()
	child := under(home, "config.json")

	for _, spelling := range []string{strings.ToUpper(home), strings.ToLower(home)} {
		if err := validateUnderHome(child, spelling); err != nil {
			t.Errorf("validateUnderHome(%q, %q) rejected the user's own file over letter case: %v",
				child, spelling, err)
		}
	}
}

// TestValidateUnderHome_windowsOtherVolume covers the other Windows-only rule: a path on a
// different volume shares no ancestor with home, and cannot be relative to it.
func TestValidateUnderHome_windowsOtherVolume(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("volumes are a Windows concept")
	}
	home := t.TempDir()
	vol := filepath.VolumeName(home)
	other := "D:"
	if strings.EqualFold(vol, other) {
		other = "E:"
	}
	path := other + `\data\file.json`
	if err := validateUnderHome(path, home); err == nil {
		t.Errorf("validateUnderHome(%q, %q) accepted a path on another volume", path, home)
	}
}

// systemPath returns an absolute path that exists and is outside any home directory.
func systemPath() string {
	if runtime.GOOS == "windows" {
		return `C:\Windows\System32\drivers\etc\hosts`
	}
	return "/etc/passwd"
}
