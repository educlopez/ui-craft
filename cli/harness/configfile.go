package harness

import (
	"errors"
	"io/fs"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

// Shared config files (~/.claude.json, .mcp.json, mcp.json, settings.json,
// opencode.json(c), config.toml, AGENTS.md, GEMINI.md) belong to the user or
// to the harness. These helpers keep ui-craft's edits to them from changing
// anything beyond the bytes it merges in.

// readConfigFile reads a shared config file. A missing file yields
// (nil, false, nil); any other read error (permission denied, a directory at
// the path, I/O failure) is returned, so callers never mistake an unreadable
// file for an absent one and overwrite it.
func readConfigFile(w fsutil.FileSystem, path string) ([]byte, bool, error) {
	data, err := w.ReadFile(path)
	if err == nil {
		return data, true, nil
	}
	if errors.Is(err, fs.ErrNotExist) {
		return nil, false, nil
	}
	return nil, false, err
}

// configFileMode returns the permission bits to write path with: the
// existing file's bits when it exists (a user who tightened ~/.claude.json to
// 0600 keeps it that way), else newMode.
func configFileMode(w fsutil.FileSystem, path string, newMode fs.FileMode) fs.FileMode {
	if info, err := w.Stat(path); err == nil && info.Mode().IsRegular() {
		return info.Mode().Perm()
	}
	return newMode
}

// writeConfigFile atomically writes a shared config file, keeping the
// existing file's permission bits (see configFileMode).
func writeConfigFile(w fsutil.FileSystem, path string, data []byte, newMode fs.FileMode) (fsutil.WriteResult, error) {
	return fsutil.WriteFileAtomic(w, path, data, configFileMode(w, path, newMode))
}
