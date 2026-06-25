package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/spf13/cobra"
)

var backupCmd = &cobra.Command{
	Use:   "backup",
	Short: "Snapshot current harness configs without installing",
	Long: `Create a timestamped backup of all detected harness config files.
This command can be run at any time, independently of install.`,
	SilenceUsage: true,
	RunE:         runBackup,
}

func init() {
	rootCmd.AddCommand(backupCmd)
}

func runBackup(cmd *cobra.Command, _ []string) error {
	out := cmd.OutOrStdout()
	fs := fsutil.OsFS{}

	detected := core.DetectAll(harness.All())
	if len(detected) == 0 {
		fmt.Fprintln(out, "No supported AI coding harness detected — nothing to back up.")
		return nil
	}

	store, err := defaultBackupStore(fs)
	if err != nil {
		return fmt.Errorf("backup: init store: %w", err)
	}

	// Collect all config file paths from detected harnesses.
	var targets []backup.SnapshotTarget
	for _, dh := range detected {
		paths := dh.Harness.ConfigPaths()
		for _, p := range []string{paths.MCPConfig, paths.SkillsDir, paths.AgentsDir} {
			if p == "" {
				continue
			}
			targets = append(targets, backup.SnapshotTarget{
				Harness:  dh.Harness.Name(),
				OrigPath: p,
			})
		}
	}

	id, err := store.Snapshot(targets, cmdVersion, backup.SourceManual)
	if err != nil {
		return fmt.Errorf("backup: snapshot: %w", err)
	}

	fmt.Fprintf(out, "Backup created: %s\n", id)
	return nil
}

// defaultBackupStore returns a Store rooted at ~/.ui-craft-backups.
func defaultBackupStore(fs fsutil.FileSystem) (*backup.Store, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	root := filepath.Join(home, ".ui-craft-backups")
	return backup.NewStore(root, fs, nil), nil
}
