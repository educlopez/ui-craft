package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/educlopez/ui-craft/cli/assets"
)

// newVersionCmd returns the version subcommand.
// version is injected from main.version (set by -X main.version= ldflags at build time).
func newVersionCmd(version string) *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print ui-craft binary version and embedded mirror version",
		// SilenceUsage inherited from root; suppresses usage on error.
		RunE: func(cmd *cobra.Command, args []string) error {
			mirrorVersion := assets.MirrorVersion()
			fmt.Fprintf(cmd.OutOrStdout(), "ui-craft %s (mirror: %s)\n", version, mirrorVersion)
			return nil
		},
	}
}
