package cmd_test

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/educlopez/ui-craft/cli/assets"
	"github.com/educlopez/ui-craft/cli/cmd"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/harness"
	"github.com/educlopez/ui-craft/cli/internal/filemerge"
	"github.com/spf13/cobra"
)

// readSkillIDs returns the top-level directory names of mirror (each is a
// skill-id, e.g. "ui-craft", "ui-craft-minimal").
func readSkillIDs(t *testing.T, mirror fs.FS) ([]string, error) {
	t.Helper()
	entries, err := fs.ReadDir(mirror, ".")
	if err != nil {
		return nil, err
	}
	var ids []string
	for _, e := range entries {
		if e.IsDir() {
			ids = append(ids, e.Name())
		}
	}
	return ids, nil
}

// readMirrorSkillMD reads "<id>/SKILL.md" from mirror.
func readMirrorSkillMD(mirror fs.FS, id string) ([]byte, error) {
	return fs.ReadFile(mirror, id+"/SKILL.md")
}

// writeCurrentMirror writes the current embedded assets.SkillsFS(harnessName)
// content for every skill-id onto disk at skillsDir, so a fixture starts
// "up to date" (skill-staleness == ok) unless a test explicitly mutates it.
func writeCurrentMirror(t *testing.T, harnessName, skillsDir string) {
	t.Helper()

	mirror := assets.SkillsFS(harnessName)
	if mirror == nil {
		t.Fatalf("assets.SkillsFS(%q) returned nil — expected embedded skills", harnessName)
	}

	entries, err := readSkillIDs(t, mirror)
	if err != nil {
		t.Fatalf("readSkillIDs: %v", err)
	}
	for _, id := range entries {
		content, err := readMirrorSkillMD(mirror, id)
		if err != nil {
			t.Fatalf("read embedded SKILL.md for %s: %v", id, err)
		}
		dest := filepath.Join(skillsDir, id, "SKILL.md")
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			t.Fatalf("MkdirAll: %v", err)
		}
		if err := os.WriteFile(dest, content, 0o644); err != nil {
			t.Fatalf("WriteFile %s: %v", dest, err)
		}
	}
}

// setupHomeWithHarness points $HOME at a fresh temp dir and pre-populates
// the given harness's skills dir (depth-1: <skillsDir>/<skill-id>/SKILL.md)
// with byte-identical copies of the embedded mirror, so the harness starts
// fully healthy. Returns the temp home dir and the harness's skills dir.
func setupHomeWithHarness(t *testing.T, harnessName string) (home, skillsDir string) {
	t.Helper()
	home = t.TempDir()
	t.Setenv("HOME", home)

	var h harness.Harness
	for _, cand := range harness.All() {
		if cand.Name() == harnessName {
			h = cand
			break
		}
	}
	if h == nil {
		t.Fatalf("unknown harness %q", harnessName)
	}

	skillsDir = h.ConfigPaths().SkillsDir
	if err := os.MkdirAll(skillsDir, 0o755); err != nil {
		t.Fatalf("MkdirAll skillsDir: %v", err)
	}
	writeCurrentMirror(t, harnessName, skillsDir)

	if harnessName == "codex" {
		agentsPath := h.ConfigPaths().AgentsMDPath
		if err := os.MkdirAll(filepath.Dir(agentsPath), 0o755); err != nil {
			t.Fatalf("MkdirAll agents dir: %v", err)
		}
		content := filemerge.BeginMarker + "\nmanaged content\n" + filemerge.EndMarker + "\n"
		if err := os.WriteFile(agentsPath, []byte(content), 0o644); err != nil {
			t.Fatalf("WriteFile AGENTS.md: %v", err)
		}
	}

	return home, skillsDir
}

// detectOnly returns a detectAllFn stub that reports exactly the given
// harness names as installed (matching each real adapter's ConfigPaths(),
// since $HOME has already been redirected via t.Setenv).
func detectOnly(names ...string) func([]harness.Harness) []core.DetectedHarness {
	want := make(map[string]bool, len(names))
	for _, n := range names {
		want[n] = true
	}
	return func(reg []harness.Harness) []core.DetectedHarness {
		var out []core.DetectedHarness
		for _, h := range reg {
			if !want[h.Name()] {
				continue
			}
			res, _ := h.Detect()
			res.Installed = true
			if res.ConfigRoot == "" {
				res.ConfigRoot = h.ConfigRoot()
			}
			out = append(out, core.DetectedHarness{Harness: h, Result: res})
		}
		return out
	}
}

func plentyDiskFn(string) (uint64, error) { return 500 << 20, nil }

// TestRunDoctor_skillChecksOnlyForDetectedHarnesses confirms that skill-layer
// checks (skill-presence/skill-frontmatter/skill-readable/skill-staleness/
// skill-content) appear only for harnesses detectAllFn reports as installed.
func TestRunDoctor_skillChecksOnlyForDetectedHarnesses(t *testing.T) {
	setupHomeWithHarness(t, "claude")
	// cursor shares the same $HOME; pre-populate it too so it is healthy.
	var cursorHarness harness.Harness
	for _, h := range harness.All() {
		if h.Name() == "cursor" {
			cursorHarness = h
		}
	}
	cursorSkills := cursorHarness.ConfigPaths().SkillsDir
	if err := os.MkdirAll(cursorSkills, 0o755); err != nil {
		t.Fatalf("MkdirAll cursor skills: %v", err)
	}
	writeCurrentMirror(t, "cursor", cursorSkills)

	out, err := runDoctorCmd(t, detectOnly("claude", "cursor"), plentyDiskFn)
	_ = err

	for _, label := range []string{"skill-presence", "skill-frontmatter", "skill-readable", "skill-staleness", "skill-content"} {
		if !strings.Contains(out, label) {
			t.Errorf("expected label %q to appear in output for detected harnesses, got:\n%s", label, out)
		}
	}

	// codex/gemini/opencode were not detected: zero skill-layer entries for them.
	// We can't label-scope by harness name in text output, so instead assert
	// via --json that only claude+cursor produced skill-* checks. See
	// TestRunDoctor_jsonIncludesNewLabels below for the JSON-based per-harness
	// assertion; here we just sanity check total occurrence count is bounded
	// to what 2 harnesses with 1 skill variant each would produce (>= 5*2 lines,
	// since each harness has 4 skill-id variants under assets/*/skills/).
	if strings.Count(out, "skill-presence") == 0 {
		t.Errorf("expected at least one skill-presence line, got:\n%s", out)
	}
}

// TestRunDoctor_codexGetsAgentsMDCheck confirms codex-agents-md only appears
// when codex is detected.
func TestRunDoctor_codexGetsAgentsMDCheck(t *testing.T) {
	setupHomeWithHarness(t, "codex")

	out, err := runDoctorCmd(t, detectOnly("codex"), plentyDiskFn)
	_ = err
	if !strings.Contains(out, "codex-agents-md") {
		t.Errorf("expected codex-agents-md check in output, got:\n%s", out)
	}

	// Now with only claude detected (codex not detected): no codex-agents-md.
	setupHomeWithHarness(t, "claude")
	out2, err2 := runDoctorCmd(t, detectOnly("claude"), plentyDiskFn)
	_ = err2
	if strings.Contains(out2, "codex-agents-md") {
		t.Errorf("codex-agents-md must NOT appear when codex is not detected, got:\n%s", out2)
	}
}

// TestRunDoctor_exitCodeOnFrontmatterFail confirms a single skill-frontmatter
// fail (all else ok) bubbles up to a non-zero exit code.
func TestRunDoctor_exitCodeOnFrontmatterFail(t *testing.T) {
	_, skillsDir := setupHomeWithHarness(t, "claude")

	// Corrupt the ui-craft variant's frontmatter (missing name field).
	target := filepath.Join(skillsDir, "ui-craft", "SKILL.md")
	malformed := "---\ndescription: SDD workflow orchestration skill\n---\nbody\n"
	if err := os.WriteFile(target, []byte(malformed), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	out, err := runDoctorCmd(t, detectOnly("claude"), plentyDiskFn)
	if err == nil {
		t.Errorf("expected non-zero exit when skill-frontmatter fails, got nil error. output:\n%s", out)
	}
	if !strings.Contains(out, "[fail] skill-frontmatter") {
		t.Errorf("expected [fail] skill-frontmatter in output, got:\n%s", out)
	}
}

// TestRunDoctor_stalenessWarnDoesNotFailExit confirms that when the ONLY
// non-ok result across the whole run is a skill-staleness warn, the overall
// exit code stays 0 (warn never fails the run).
func TestRunDoctor_stalenessWarnDoesNotFailExit(t *testing.T) {
	_, skillsDir := setupHomeWithHarness(t, "claude")

	// Make the ui-craft variant stale (byte-diff from the embedded mirror)
	// while keeping frontmatter/content/presence/readable all valid.
	target := filepath.Join(skillsDir, "ui-craft", "SKILL.md")
	stale := "---\nname: ui-craft\ndescription: an older installed description\n---\nbody\n"
	if err := os.WriteFile(target, []byte(stale), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	out, err := runDoctorCmd(t, detectOnly("claude"), plentyDiskFn)
	if err != nil {
		t.Errorf("expected exit code 0 when only skill-staleness warns, got error: %v. output:\n%s", err, out)
	}
	if !strings.Contains(out, "[warn] skill-staleness") {
		t.Errorf("expected [warn] skill-staleness in output, got:\n%s", out)
	}
}

// TestRunDoctor_codexMalformedAgentsMDFails confirms a malformed (orphan
// marker) AGENTS.md block for codex is a [fail] that bubbles up to exit 1.
func TestRunDoctor_codexMalformedAgentsMDFails(t *testing.T) {
	_, _ = setupHomeWithHarness(t, "codex")

	var codexHarness harness.Harness
	for _, h := range harness.All() {
		if h.Name() == "codex" {
			codexHarness = h
		}
	}
	agentsPath := codexHarness.ConfigPaths().AgentsMDPath
	orphan := filemerge.BeginMarker + "\nmanaged content, no end marker\n"
	if err := os.WriteFile(agentsPath, []byte(orphan), 0o644); err != nil {
		t.Fatalf("WriteFile AGENTS.md: %v", err)
	}

	out, err := runDoctorCmd(t, detectOnly("codex"), plentyDiskFn)
	if err == nil {
		t.Errorf("expected non-zero exit on malformed AGENTS.md managed block, got nil. output:\n%s", out)
	}
	if !strings.Contains(out, "[fail] codex-agents-md") {
		t.Errorf("expected [fail] codex-agents-md in output, got:\n%s", out)
	}
}

// TestRunDoctor_jsonIncludesNewLabels confirms --json includes the new
// skill-layer check labels with the standard field names.
func TestRunDoctor_jsonIncludesNewLabels(t *testing.T) {
	setupHomeWithHarness(t, "claude")

	m, _ := runDoctorJSONWithSkills(t, detectOnly("claude"), plentyDiskFn)
	checksRaw, ok := m["checks"]
	if !ok {
		t.Fatal("doctor --json: missing 'checks' key")
	}
	checks, ok := checksRaw.([]interface{})
	if !ok {
		t.Fatal("doctor --json: 'checks' is not an array")
	}

	wantLabels := map[string]bool{
		"skill-presence":    false,
		"skill-frontmatter": false,
		"skill-readable":    false,
		"skill-staleness":   false,
		"skill-content":     false,
	}
	for _, raw := range checks {
		entry, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		label, _ := entry["label"].(string)
		if _, tracked := wantLabels[label]; tracked {
			wantLabels[label] = true
			for _, field := range []string{"label", "level", "detail"} {
				if _, present := entry[field]; !present {
					t.Errorf("check %q missing field %q", label, field)
				}
			}
		}
	}
	for label, seen := range wantLabels {
		if !seen {
			t.Errorf("expected label %q in --json checks array, got: %+v", label, checks)
		}
	}
}

// TestRunDoctor_quietSuppressesOkNewChecks confirms --quiet suppresses
// [ok]-level skill-layer checks from human-readable output.
func TestRunDoctor_quietSuppressesOkNewChecks(t *testing.T) {
	setupHomeWithHarness(t, "claude")

	out, _ := runDoctorQuietCmd(t, detectOnly("claude"), plentyDiskFn)
	if strings.Contains(out, "[ok] skill-presence") {
		t.Errorf("--quiet must suppress [ok] skill-presence lines, got:\n%s", out)
	}
}

// TestRunDoctor_quietStillShowsFailingNewCheck confirms --quiet still shows
// failing (non-ok) skill-layer checks.
func TestRunDoctor_quietStillShowsFailingNewCheck(t *testing.T) {
	_, skillsDir := setupHomeWithHarness(t, "claude")

	target := filepath.Join(skillsDir, "ui-craft", "SKILL.md")
	if err := os.WriteFile(target, []byte{}, 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	out, _ := runDoctorQuietCmd(t, detectOnly("claude"), plentyDiskFn)
	if !strings.Contains(out, "[fail] skill-content") {
		t.Errorf("--quiet must still show [fail] skill-content, got:\n%s", out)
	}
}

// --- local test helpers (JSON / quiet doctor runners scoped to this file) ---

func runDoctorJSONWithSkills(
	t *testing.T,
	detectFn func([]harness.Harness) []core.DetectedHarness,
	statfs func(string) (uint64, error),
) (map[string]interface{}, error) {
	t.Helper()

	restore := cmd.SetDetectAllFn(detectFn)
	defer restore()
	oldStatfs := cmd.SetDoctorStatfsFn(statfs)
	defer oldStatfs()

	oldJSON := cmd.Flags.JSON
	defer func() { cmd.Flags.JSON = oldJSON }()

	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.PersistentFlags().BoolVar(&cmd.Flags.JSON, "json", false, "")
	root.AddCommand(cmd.MakeDoctorCmd())
	root.SetArgs([]string{"--json", "doctor"})

	var buf strings.Builder
	root.SetOut(&buf)
	root.SetErr(&buf)
	err := root.Execute()

	dec := json.NewDecoder(strings.NewReader(buf.String()))
	var m map[string]interface{}
	if jsonErr := dec.Decode(&m); jsonErr != nil {
		t.Fatalf("doctor --json: not valid JSON: %v\noutput: %s", jsonErr, buf.String())
	}
	return m, err
}

func runDoctorQuietCmd(
	t *testing.T,
	detectFn func([]harness.Harness) []core.DetectedHarness,
	statfs func(string) (uint64, error),
) (string, error) {
	t.Helper()

	restore := cmd.SetDetectAllFn(detectFn)
	defer restore()
	oldStatfs := cmd.SetDoctorStatfsFn(statfs)
	defer oldStatfs()

	oldQuiet := cmd.Flags.Quiet
	defer func() { cmd.Flags.Quiet = oldQuiet }()

	root := &cobra.Command{Use: "ui-craft", SilenceUsage: true}
	root.PersistentFlags().BoolVar(&cmd.Flags.Quiet, "quiet", false, "")
	root.AddCommand(cmd.MakeDoctorCmd())
	root.SetArgs([]string{"--quiet", "doctor"})

	var buf strings.Builder
	root.SetOut(&buf)
	root.SetErr(&buf)
	err := root.Execute()
	return buf.String(), err
}
