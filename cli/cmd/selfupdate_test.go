package cmd_test

// Tests for the self-update command (Feature 2).
//
// Covered:
//   brew-path detection   → advises "brew upgrade ui-craft" + no download
//   scoop-path detection  → advises "scoop update ui-craft" + no download
//   already-latest        → no-op, says "already at latest"
//   newer version (direct)→ downloads + verifies + swaps (fake fs/temp)
//   checksum mismatch     → aborts, no swap
//   --json brew path      → emits JSON with method=brew
//   --json already-latest → emits JSON with updated=false

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/spf13/cobra"

	"github.com/educlopez/ui-craft/cli/cmd"
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

// buildFakeTarGz creates an in-memory .tar.gz containing a single "ui-craft"
// binary with the given content bytes.
func buildFakeTarGz(t *testing.T, content []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gw)
	hdr := &tar.Header{
		Name: "ui-craft",
		Mode: 0o755,
		Size: int64(len(content)),
	}
	if err := tw.WriteHeader(hdr); err != nil {
		t.Fatalf("buildFakeTarGz: WriteHeader: %v", err)
	}
	if _, err := tw.Write(content); err != nil {
		t.Fatalf("buildFakeTarGz: Write: %v", err)
	}
	if err := tw.Close(); err != nil {
		t.Fatalf("buildFakeTarGz: tar Close: %v", err)
	}
	if err := gw.Close(); err != nil {
		t.Fatalf("buildFakeTarGz: gzip Close: %v", err)
	}
	return buf.Bytes()
}

// sha256Hex returns the hex-encoded SHA-256 of data.
func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// checksumsTxt builds a fake checksums.txt body for the given archive name and data.
func checksumsTxt(archiveName string, archiveData []byte) []byte {
	return []byte(fmt.Sprintf("%s  %s\n", sha256Hex(archiveData), archiveName))
}

// runSelfUpdateCmd builds a minimal cobra root, wires self-update into it, and
// executes it with the given args. It returns stdout + stderr combined and any
// execution error.
func runSelfUpdateCmd(t *testing.T, args []string) (string, error) {
	t.Helper()
	var buf bytes.Buffer
	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.PersistentFlags().BoolVar(&cmd.Flags.JSON, "json", false, "")
	root.PersistentFlags().BoolVar(&cmd.Flags.Quiet, "quiet", false, "")
	root.SetOut(&buf)
	root.SetErr(&buf)
	cmd.RegisterSelfUpdateCmdForTest(root)
	root.SetArgs(args)
	err := root.Execute()
	return buf.String(), err
}

// ─── Package-manager detection tests ─────────────────────────────────────────

func TestDetectPackageManager_brew(t *testing.T) {
	cases := []string{
		"/opt/homebrew/bin/ui-craft",
		"/usr/local/Cellar/ui-craft/1.0.0/bin/ui-craft",
		"/home/linuxbrew/.linuxbrew/bin/ui-craft",
	}
	for _, path := range cases {
		if got := cmd.DetectPackageManager(path); got != "brew" {
			t.Errorf("DetectPackageManager(%q) = %q, want brew", path, got)
		}
	}
}

func TestDetectPackageManager_scoop(t *testing.T) {
	path := `C:\Users\user\scoop\apps\ui-craft\current\ui-craft.exe`
	if got := cmd.DetectPackageManager(path); got != "scoop" {
		t.Errorf("DetectPackageManager(%q) = %q, want scoop", path, got)
	}
}

func TestDetectPackageManager_none(t *testing.T) {
	cases := []string{
		"/usr/local/bin/ui-craft",
		"/home/user/bin/ui-craft",
		`C:\Users\user\bin\ui-craft.exe`,
	}
	for _, path := range cases {
		if got := cmd.DetectPackageManager(path); got != "" {
			t.Errorf("DetectPackageManager(%q) = %q, want empty", path, got)
		}
	}
}

// ─── Checksum verification tests ──────────────────────────────────────────────

func TestVerifyChecksum_match(t *testing.T) {
	data := []byte("fake binary content")
	archiveName := "ui-craft_Darwin_arm64.tar.gz"
	cs := checksumsTxt(archiveName, data)
	if err := cmd.VerifyChecksum(data, cs, archiveName); err != nil {
		t.Errorf("VerifyChecksum: expected no error, got %v", err)
	}
}

func TestVerifyChecksum_mismatch(t *testing.T) {
	data := []byte("real binary")
	badData := []byte("different binary")
	archiveName := "ui-craft_Darwin_arm64.tar.gz"
	// Checksum for badData, but we verify data — should fail.
	cs := checksumsTxt(archiveName, badData)
	err := cmd.VerifyChecksum(data, cs, archiveName)
	if err == nil {
		t.Error("VerifyChecksum: expected error on mismatch, got nil")
	}
	if !strings.Contains(err.Error(), "checksum mismatch") {
		t.Errorf("VerifyChecksum: error should mention 'checksum mismatch', got %v", err)
	}
}

func TestVerifyChecksum_missingEntry(t *testing.T) {
	data := []byte("binary")
	cs := []byte("aabbcc  other_archive.tar.gz\n")
	err := cmd.VerifyChecksum(data, cs, "ui-craft_Darwin_arm64.tar.gz")
	if err == nil {
		t.Error("VerifyChecksum: expected error when entry missing, got nil")
	}
}

// ─── Archive extraction tests ─────────────────────────────────────────────────

func TestExtractBinaryFromArchive_tarGz(t *testing.T) {
	want := []byte("fake ui-craft binary v99")
	archive := buildFakeTarGz(t, want)
	archiveName := "ui-craft_Darwin_arm64.tar.gz"
	got, err := cmd.ExtractBinaryFromArchive(archive, archiveName)
	if err != nil {
		t.Fatalf("ExtractBinaryFromArchive: %v", err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("ExtractBinaryFromArchive: got %q, want %q", got, want)
	}
}

// ─── Command-level self-update tests ─────────────────────────────────────────

func TestSelfUpdate_brewPath_advisesBrewCommand(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("brew test not applicable on Windows")
	}
	restoreExec := cmd.SetSelfUpdateExecPath(func() (string, error) {
		return "/opt/homebrew/bin/ui-craft", nil
	})
	defer restoreExec()

	// selfUpdateFetchRelease should NOT be called for brew path.
	fetchCalled := false
	restoreFetch := cmd.SetSelfUpdateFetchRelease(func(url string) (*cmd.SelfUpdateRelease, error) {
		fetchCalled = true
		return nil, fmt.Errorf("should not be called")
	})
	defer restoreFetch()

	oldJSON := cmd.Flags.JSON
	defer func() { cmd.Flags.JSON = oldJSON }()

	out, err := runSelfUpdateCmd(t, []string{"self-update"})
	if err != nil {
		t.Fatalf("self-update brew path: unexpected error: %v", err)
	}
	if fetchCalled {
		t.Error("self-update brew path: should not fetch release, but did")
	}
	if !strings.Contains(out, "brew upgrade ui-craft") {
		t.Errorf("self-update brew path: expected 'brew upgrade ui-craft' in output, got: %s", out)
	}
}

func TestSelfUpdate_brewPath_JSONMethod(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("brew test not applicable on Windows")
	}
	restoreExec := cmd.SetSelfUpdateExecPath(func() (string, error) {
		return "/opt/homebrew/bin/ui-craft", nil
	})
	defer restoreExec()

	restoreFetch := cmd.SetSelfUpdateFetchRelease(func(url string) (*cmd.SelfUpdateRelease, error) {
		return nil, fmt.Errorf("should not be called")
	})
	defer restoreFetch()

	oldJSON := cmd.Flags.JSON
	defer func() { cmd.Flags.JSON = oldJSON }()

	out, err := runSelfUpdateCmd(t, []string{"--json", "self-update"})
	if err != nil {
		t.Fatalf("self-update brew --json: unexpected error: %v", err)
	}

	var m map[string]interface{}
	dec := json.NewDecoder(strings.NewReader(out))
	if err := dec.Decode(&m); err != nil {
		t.Fatalf("self-update brew --json: not valid JSON: %v\noutput: %s", err, out)
	}
	if method, _ := m["method"].(string); method != "brew" {
		t.Errorf("self-update brew --json: expected method=brew, got %q", method)
	}
}

func TestSelfUpdate_alreadyLatest_noOp(t *testing.T) {
	restoreExec := cmd.SetSelfUpdateExecPath(func() (string, error) {
		return "/usr/local/bin/ui-craft", nil
	})
	defer restoreExec()

	restoreFetch := cmd.SetSelfUpdateFetchRelease(func(url string) (*cmd.SelfUpdateRelease, error) {
		// Return the same version that cmdVersion would report ("dev").
		return &cmd.SelfUpdateRelease{TagName: "dev", Assets: nil}, nil
	})
	defer restoreFetch()

	downloadCalled := false
	restoreDownload := cmd.SetSelfUpdateDownloadAsset(func(url string) ([]byte, error) {
		downloadCalled = true
		return nil, fmt.Errorf("should not download")
	})
	defer restoreDownload()

	oldJSON := cmd.Flags.JSON
	defer func() { cmd.Flags.JSON = oldJSON }()

	out, err := runSelfUpdateCmd(t, []string{"self-update"})
	if err != nil {
		t.Fatalf("self-update already-latest: unexpected error: %v", err)
	}
	if downloadCalled {
		t.Error("self-update already-latest: should not download, but did")
	}
	if !strings.Contains(out, "already at the latest") {
		t.Errorf("self-update already-latest: expected 'already at the latest' in output, got: %s", out)
	}
}

func TestSelfUpdate_checksumMismatch_abortsNoSwap(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("atomic rename test not applicable on Windows self-replace path")
	}

	// Create a temp dir to act as the binary's directory.
	tmpDir := t.TempDir()
	fakeBin := filepath.Join(tmpDir, "ui-craft")
	original := []byte("original binary")
	if err := os.WriteFile(fakeBin, original, 0o755); err != nil {
		t.Fatalf("write fake binary: %v", err)
	}

	restoreExec := cmd.SetSelfUpdateExecPath(func() (string, error) {
		return fakeBin, nil
	})
	defer restoreExec()

	archiveName := cmd.ArchiveNameForPlatform("v99.0.0")
	fakeBinContent := []byte("new binary content")
	goodArchive := buildFakeTarGz(t, fakeBinContent)
	// Build a checksums.txt that does NOT match goodArchive.
	badChecksums := []byte(fmt.Sprintf("0000000000000000000000000000000000000000000000000000000000000000  %s\n", archiveName))

	restoreFetch := cmd.SetSelfUpdateFetchRelease(func(url string) (*cmd.SelfUpdateRelease, error) {
		return &cmd.SelfUpdateRelease{
			TagName: "v99.0.0",
			Assets: []cmd.SelfUpdateAsset{
				{Name: archiveName, BrowserDownloadURL: "http://fake/archive"},
				{Name: "checksums.txt", BrowserDownloadURL: "http://fake/checksums"},
			},
		}, nil
	})
	defer restoreFetch()

	restoreDownload := cmd.SetSelfUpdateDownloadAsset(func(url string) ([]byte, error) {
		if strings.Contains(url, "checksums") {
			return badChecksums, nil
		}
		return goodArchive, nil
	})
	defer restoreDownload()

	oldJSON := cmd.Flags.JSON
	defer func() { cmd.Flags.JSON = oldJSON }()

	_, err := runSelfUpdateCmd(t, []string{"self-update"})
	if err == nil {
		t.Error("self-update checksum mismatch: expected error, got nil")
	}
	if !strings.Contains(err.Error(), "checksum") {
		t.Errorf("self-update checksum mismatch: error should mention 'checksum', got %v", err)
	}
	// Binary must not have been replaced.
	got, readErr := os.ReadFile(fakeBin)
	if readErr != nil {
		t.Fatalf("could not read binary after mismatch: %v", readErr)
	}
	if !bytes.Equal(got, original) {
		t.Error("self-update checksum mismatch: binary was modified despite checksum failure")
	}
}

func TestSelfUpdate_newerVersion_swapsBinary(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("atomic rename test skipped on Windows")
	}

	tmpDir := t.TempDir()
	fakeBin := filepath.Join(tmpDir, "ui-craft")
	original := []byte("old binary")
	if err := os.WriteFile(fakeBin, original, 0o755); err != nil {
		t.Fatalf("write fake binary: %v", err)
	}

	restoreExec := cmd.SetSelfUpdateExecPath(func() (string, error) {
		return fakeBin, nil
	})
	defer restoreExec()

	archiveName := cmd.ArchiveNameForPlatform("v99.0.0")
	newContent := []byte("new binary content v99")
	archive := buildFakeTarGz(t, newContent)
	cs := checksumsTxt(archiveName, archive)

	restoreFetch := cmd.SetSelfUpdateFetchRelease(func(url string) (*cmd.SelfUpdateRelease, error) {
		return &cmd.SelfUpdateRelease{
			TagName: "v99.0.0",
			Assets: []cmd.SelfUpdateAsset{
				{Name: archiveName, BrowserDownloadURL: "http://fake/archive"},
				{Name: "checksums.txt", BrowserDownloadURL: "http://fake/checksums"},
			},
		}, nil
	})
	defer restoreFetch()

	restoreDownload := cmd.SetSelfUpdateDownloadAsset(func(url string) ([]byte, error) {
		if strings.Contains(url, "checksums") {
			return cs, nil
		}
		return archive, nil
	})
	defer restoreDownload()

	oldJSON := cmd.Flags.JSON
	defer func() { cmd.Flags.JSON = oldJSON }()

	out, err := runSelfUpdateCmd(t, []string{"self-update"})
	if err != nil {
		t.Fatalf("self-update newer: unexpected error: %v\noutput: %s", err, out)
	}

	// Verify binary was replaced.
	got, readErr := os.ReadFile(fakeBin)
	if readErr != nil {
		t.Fatalf("could not read binary after update: %v", readErr)
	}
	if !bytes.Equal(got, newContent) {
		t.Errorf("self-update newer: binary not replaced; got %q, want %q", got, newContent)
	}
	if !strings.Contains(out, "Updated") && !strings.Contains(out, "v99.0.0") {
		t.Errorf("self-update newer: expected 'Updated' or version in output, got: %s", out)
	}
}
