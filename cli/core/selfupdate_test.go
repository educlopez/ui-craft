package core_test

// selfupdate_test.go — characterization tests for core.RunSelfUpdate.
//
// These tests capture the behaviour of the self-update logic that was
// previously embedded in cmd/selfupdate.go.  Writing them BEFORE the
// extraction (task 1.1 RED) documents the exact contract; they turn GREEN
// when task 1.2 moves the logic into core.RunSelfUpdate.
//
// Covered paths:
//   brew-path detection     → returns nil, no fetch called
//   scoop-path detection    → returns nil, no fetch called
//   already-latest          → returns nil, no download
//   checksum mismatch       → returns error, no binary written
//   download failure        → returns error
//   newer version (direct)  → replaces binary, returns nil

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/core"
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

func buildFakeTarGzCore(t *testing.T, content []byte) []byte {
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
		t.Fatalf("buildFakeTarGzCore: WriteHeader: %v", err)
	}
	if _, err := tw.Write(content); err != nil {
		t.Fatalf("buildFakeTarGzCore: Write: %v", err)
	}
	if err := tw.Close(); err != nil {
		t.Fatalf("buildFakeTarGzCore: tar Close: %v", err)
	}
	if err := gw.Close(); err != nil {
		t.Fatalf("buildFakeTarGzCore: gzip Close: %v", err)
	}
	return buf.Bytes()
}

func sha256HexCore(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func fakeChecksumsTxt(archiveName string, archiveData []byte) []byte {
	return []byte(fmt.Sprintf("%s  %s\n", sha256HexCore(archiveData), archiveName))
}

// fakeRelease constructs a SelfUpdateRelease with the given assets.
func fakeRelease(tag string, archiveName, archiveURL, checksumsURL string) *core.SelfUpdateRelease {
	assets := []core.SelfUpdateAsset{
		{Name: archiveName, BrowserDownloadURL: archiveURL},
	}
	if checksumsURL != "" {
		assets = append(assets, core.SelfUpdateAsset{Name: "checksums.txt", BrowserDownloadURL: checksumsURL})
	}
	return &core.SelfUpdateRelease{TagName: tag, Assets: assets}
}

// baseOpts returns SelfUpdateOpts with all injectable fns set to stubs that
// fail loudly if called unexpectedly.
func baseOpts(t *testing.T) core.SelfUpdateOpts {
	t.Helper()
	return core.SelfUpdateOpts{
		CurrentVersion: "dev",
		FetchRelease: func(url string) (*core.SelfUpdateRelease, error) {
			t.Errorf("FetchRelease called unexpectedly with %s", url)
			return nil, fmt.Errorf("not expected")
		},
		DownloadAsset: func(url string) ([]byte, error) {
			t.Errorf("DownloadAsset called unexpectedly with %s", url)
			return nil, fmt.Errorf("not expected")
		},
		ExecPath: func() (string, error) {
			return "/usr/local/bin/ui-craft", nil
		},
		Output: io.Discard,
	}
}

// ─── Brew detection ───────────────────────────────────────────────────────────

func TestRunSelfUpdate_brewPath_returnsNilNoFetch(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("brew test not applicable on Windows")
	}
	fetchCalled := false
	opts := baseOpts(t)
	opts.ExecPath = func() (string, error) { return "/opt/homebrew/bin/ui-craft", nil }
	opts.FetchRelease = func(url string) (*core.SelfUpdateRelease, error) {
		fetchCalled = true
		return nil, fmt.Errorf("should not be called")
	}
	var buf bytes.Buffer
	opts.Output = &buf

	_, err := core.RunSelfUpdate(opts)
	if err != nil {
		t.Fatalf("RunSelfUpdate brew path: unexpected error: %v", err)
	}
	if fetchCalled {
		t.Error("RunSelfUpdate brew path: FetchRelease should not have been called")
	}
	if !strings.Contains(buf.String(), "brew upgrade") {
		t.Errorf("RunSelfUpdate brew path: expected 'brew upgrade' in output, got: %s", buf.String())
	}
}

// ─── Scoop detection ──────────────────────────────────────────────────────────

func TestRunSelfUpdate_scoopPath_returnsNilNoFetch(t *testing.T) {
	fetchCalled := false
	opts := baseOpts(t)
	opts.ExecPath = func() (string, error) {
		return `C:\Users\user\scoop\apps\ui-craft\current\ui-craft.exe`, nil
	}
	opts.FetchRelease = func(url string) (*core.SelfUpdateRelease, error) {
		fetchCalled = true
		return nil, fmt.Errorf("should not be called")
	}
	var buf bytes.Buffer
	opts.Output = &buf

	_, err := core.RunSelfUpdate(opts)
	if err != nil {
		t.Fatalf("RunSelfUpdate scoop path: unexpected error: %v", err)
	}
	if fetchCalled {
		t.Error("RunSelfUpdate scoop path: FetchRelease should not have been called")
	}
	if !strings.Contains(buf.String(), "scoop update") {
		t.Errorf("RunSelfUpdate scoop path: expected 'scoop update' in output, got: %s", buf.String())
	}
}

// ─── Already-latest ───────────────────────────────────────────────────────────

func TestRunSelfUpdate_alreadyLatest_returnsNilNoDownload(t *testing.T) {
	downloadCalled := false
	opts := baseOpts(t)
	opts.CurrentVersion = "v1.0.0"
	opts.ExecPath = func() (string, error) { return "/usr/local/bin/ui-craft", nil }
	opts.FetchRelease = func(url string) (*core.SelfUpdateRelease, error) {
		return &core.SelfUpdateRelease{TagName: "v1.0.0"}, nil
	}
	opts.DownloadAsset = func(url string) ([]byte, error) {
		downloadCalled = true
		return nil, fmt.Errorf("should not download")
	}
	var buf bytes.Buffer
	opts.Output = &buf

	newVer, err := core.RunSelfUpdate(opts)
	if err != nil {
		t.Fatalf("RunSelfUpdate already-latest: unexpected error: %v", err)
	}
	if downloadCalled {
		t.Error("RunSelfUpdate already-latest: DownloadAsset should not have been called")
	}
	if !strings.Contains(buf.String(), "already at the latest") {
		t.Errorf("RunSelfUpdate already-latest: expected 'already at the latest' in output, got: %s", buf.String())
	}
	if newVer != "" {
		t.Errorf("RunSelfUpdate already-latest: newVersion should be empty when already up-to-date, got %q", newVer)
	}
}

// ─── Checksum mismatch ────────────────────────────────────────────────────────

func TestRunSelfUpdate_checksumMismatch_abortsNoSwap(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("atomic rename test not applicable on Windows self-replace path")
	}

	tmpDir := t.TempDir()
	fakeBin := filepath.Join(tmpDir, "ui-craft")
	original := []byte("original binary")
	if err := os.WriteFile(fakeBin, original, 0o755); err != nil {
		t.Fatalf("write fake binary: %v", err)
	}

	archiveName := core.ArchiveNameForPlatform("v99.0.0")
	fakeBinContent := []byte("new binary content")
	goodArchive := buildFakeTarGzCore(t, fakeBinContent)
	badChecksums := []byte(fmt.Sprintf("0000000000000000000000000000000000000000000000000000000000000000  %s\n", archiveName))

	opts := baseOpts(t)
	opts.ExecPath = func() (string, error) { return fakeBin, nil }
	opts.FetchRelease = func(url string) (*core.SelfUpdateRelease, error) {
		return fakeRelease("v99.0.0", archiveName,
			"https://objects.githubusercontent.com/fake/archive",
			"https://objects.githubusercontent.com/fake/checksums"), nil
	}
	opts.DownloadAsset = func(url string) ([]byte, error) {
		if strings.Contains(url, "checksums") {
			return badChecksums, nil
		}
		return goodArchive, nil
	}
	opts.Output = io.Discard

	_, err := core.RunSelfUpdate(opts)
	if err == nil {
		t.Fatal("RunSelfUpdate checksum mismatch: expected error, got nil")
	}
	if !strings.Contains(err.Error(), "checksum") {
		t.Errorf("RunSelfUpdate checksum mismatch: error should mention 'checksum', got: %v", err)
	}
	// Binary must not have been replaced.
	got, readErr := os.ReadFile(fakeBin)
	if readErr != nil {
		t.Fatalf("could not read binary after mismatch: %v", readErr)
	}
	if !bytes.Equal(got, original) {
		t.Error("RunSelfUpdate checksum mismatch: binary was modified despite checksum failure")
	}
}

// ─── Download failure ─────────────────────────────────────────────────────────

func TestRunSelfUpdate_downloadFailure_returnsError(t *testing.T) {
	archiveName := core.ArchiveNameForPlatform("v99.0.0")

	opts := baseOpts(t)
	opts.ExecPath = func() (string, error) { return "/usr/local/bin/ui-craft", nil }
	opts.FetchRelease = func(url string) (*core.SelfUpdateRelease, error) {
		return fakeRelease("v99.0.0", archiveName,
			"https://objects.githubusercontent.com/fake/archive",
			"https://objects.githubusercontent.com/fake/checksums"), nil
	}
	opts.DownloadAsset = func(url string) ([]byte, error) {
		return nil, fmt.Errorf("network error: connection refused")
	}
	opts.Output = io.Discard

	_, err := core.RunSelfUpdate(opts)
	if err == nil {
		t.Fatal("RunSelfUpdate download failure: expected error, got nil")
	}
}

// ─── Newer version — happy path ───────────────────────────────────────────────

func TestRunSelfUpdate_newerVersion_swapsBinary(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("atomic rename test skipped on Windows")
	}

	tmpDir := t.TempDir()
	fakeBin := filepath.Join(tmpDir, "ui-craft")
	original := []byte("old binary")
	if err := os.WriteFile(fakeBin, original, 0o755); err != nil {
		t.Fatalf("write fake binary: %v", err)
	}

	archiveName := core.ArchiveNameForPlatform("v99.0.0")
	newContent := []byte("new binary content v99")
	archive := buildFakeTarGzCore(t, newContent)
	cs := fakeChecksumsTxt(archiveName, archive)

	opts := baseOpts(t)
	opts.ExecPath = func() (string, error) { return fakeBin, nil }
	opts.FetchRelease = func(url string) (*core.SelfUpdateRelease, error) {
		return fakeRelease("v99.0.0", archiveName,
			"https://objects.githubusercontent.com/fake/archive",
			"https://objects.githubusercontent.com/fake/checksums"), nil
	}
	opts.DownloadAsset = func(url string) ([]byte, error) {
		if strings.Contains(url, "checksums") {
			return cs, nil
		}
		return archive, nil
	}
	var buf bytes.Buffer
	opts.Output = &buf

	newVer, err := core.RunSelfUpdate(opts)
	if err != nil {
		t.Fatalf("RunSelfUpdate newer: unexpected error: %v\noutput: %s", err, buf.String())
	}

	// Fix 5: RunSelfUpdate now returns the installed version tag.
	if newVer != "v99.0.0" {
		t.Errorf("RunSelfUpdate newer: expected newVersion=%q, got %q", "v99.0.0", newVer)
	}

	got, readErr := os.ReadFile(fakeBin)
	if readErr != nil {
		t.Fatalf("could not read binary after update: %v", readErr)
	}
	if !bytes.Equal(got, newContent) {
		t.Errorf("RunSelfUpdate newer: binary not replaced; got %q, want %q", got, newContent)
	}

	// Assert the replaced binary is executable.
	info, statErr := os.Stat(fakeBin)
	if statErr != nil {
		t.Fatalf("RunSelfUpdate newer: could not stat binary: %v", statErr)
	}
	if mode := info.Mode(); mode&0o111 == 0 {
		t.Errorf("RunSelfUpdate newer: binary is not executable after swap; mode=%v", mode)
	}
}
