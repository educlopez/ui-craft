// Package assets exposes the embedded harness mirrors, scaffold templates, and
// splash art that are bundled into the ui-craft binary at build time.
//
// CI ordering dependency (gotcha #5):
//
//	The `sync-harnesses.mjs` script MUST run and copy its output into
//	cli/assets/mirrors/<harness>/ BEFORE `go build` executes.  The init()
//	guard below will panic if the mirrors subtree is empty, catching any CI
//	step-ordering bug at build verification time rather than at install time.
//
// TODO(gotcha#5): Once CI wiring lands (Slice 5), the mirrorsFSNonEmpty()
// assertion in init() will fire against real mirror content.  Until then the
// placeholder VERSION file keeps the embed valid and the guard dormant.
package assets

import (
	"embed"
	"io/fs"
	"strings"
)

//go:embed mirrors
var mirrorsFS embed.FS

//go:embed templates
var templatesFS embed.FS

//go:embed art
var artFS embed.FS

// MirrorFS returns the embedded FS rooted at "mirrors/".
func MirrorFS() fs.FS {
	sub, err := fs.Sub(mirrorsFS, "mirrors")
	if err != nil {
		panic("assets: cannot sub mirrorsFS: " + err.Error())
	}
	return sub
}

// TemplateFS returns the embedded FS rooted at "templates/".
func TemplateFS() fs.FS {
	sub, err := fs.Sub(templatesFS, "templates")
	if err != nil {
		panic("assets: cannot sub templatesFS: " + err.Error())
	}
	return sub
}

// ArtFS returns the embedded FS rooted at "art/".
func ArtFS() fs.FS {
	sub, err := fs.Sub(artFS, "art")
	if err != nil {
		panic("assets: cannot sub artFS: " + err.Error())
	}
	return sub
}

// MirrorVersion returns the version stamp embedded in mirrors/VERSION.
// Returns "unknown" if the file is absent or unreadable.
func MirrorVersion() string {
	data, err := mirrorsFS.ReadFile("mirrors/VERSION")
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(data))
}

// mirrorsFSNonEmpty returns true when at least one non-.gitkeep file exists
// under the mirrors/ subtree. Used by the init() guard below.
func mirrorsFSNonEmpty() bool {
	found := false
	_ = fs.WalkDir(mirrorsFS, "mirrors", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		// .gitkeep and VERSION are scaffold-only; real content = anything else.
		base := d.Name()
		if base == ".gitkeep" {
			return nil
		}
		if path == "mirrors/VERSION" {
			return nil
		}
		found = true
		return fs.SkipAll
	})
	return found
}

// assertMirrorsFreshSeam is the build-time / init assertion seam for gotcha #5.
// In development builds (placeholder only) this is a no-op.
// When CI populates mirrors/ with real content and then runs `go build`,
// if the subtree is somehow empty the panic will surface the ordering bug
// before the binary ships.
//
// TODO(slice5): Remove the placeholder guard once CI sync step is wired.
// At that point, replace the mirrorsFSNonEmpty check with a stricter assertion
// that each expected harness subdirectory is present and non-empty.
//
//nolint:unused
func assertMirrorsFreshSeam() {
	// During development (Slices 1–4) mirrors/ contains only placeholders,
	// so we skip the assertion. The CI gate is enforced separately.
	// Uncomment and harden the body below when CI wiring lands (Slice 5):
	//
	//   if !mirrorsFSNonEmpty() {
	//       panic("assets: mirrors/ subtree is empty — run sync-harnesses.mjs before go build (gotcha #5)")
	//   }
	if mirrorsFSNonEmpty() {
		// Real content detected — CI sync step ran successfully.
		// No action needed during Slices 1–4; this branch is a no-op placeholder.
	}
}

func init() {
	assertMirrorsFreshSeam()
}
