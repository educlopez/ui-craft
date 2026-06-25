package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/spf13/cobra"
)

var rollbackAtFlag string

var rollbackCmd = &cobra.Command{
	Use:   "rollback [harness]",
	Short: "Restore the latest (or a specific) harness config snapshot",
	Long: `Restore harness config files from a backup snapshot.

Without --at, the most recent snapshot is restored.
Use --at <timestamp> to pick a specific snapshot by its ID prefix.`,
	SilenceUsage: true,
	RunE:         runRollback,
}

func init() {
	rollbackCmd.Flags().StringVar(&rollbackAtFlag, "at", "", "Snapshot ID (or prefix) to restore; defaults to the latest")
	rootCmd.AddCommand(rollbackCmd)
}

func runRollback(cmd *cobra.Command, args []string) error {
	out := cmd.OutOrStdout()
	fs := fsutil.OsFS{}

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("rollback: resolve home dir: %w", err)
	}
	root := filepath.Join(home, ".ui-craft-backups")
	store := backup.NewStore(root, fs, nil)

	// Determine which snapshot ID to restore.
	var id backup.SnapshotID
	if rollbackAtFlag != "" {
		id = backup.SnapshotID(rollbackAtFlag)
	} else {
		latest, err := store.Latest()
		if err != nil {
			harnessName := "this harness"
			if len(args) > 0 {
				harnessName = args[0]
			}
			fmt.Fprintf(out, "No backup found for %s\n", harnessName)
			return fmt.Errorf("no backup found")
		}
		id = latest
	}

	if err := store.Restore(id); err != nil {
		return fmt.Errorf("rollback: restore %s: %w", id, err)
	}

	fmt.Fprintf(out, "Restored snapshot: %s\n", id)
	return nil
}
