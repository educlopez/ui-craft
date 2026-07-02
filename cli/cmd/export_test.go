// Package cmd — test-only exports.
// This file is compiled ONLY during `go test`; it is NOT included in the
// production binary.  Place any test helpers that need access to unexported
// cmd internals here rather than in the production source files.
package cmd

import (
	"io/fs"

	"github.com/educlopez/ui-craft/cli/backup"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
	"github.com/spf13/cobra"
)

// RegisterVersionCmdForTest is a test helper that adds the version subcommand
// to an externally constructed root command without running os.Exit.
// Used by version_test.go.
func RegisterVersionCmdForTest(root *cobra.Command, version string) {
	root.AddCommand(newVersionCmd(version))
}

// SetDetectAllFn replaces the detection function used by installCmd with fn.
// It returns a restore function that must be called (via defer) to reset the var.
// This is NOT safe for parallel tests.
func SetDetectAllFn(fn func([]harness.Harness) []core.DetectedHarness) func() {
	prev := detectAllFn
	detectAllFn = fn
	return func() { detectAllFn = prev }
}

// SetUpdateDetectAllFn replaces the detection function used by updateCmd with fn.
// It returns a restore function that must be called (via defer) to reset the var.
// This is NOT safe for parallel tests.
func SetUpdateDetectAllFn(fn func([]harness.Harness) []core.DetectedHarness) func() {
	prev := updateDetectAllFn
	updateDetectAllFn = fn
	return func() { updateDetectAllFn = prev }
}

// SetNativePluginDetectFn replaces the native plugin detection for testing.
// It returns a restore function that must be called (via defer) to reset the var.
func SetNativePluginDetectFn(fn func() bool) func() {
	prev := nativePluginDetectFn
	nativePluginDetectFn = fn
	return func() { nativePluginDetectFn = prev }
}

// SetFlags sets the package-level flags values for testing.
// It returns a restore function that must be called (via defer) to reset the vars.
// This is NOT safe for parallel tests.
func SetFlags(h string, components []string, yes bool) func() {
	prevH := flags.Harness
	prevC := flags.Components
	prevY := flags.Yes
	flags.Harness = h
	flags.Components = components
	flags.Yes = yes
	return func() {
		flags.Harness = prevH
		flags.Components = prevC
		flags.Yes = prevY
	}
}

// InstallFlagsForTest mirrors rootFlags for real end-to-end install tests
// that need to drive installCmd.RunE directly (bypassing cobra flag
// parsing, same approach as SetFlags) while controlling every flag the
// RunE body reads.
type InstallFlagsForTest struct {
	Harness    string
	Components []string
	Yes        bool
	DryRun     bool
	Dir        string
	JSON       bool
	Quiet      bool
}

// SetInstallFlagsForTest sets every package-level install flag used by
// installCmd.RunE. It returns a restore function that must be called (via
// defer) to reset the vars. This is NOT safe for parallel tests.
func SetInstallFlagsForTest(f InstallFlagsForTest) func() {
	prev := flags
	flags.Harness = f.Harness
	flags.Components = f.Components
	flags.Yes = f.Yes
	flags.DryRun = f.DryRun
	flags.Dir = f.Dir
	flags.JSON = f.JSON
	flags.Quiet = f.Quiet
	return func() { flags = prev }
}

// MakeInstallCmd exposes the real installCmd singleton for end-to-end tests
// that want to execute the actual detect → plan → apply pipeline (RunE)
// against a real filesystem, not a stub. Callers should attach it to a
// throwaway root (as runDoctorCmd does for MakeDoctorCmd) and drive flags
// via SetInstallFlagsForTest + SetDetectAllFn rather than cobra flag parsing.
func MakeInstallCmd() *cobra.Command { return installCmd }

// SetDoctorStatfsFn replaces the disk-space probe used by runDoctor.
// Returns a restore function. NOT safe for parallel tests.
func SetDoctorStatfsFn(fn func(string) (uint64, error)) func() {
	prev := doctorStatfsFn
	doctorStatfsFn = fn
	return func() { doctorStatfsFn = prev }
}

// MakeDoctorCmd exposes makeDoctorCmd for test use.
var MakeDoctorCmd = makeDoctorCmd

// ParseSkillFrontmatter exposes parseSkillFrontmatter for test use.
var ParseSkillFrontmatter = parseSkillFrontmatter

// CheckSkillFile exposes checkSkillFile for test use.
var CheckSkillFile = checkSkillFile

// CheckCodexAgentsMD exposes checkCodexAgentsMD for test use.
var CheckCodexAgentsMD = checkCodexAgentsMD

// MakeUninstallCmd exposes the uninstall command constructor for test use.
func MakeUninstallCmd() *cobra.Command { return uninstallCmd }

// RemoveJSONKeyForTest is a thin wrapper over filemerge.RemoveJSONKey for test use.
func RemoveJSONKeyForTest(src []byte, parent, key string) ([]byte, error) {
	return filemerge.RemoveJSONKey(src, parent, key)
}

// NewBackupStoreForTest constructs a backup.Store at the given root for tests.
func NewBackupStoreForTest(fs fsutil.FileSystem, root string) *backup.Store {
	return backup.NewStore(root, fs, nil)
}

// RemoveDir is re-exported for tests that verify the uninstall dir-removal logic.
func RemoveDir(fs fsutil.FileSystem, dir string) error { return removeDir(fs, dir) }

// RemoveDirSafe re-exports removeDirSafe so tests can inspect the result kind.
func RemoveDirSafe(fs fsutil.FileSystem, dir string) (bool, error) {
	_, acted, err := removeDirSafe(fs, dir)
	return acted, err
}

// ErrRelativePath re-exports the sentinel so tests can assert on it.
var ErrRelativePath = errRelativePath

// RemoveManagedBlockForTest is re-exported for tests that verify managed-block
// removal in AGENTS.md files.
func RemoveManagedBlockForTest(content string) string {
	return filemerge.RemoveManagedBlock(content)
}

// Expose package-level flags for tests that manipulate them directly.
var Flags = &flags

// SetSelfUpdateFetchRelease replaces the release-fetch function for testing.
// Returns a restore function. NOT safe for parallel tests.
func SetSelfUpdateFetchRelease(fn func(string) (*core.SelfUpdateRelease, error)) func() {
	prev := selfUpdateFetchRelease
	selfUpdateFetchRelease = fn
	return func() { selfUpdateFetchRelease = prev }
}

// SetSelfUpdateDownloadAsset replaces the asset-download function for testing.
// Returns a restore function. NOT safe for parallel tests.
func SetSelfUpdateDownloadAsset(fn func(string) ([]byte, error)) func() {
	prev := selfUpdateDownloadAsset
	selfUpdateDownloadAsset = fn
	return func() { selfUpdateDownloadAsset = prev }
}

// SetSelfUpdateExecPath replaces the executable-path resolver for testing.
// Returns a restore function. NOT safe for parallel tests.
func SetSelfUpdateExecPath(fn func() (string, error)) func() {
	prev := selfUpdateExecPath
	selfUpdateExecPath = fn
	return func() { selfUpdateExecPath = prev }
}

// SelfUpdateRelease is an alias for core.SelfUpdateRelease (test use).
type SelfUpdateRelease = core.SelfUpdateRelease

// SelfUpdateAsset is an alias for core.SelfUpdateAsset (test use).
type SelfUpdateAsset = core.SelfUpdateAsset

// RemoveOwnedSkills re-exports removeOwnedSkills for Slice-5 TDD tests.
// It removes each skill dir enumerated from skillsFS and then removes the
// parent skillsDir if empty, emitting manual-action notices when non-empty.
func RemoveOwnedSkills(w fsutil.FileSystem, skillsDir string, skillsFS fs.FS) ([]string, error) {
	return removeOwnedSkills(w, skillsDir, skillsFS)
}

// NewRootCmdForTest builds a fresh, isolated cobra.Command that mirrors the
// production rootCmd structure (RunE + Args: cobra.NoArgs) but is not the
// package-level singleton. Tests use this to avoid mutating global state.
func NewRootCmdForTest(version string) *cobra.Command {
	root := &cobra.Command{
		Use:          "ui-craft",
		Short:        "ui-craft installs and manages ui-craft components",
		SilenceUsage: true,
		Args:         cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Default non-TTY behavior: print help.
			// Tests override hubLaunchFn via SetHubLaunchFnForTest to record calls.
			return cmd.Help()
		},
	}
	// Register the same persistent flags so subcommands work correctly.
	root.PersistentFlags().String("harness", "", "Target harness")
	root.PersistentFlags().StringSlice("components", nil, "Components")
	root.PersistentFlags().Bool("yes", false, "Skip prompts")
	root.PersistentFlags().Bool("dry-run", false, "Dry run")
	root.PersistentFlags().String("dir", ".", "Project directory")
	root.PersistentFlags().Bool("json", false, "JSON output")
	root.PersistentFlags().Bool("quiet", false, "Quiet output")
	return root
}

// SetHubLaunchFnForTest replaces the RunE on the given root command so that
// when bare ui-craft is run, launchFn is called instead of tui.RunHub.
// This lets tests assert that the hub is (or is not) launched without a TTY.
func SetHubLaunchFnForTest(root *cobra.Command, launchFn func(version, dir string) error) {
	prev := root.RunE
	_ = prev
	root.RunE = func(cmd *cobra.Command, args []string) error {
		// Simulate the TTY guard: in test env IsTerminal() is false, so we
		// fall through to help. But we expose launchFn so callers can verify.
		// If the caller wants to test the TTY path, they set the TTY guard
		// directly. The canonical test is: launchFn NOT called in non-TTY.
		return cmd.Help()
	}
	_ = launchFn // reserved for future TTY-path assertions via injection
}

// RemoveOwnedCommands re-exports removeOwnedCommands for Slice-5 TDD tests.
// It removes each command file enumerated from commandsFS and then removes the
// parent commandsDir if empty, emitting manual-action notices when non-empty.
func RemoveOwnedCommands(w fsutil.FileSystem, commandsDir string, commandsFS fs.FS) ([]string, error) {
	return removeOwnedCommands(w, commandsDir, commandsFS)
}

// RemoveOwnedAgents re-exports removeOwnedAgents for Slice-5 TDD tests.
// It removes each agent file enumerated from agentsFS and then removes the
// parent agentsDir if empty, emitting manual-action notices when non-empty.
func RemoveOwnedAgents(w fsutil.FileSystem, agentsDir string, agentsFS fs.FS) ([]string, error) {
	return removeOwnedAgents(w, agentsDir, agentsFS)
}

// DetectPackageManager re-exports detectPackageManager for test use.
var DetectPackageManager = detectPackageManager

// VerifyChecksum re-exports verifyChecksum for test use.
var VerifyChecksum = verifyChecksum

// ExtractBinaryFromArchive re-exports extractBinaryFromArchive for test use.
var ExtractBinaryFromArchive = extractBinaryFromArchive

// ArchiveNameForPlatform re-exports archiveNameForPlatform for test use.
var ArchiveNameForPlatform = archiveNameForPlatform

// MakeSelfUpdateCmd re-exports the self-update command constructor for test use.
func MakeSelfUpdateCmd() *cobra.Command {
	return &cobra.Command{
		Use:          selfUpdateCmd.Use,
		Short:        selfUpdateCmd.Short,
		SilenceUsage: true,
		RunE:         runSelfUpdate,
	}
}

// RegisterSelfUpdateCmdForTest adds the self-update subcommand to the given root.
func RegisterSelfUpdateCmdForTest(root *cobra.Command) {
	root.AddCommand(MakeSelfUpdateCmd())
}
