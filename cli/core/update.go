// Package core — update.go
// Launch-time update-check with a 24h TTL cooldown.
//
// Design: fail-open — any network or parse error silently returns "no update".
// The check runs in a goroutine from the TUI Init() so it never blocks the flow.
//
// Adapted from github.com/Gentleman-Programming/gentle-ai §cooldown pattern (MIT).
package core

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/educlopez/ui-craft/cli/fsutil"
)

const (
	// updateCheckTTL is how long to wait between GitHub release checks.
	updateCheckTTL = 24 * time.Hour

	// githubReleasesURL is the GitHub API endpoint for the latest release.
	githubReleasesURL = "https://api.github.com/repos/educlopez/ui-craft/releases/latest"

	// updateCheckTimeout is the HTTP request timeout. Fail-open: if the check
	// takes longer than this, it is silently abandoned and "no update" is returned.
	updateCheckTimeout = 2 * time.Second
)

// UpdateResult is the result of an update check.
type UpdateResult struct {
	// Available is true when a newer version is available.
	Available bool
	// LatestTag is the latest release tag (e.g. "v0.22.0") when Available is true.
	LatestTag string
}

// ─── Injectable dependencies (for testability) ────────────────────────────

// ClockFn is the injectable clock used to get the current time. Tests replace
// this to control TTL behaviour without sleeping.
var ClockFn func() time.Time = time.Now

// FetchReleaseFn is the injectable release fetcher. Tests replace this to avoid
// real network calls. The function receives the releases URL and returns the
// latest tag name (e.g. "v0.22.0"), or an error on failure.
var FetchReleaseFn func(url string) (string, error) = defaultFetchRelease

// ─── Public API ───────────────────────────────────────────────────────────

// CheckForUpdate checks whether a newer version of ui-craft is available.
//
// It is gated by a 24h TTL: if state.LastUpdateCheck is within the last 24h,
// it returns UpdateResult{Available: false} immediately without hitting the network.
//
// After a successful network check, it writes the new LastUpdateCheck timestamp
// to state.json at stateRoot. This write is best-effort — a write failure is
// silently ignored and does not affect the result.
//
// Fail-open: any network or parse error returns UpdateResult{Available: false}.
// This function is designed to run in a goroutine and NEVER blocks the caller.
func CheckForUpdate(filesystem fsutil.FileSystem, stateRoot, currentVersion string) UpdateResult {
	us, _ := loadUpdateState(filesystem, stateRoot)

	// TTL gate: skip check if we already checked within the last 24h.
	if !us.lastChecked.IsZero() {
		elapsed := ClockFn().Sub(us.lastChecked)
		if elapsed < updateCheckTTL {
			return UpdateResult{}
		}
	}

	// Fetch the latest release tag.
	latestTag, err := FetchReleaseFn(githubReleasesURL)
	if err != nil {
		// Fail-open: network/parse error → no advisory.
		return UpdateResult{}
	}

	// Record that we checked, regardless of whether there is an update.
	us.lastChecked = ClockFn()
	_ = saveUpdateState(filesystem, stateRoot, us)

	if latestTag == "" {
		return UpdateResult{}
	}

	// Compare: if latest != current, a newer version is available.
	// We normalise both to strip a leading "v" before comparing, so that
	// "v0.22.0" == "0.22.0" is handled correctly.
	if normaliseTag(latestTag) != normaliseTag(currentVersion) {
		return UpdateResult{Available: true, LatestTag: latestTag}
	}
	return UpdateResult{}
}

// UpdateAdvisoryLine returns the one-line advisory string shown to the user
// when an update is available, or an empty string when no update is available.
// Example: "⬆ ui-craft v0.22.0 available — brew upgrade ui-craft"
func UpdateAdvisoryLine(result UpdateResult) string {
	if !result.Available {
		return ""
	}
	return fmt.Sprintf("⬆ ui-craft %s available — brew upgrade ui-craft", result.LatestTag)
}

// ─── Internal helpers ─────────────────────────────────────────────────────

// updateCheckState is the minimal TTL state stored in state.json.
type updateCheckState struct {
	lastChecked time.Time
}

// loadUpdateState reads LastUpdateCheck from state.json. Returns a zero-value
// state (not an error) when the file is missing or the field is absent.
func loadUpdateState(filesystem fsutil.FileSystem, stateRoot string) (updateCheckState, error) {
	p := statePath(stateRoot)
	data, err := filesystem.ReadFile(p)
	if err != nil {
		// Missing file is normal — treat as "never checked".
		return updateCheckState{}, nil
	}

	var raw struct {
		LastUpdateCheck string `json:"lastUpdateCheck,omitempty"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return updateCheckState{}, nil
	}

	if raw.LastUpdateCheck == "" {
		return updateCheckState{}, nil
	}
	t, err := time.Parse(time.RFC3339, raw.LastUpdateCheck)
	if err != nil {
		return updateCheckState{}, nil
	}
	return updateCheckState{lastChecked: t}, nil
}

// saveUpdateState merges LastUpdateCheck into the existing state.json, preserving
// all other fields. Best-effort — errors are silently ignored by the caller.
func saveUpdateState(filesystem fsutil.FileSystem, stateRoot string, us updateCheckState) error {
	p := statePath(stateRoot)

	// Read the existing raw JSON (if any) so we can merge.
	var raw map[string]interface{}
	if data, err := filesystem.ReadFile(p); err == nil {
		_ = json.Unmarshal(data, &raw)
	}
	if raw == nil {
		raw = map[string]interface{}{}
	}

	raw["lastUpdateCheck"] = us.lastChecked.UTC().Format(time.RFC3339)

	data, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	if err := filesystem.MkdirAll(stateRoot, 0o755); err != nil {
		return err
	}
	return filesystem.WriteFile(p, data, 0o644)
}

// defaultFetchRelease performs the real HTTP GET against the GitHub releases API.
// Returns the tag_name string or an error. 2s timeout — fail-open on any error.
func defaultFetchRelease(url string) (string, error) {
	client := &http.Client{Timeout: updateCheckTimeout}
	resp, err := client.Get(url) //nolint:noctx
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<16)) // cap at 64 KiB
	if err != nil {
		return "", err
	}

	var release struct {
		TagName string `json:"tag_name"`
	}
	if err := json.Unmarshal(body, &release); err != nil {
		return "", err
	}
	return release.TagName, nil
}

// normaliseTag strips a leading "v" from a version tag so that "v0.22.0"
// and "0.22.0" compare equal.
func normaliseTag(tag string) string {
	return strings.TrimPrefix(tag, "v")
}
