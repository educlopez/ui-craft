// Package core contains the pure installer logic: detection, planning, and
// apply. It sits between the command/TUI layer and the harness adapters.
package core

import (
	"fmt"

	"github.com/educlopez/ui-craft/cli/harness"
)

// DetectedHarness pairs a Harness adapter with its detection result.
type DetectedHarness struct {
	Harness harness.Harness
	Result  harness.DetectResult
}

// Detect runs Harness.Detect() for every entry in reg and returns only the
// harnesses that are installed on the current machine.
//
// An error from a single harness's Detect() is wrapped and returned immediately
// so callers can surface it without silently skipping a harness. If you want
// best-effort detection, call DetectAll instead.
func Detect(reg []harness.Harness) ([]DetectedHarness, error) {
	var detected []DetectedHarness
	for _, h := range reg {
		res, err := h.Detect()
		if err != nil {
			return nil, fmt.Errorf("detect %s: %w", h.Name(), err)
		}
		if res.Installed {
			detected = append(detected, DetectedHarness{Harness: h, Result: res})
		}
	}
	return detected, nil
}

// DetectAll is like Detect but never returns an error — detection failures for
// individual harnesses are silently ignored and that harness is skipped. Use
// this when a best-effort result is preferable to aborting on the first error
// (e.g. in the TUI).
func DetectAll(reg []harness.Harness) []DetectedHarness {
	var detected []DetectedHarness
	for _, h := range reg {
		res, err := h.Detect()
		if err != nil {
			continue // ignore per-harness errors; best-effort
		}
		if res.Installed {
			detected = append(detected, DetectedHarness{Harness: h, Result: res})
		}
	}
	return detected
}
