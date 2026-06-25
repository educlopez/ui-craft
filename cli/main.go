package main

import "github.com/educlopez/ui-craft/cli/cmd"

// version is set via ldflags at build time: -X main.version=<semver>
var version = "dev"

// mirrorVersion is set via ldflags at build time: -X main.mirrorVersion=<semver>
// It records the repo version whose sync-harnesses.mjs output is embedded.
// Together with version, it implements the single coordinated version from ADR-6:
// binary version == mirror version for an official release build.
var mirrorVersion = "dev"

func main() {
	cmd.Execute(version, mirrorVersion)
}
