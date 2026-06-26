package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

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
		// Security: reject any ID that contains a path separator or ".." to
		// prevent user-supplied input from being used as a path component that
		// could escape the backup root directory.
		if strings.Contains(rollbackAtFlag, string(os.PathSeparator)) ||
			strings.Contains(rollbackAtFlag, "/") ||
			strings.Contains(rollbackAtFlag, "..") {
			return fmt.Errorf("rollback: invalid snapshot id %q: must not contain path separators or '..'", rollbackAtFlag)
		}

		// Confirm the ID exists in the store before calling Restore.
		metas, listErr := store.List()
		if listErr != nil {
			return fmt.Errorf("rollback: list snapshots: %w", listErr)
		}
		var found bool
		for _, m := range metas {
			if string(m.ID) == rollbackAtFlag {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("rollback: snapshot id %q not found", rollbackAtFlag)
		}
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
