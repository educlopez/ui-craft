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
