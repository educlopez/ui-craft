// Package-level vars for injectable detection. Tests that use withInjectedDetect
// MUST NOT call t.Parallel(): lookPath and statPath are shared package-level
// vars and are not safe for concurrent mutation by multiple test goroutines.
package harness

import (
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// lookPath wraps exec.LookPath. Tests may replace this var to inject a fake
// implementation without spawning real processes.
//
// Adopted from gentle-ai (MIT): internal/system/detect.go pattern.
var lookPath = func(file string) (string, error) {
	return exec.LookPath(file)
}

// statPath wraps os.Stat. Tests may replace this var to inject a fake
// implementation that controls which paths appear to exist.
//
// Adopted from gentle-ai (MIT): internal/system/detect.go pattern.
var statPath = func(name string) (fs.FileInfo, error) {
	return os.Stat(name)
}

// goos is runtime.GOOS behind a var so tests can exercise the Windows-only
// legacy-path branches on any host. It is never consulted to pick a current
// config root: every harness resolves the same way on all platforms.
var goos = runtime.GOOS

// homeDir returns the user's home directory, or "" when it cannot be
// resolved. os.UserHomeDir reads $HOME on Unix and %USERPROFILE% on Windows.
func homeDir() string {
	home, _ := os.UserHomeDir()
	return home
}

// envDir returns the value of the environment variable name when it is set
// to an absolute path, or "" otherwise. A relative override would resolve
// against the current directory, so it is ignored rather than trusted.
func envDir(name string) string {
	v := os.Getenv(name)
	if v == "" || !filepath.IsAbs(v) {
		return ""
	}
	return filepath.Clean(v)
}

// envDirFromCwd is envDir for variables the harness itself resolves against the
// working directory when relative: CODEX_HOME (Codex canonicalizes it),
// GEMINI_CLI_HOME and OPENCODE_CONFIG_DIR (both used as given, so relative to
// the cwd). Ignoring a relative value would install into a different root than
// the one the harness reads. CLAUDE_CONFIG_DIR and XDG_CONFIG_HOME keep envDir:
// Claude Code documents an absolute path, and the XDG spec says to ignore
// relative values.
func envDirFromCwd(name string) string {
	v := os.Getenv(name)
	if v == "" {
		return ""
	}
	abs, err := filepath.Abs(v)
	if err != nil {
		return ""
	}
	return abs
}

// windowsAppDataDir returns %APPDATA%\<name> on Windows, where older ui-craft
// versions wrote Claude Code and OpenCode files, or "" elsewhere.
func windowsAppDataDir(name string) string {
	if goos != "windows" {
		return ""
	}
	appdata := envDir("APPDATA")
	if appdata == "" {
		return ""
	}
	return filepath.Join(appdata, name)
}
