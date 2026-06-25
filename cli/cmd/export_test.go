// Package cmd — test-only exports.
// This file is compiled ONLY during `go test`; it is NOT included in the
// production binary.  Place any test helpers that need access to unexported
// cmd internals here rather than in the production source files.
package cmd

import (
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
	// Pass "dev" as mirrorVersion in tests; the actual mirror content is read
	// from assets/mirrors/VERSION (which contains "dev" in the placeholder).
	root.AddCommand(newVersionCmd(version, "dev"))
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

// SetDoctorStatfsFn replaces the disk-space probe used by runDoctor.
// Returns a restore function. NOT safe for parallel tests.
func SetDoctorStatfsFn(fn func(string) (uint64, error)) func() {
	prev := doctorStatfsFn
	doctorStatfsFn = fn
	return func() { doctorStatfsFn = prev }
}

// MakeDoctorCmd exposes makeDoctorCmd for test use.
var MakeDoctorCmd = makeDoctorCmd

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

// RemoveManagedBlockForTest is re-exported for tests that verify managed-block
// removal in AGENTS.md files.
func RemoveManagedBlockForTest(content string) string {
	return filemerge.RemoveManagedBlock(content)
}

// Expose package-level flags for tests that manipulate them directly.
var Flags = &flags
