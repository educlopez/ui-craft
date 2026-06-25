package main

import "github.com/educlopez/ui-craft/cli/cmd"

// version is set via ldflags at build time: -X main.version=<semver>
var version = "dev"

func main() {
	cmd.Execute(version)
}
