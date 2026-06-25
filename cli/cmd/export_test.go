// Package cmd — test-only exports.
// This file is compiled ONLY during `go test`; it is NOT included in the
// production binary.  Place any test helpers that need access to unexported
// cmd internals here rather than in the production source files.
package cmd

import "github.com/spf13/cobra"

// RegisterVersionCmdForTest is a test helper that adds the version subcommand
// to an externally constructed root command without running os.Exit.
// Used by version_test.go.
func RegisterVersionCmdForTest(root *cobra.Command, version string) {
	// Pass "dev" as mirrorVersion in tests; the actual mirror content is read
	// from assets/mirrors/VERSION (which contains "dev" in the placeholder).
	root.AddCommand(newVersionCmd(version, "dev"))
}
