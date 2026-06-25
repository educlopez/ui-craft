// Package backup — path containment helpers.
package backup

import (
	"fmt"
	"path/filepath"
	"strings"
)

// underRoot resolves candidate against root and returns the cleaned absolute
// path. It returns an error when candidate escapes root (i.e. the relative
// path from root to candidate starts with ".." or equals "..").
//
// Implementation deliberately avoids strings.Contains("..") — that would
// reject legitimate paths like "/root/..hidden/file". Instead it uses
// filepath.Rel which normalises the path and surfaces traversal via a ".."
// prefix in the resulting relative path.
func underRoot(root, candidate string) (string, error) {
	joined := filepath.Join(root, candidate)
	clean := filepath.Clean(joined)

	rel, err := filepath.Rel(root, clean)
	if err != nil {
		return "", fmt.Errorf("path containment: cannot relativise %q against %q: %w", candidate, root, err)
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path %q escapes root %q", candidate, root)
	}
	return clean, nil
}
