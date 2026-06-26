// Adapted from github.com/Gentleman-Programming/gentle-ai (MIT).
// Original: internal/components/filemerge/section.go
package filemerge

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

// Managed-block markers. The block wraps content the CLI injects into
// user-editable files (e.g., AGENTS.md). Content outside the markers is never
// modified. Orphan markers from prior buggy runs are repaired before inject
// (gotcha #3).
const (
	BeginMarker = "<!-- BEGIN ui-craft (managed — do not edit) -->"
	EndMarker   = "<!-- END ui-craft -->"
)

// BlockHash returns a short SHA-256 hex prefix of the block's content. Used by
// the update path to decide whether a rewrite is needed (no-op when unchanged).
func BlockHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return fmt.Sprintf("%x", sum[:4])
}

// UpsertManagedBlock inserts or replaces the ui-craft managed block inside
// content. The block is placed at the end of the file if no prior block is
// found. Orphan BEGIN or END markers (unpaired) are repaired before the
// upsert to avoid double-wrapping (gotcha #3).
func UpsertManagedBlock(content, blockContent string) string {
	content = repairOrphanMarkers(content)
	newBlock := BeginMarker + "\n" + blockContent + "\n" + EndMarker

	beginIdx := strings.Index(content, BeginMarker)
	endIdx := strings.Index(content, EndMarker)

	if beginIdx != -1 && endIdx != -1 && beginIdx < endIdx {
		// Replace existing block (everything from BEGIN to END inclusive).
		before := content[:beginIdx]
		after := content[endIdx+len(EndMarker):]
		return before + newBlock + after
	}

	// No valid block: append at end with a blank line separator.
	if content != "" && !strings.HasSuffix(content, "\n") {
		content += "\n"
	}
	return content + "\n" + newBlock + "\n"
}

// RemoveManagedBlock removes the ui-craft managed block (BEGIN…END inclusive)
// from content. Content outside the block is preserved verbatim. If no block
// is found, content is returned unchanged.
func RemoveManagedBlock(content string) string {
	beginIdx := strings.Index(content, BeginMarker)
	endIdx := strings.Index(content, EndMarker)
	if beginIdx == -1 || endIdx == -1 || beginIdx >= endIdx {
		// No valid block — strip orphan markers and return.
		return repairOrphanMarkers(content)
	}

	before := content[:beginIdx]
	after := content[endIdx+len(EndMarker):]

	// Trim a leading newline in the section that preceded the block (the
	// UpsertManagedBlock adds "\n" + block) so we don't leave a double blank line.
	if strings.HasSuffix(before, "\n\n") {
		before = before[:len(before)-1]
	}
	// Trim a leading newline from after if before already ends with newline.
	if strings.HasPrefix(after, "\n") && strings.HasSuffix(before, "\n") {
		after = after[1:]
	}
	return before + after
}

// repairOrphanMarkers removes unpaired BEGIN or END markers. A single BEGIN
// without a matching END (or vice versa) is silently dropped so that the next
// UpsertManagedBlock writes a clean, well-formed block.
func repairOrphanMarkers(content string) string {
	hasBegin := strings.Contains(content, BeginMarker)
	hasEnd := strings.Contains(content, EndMarker)

	if hasBegin && hasEnd {
		beginIdx := strings.Index(content, BeginMarker)
		endIdx := strings.Index(content, EndMarker)
		if beginIdx < endIdx {
			return content // well-formed
		}
	}
	// Orphan: strip both markers and let UpsertManagedBlock start fresh.
	content = strings.ReplaceAll(content, BeginMarker, "")
	content = strings.ReplaceAll(content, EndMarker, "")
	return content
}
