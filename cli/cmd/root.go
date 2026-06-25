package cmd

import (
	"os"
	"sync"

	"github.com/spf13/cobra"
)

// rootFlags holds values for the persistent flags.
type rootFlags struct {
	Harness    string
	Components []string
	Yes        bool
	DryRun     bool
	Dir        string
}

var flags rootFlags

// rootCmd is the base command for the ui-craft CLI.
var rootCmd = &cobra.Command{
	Use:   "ui-craft",
	Short: "ui-craft installs and manages ui-craft components into your AI coding harness",
	Long: `ui-craft is a static installer that detects your AI coding harness (Claude Code,
Cursor, Codex, Gemini, OpenCode) and writes ui-craft components — skill+commands,
MCP gates, review agents, and design-memory — into the harness's native config format.`,
	SilenceUsage: true,
}

// cmdVersion holds the binary version passed to Execute. It is available to
// all subcommands (e.g. backup) for embedding in snapshot manifests.
var cmdVersion = "dev"

// versionOnce guards AddCommand so that calling Execute more than once
// (e.g. in tests that reuse the package-level rootCmd) does not register a
// duplicate "version" subcommand and trigger cobra's duplicate-command panic.
var versionOnce sync.Once

// Execute wires the binary version into the root command and runs it.
func Execute(version string) {
	cmdVersion = version
	// Attach the version subcommand with the build-time version string.
	// sync.Once ensures idempotency if Execute is called more than once.
	versionOnce.Do(func() {
		rootCmd.AddCommand(newVersionCmd(version))
	})

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	// Persistent flags are available to all subcommands.
	rootCmd.PersistentFlags().StringVar(&flags.Harness, "harness", "", "Target harness (claude, cursor, codex, gemini, opencode)")
	rootCmd.PersistentFlags().StringSliceVar(&flags.Components, "components", nil, "Comma-separated components to install (skill+commands,mcp-gates,review-agents,design-memory)")
	rootCmd.PersistentFlags().BoolVar(&flags.Yes, "yes", false, "Skip interactive prompts and apply defaults")
	rootCmd.PersistentFlags().BoolVar(&flags.DryRun, "dry-run", false, "Show what would be changed without writing any files")
	rootCmd.PersistentFlags().StringVar(&flags.Dir, "dir", ".", "Project directory (default: current directory)")
}
