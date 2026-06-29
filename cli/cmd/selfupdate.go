// Package cmd — self-update command.
//
// ui-craft self-update upgrades the binary to the latest GitHub release.
//
// This file is a thin shim: all business logic lives in core.RunSelfUpdate.
// See core/selfupdate.go for the full safety design description.
//
// --json output: {"updated": bool, "from": str, "to": str, "method": str}
package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/educlopez/ui-craft/cli/core"
	"github.com/spf13/cobra"
)

// selfUpdateJSONResult is the --json output envelope for self-update.
type selfUpdateJSONResult struct {
	Updated bool   `json:"updated"`
	From    string `json:"from"`
	To      string `json:"to"`
	Method  string `json:"method"`
}

// ─── Injectable dependencies (for testability) ────────────────────────────
//
// These vars are kept in the cmd layer so that existing cmd-level tests
// continue to work unchanged.  They are forwarded into core.SelfUpdateOpts
// when RunE is called.  The export_test.go setters mutate these vars in tests.

var selfUpdateFetchRelease func(url string) (*core.SelfUpdateRelease, error)
var selfUpdateDownloadAsset func(url string) ([]byte, error)
var selfUpdateExecPath func() (string, error)

// ─── Cobra command ────────────────────────────────────────────────────────────

var selfUpdateCmd = &cobra.Command{
	Use:   "self-update",
	Short: "Upgrade ui-craft binary to the latest GitHub release",
	Long: `Upgrade ui-craft to the latest release from GitHub.

If installed via Homebrew or Scoop, the correct package-manager upgrade
command is printed and the binary is NOT self-replaced (self-replacing a
package-managed binary corrupts the manager's state).

For direct-download installs: the latest release is fetched, its sha256
is verified against the release checksums.txt, and the binary is atomically
replaced. On Windows, a ui-craft.new file is written next to the binary
instead (Windows cannot replace a running executable), and instructions are
printed.`,
	SilenceUsage: true,
	RunE:         runSelfUpdate,
}

func init() {
	rootCmd.AddCommand(selfUpdateCmd)
}

func runSelfUpdate(cmd *cobra.Command, _ []string) error {
	out := cmd.OutOrStdout()

	// For brew/scoop paths the core function writes human-readable output but
	// we need to intercept those cases for --json mode.  We detect the install
	// method up-front so we can emit the JSON envelope here before delegating.
	if flags.JSON {
		return runSelfUpdateJSON(out)
	}

	coreOut := out
	if flags.Quiet {
		coreOut = io.Discard
	}

	opts := core.SelfUpdateOpts{
		CurrentVersion: cmdVersion,
		Output:         coreOut,
		FetchRelease:   selfUpdateFetchRelease,  // nil → core uses real HTTP
		DownloadAsset:  selfUpdateDownloadAsset, // nil → core uses real HTTP
		ExecPath:       selfUpdateExecPath,      // nil → core uses os.Executable
	}
	_, err := core.RunSelfUpdate(opts)
	return err
}

// runSelfUpdateJSON handles the --json flag path.  It needs to emit a
// structured JSON envelope whose shape depends on the result, which requires
// knowing the install method and outcome before writing to the output.
func runSelfUpdateJSON(out io.Writer) error {
	// Capture all output from core so we can decide what JSON to emit.
	// We run core with io.Discard output and inspect the error / install-method.

	var exePath string
	execFn := selfUpdateExecPath
	if execFn == nil {
		execFn = func() (string, error) {
			// resolve via core default — we call it just to get the path
			return core.ResolveExecPath()
		}
	}
	var execErr error
	exePath, execErr = execFn()
	if execErr != nil {
		return fmt.Errorf("self-update: cannot determine executable path: %w", execErr)
	}

	pm := core.DetectInstallMethod(exePath)
	if pm == "brew" {
		return emitJSON(out, selfUpdateJSONResult{Updated: false, From: cmdVersion, To: "", Method: "brew"})
	}
	if pm == "scoop" {
		return emitJSON(out, selfUpdateJSONResult{Updated: false, From: cmdVersion, To: "", Method: "scoop"})
	}

	// Direct install — run core with a capturing fetch to learn the latest tag,
	// then emit the JSON result.
	var latestTag string
	fetchFn := selfUpdateFetchRelease // nil → wrappedFetch falls back to core.FetchRelease

	// We need the latest tag for the JSON result, so intercept FetchRelease.
	wrappedFetch := func(url string) (*core.SelfUpdateRelease, error) {
		var rel *core.SelfUpdateRelease
		var err error
		if fetchFn != nil {
			rel, err = fetchFn(url)
		} else {
			// use core's real fetch
			rel, err = core.FetchRelease(url)
		}
		if err == nil && rel != nil {
			latestTag = rel.TagName
		}
		return rel, err
	}

	opts := core.SelfUpdateOpts{
		CurrentVersion: cmdVersion,
		Output:         io.Discard, // suppress human output; we emit JSON
		FetchRelease:   wrappedFetch,
		DownloadAsset:  selfUpdateDownloadAsset,
		ExecPath:       func() (string, error) { return exePath, nil },
	}

	_, runErr := core.RunSelfUpdate(opts)
	if runErr != nil {
		return runErr
	}

	normLatest := strings.TrimPrefix(latestTag, "v")
	normCurrent := strings.TrimPrefix(cmdVersion, "v")
	if normLatest == normCurrent || latestTag == "" {
		return emitJSON(out, selfUpdateJSONResult{Updated: false, From: cmdVersion, To: latestTag, Method: "direct"})
	}
	return emitJSON(out, selfUpdateJSONResult{Updated: true, From: cmdVersion, To: latestTag, Method: "direct"})
}

// emitJSON encodes v as indented JSON to w.
func emitJSON(w io.Writer, v interface{}) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

// ─── Helpers delegated to core (used by export_test.go) ─────────────────────

// detectPackageManager delegates to core.DetectInstallMethod.
// This function is called by export_test.go which re-exports DetectPackageManager.
func detectPackageManager(exePath string) string {
	return core.DetectInstallMethod(exePath)
}

// verifyChecksum delegates to core.VerifySelfUpdateChecksum.
func verifyChecksum(archiveData, checksumsTxt []byte, archiveName string) error {
	return core.VerifySelfUpdateChecksum(archiveData, checksumsTxt, archiveName)
}

// extractBinaryFromArchive delegates to core.ExtractBinaryFromSelfUpdateArchive.
func extractBinaryFromArchive(archiveData []byte, archiveName string) ([]byte, error) {
	return core.ExtractBinaryFromSelfUpdateArchive(archiveData, archiveName)
}

// archiveNameForPlatform delegates to core.ArchiveNameForPlatform.
func archiveNameForPlatform(tag string) string {
	return core.ArchiveNameForPlatform(tag)
}
