package core_test

import (
	"os"
	"regexp"
	"runtime"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/core"
)

// The name self-update looks for has to match what the release actually publishes, and the
// only authority on that is .goreleaser.yaml. Asserting a literal here would repeat the
// mistake that caused #124: the old tests pinned "ui-craft_Darwin_arm64.tar.gz" — exactly
// what the buggy code produced — so they passed while self-update failed for every user on
// every platform. A test that agrees with the code it tests proves nothing.
func TestArchiveNameMatchesGoreleaserTemplate(t *testing.T) {
	raw, err := os.ReadFile("../../.goreleaser.yaml")
	if err != nil {
		t.Fatalf("cannot read .goreleaser.yaml: %v", err)
	}

	raw = []byte(strings.ReplaceAll(string(raw), "\r\n", "\n"))
	m := regexp.MustCompile(`name_template:\s*"([^"]*\{\{[^"]*)"`).FindSubmatch(raw)
	if m == nil {
		t.Fatal("no archive name_template found in .goreleaser.yaml")
	}
	tmpl := string(m[1])

	// Render the template the way goreleaser would, for this platform.
	want := strings.NewReplacer(
		"{{ .ProjectName }}", "ui-craft",
		"{{ .Version }}", "1.0.14",
		"{{ .Os }}", runtime.GOOS,
		"{{ .Arch }}", runtime.GOARCH,
	).Replace(tmpl)
	if strings.Contains(want, "{{") {
		t.Fatalf("template uses a field this test does not render: %q", tmpl)
	}
	if runtime.GOOS == "windows" {
		want += ".zip"
	} else {
		want += ".tar.gz"
	}

	if got := core.ArchiveNameForPlatform("v1.0.14"); got != want {
		t.Errorf("archive name drifted from the release template:\n  self-update looks for: %s\n  goreleaser publishes:  %s", got, want)
	}
}

// The tag arrives with a leading "v"; the published filename does not carry it.
func TestArchiveNameStripsTagPrefix(t *testing.T) {
	if got := core.ArchiveNameForPlatform("v1.0.14"); strings.Contains(got, "_v1.0.14_") {
		t.Errorf("leading v not stripped from the version segment: %s", got)
	}
}

// The exact asset list from the bug report, so the reported case is pinned forever.
func TestArchiveNameIsPresentInReportedReleaseAssets(t *testing.T) {
	if runtime.GOOS != "darwin" || runtime.GOARCH != "arm64" {
		t.Skip("the report is from a darwin/arm64 machine")
	}
	published := []string{
		"checksums.txt",
		"ui-craft_1.0.14_darwin_amd64.tar.gz",
		"ui-craft_1.0.14_darwin_arm64.tar.gz",
		"ui-craft_1.0.14_linux_amd64.tar.gz",
		"ui-craft_1.0.14_linux_arm64.tar.gz",
		"ui-craft_1.0.14_windows_amd64.zip",
		"ui-craft_1.0.14_windows_arm64.zip",
	}
	got := core.ArchiveNameForPlatform("v1.0.14")
	for _, a := range published {
		if a == got {
			return
		}
	}
	t.Errorf("self-update would look for %q, which is not in the v1.0.14 release: %v", got, published)
}

// Every platform the release actually builds, not just the one running the test.
//
// #124 shipped a name that was wrong for all six published platforms. A test bound to
// runtime.GOOS could not have caught that — on the maintainer's Mac it would have asserted
// one wrong name against one wrong expectation and passed. The matrix comes from
// .goreleaser.yaml so adding a platform there fails here until self-update knows about it.
func TestArchiveNameForEveryBuiltPlatform(t *testing.T) {
	raw, err := os.ReadFile("../../.goreleaser.yaml")
	if err != nil {
		t.Fatalf("cannot read .goreleaser.yaml: %v", err)
	}
	// A Windows checkout rewrites this file to CRLF, and every pattern below anchors on \n.
	// Without this the matrix parses as empty and the test reports "could not parse" — which
	// it did, on the first run of the Windows suite, against a file that was perfectly fine.
	raw = []byte(strings.ReplaceAll(string(raw), "\r\n", "\n"))

	builds := regexp.MustCompile(`(?ms)^builds:.*?^archives:`).Find(raw)
	if builds == nil {
		t.Fatal("no builds section found in .goreleaser.yaml")
	}
	list := func(key string) []string {
		m := regexp.MustCompile(`(?s)` + key + `:\s*\n((?:\s*-\s*\w+\n)+)`).FindSubmatch(builds)
		if m == nil {
			return nil
		}
		var out []string
		for _, l := range regexp.MustCompile(`-\s*(\w+)`).FindAllSubmatch(m[1], -1) {
			out = append(out, string(l[1]))
		}
		return out
	}

	oses, arches := list("goos"), list("goarch")
	if len(oses) == 0 || len(arches) == 0 {
		t.Fatalf("could not parse the build matrix: goos=%v goarch=%v", oses, arches)
	}

	for _, goos := range oses {
		for _, goarch := range arches {
			got := core.ArchiveNameFor("v1.0.15", goos, goarch)
			wantExt := ".tar.gz"
			if goos == "windows" {
				wantExt = ".zip"
			}
			want := "ui-craft_1.0.15_" + goos + "_" + goarch + wantExt
			if got != want {
				t.Errorf("%s/%s: self-update looks for %q, release publishes %q", goos, goarch, got, want)
			}
		}
	}
	t.Logf("checked %d platform(s) from the build matrix", len(oses)*len(arches))
}
