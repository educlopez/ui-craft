package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"text/tabwriter"

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
This command can be run at any time, independently of install.

Subcommands:
  list        List all snapshots (id, date, source, pinned, file count)
  pin <id>    Pin a snapshot so auto-prune never removes it
  unpin <id>  Unpin a snapshot, making it eligible for auto-prune`,
	SilenceUsage: true,
	RunE:         runBackup,
}

// backupListCmd lists all snapshots in the store.
var backupListCmd = &cobra.Command{
	Use:          "list",
	Short:        "List all backup snapshots",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, _ []string) error {
		out := cmd.OutOrStdout()
		fs := fsutil.OsFS{}

		store, err := defaultBackupStore(fs)
		if err != nil {
			return fmt.Errorf("backup list: init store: %w", err)
		}

		metas, err := store.List()
		if err != nil {
			return fmt.Errorf("backup list: %w", err)
		}
		if len(metas) == 0 {
			fmt.Fprintln(out, "No backups found.")
			return nil
		}

		tw := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
		fmt.Fprintln(tw, "ID\tCREATED\tSOURCE\tPINNED\tFILES")
		for _, m := range metas {
			pinned := ""
			if m.Pinned {
				pinned = "yes"
			}
			fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%d\n",
				m.ID,
				m.CreatedAt.Local().Format("2006-01-02 15:04:05"),
				m.Source,
				pinned,
				m.FileCount,
			)
		}
		return tw.Flush()
	},
}

// backupPinCmd pins a snapshot by ID.
var backupPinCmd = &cobra.Command{
	Use:          "pin <id>",
	Short:        "Pin a snapshot so auto-prune never removes it",
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		out := cmd.OutOrStdout()
		fs := fsutil.OsFS{}

		store, err := defaultBackupStore(fs)
		if err != nil {
			return fmt.Errorf("backup pin: init store: %w", err)
		}
		id := backup.SnapshotID(args[0])
		if err := store.Pin(id); err != nil {
			return fmt.Errorf("backup pin: %w", err)
		}
		fmt.Fprintf(out, "Pinned: %s\n", id)
		return nil
	},
}

// backupUnpinCmd unpins a snapshot by ID.
var backupUnpinCmd = &cobra.Command{
	Use:          "unpin <id>",
	Short:        "Unpin a snapshot, making it eligible for auto-prune",
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		out := cmd.OutOrStdout()
		fs := fsutil.OsFS{}

		store, err := defaultBackupStore(fs)
		if err != nil {
			return fmt.Errorf("backup unpin: init store: %w", err)
		}
		id := backup.SnapshotID(args[0])
		if err := store.Unpin(id); err != nil {
			return fmt.Errorf("backup unpin: %w", err)
		}
		fmt.Fprintf(out, "Unpinned: %s\n", id)
		return nil
	},
}

func init() {
	backupCmd.AddCommand(backupListCmd)
	backupCmd.AddCommand(backupPinCmd)
	backupCmd.AddCommand(backupUnpinCmd)
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
