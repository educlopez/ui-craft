// Package core — shared self-update entry point.
//
// RunSelfUpdate encapsulates the full binary self-update logic so that BOTH
// the cobra self-update command and the TUI Upgrade screen call the same
// code without duplication.
//
// Safety design (preserved from cmd/selfupdate.go):
//   - Detect install method first: brew → print upgrade cmd, exit 0.
//     Scoop → print upgrade cmd, exit 0.  Self-replace only for direct installs.
//   - Direct path: query latest release, compare versions, download, verify
//     sha256 against checksums.txt, extract binary, atomic rename.
//   - Windows cannot rename over a running executable; writes ui-craft.new instead.
//   - All network functions are injectable via SelfUpdateOpts for testability.
//   - Checksums are MANDATORY; a release without checksums.txt is rejected.
//   - Download URLs must be GitHub-origin (SSRF guard).
//   - Empty tag_name is treated as a malformed release (returns error).
package core

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// ─── Types ────────────────────────────────────────────────────────────────────

// SelfUpdateRelease holds the data extracted from the GitHub releases API.
type SelfUpdateRelease struct {
	TagName string             `json:"tag_name"`
	Assets  []SelfUpdateAsset  `json:"assets"`
}

// SelfUpdateAsset is one release asset entry.
type SelfUpdateAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// SelfUpdateOpts carries all parameters and injectable dependencies for
// RunSelfUpdate.  This keeps core free of cmd-package imports while allowing
// both cobra and TUI callers to supply their own I/O writer, version string,
// and test stubs.
type SelfUpdateOpts struct {
	// CurrentVersion is the running binary's version (e.g. "v1.0.1" or "dev").
	CurrentVersion string

	// Output receives human-readable progress messages. Pass io.Discard in tests
	// or when running in --quiet/--json mode.
	Output io.Writer

	// FetchRelease fetches the latest GitHub release JSON. Defaults to real HTTP
	// when nil is passed; override in tests or to customise the API URL.
	FetchRelease func(url string) (*SelfUpdateRelease, error)

	// DownloadAsset downloads a release asset URL and returns its bytes.
	// Override in tests to avoid real network calls.
	DownloadAsset func(url string) ([]byte, error)

	// ExecPath returns the absolute, symlink-resolved path of the running binary.
	// Override in tests to control where the "binary" lives.
	ExecPath func() (string, error)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const (
	selfUpdateGitHubOwner = "educlopez"
	selfUpdateGitHubRepo  = "ui-craft"
	selfUpdateAPIURL      = "https://api.github.com/repos/" + selfUpdateGitHubOwner + "/" + selfUpdateGitHubRepo + "/releases/latest"
)

// ─── RunSelfUpdate ────────────────────────────────────────────────────────────

// RunSelfUpdate performs the binary self-update flow described in the package
// doc.  Callers (cobra RunE and TUI screen) must supply all required opts.
// Output is written to opts.Output; callers control whether that is stdout,
// a buffer, or io.Discard.
//
// Return values:
//   - newVersion: the version tag that was installed (e.g. "v1.2.0"), or ""
//     when already up-to-date, managed by brew/scoop, or when an error occurs.
//   - err: non-nil when the update failed.
func RunSelfUpdate(opts SelfUpdateOpts) (newVersion string, err error) {
	if opts.Output == nil {
		opts.Output = io.Discard
	}
	if opts.FetchRelease == nil {
		opts.FetchRelease = selfUpdateDefaultFetchRelease
	}
	if opts.DownloadAsset == nil {
		opts.DownloadAsset = selfUpdateDefaultDownloadAsset
	}
	if opts.ExecPath == nil {
		opts.ExecPath = selfUpdateDefaultExecPath
	}

	// 0. Resolve the running binary's real path.
	exePath, err := opts.ExecPath()
	if err != nil {
		return "", fmt.Errorf("self-update: cannot determine executable path: %w", err)
	}

	// 1. Detect install method.
	pm := DetectInstallMethod(exePath)
	if pm == "brew" {
		fmt.Fprintf(opts.Output, "ui-craft is managed by Homebrew. Run: brew upgrade ui-craft\n")
		return "", nil
	}
	if pm == "scoop" {
		fmt.Fprintf(opts.Output, "ui-craft is managed by Scoop. Run: scoop update ui-craft\n")
		return "", nil
	}

	// 2. Fetch latest release.
	fmt.Fprintln(opts.Output, "Checking for latest release...")
	rel, err := opts.FetchRelease(selfUpdateAPIURL)
	if err != nil {
		return "", err
	}

	latestTag := rel.TagName
	currentTag := opts.CurrentVersion

	normLatest := strings.TrimPrefix(latestTag, "v")
	normCurrent := strings.TrimPrefix(currentTag, "v")

	// Empty tag = malformed release JSON.
	if normLatest == "" {
		return "", fmt.Errorf("self-update: release has empty tag_name — aborting (malformed release JSON)")
	}
	if normLatest == normCurrent {
		fmt.Fprintf(opts.Output, "ui-craft is already at the latest version (%s).\n", currentTag)
		return "", nil
	}

	// 3. Identify the archive asset for this platform.
	archiveName := ArchiveNameForPlatform(latestTag)
	var archiveURL, checksumsURL string
	for _, a := range rel.Assets {
		switch {
		case a.Name == archiveName:
			archiveURL = a.BrowserDownloadURL
		case a.Name == "checksums.txt":
			checksumsURL = a.BrowserDownloadURL
		}
	}
	if archiveURL == "" {
		return "", fmt.Errorf("self-update: no asset found for platform (%s); available assets: %s",
			archiveName, selfUpdateAssetNames(rel.Assets))
	}
	if checksumsURL == "" {
		return "", fmt.Errorf("self-update: release has no checksums.txt — aborting for safety")
	}

	// Validate that all download URLs are GitHub-origin (SSRF guard).
	if err := requireGitHubOriginURL(archiveURL); err != nil {
		return "", err
	}
	if err := requireGitHubOriginURL(checksumsURL); err != nil {
		return "", err
	}

	fmt.Fprintf(opts.Output, "Downloading %s → %s...\n", currentTag, latestTag)

	// 4. Download the archive.
	archiveData, err := opts.DownloadAsset(archiveURL)
	if err != nil {
		return "", err
	}

	// 5. Verify checksum (mandatory).
	checksumData, err := opts.DownloadAsset(checksumsURL)
	if err != nil {
		return "", fmt.Errorf("self-update: could not download checksums.txt: %w", err)
	}
	if err := VerifySelfUpdateChecksum(archiveData, checksumData, archiveName); err != nil {
		return "", err
	}
	fmt.Fprintln(opts.Output, "Checksum verified.")

	// 6. Extract the binary.
	binData, err := ExtractBinaryFromSelfUpdateArchive(archiveData, archiveName)
	if err != nil {
		return "", err
	}

	// 7. Atomic replace.
	exeDir := filepath.Dir(exePath)
	exeBase := filepath.Base(exePath)

	if runtime.GOOS == "windows" {
		newPath := filepath.Join(exeDir, "ui-craft.new")
		if err := os.WriteFile(newPath, binData, 0o755); err != nil {
			return "", fmt.Errorf("self-update: write ui-craft.new: %w", err)
		}
		fmt.Fprintf(opts.Output, "New binary written to: %s\n", newPath)
		fmt.Fprintf(opts.Output, "To complete the update, run:\n  move /Y %q %q\n", newPath, exePath)
		// On Windows we wrote a .new file but the rename is manual; the update
		// target version is latestTag even though the rename hasn't happened yet.
		return latestTag, nil
	}

	// Unix: temp file + atomic rename.
	tmpFile, err := os.CreateTemp(exeDir, ".ui-craft-update-*")
	if err != nil {
		return "", fmt.Errorf("self-update: create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer func() {
		if _, statErr := os.Stat(tmpPath); statErr == nil {
			_ = os.Remove(tmpPath)
		}
	}()

	if _, err := tmpFile.Write(binData); err != nil {
		_ = tmpFile.Close()
		return "", fmt.Errorf("self-update: write temp file: %w", err)
	}
	if err := tmpFile.Chmod(0o755); err != nil {
		_ = tmpFile.Close()
		return "", fmt.Errorf("self-update: chmod temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return "", fmt.Errorf("self-update: close temp file: %w", err)
	}

	destPath := filepath.Join(exeDir, exeBase)
	if err := os.Rename(tmpPath, destPath); err != nil {
		return "", fmt.Errorf("self-update: replace binary: %w", err)
	}

	fmt.Fprintf(opts.Output, "Updated: %s → %s\n", currentTag, latestTag)
	return latestTag, nil
}

// ─── Install-method detection ─────────────────────────────────────────────────

// DetectInstallMethod inspects exePath to determine if the binary is managed
// by Homebrew ("brew"), Scoop ("scoop"), or neither ("").
func DetectInstallMethod(exePath string) string {
	homebrewPrefixes := []string{
		"/opt/homebrew/",
		"/usr/local/Cellar/",
		"/usr/local/opt/",
		"/home/linuxbrew/",
	}
	for _, prefix := range homebrewPrefixes {
		if strings.HasPrefix(exePath, prefix) {
			return "brew"
		}
	}
	if strings.Contains(exePath, `scoop\apps`) || strings.Contains(exePath, "scoop/apps") {
		return "scoop"
	}
	return ""
}

// ─── Archive name ─────────────────────────────────────────────────────────────

// ArchiveNameForPlatform returns the expected archive filename for the current
// GOOS/GOARCH, matching goreleaser's default naming convention.
func ArchiveNameForPlatform(tag string) string {
	_ = tag // reserved for future per-tag naming variations
	osName := runtime.GOOS
	arch := runtime.GOARCH
	switch arch {
	case "amd64":
		arch = "x86_64"
	case "386":
		arch = "i386"
	}
	osTitle := selfUpdateTitleCase(osName)
	if osName == "windows" {
		return fmt.Sprintf("ui-craft_%s_%s.zip", osTitle, arch)
	}
	return fmt.Sprintf("ui-craft_%s_%s.tar.gz", osTitle, arch)
}

// ─── Checksum verification ────────────────────────────────────────────────────

// VerifySelfUpdateChecksum checks the sha256 of archiveData against the
// checksums.txt content.  archiveName is the filename key to look up.
func VerifySelfUpdateChecksum(archiveData, checksumsTxt []byte, archiveName string) error {
	sum := sha256.Sum256(archiveData)
	got := hex.EncodeToString(sum[:])
	lines := strings.Split(string(checksumsTxt), "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		if filepath.Base(fields[1]) == archiveName {
			want := strings.ToLower(fields[0])
			if got != want {
				return fmt.Errorf("self-update: checksum mismatch for %s: got %s, want %s", archiveName, got, want)
			}
			return nil
		}
	}
	return fmt.Errorf("self-update: checksum entry not found for %s in checksums.txt", archiveName)
}

// ─── Archive extraction ───────────────────────────────────────────────────────

// ExtractBinaryFromSelfUpdateArchive extracts the ui-craft binary from an
// archive (tar.gz for Linux/macOS, zip for Windows).
func ExtractBinaryFromSelfUpdateArchive(archiveData []byte, archiveName string) ([]byte, error) {
	if strings.HasSuffix(archiveName, ".tar.gz") || strings.HasSuffix(archiveName, ".tgz") {
		return selfUpdateExtractTarGz(archiveData)
	}
	if strings.HasSuffix(archiveName, ".zip") {
		return selfUpdateExtractZip(archiveData)
	}
	return nil, fmt.Errorf("self-update: unknown archive format: %s", archiveName)
}

func selfUpdateExtractTarGz(data []byte) ([]byte, error) {
	gzReader, err := gzip.NewReader(selfUpdateBytesReader(data))
	if err != nil {
		return nil, fmt.Errorf("self-update: gzip: %w", err)
	}
	defer gzReader.Close()
	tr := tar.NewReader(gzReader)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("self-update: tar: %w", err)
		}
		base := filepath.Base(hdr.Name)
		if base == "ui-craft" || base == "ui-craft.exe" {
			return io.ReadAll(io.LimitReader(tr, 128*1024*1024))
		}
	}
	return nil, fmt.Errorf("self-update: binary 'ui-craft' not found in archive")
}

func selfUpdateExtractZip(data []byte) ([]byte, error) {
	r, err := zip.NewReader(selfUpdateBytesReaderAt(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("self-update: zip: %w", err)
	}
	for _, f := range r.File {
		base := filepath.Base(f.Name)
		if base == "ui-craft" || base == "ui-craft.exe" {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("self-update: zip open: %w", err)
			}
			defer rc.Close()
			return io.ReadAll(io.LimitReader(rc, 128*1024*1024))
		}
	}
	return nil, fmt.Errorf("self-update: binary 'ui-craft' not found in zip archive")
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

func requireGitHubOriginURL(url string) error {
	if strings.HasPrefix(url, "https://github.com/") ||
		strings.HasPrefix(url, "https://objects.githubusercontent.com/") {
		return nil
	}
	return fmt.Errorf("self-update: refusing non-GitHub download URL: %s", url)
}

func selfUpdateAssetNames(assets []SelfUpdateAsset) string {
	names := make([]string, 0, len(assets))
	for _, a := range assets {
		names = append(names, a.Name)
	}
	return strings.Join(names, ", ")
}

func selfUpdateTitleCase(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// ─── io helpers (avoid bytes import cycle with tests) ─────────────────────────

type selfUpdateBytesReaderT struct {
	data []byte
	pos  int
}

func selfUpdateBytesReader(data []byte) *selfUpdateBytesReaderT {
	return &selfUpdateBytesReaderT{data: data}
}
func (r *selfUpdateBytesReaderT) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

type selfUpdateBytesReaderAtT struct{ data []byte }

func selfUpdateBytesReaderAt(data []byte) *selfUpdateBytesReaderAtT {
	return &selfUpdateBytesReaderAtT{data: data}
}
func (r *selfUpdateBytesReaderAtT) ReadAt(p []byte, off int64) (int, error) {
	if off >= int64(len(r.data)) {
		return 0, io.EOF
	}
	n := copy(p, r.data[off:])
	if n < len(p) {
		return n, io.EOF
	}
	return n, nil
}

// ─── Default injectable implementations ──────────────────────────────────────

// These are the real HTTP implementations used in production. Tests replace
// them via SelfUpdateOpts fields — the vars below are NOT exported; callers
// always pass opts.

// ResolveExecPath returns the absolute, symlink-resolved path of the running
// binary. Exported so that cmd-layer callers can use it without importing os directly.
func ResolveExecPath() (string, error) {
	return selfUpdateDefaultExecPath()
}

// FetchRelease calls the real GitHub release API and returns the release data.
// Exported so that the cmd-layer JSON path can call it when no override is set.
func FetchRelease(url string) (*SelfUpdateRelease, error) {
	return selfUpdateFetchReleaseHTTP(url)
}

var selfUpdateDefaultFetchRelease = func(url string) (*SelfUpdateRelease, error) {
	return selfUpdateFetchReleaseHTTP(url)
}

var selfUpdateDefaultDownloadAsset = func(url string) ([]byte, error) {
	return selfUpdateDownloadAssetHTTP(url)
}

var selfUpdateDefaultExecPath = func() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(exe)
}
