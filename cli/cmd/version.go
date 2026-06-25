package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/educlopez/ui-craft/cli/assets"
)

// newVersionCmd returns the version subcommand.
// version and mirrorVersion are injected via -X main.version= and
// -X main.mirrorVersion= ldflags at build time (ADR-6: one coordinated version).
//
// Output format:
//
//	ui-craft v0.35.0 (mirror: v0.35.0)
//
// The embedded mirrors/VERSION file is shown as "embedded" when it differs from
// the ldflag mirrorVersion, which indicates a mismatch between the build-time
// ldflags and the CI mirror-copy step. In a correct release build both are equal.
func newVersionCmd(version, mirrorVersion string) *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print ui-craft binary version and embedded mirror version",
		// SilenceUsage inherited from root; suppresses usage on error.
		RunE: func(cmd *cobra.Command, args []string) error {
			// mirrorVersion from ldflags (set by CI from package.json version).
			// Falls back to the embedded mirrors/VERSION stamp when not set by ldflags.
			effectiveMirror := mirrorVersion
			if effectiveMirror == "" || effectiveMirror == "dev" {
				effectiveMirror = assets.MirrorVersion()
			}
			fmt.Fprintf(cmd.OutOrStdout(), "ui-craft %s (mirror: %s)\n", version, effectiveMirror)
			return nil
		},
	}
}
