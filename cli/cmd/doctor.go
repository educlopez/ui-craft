// Package cmd — doctor command.
// ui-craft doctor performs a health check of the ui-craft installation:
//
//	(a) which harness binaries are detected
//	(b) state.json parses OK and each harness config dir is present on disk
//	(c) disk space at the backup root (warn < 100 MB, fail < 10 MB)
//
// Each check emits [ok] / [warn] / [fail] with a one-line remedy.
// The command exits 1 if any check is [fail] (warn does not fail).
//
// Adapted from github.com/Gentleman-Programming/gentle-ai internal/cli/doctor.go (MIT).
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/spf13/cobra"
)

// doctorStatfsFn is injectable for testing. It wraps diskAvail so tests
// can simulate low-disk conditions without touching the real filesystem.
// diskAvail is defined in doctor_unix.go (Linux/Darwin) or doctor_windows.go.
var doctorStatfsFn = diskAvail

// makeDoctorCmd constructs the doctor command. It is factored out of the
// package-level var so tests can build a fresh instance without interfering
// with the global rootCmd (and its sync.Once guards).
func makeDoctorCmd() *cobra.Command {
	return &cobra.Command{
		Use:          "doctor",
		Short:        "Health check for ui-craft installation",
		SilenceUsage: true,
		RunE:         runDoctor,
	}
}

var doctorCmd = makeDoctorCmd()

func init() {
	rootCmd.AddCommand(doctorCmd)
}

// checkResult holds the outcome of a single doctor check.
type checkResult struct {
	label  string // short name, e.g. "harness-binaries"
	level  string // "ok", "warn", "fail"
	detail string // human-readable status
	remedy string // one-line fix (empty when level == "ok")
}

func (c checkResult) String() string {
	if c.remedy != "" {
		return fmt.Sprintf("[%s] %s: %s — %s", c.level, c.label, c.detail, c.remedy)
	}
	return fmt.Sprintf("[%s] %s: %s", c.level, c.label, c.detail)
}

func runDoctor(cmd *cobra.Command, _ []string) error {
	out := cmd.OutOrStdout()
	fs := fsutil.OsFS{}

	var results []checkResult
	anyFail := false

	// -----------------------------------------------------------------------
	// (a) Harness binaries: which of claude/cursor/codex/gemini/opencode are
	//     detected. Note any that are not found.
	// -----------------------------------------------------------------------
	detected := detectAllFn(harness.All())
	detectedNames := make(map[string]bool)
	for _, dh := range detected {
		detectedNames[dh.Harness.Name()] = true
	}

	allHarnesses := []string{"claude", "cursor", "codex", "gemini", "opencode"}
	var foundHarnesses, missingHarnesses []string
	for _, name := range allHarnesses {
		if detectedNames[name] {
			foundHarnesses = append(foundHarnesses, name)
		} else {
			missingHarnesses = append(missingHarnesses, name)
		}
	}

	if len(foundHarnesses) == 0 {
		results = append(results, checkResult{
			label:  "harness-binaries",
			level:  "warn",
			detail: "no supported harness detected",
			remedy: fmt.Sprintf("install one of: %v", allHarnesses),
		})
	} else {
		detail := fmt.Sprintf("detected: %v", foundHarnesses)
		if len(missingHarnesses) > 0 {
			detail += fmt.Sprintf("; not found: %v", missingHarnesses)
		}
		results = append(results, checkResult{
			label:  "harness-binaries",
			level:  "ok",
			detail: detail,
		})
	}

	// -----------------------------------------------------------------------
	// (b) state.json: parses OK, and each harness it lists still has its
	//     config dir on disk.
	// -----------------------------------------------------------------------
	home, _ := os.UserHomeDir()
	stateRoot := filepath.Join(home, ".ui-craft")
	state, _ := core.LoadState(fs, stateRoot)

	if len(state.Harnesses) == 0 {
		results = append(results, checkResult{
			label:  "state.json",
			level:  "ok",
			detail: "no harnesses recorded (nothing installed yet)",
		})
	} else {
		var missingDirs []string
		for _, hs := range state.Harnesses {
			// Find the harness adapter to get its ConfigRoot.
			var cfgRoot string
			for _, h := range harness.All() {
				if h.Name() == hs.Name {
					res, err := h.Detect()
					if err == nil && res.Installed {
						cfgRoot = res.ConfigRoot
					}
					break
				}
			}
			if cfgRoot == "" {
				// Could not detect — harness may have been uninstalled.
				missingDirs = append(missingDirs, hs.Name+" (not detected)")
				continue
			}
			if _, err := os.Stat(cfgRoot); err != nil {
				missingDirs = append(missingDirs, hs.Name+" ("+cfgRoot+" missing)")
			}
		}
		if len(missingDirs) > 0 {
			results = append(results, checkResult{
				label:  "state.json",
				level:  "warn",
				detail: fmt.Sprintf("config dirs missing for: %v", missingDirs),
				remedy: "re-run `ui-craft install` or remove these entries from ~/.ui-craft/state.json",
			})
		} else {
			results = append(results, checkResult{
				label:  "state.json",
				level:  "ok",
				detail: fmt.Sprintf("parses OK; %d harness(es) with config dirs present", len(state.Harnesses)),
			})
		}
	}

	// -----------------------------------------------------------------------
	// (c) Disk space at backup root.
	// -----------------------------------------------------------------------
	const warnBytes = 100 << 20 // 100 MB
	const failBytes = 10 << 20  // 10 MB

	backupRoot := filepath.Join(home, ".ui-craft-backups")
	// Statfs requires the path to exist; fall back to home if backup root is absent.
	statPath := backupRoot
	if _, err := os.Stat(backupRoot); err != nil {
		statPath = home
	}

	avail, err := doctorStatfsFn(statPath)
	if err != nil {
		results = append(results, checkResult{
			label:  "disk-space",
			level:  "warn",
			detail: fmt.Sprintf("could not stat %s: %v", statPath, err),
			remedy: "check filesystem health",
		})
	} else {
		availMB := avail / (1 << 20)
		switch {
		case avail < failBytes:
			results = append(results, checkResult{
				label:  "disk-space",
				level:  "fail",
				detail: fmt.Sprintf("%d MB available at %s", availMB, statPath),
				remedy: "free disk space immediately; backups and installs will fail",
			})
			anyFail = true
		case avail < warnBytes:
			results = append(results, checkResult{
				label:  "disk-space",
				level:  "warn",
				detail: fmt.Sprintf("%d MB available at %s", availMB, statPath),
				remedy: "consider freeing disk space before running install",
			})
		default:
			results = append(results, checkResult{
				label:  "disk-space",
				level:  "ok",
				detail: fmt.Sprintf("%d MB available at %s", availMB, statPath),
			})
		}
	}

	// -----------------------------------------------------------------------
	// Print results (human or JSON).
	// -----------------------------------------------------------------------
	if flags.JSON {
		// doctorJSONCheck is the per-check JSON representation.
		type doctorJSONCheck struct {
			Label  string `json:"label"`
			Level  string `json:"level"`
			Detail string `json:"detail"`
			Remedy string `json:"remedy,omitempty"`
		}
		type doctorJSONResult struct {
			OK     bool              `json:"ok"`
			Checks []doctorJSONCheck `json:"checks"`
		}
		checks := make([]doctorJSONCheck, 0, len(results))
		for _, r := range results {
			checks = append(checks, doctorJSONCheck{
				Label:  r.label,
				Level:  r.level,
				Detail: r.detail,
				Remedy: r.remedy,
			})
		}
		res := doctorJSONResult{OK: !anyFail, Checks: checks}
		enc := json.NewEncoder(out)
		enc.SetIndent("", "  ")
		if err := enc.Encode(res); err != nil {
			return err
		}
		if anyFail {
			return fmt.Errorf("doctor: one or more checks failed")
		}
		return nil
	}

	for _, r := range results {
		if flags.Quiet && r.level == "ok" {
			continue
		}
		fmt.Fprintln(out, r.String())
	}

	if anyFail {
		return fmt.Errorf("doctor: one or more checks failed")
	}
	return nil
}
