package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
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
//
// --check-parity flag (Slice 10): runs VerifyClaudeCodeParity and prints per-check
// PASS/FAIL; exits 0 if all pass, 1 if any fail.
func newVersionCmd(version, mirrorVersion string) *cobra.Command {
	cmd := &cobra.Command{
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

			// --json: emit a machine-readable object instead of human text.
			if flags.JSON {
				out := struct {
					Version string `json:"version"`
					Mirror  string `json:"mirror"`
				}{Version: version, Mirror: effectiveMirror}
				enc := json.NewEncoder(cmd.OutOrStdout())
				enc.SetIndent("", "  ")
				return enc.Encode(out)
			}

			if !flags.Quiet {
				fmt.Fprintf(cmd.OutOrStdout(), "ui-craft %s (mirror: %s)\n", version, effectiveMirror)
			}

			checkParity, _ := cmd.Flags().GetBool("check-parity")
			if !checkParity {
				return nil
			}

			// --- Claude Code parity check ---
			out := cmd.OutOrStdout()
			osfs := fsutil.OsFS{}
			home, _ := os.UserHomeDir()
			stateRoot := filepath.Join(home, ".ui-craft")
			state, _ := core.LoadState(osfs, stateRoot)

			issues, results := core.VerifyClaudeCodeParity(osfs, state, "")
			if results == nil {
				// results == nil means no Claude install was recorded.
				fmt.Fprintln(out, "parity: no Claude Code install recorded in state.json")
				return nil
			}

			// Print PASS/FAIL only for the checks that were actually run.
			// Never print PASS for a component that had no parity check (e.g. design-memory).
			for _, r := range results {
				if r.Passed {
					fmt.Fprintf(out, "PASS [%s]\n", r.CheckName)
				} else {
					// Find the matching issue for the description.
					for _, iss := range issues {
						if iss.Check == r.CheckName {
							fmt.Fprintln(out, iss.String())
							break
						}
					}
				}
			}

			if len(issues) > 0 {
				return fmt.Errorf("parity: %d check(s) failed", len(issues))
			}
			return nil
		},
	}
	cmd.Flags().Bool("check-parity", false, "Verify Claude Code install matches expected parity (PASS/FAIL per check)")
	return cmd
}
