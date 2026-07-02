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
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/fsutil"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
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

// Label, Level, and Detail expose checkResult's fields for tests outside the
// cmd package (cmd_test). checkResult itself stays unexported; only these
// narrow read accessors are part of the test-facing surface.
func (c checkResult) Label() string  { return c.label }
func (c checkResult) Level() string  { return c.level }
func (c checkResult) Detail() string { return c.detail }
func (c checkResult) Remedy() string { return c.remedy }

// parseSkillFrontmatter parses the leading YAML-style frontmatter block of a
// SKILL.md file: an opening "---" fence on the first non-empty line, followed
// by flat "key: value" lines, followed by a closing "---" fence. It returns
// the trimmed "name" and "description" field values and ok=true only when:
//   - the opening fence is present,
//   - the fence is terminated by a closing "---" line,
//   - "name" is present and non-empty after trimming,
//   - "description" is present and at least 10 non-whitespace characters
//     after trimming (per spec: this threshold catches placeholder/truncated
//     values like "description: x" without penalizing legitimately terse
//     but real descriptions).
//
// No YAML library is used — frontmatter here is a trivial flat key:value
// list, so a minimal line-scanning parser avoids adding a new dependency.
func parseSkillFrontmatter(b []byte) (name, desc string, ok bool) {
	lines := strings.Split(string(b), "\n")

	// Find the opening fence: the first non-empty line must be exactly "---".
	start := -1
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if trimmed == "---" {
			start = i
		}
		break
	}
	if start == -1 {
		return "", "", false
	}

	// Find the closing fence: the next line (after start) that is exactly "---".
	end := -1
	for i := start + 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			end = i
			break
		}
	}
	if end == -1 {
		// Unterminated frontmatter block.
		return "", "", false
	}

	// Scan key:value lines between the fences.
	for _, line := range lines[start+1 : end] {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		key, val, found := strings.Cut(trimmed, ":")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		switch key {
		case "name":
			name = val
		case "description":
			desc = val
		}
	}

	if strings.TrimSpace(name) == "" {
		return "", "", false
	}
	if len(strings.TrimSpace(desc)) < 10 {
		return "", "", false
	}
	return name, desc, true
}

// checkSkillFile runs the presence / readable / content / frontmatter /
// staleness checks for a single installed SKILL.md file at diskPath,
// comparing its content against embeddedContent (the mirror copy shipped
// with this ui-craft build). It is read-only: it never writes to fs.
//
// Checks are gated in order — a failing presence check short-circuits the
// rest (no file to read), and a failing readable check short-circuits
// content/frontmatter/staleness (no bytes to inspect). This mirrors the
// spec's "this check only runs if the presence check passed" language.
//
// Per spec, only presence / readable / content / frontmatter are [fail]
// level; staleness is always [warn] (byte mismatch is not a correctness
// failure) and this function never mutates the file to "fix" staleness.
func checkSkillFile(fs fsutil.FileSystem, diskPath string, embeddedContent []byte) []checkResult {
	var results []checkResult

	// --- Presence -----------------------------------------------------
	if _, err := fs.Stat(diskPath); err != nil {
		results = append(results, checkResult{
			label:  "skill-presence",
			level:  "fail",
			detail: fmt.Sprintf("SKILL.md not found at %s", diskPath),
			remedy: "run `ui-craft install`",
		})
		return results
	}
	results = append(results, checkResult{
		label:  "skill-presence",
		level:  "ok",
		detail: fmt.Sprintf("SKILL.md present at %s", diskPath),
	})

	// --- Readable -------------------------------------------------------
	content, err := fs.ReadFile(diskPath)
	if err != nil {
		results = append(results, checkResult{
			label:  "skill-readable",
			level:  "fail",
			detail: fmt.Sprintf("permission denied reading %s", diskPath),
			remedy: "fix file permissions (chmod) or reinstall via `ui-craft update`",
		})
		return results
	}
	results = append(results, checkResult{
		label:  "skill-readable",
		level:  "ok",
		detail: "file is readable",
	})

	// --- Content / malformed --------------------------------------------
	switch {
	case len(content) == 0:
		results = append(results, checkResult{
			label:  "skill-content",
			level:  "fail",
			detail: "file is empty (0 bytes)",
			remedy: "reinstall via `ui-craft update`",
		})
		return results
	case !utf8.Valid(content):
		results = append(results, checkResult{
			label:  "skill-content",
			level:  "fail",
			detail: "file contains invalid UTF-8",
			remedy: "reinstall via `ui-craft update`",
		})
		return results
	}
	results = append(results, checkResult{
		label:  "skill-content",
		level:  "ok",
		detail: "file is non-empty and valid UTF-8",
	})

	// --- Frontmatter ------------------------------------------------------
	_, _, fmOK := parseSkillFrontmatter(content)
	if !fmOK {
		detail, remedy := frontmatterFailureDetail(content)
		results = append(results, checkResult{
			label:  "skill-frontmatter",
			level:  "fail",
			detail: detail,
			remedy: remedy,
		})
	} else {
		results = append(results, checkResult{
			label:  "skill-frontmatter",
			level:  "ok",
			detail: "frontmatter is well-formed",
		})
	}

	// --- Staleness --------------------------------------------------------
	if bytes.Equal(content, embeddedContent) {
		results = append(results, checkResult{
			label:  "skill-staleness",
			level:  "ok",
			detail: "installed content matches current ui-craft version",
		})
	} else {
		results = append(results, checkResult{
			label:  "skill-staleness",
			level:  "warn",
			detail: "installed content differs from current ui-craft version",
			remedy: "run `ui-craft update`",
		})
	}

	return results
}

// checkCodexAgentsMD verifies that Codex's AGENTS.md file exists and
// contains a well-formed ui-craft managed block: filemerge.BeginMarker
// appearing before filemerge.EndMarker. This is the only skills-dir
// discovery pointer Codex has (no marketplace), per the proposal. The
// markers are reused directly from filemerge (the same constants
// filemerge.UpsertManagedBlock writes via harness/codex.go's WriteSkill) —
// no duplicated marker strings or regex. This check is read-only; it never
// repairs the file (that is codex.go's WriteSkill / `ui-craft update`
// responsibility, not doctor's).
func checkCodexAgentsMD(fs fsutil.FileSystem, agentsMDPath string) checkResult {
	content, err := fs.ReadFile(agentsMDPath)
	if err != nil {
		return checkResult{
			label:  "codex-agents-md",
			level:  "fail",
			detail: fmt.Sprintf("AGENTS.md not found at %s", agentsMDPath),
			remedy: "run `ui-craft install`",
		}
	}

	text := string(content)
	beginIdx := strings.Index(text, filemerge.BeginMarker)
	endIdx := strings.Index(text, filemerge.EndMarker)

	if beginIdx != -1 && endIdx != -1 && beginIdx < endIdx {
		return checkResult{
			label:  "codex-agents-md",
			level:  "ok",
			detail: "managed block present and well-formed",
		}
	}

	return checkResult{
		label:  "codex-agents-md",
		level:  "fail",
		detail: "managed block markers malformed (orphan marker)",
		remedy: "run `ui-craft update` to repair the managed block",
	}
}

// frontmatterFailureDetail re-derives a specific failure reason for a
// frontmatter block that parseSkillFrontmatter rejected, so checkSkillFile
// can report a precise detail/remedy pair instead of a generic message.
// It duplicates a small amount of parseSkillFrontmatter's fence-scanning
// logic; this is intentional — parseSkillFrontmatter's contract is a single
// ok bool, and re-deriving the reason here keeps that function's signature
// simple while still giving doctor's output the specific wording the spec
// requires ("frontmatter not terminated", "description missing or too
// short (<10 chars)", "name field missing").
func frontmatterFailureDetail(content []byte) (detail, remedy string) {
	const remedyReinstall = "reinstall via `ui-craft update`"

	lines := strings.Split(string(content), "\n")

	start := -1
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if trimmed == "---" {
			start = i
		}
		break
	}
	if start == -1 {
		return "frontmatter not terminated", remedyReinstall
	}

	end := -1
	for i := start + 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			end = i
			break
		}
	}
	if end == -1 {
		return "frontmatter not terminated", remedyReinstall
	}

	var name, desc string
	for _, line := range lines[start+1 : end] {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		key, val, found := strings.Cut(trimmed, ":")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		switch key {
		case "name":
			name = val
		case "description":
			desc = val
		}
	}

	if strings.TrimSpace(name) == "" {
		return "name field missing", remedyReinstall
	}
	if len(strings.TrimSpace(desc)) < 10 {
		return "description missing or too short (<10 chars)", remedyReinstall
	}
	// Fences are terminated and name/description both pass — this function
	// should not have been called (parseSkillFrontmatter would have
	// returned ok=true). Fall back to a generic detail defensively.
	return "frontmatter invalid", remedyReinstall
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
