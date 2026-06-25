// Package config provides project-wide constants and helpers for the
// structured-config read-merge-write layer.
package config

import (
	"crypto/sha256"
	"fmt"
)

// BeginMarker and EndMarker delimit the CLI-managed block inside user-editable
// files (AGENTS.md, markdown configs). Content outside these markers is never
// modified by the CLI.
const (
	BeginMarker = "<!-- BEGIN ui-craft (managed — do not edit) -->"
	EndMarker   = "<!-- END ui-craft -->"
)

// BlockHash returns a 4-byte SHA-256 hex prefix of content. Used by the update
// path to detect whether a managed block needs rewriting.
func BlockHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return fmt.Sprintf("%x", sum[:4])
}
