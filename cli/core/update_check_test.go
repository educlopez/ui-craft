package core_test

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
)

// ─── helpers ──────────────────────────────────────────────────────────────

// withClock temporarily replaces ClockFn for the duration of a test.
func withClock(t *testing.T, fn func() time.Time) {
	t.Helper()
	orig := core.ClockFn
	core.ClockFn = fn
	t.Cleanup(func() { core.ClockFn = orig })
}

// withFetcher temporarily replaces FetchReleaseFn for the duration of a test.
func withFetcher(t *testing.T, fn func(string) (string, error)) {
	t.Helper()
	orig := core.FetchReleaseFn
	core.FetchReleaseFn = fn
	t.Cleanup(func() { core.FetchReleaseFn = orig })
}

// writeLastCheck writes a state.json with lastUpdateCheck set to ts (RFC3339).
func writeLastCheck(t *testing.T, m *fsutil.MemFS, root string, ts time.Time) {
	t.Helper()
	_ = m.MkdirAll(root, 0o755)
	content := `{"schemaVersion":1,"lastUpdateCheck":"` + ts.UTC().Format(time.RFC3339) + `"}`
	_ = m.WriteFile(filepath.Join(root, "state.json"), []byte(content), 0o644)
}

// ─── TTL gate tests ────────────────────────────────────────────────────────

// TestCheckForUpdate_TTLSkipsWithin24h verifies that when LastUpdateCheck is
// less than 24h ago, the fetcher is NOT called and no update is returned.
func TestCheckForUpdate_TTLSkipsWithin24h(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	lastCheck := now.Add(-1 * time.Hour) // only 1h ago — within TTL

	writeLastCheck(t, m, root, lastCheck)
	withClock(t, func() time.Time { return now })

	fetchCalled := false
	withFetcher(t, func(_ string) (string, error) {
		fetchCalled = true
		return "v9.9.9", nil
	})

	result := core.CheckForUpdate(m, root, "v0.21.0")

	if fetchCalled {
		t.Error("fetcher must NOT be called when last check is within 24h TTL")
	}
	if result.Available {
		t.Error("must return no update when within TTL")
	}
}

// TestCheckForUpdate_TTLChecksAfter24h verifies that when LastUpdateCheck is
// more than 24h ago, the fetcher IS called.
func TestCheckForUpdate_TTLChecksAfter24h(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	lastCheck := now.Add(-25 * time.Hour) // 25h ago — outside TTL

	writeLastCheck(t, m, root, lastCheck)
	withClock(t, func() time.Time { return now })

	fetchCalled := false
	withFetcher(t, func(_ string) (string, error) {
		fetchCalled = true
		return "v0.21.0", nil // same version — no update
	})

	_ = core.CheckForUpdate(m, root, "v0.21.0")

	if !fetchCalled {
		t.Error("fetcher must be called when last check is outside 24h TTL")
	}
}

// ─── 6h cooldown boundary tests ───────────────────────────────────────────────
// These tests define the exact 6h TTL boundary (gentle-ai parity).
// They will FAIL with updateCheckTTL = 24h and PASS with updateCheckTTL = 6h.

// TestCheckForUpdate_TTLSkipsJustUnder6h verifies that a check timestamp that is
// just under 6h ago (5h59m) does NOT trigger a network call — we are still within
// the 6h cooldown window.
func TestCheckForUpdate_TTLSkipsJustUnder6h(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft-6h-under"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	lastCheck := now.Add(-5*time.Hour - 59*time.Minute) // 5h59m ago — just under 6h

	writeLastCheck(t, m, root, lastCheck)
	withClock(t, func() time.Time { return now })

	fetchCalled := false
	withFetcher(t, func(_ string) (string, error) {
		fetchCalled = true
		return "v9.9.9", nil
	})

	result := core.CheckForUpdate(m, root, "v0.21.0")

	if fetchCalled {
		t.Error("fetcher must NOT be called when last check is within 6h TTL (5h59m elapsed)")
	}
	if result.Available {
		t.Error("must return no update when within 6h TTL")
	}
}

// TestCheckForUpdate_TTLChecksJustOver6h verifies that a check timestamp that is
// just over 6h ago (6h1m) DOES trigger a network call — the 6h cooldown has expired.
func TestCheckForUpdate_TTLChecksJustOver6h(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft-6h-over"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	lastCheck := now.Add(-6*time.Hour - 1*time.Minute) // 6h1m ago — just over 6h

	writeLastCheck(t, m, root, lastCheck)
	withClock(t, func() time.Time { return now })

	fetchCalled := false
	withFetcher(t, func(_ string) (string, error) {
		fetchCalled = true
		return "v0.21.0", nil // same version — no update
	})

	_ = core.CheckForUpdate(m, root, "v0.21.0")

	if !fetchCalled {
		t.Error("fetcher must be called when last check is outside 6h TTL (6h1m elapsed)")
	}
}

// TestCheckForUpdate_NeverChecked verifies that on first run (no state.json),
// the fetcher IS called.
func TestCheckForUpdate_NeverChecked(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft-fresh"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	withClock(t, func() time.Time { return now })

	fetchCalled := false
	withFetcher(t, func(_ string) (string, error) {
		fetchCalled = true
		return "v0.21.0", nil
	})

	_ = core.CheckForUpdate(m, root, "v0.21.0")

	if !fetchCalled {
		t.Error("fetcher must be called on first run (no state.json)")
	}
}

// ─── Advisory tests ────────────────────────────────────────────────────────

// TestCheckForUpdate_NewerVersionAvailable verifies that a different remote tag
// produces UpdateResult{Available: true, LatestTag: "v0.22.0"}.
func TestCheckForUpdate_NewerVersionAvailable(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	withClock(t, func() time.Time { return now })
	withFetcher(t, func(_ string) (string, error) {
		return "v0.22.0", nil
	})

	result := core.CheckForUpdate(m, root, "v0.21.0")

	if !result.Available {
		t.Error("expected Available=true when remote tag differs from current version")
	}
	if result.LatestTag != "v0.22.0" {
		t.Errorf("LatestTag: got %q, want %q", result.LatestTag, "v0.22.0")
	}

	line := core.UpdateAdvisoryLine(result)
	if line == "" {
		t.Error("UpdateAdvisoryLine must return non-empty string when update is available")
	}
}

// TestCheckForUpdate_SameVersionNoAdvisory verifies that the same remote tag
// as the current version produces UpdateResult{Available: false}.
func TestCheckForUpdate_SameVersionNoAdvisory(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	withClock(t, func() time.Time { return now })
	withFetcher(t, func(_ string) (string, error) {
		return "v0.21.0", nil
	})

	result := core.CheckForUpdate(m, root, "v0.21.0")

	if result.Available {
		t.Error("must NOT advise when remote tag matches current version")
	}
	if core.UpdateAdvisoryLine(result) != "" {
		t.Error("UpdateAdvisoryLine must return empty string when no update available")
	}
}

// ─── Fail-open tests ───────────────────────────────────────────────────────

// TestCheckForUpdate_NetworkErrorSilent verifies that a network error returns
// no advisory and does not propagate an error to the caller.
func TestCheckForUpdate_NetworkErrorSilent(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	withClock(t, func() time.Time { return now })
	withFetcher(t, func(_ string) (string, error) {
		return "", errors.New("connection refused")
	})

	result := core.CheckForUpdate(m, root, "v0.21.0")

	if result.Available {
		t.Error("network error must not produce an advisory (fail-open)")
	}
}

// TestCheckForUpdate_MalformedJSONSilent verifies that malformed JSON from the
// fetcher returns no advisory.
func TestCheckForUpdate_MalformedJSONSilent(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	withClock(t, func() time.Time { return now })
	// Simulate the fetcher returning a parse error (wraps the JSON decode failure).
	withFetcher(t, func(_ string) (string, error) {
		return "", errors.New("invalid character 'x' looking for beginning of value")
	})

	result := core.CheckForUpdate(m, root, "v0.21.0")

	if result.Available {
		t.Error("malformed JSON must not produce an advisory (fail-open)")
	}
}

// ─── Timestamp persistence test ────────────────────────────────────────────

// TestCheckForUpdate_WritesTimestampAfterCheck verifies that after a successful
// check, LastUpdateCheck is persisted to state.json.
func TestCheckForUpdate_WritesTimestampAfterCheck(t *testing.T) {
	m := fsutil.NewMemFS()
	root := "/home/user/.ui-craft"

	now := time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC)
	withClock(t, func() time.Time { return now })
	withFetcher(t, func(_ string) (string, error) {
		return "v0.22.0", nil
	})

	_ = core.CheckForUpdate(m, root, "v0.21.0")

	// Read back state.json and verify lastUpdateCheck was written.
	state, err := core.LoadState(m, root)
	if err != nil {
		t.Fatalf("load state: %v", err)
	}
	if state.LastUpdateCheck == "" {
		t.Error("expected LastUpdateCheck to be set in state.json after check")
	}
}
