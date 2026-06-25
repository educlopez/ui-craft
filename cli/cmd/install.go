package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// installCmd is a stub for the detect → plan → apply pipeline.
// Later slices (2–7) fill in the real implementation.
var installCmd = &cobra.Command{
	Use:          "install",
	Short:        "Install ui-craft components into detected AI coding harnesses",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Slice 1: skeleton only.
		// Slice 2 wires Detect(); Slice 3 wires Apply(); Slice 7 wires the TUI.
		fmt.Fprintln(cmd.OutOrStdout(), "install: not yet implemented (coming in Slice 2)")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(installCmd)
}
