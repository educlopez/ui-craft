// Package cmd — self-update command.
//
// ui-craft self-update upgrades the binary to the latest GitHub release.
//
// Safety design:
//   - Detect install method first: if the binary is under a Homebrew or Scoop
//     path, do NOT self-replace — print the correct package-manager command and
//     exit 0. Self-replacing a package-managed binary corrupts the manager's state.
//   - Direct-download path: query latest release, compare to current version;
//     if newer, download the matching OS/arch archive, verify sha256 against the
//     release checksums.txt, extract the binary to a temp file, atomically rename
//     it over the running binary.
//   - Windows self-replace-over-self fails (file in use), so on Windows we write
//     ui-craft.new next to the binary and print clear instructions instead.
//   - Fail with clear errors; never leave a half-written binary (temp + rename).
//   - All network functions are injectable (func vars) for testability.
//
// --json output: {"updated": bool, "from": str, "to": str, "method": str}
package cmd

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

const (
	selfUpdateGitHubOwner = "educlopez"
	selfUpdateGitHubRepo  = "ui-craft"
	selfUpdateAPIURL      = "https://api.github.com/repos/" + selfUpdateGitHubOwner + "/" + selfUpdateGitHubRepo + "/releases/latest"
	selfUpdateTimeout     = 30 * time.Second
)

// selfUpdateRelease holds the data we extract from the GitHub releases API.
type selfUpdateRelease struct {
	TagName string            `json:"tag_name"`
	Assets  []selfUpdateAsset `json:"assets"`
}

type selfUpdateAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// selfUpdateJSONResult is the --json output envelope for self-update.
type selfUpdateJSONResult struct {
	Updated bool   `json:"updated"`
	From    string `json:"from"`
	To      string `json:"to"`
	Method  string `json:"method"`
}

// ─── Injectable dependencies (for testability) ────────────────────────────

// selfUpdateFetchRelease fetches the latest GitHub release. Defaults to the
// real HTTP implementation; tests can replace with a fake.
var selfUpdateFetchRelease = func(url string) (*selfUpdateRelease, error) {
	client := &http.Client{Timeout: selfUpdateTimeout}
	resp, err := client.Get(url) //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("self-update: fetch release: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("self-update: GitHub API returned %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if err != nil {
		return nil, fmt.Errorf("self-update: read release body: %w", err)
	}
	var rel selfUpdateRelease
	if err := json.Unmarshal(body, &rel); err != nil {
		return nil, fmt.Errorf("self-update: parse release JSON: %w", err)
	}
	return &rel, nil
}

// selfUpdateDownloadAsset downloads an asset URL and returns its bytes.
// Defaults to real HTTP; tests can inject a fake.
var selfUpdateDownloadAsset = func(url string) ([]byte, error) {
	client := &http.Client{Timeout: selfUpdateTimeout}
	resp, err := client.Get(url) //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("self-update: download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("self-update: download returned %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024*1024)) // cap 256 MiB
	if err != nil {
		return nil, fmt.Errorf("self-update: read download body: %w", err)
	}
	return data, nil
}

// selfUpdateExecPath returns the resolved executable path. Injectable for tests.
var selfUpdateExecPath = func() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(exe)
}

// ─── Homebrew / Scoop detection ───────────────────────────────────────────

// detectPackageManager inspects the binary path to decide whether it is managed
// by Homebrew or Scoop. Returns ("brew", ...), ("scoop", ...), or ("", ...).
func detectPackageManager(exePath string) string {
	// Homebrew prefixes: macOS arm64, macOS x86, Linux
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
	// Scoop: typically C:\Users\<user>\scoop\apps\ or %SCOOP%\apps\
	if strings.Contains(exePath, `scoop\apps`) || strings.Contains(exePath, "scoop/apps") {
		return "scoop"
	}
	return ""
}

// ─── Archive extraction ───────────────────────────────────────────────────

// extractBinaryFromArchive extracts the "ui-craft" binary from an archive
// (tar.gz for Linux/macOS, zip for Windows). Returns the raw binary bytes.
func extractBinaryFromArchive(archiveData []byte, archiveName string) ([]byte, error) {
	if strings.HasSuffix(archiveName, ".tar.gz") || strings.HasSuffix(archiveName, ".tgz") {
		return extractFromTarGz(archiveData)
	}
	if strings.HasSuffix(archiveName, ".zip") {
		return extractFromZip(archiveData)
	}
	return nil, fmt.Errorf("self-update: unknown archive format: %s", archiveName)
}

func extractFromTarGz(data []byte) ([]byte, error) {
	gzReader, err := gzip.NewReader(newBytesReader(data))
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

func extractFromZip(data []byte) ([]byte, error) {
	r, err := zip.NewReader(newBytesReaderAt(data), int64(len(data)))
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

// bytesReader wraps a []byte to implement io.Reader.
type bytesReader struct {
	data []byte
	pos  int
}

func newBytesReader(data []byte) *bytesReader { return &bytesReader{data: data} }
func (r *bytesReader) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

// bytesReaderAt wraps a []byte to implement io.ReaderAt (needed for zip).
type bytesReaderAt struct{ data []byte }

func newBytesReaderAt(data []byte) *bytesReaderAt { return &bytesReaderAt{data: data} }
func (r *bytesReaderAt) ReadAt(p []byte, off int64) (int, error) {
	if off >= int64(len(r.data)) {
		return 0, io.EOF
	}
	n := copy(p, r.data[off:])
	if n < len(p) {
		return n, io.EOF
	}
	return n, nil
}

// ─── Checksum verification ────────────────────────────────────────────────

// verifyChecksum checks the sha256 of archiveData against the checksums.txt
// content. archiveName is the filename to look up in the checksums file.
func verifyChecksum(archiveData []byte, checksumsTxt []byte, archiveName string) error {
	// sha256sum format: "<hex>  <filename>" or "<hex> <filename>"
	sum := sha256.Sum256(archiveData)
	got := hex.EncodeToString(sum[:])
	lines := strings.Split(string(checksumsTxt), "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		// The filename in checksums may be bare (no path) or prefixed.
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

// ─── Archive name resolution ──────────────────────────────────────────────

// archiveNameForPlatform returns the expected archive filename for the current
// GOOS/GOARCH. Matches goreleaser's default naming convention.
func archiveNameForPlatform(tag string) string {
	os_ := runtime.GOOS
	arch := runtime.GOARCH
	// Normalise arch: goreleaser uses "x86_64" for amd64, "arm64" for arm64.
	switch arch {
	case "amd64":
		arch = "x86_64"
	case "386":
		arch = "i386"
	}
	// Capitalise OS for display consistency with goreleaser naming:
	// ui-craft_Darwin_arm64.tar.gz  etc.
	osName := strings.Title(os_) //nolint:staticcheck // simple title-case for platform name
	if os_ == "windows" {
		return fmt.Sprintf("ui-craft_%s_%s.zip", osName, arch)
	}
	return fmt.Sprintf("ui-craft_%s_%s.tar.gz", osName, arch)
}

// ─── Cobra command ────────────────────────────────────────────────────────

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

	// Resolve the running binary's real path (symlinks resolved).
	exePath, err := selfUpdateExecPath()
	if err != nil {
		return fmt.Errorf("self-update: cannot determine executable path: %w", err)
	}

	// 1. Detect install method.
	pm := detectPackageManager(exePath)
	if pm == "brew" {
		msg := "brew upgrade ui-craft"
		if flags.JSON {
			res := selfUpdateJSONResult{Updated: false, From: cmdVersion, To: "", Method: "brew"}
			return emitJSON(out, res)
		}
		fmt.Fprintf(out, "ui-craft is managed by Homebrew. Run: %s\n", msg)
		return nil
	}
	if pm == "scoop" {
		msg := "scoop update ui-craft"
		if flags.JSON {
			res := selfUpdateJSONResult{Updated: false, From: cmdVersion, To: "", Method: "scoop"}
			return emitJSON(out, res)
		}
		fmt.Fprintf(out, "ui-craft is managed by Scoop. Run: %s\n", msg)
		return nil
	}

	// 2. Fetch latest release.
	if !flags.Quiet && !flags.JSON {
		fmt.Fprintln(out, "Checking for latest release...")
	}
	rel, err := selfUpdateFetchRelease(selfUpdateAPIURL)
	if err != nil {
		return err
	}

	latestTag := rel.TagName
	currentTag := cmdVersion

	// Normalise: strip leading "v" for comparison.
	normLatest := strings.TrimPrefix(latestTag, "v")
	normCurrent := strings.TrimPrefix(currentTag, "v")

	if normLatest == normCurrent || normLatest == "" {
		if flags.JSON {
			return emitJSON(out, selfUpdateJSONResult{Updated: false, From: currentTag, To: latestTag, Method: "direct"})
		}
		fmt.Fprintf(out, "ui-craft is already at the latest version (%s).\n", currentTag)
		return nil
	}

	// 3. Identify the archive asset for this platform.
	archiveName := archiveNameForPlatform(latestTag)
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
		return fmt.Errorf("self-update: no asset found for platform (%s); available assets: %s",
			archiveName, assetNames(rel.Assets))
	}

	if !flags.Quiet && !flags.JSON {
		fmt.Fprintf(out, "Downloading %s → %s...\n", currentTag, latestTag)
	}

	// 4. Download the archive.
	archiveData, err := selfUpdateDownloadAsset(archiveURL)
	if err != nil {
		return err
	}

	// 5. Verify checksum (if checksums.txt is available).
	if checksumsURL != "" {
		checksumData, err := selfUpdateDownloadAsset(checksumsURL)
		if err != nil {
			return fmt.Errorf("self-update: could not download checksums.txt: %w", err)
		}
		if err := verifyChecksum(archiveData, checksumData, archiveName); err != nil {
			return err // aborts cleanly — no binary written yet
		}
		if !flags.Quiet && !flags.JSON {
			fmt.Fprintln(out, "Checksum verified.")
		}
	}

	// 6. Extract the binary from the archive.
	binData, err := extractBinaryFromArchive(archiveData, archiveName)
	if err != nil {
		return err
	}

	// 7. Atomic replace.
	exeDir := filepath.Dir(exePath)
	exeBase := filepath.Base(exePath)

	if runtime.GOOS == "windows" {
		// Windows cannot rename over a running executable.
		// Write ui-craft.new and instruct the user.
		newPath := filepath.Join(exeDir, "ui-craft.new")
		if err := os.WriteFile(newPath, binData, 0o755); err != nil {
			return fmt.Errorf("self-update: write ui-craft.new: %w", err)
		}
		if flags.JSON {
			return emitJSON(out, selfUpdateJSONResult{Updated: false, From: currentTag, To: latestTag, Method: "direct-windows-manual"})
		}
		fmt.Fprintf(out, "New binary written to: %s\n", newPath)
		fmt.Fprintf(out, "To complete the update, run:\n  move /Y %q %q\n", newPath, exePath)
		return nil
	}

	// Unix: write to a temp file in the same directory, then rename atomically.
	tmpFile, err := os.CreateTemp(exeDir, ".ui-craft-update-*")
	if err != nil {
		return fmt.Errorf("self-update: create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer func() {
		// Clean up temp file on any failure path (rename removes it on success).
		if _, err := os.Stat(tmpPath); err == nil {
			_ = os.Remove(tmpPath)
		}
	}()

	if _, err := tmpFile.Write(binData); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("self-update: write temp file: %w", err)
	}
	if err := tmpFile.Chmod(0o755); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("self-update: chmod temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("self-update: close temp file: %w", err)
	}

	// Atomic rename (same filesystem, so rename is atomic on POSIX).
	destPath := filepath.Join(exeDir, exeBase)
	if err := os.Rename(tmpPath, destPath); err != nil {
		return fmt.Errorf("self-update: replace binary: %w", err)
	}

	if flags.JSON {
		return emitJSON(out, selfUpdateJSONResult{Updated: true, From: currentTag, To: latestTag, Method: "direct"})
	}
	if !flags.Quiet {
		fmt.Fprintf(out, "Updated: %s → %s\n", currentTag, latestTag)
	} else {
		fmt.Fprintf(out, "self-update: ok (%s → %s)\n", currentTag, latestTag)
	}
	return nil
}

// emitJSON encodes v as indented JSON to w.
func emitJSON(w io.Writer, v interface{}) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

// assetNames returns a comma-separated list of asset names (for error messages).
func assetNames(assets []selfUpdateAsset) string {
	names := make([]string, 0, len(assets))
	for _, a := range assets {
		names = append(names, a.Name)
	}
	return strings.Join(names, ", ")
}
