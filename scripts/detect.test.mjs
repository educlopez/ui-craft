// detect.test.mjs — CLI parity + scan() unit tests
// Uses node:test and node:assert (zero external deps).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  scan,
  parseUnifiedDiff,
  filterFindingsByScope,
  resolveBaseRef,
  renderGHAWorkflow,
  renderReviewComments,
  DEFAULT_GHA_CONFIG,
} from "./detect.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DETECT_MJS = path.join(__dirname, "detect.mjs");
const SLOP_FIXTURE = path.join(__dirname, "fixtures", "slop.tsx");
const CLEAN_FIXTURE = path.join(__dirname, "fixtures", "clean.tsx");

// ---------------------------------------------------------------------------
// 2.2 — scan() on slop fixture: shape check
// ---------------------------------------------------------------------------
test("scan() on slop fixture returns {version, summary, findings} shape", async () => {
  const result = await scan(SLOP_FIXTURE);

  assert.ok(typeof result.version === "string", "version must be a string");
  assert.ok(typeof result.summary === "object", "summary must be an object");
  assert.ok(typeof result.summary.files_scanned === "number", "summary.files_scanned must be a number");
  assert.ok(typeof result.summary.files_flagged === "number", "summary.files_flagged must be a number");
  assert.ok(typeof result.summary.errors === "number", "summary.errors must be a number");
  assert.ok(typeof result.summary.warnings === "number", "summary.warnings must be a number");
  assert.ok(Array.isArray(result.findings), "findings must be an array");
  assert.ok(result.findings.length > 0, "slop fixture must produce at least one finding");
  // summary.warnings folds both "major" and "warn" severities together, so
  // errors + warnings === total findings length (not just warn-severity count).
  assert.equal(
    result.summary.errors + result.summary.warnings,
    result.findings.length,
    "summary totals must match findings count"
  );
});

// ---------------------------------------------------------------------------
// 2.4 — scan() on code string with known anti-slop pattern via temp fixture
//        (scan() accepts a path; slop fixture has purple-cyan gradient)
// ---------------------------------------------------------------------------
test("scan() on slop fixture detects purple-cyan gradient rule", async () => {
  const result = await scan(SLOP_FIXTURE);

  const gradientFinding = result.findings.find((f) => f.rule === "purple-cyan-gradient");
  assert.ok(gradientFinding, 'must find a finding with rule "purple-cyan-gradient"');
  assert.equal(gradientFinding.severity, "critical");
});

// ---------------------------------------------------------------------------
// 2.5 — scan() on clean fixture: no findings
// ---------------------------------------------------------------------------
test("scan() on clean fixture returns empty findings and summary.total === 0", async () => {
  const result = await scan(CLEAN_FIXTURE);

  assert.equal(result.findings.length, 0, "clean fixture must produce zero findings");
  assert.equal(result.summary.errors, 0, "errors must be 0 for clean fixture");
  assert.equal(result.summary.warnings, 0, "warnings must be 0 for clean fixture");
  assert.equal(result.summary.files_flagged, 0, "files_flagged must be 0 for clean fixture");
});

// ---------------------------------------------------------------------------
// 2.3 — CLI parity: ui-craft-detect --json output == scan() output (full)
// ---------------------------------------------------------------------------
test("CLI --json findings match scan() findings (parity)", async () => {
  // Run CLI
  let cliStdout;
  try {
    cliStdout = execFileSync(process.execPath, [DETECT_MJS, SLOP_FIXTURE, "--json"], {
      encoding: "utf8",
    });
  } catch (err) {
    // CLI exits with code 1 when there are errors — execFileSync throws, but stdout is still populated.
    cliStdout = err.stdout;
  }

  const cliResult = JSON.parse(cliStdout);
  const scanResult = await scan(SLOP_FIXTURE);

  // Compare version + summary envelope.
  assert.equal(cliResult.version, scanResult.version, "version must match between CLI and scan()");
  assert.deepStrictEqual(cliResult.summary, scanResult.summary, "summary must match between CLI and scan()");

  // Full deep comparison of findings (all fields: rule, line, severity, file,
  // description, snippet, fix) — sorted by rule+line for stability.
  const sortKey = (f) => `${f.rule}:${f.line}`;
  const cliFindings = [...cliResult.findings].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b))
  );
  const scanFindings = [...scanResult.findings].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b))
  );

  assert.deepStrictEqual(
    cliFindings,
    scanFindings,
    "CLI and scan() must return identical findings (all fields)"
  );
});

// ---------------------------------------------------------------------------
// 2.6 — CLI --sarif: produces valid SARIF JSON and correct exit code
// ---------------------------------------------------------------------------
test("CLI --sarif produces valid SARIF output and exits with code 1 on slop", () => {
  let sarifStdout;
  let exitCode = 0;
  try {
    sarifStdout = execFileSync(process.execPath, [DETECT_MJS, SLOP_FIXTURE, "--sarif"], {
      encoding: "utf8",
    });
  } catch (err) {
    // CLI exits 1 when there are error-severity findings — capture stdout anyway.
    sarifStdout = err.stdout;
    exitCode = err.status;
  }

  // Must be parseable JSON.
  let sarif;
  assert.doesNotThrow(() => {
    sarif = JSON.parse(sarifStdout);
  }, "SARIF output must be valid JSON");

  // Must have the SARIF 2.1.0 shape.
  assert.ok(Array.isArray(sarif.runs), "SARIF must have a runs array");
  assert.ok(sarif.runs.length > 0, "SARIF runs must be non-empty");
  assert.ok(Array.isArray(sarif.runs[0].results), "SARIF runs[0] must have a results array");
  assert.ok(sarif.runs[0].results.length > 0, "SARIF results must be non-empty for slop fixture");

  // Exit code must be 1 (slop fixture has critical findings).
  assert.equal(exitCode, 1, "CLI must exit with code 1 for slop fixture with --sarif");
});

// ---------------------------------------------------------------------------
// Extra: CLI exit codes intact
// ---------------------------------------------------------------------------
test("CLI exits with code 1 when findings contain errors (exit code parity)", () => {
  let exitCode = 0;
  try {
    execFileSync(process.execPath, [DETECT_MJS, SLOP_FIXTURE, "--json"], { encoding: "utf8" });
  } catch (err) {
    exitCode = err.status;
  }
  assert.equal(exitCode, 1, "CLI must exit with code 1 when there are critical findings");
});

test("CLI exits with code 0 for clean input", () => {
  let exitCode = 0;
  try {
    execFileSync(process.execPath, [DETECT_MJS, CLEAN_FIXTURE, "--json"], { encoding: "utf8" });
  } catch (err) {
    exitCode = err.status;
  }
  assert.equal(exitCode, 0, "CLI must exit with code 0 for clean input");
});

// ---------------------------------------------------------------------------
// Error path: nonexistent path returns structured result without crashing
// ---------------------------------------------------------------------------
test("scan() on nonexistent path returns structured error without throwing", async () => {
  const result = await scan("/nonexistent/path/that/does/not/exist.tsx");
  assert.ok(result.error, "result must have an error field");
  assert.equal(result.findings.length, 0, "findings must be empty on error");
  assert.equal(result.summary.files_scanned, 0, "files_scanned must be 0 on error");
});

// ---------------------------------------------------------------------------
// Diff-scoped scanning — Phase 1/2 (PR 1 of detect-ci-integration)
// Pure parser/filter unit tests. String-fixture based (no temp repos) so
// they're git-version independent. See design obs #869.
// ---------------------------------------------------------------------------

// --- parseUnifiedDiff -------------------------------------------------------

test("parseUnifiedDiff: single hunk in one file", () => {
  const diff = `diff --git a/src/foo.tsx b/src/foo.tsx
index 1111111..2222222 100644
--- a/src/foo.tsx
+++ b/src/foo.tsx
@@ -10,0 +11,3 @@ function Foo() {
+  const a = 1;
+  const b = 2;
+  const c = 3;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/foo.tsx"), [[11, 13]]);
});

test("parseUnifiedDiff: multiple hunks in one file", () => {
  const diff = `diff --git a/src/foo.tsx b/src/foo.tsx
--- a/src/foo.tsx
+++ b/src/foo.tsx
@@ -5,0 +5,2 @@
+  const x = 1;
+  const y = 2;
@@ -40,0 +42,1 @@
+  const z = 3;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/foo.tsx"), [
    [5, 6],
    [42, 42],
  ]);
});

test("parseUnifiedDiff: renamed file with edits is followed, not double-counted", () => {
  const diff = `diff --git a/src/old-name.tsx b/src/new-name.tsx
similarity index 90%
rename from src/old-name.tsx
rename to src/new-name.tsx
index 1111111..2222222 100644
--- a/src/old-name.tsx
+++ b/src/new-name.tsx
@@ -3,0 +3,1 @@
+  const renamed = true;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.ok(!hunks.has("src/old-name.tsx"), "old path must not appear (no delete+add double count)");
  assert.deepStrictEqual(hunks.get("src/new-name.tsx"), [[3, 3]]);
});

test("parseUnifiedDiff: pure rename (no edits) yields empty ranges for new path", () => {
  const diff = `diff --git a/src/old-name.tsx b/src/new-name.tsx
similarity index 100%
rename from src/old-name.tsx
rename to src/new-name.tsx
`;
  const hunks = parseUnifiedDiff(diff);
  assert.ok(hunks.has("src/new-name.tsx"), "renamed file must be listed (visible in files scope)");
  assert.deepStrictEqual(hunks.get("src/new-name.tsx"), [], "no ranges (invisible in changed scope)");
});

test("parseUnifiedDiff: newly-added file — all lines counted as changed", () => {
  const diff = `diff --git a/src/brand-new.tsx b/src/brand-new.tsx
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/brand-new.tsx
@@ -0,0 +1,5 @@
+export function BrandNew() {
+  return <div>new</div>;
+}
+
+export default BrandNew;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/brand-new.tsx"), [[1, 5]]);
});

test("parseUnifiedDiff: binary file is skipped cleanly, no crash", () => {
  const diff = `diff --git a/assets/logo.png b/assets/logo.png
index 1111111..2222222 100644
Binary files a/assets/logo.png and b/assets/logo.png differ
`;
  assert.doesNotThrow(() => parseUnifiedDiff(diff));
  const hunks = parseUnifiedDiff(diff);
  assert.ok(hunks.has("assets/logo.png"), "binary file must be listed (files scope)");
  assert.deepStrictEqual(hunks.get("assets/logo.png"), [], "no ranges fabricated for binary file");
});

test("parseUnifiedDiff: pure-deletion hunk (+c,0) is skipped, no range added", () => {
  const diff = `diff --git a/src/foo.tsx b/src/foo.tsx
--- a/src/foo.tsx
+++ b/src/foo.tsx
@@ -10,3 +10,0 @@
-  const removed1 = 1;
-  const removed2 = 2;
-  const removed3 = 3;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/foo.tsx"), []);
});

test("parseUnifiedDiff: multiple files in one diff are each tracked independently", () => {
  const diff = `diff --git a/src/a.tsx b/src/a.tsx
--- a/src/a.tsx
+++ b/src/a.tsx
@@ -1,0 +1,2 @@
+line1
+line2
diff --git a/src/b.tsx b/src/b.tsx
--- a/src/b.tsx
+++ b/src/b.tsx
@@ -8,0 +9,1 @@
+line9
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/a.tsx"), [[1, 2]]);
  assert.deepStrictEqual(hunks.get("src/b.tsx"), [[9, 9]]);
});

// --- filterFindingsByScope ---------------------------------------------------

const SCOPE_FIXTURE_FINDINGS = [
  { file: "src/touched.tsx", line: 12, rule: "in-hunk", severity: "critical" },
  { file: "src/touched.tsx", line: 99, rule: "out-of-hunk-same-file", severity: "warn" },
  { file: "src/untouched.tsx", line: 5, rule: "untouched-file", severity: "major" },
];

function fixtureHunks() {
  return new Map([["src/touched.tsx", [[10, 15]]]]);
}

test("filterFindingsByScope: 'full' returns the same array reference (identity)", () => {
  const findings = SCOPE_FIXTURE_FINDINGS;
  const result = filterFindingsByScope(findings, "full", fixtureHunks(), { cwd: "/repo", repoToplevel: "/repo" });
  assert.strictEqual(result, findings, "full scope must return the identical array reference");
});

test("filterFindingsByScope: 'files' keeps whole-file findings, drops untouched files", () => {
  const result = filterFindingsByScope(SCOPE_FIXTURE_FINDINGS, "files", fixtureHunks(), {
    cwd: "/repo",
    repoToplevel: "/repo",
  });
  const rules = result.map((f) => f.rule).sort();
  assert.deepStrictEqual(rules, ["in-hunk", "out-of-hunk-same-file"]);
});

test("filterFindingsByScope: 'changed' excludes findings outside hunks, keeps in-hunk findings", () => {
  const result = filterFindingsByScope(SCOPE_FIXTURE_FINDINGS, "changed", fixtureHunks(), {
    cwd: "/repo",
    repoToplevel: "/repo",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].rule, "in-hunk");
});

test("filterFindingsByScope: normalizes cwd-relative paths for a subdirectory scan target", () => {
  // Simulates scanning from a subdirectory: scan()'s finding.file is relative
  // to process.cwd() (e.g. "touched.tsx" when cwd is "/repo/src"), while the
  // hunk map keys are always repo-relative ("src/touched.tsx"). The filter
  // must reconcile the two via repoToplevel.
  const subdirFindings = [
    { file: "touched.tsx", line: 12, rule: "in-hunk", severity: "critical" },
  ];
  const result = filterFindingsByScope(subdirFindings, "changed", fixtureHunks(), {
    cwd: "/repo/src",
    repoToplevel: "/repo",
  });
  assert.equal(result.length, 1, "finding must be matched after repo-relative normalization");
  assert.equal(result[0].rule, "in-hunk");
});

// --- resolveBaseRef ----------------------------------------------------------

test("resolveBaseRef: explicit base is verified and returned unchanged on success", () => {
  // HEAD always resolves inside this repo's working tree.
  const result = resolveBaseRef("HEAD", { cwd: __dirname });
  assert.equal(result, "HEAD");
});

test("resolveBaseRef: explicit base returns null when it cannot be verified (fallback trigger)", () => {
  const result = resolveBaseRef("this-ref-does-not-exist-anywhere-xyz", { cwd: __dirname });
  assert.equal(result, null);
});

test("resolveBaseRef: default resolution returns null outside a git work tree", () => {
  // /tmp is not (reliably) inside a git work tree; assert the non-git-repo
  // fallback path resolves to null without throwing.
  const result = resolveBaseRef(null, { cwd: "/tmp" });
  assert.doesNotThrow(() => resolveBaseRef(null, { cwd: "/tmp" }));
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Diff-scoped scanning — Phase 3/4 (PR 2 of detect-ci-integration)
// CLI wiring integration tests: --scope, --base, --fail-on, end-to-end via a
// real ephemeral git repo, plus the non-git fallback path. See design obs #869.
// ---------------------------------------------------------------------------

/**
 * Runs the CLI via execFileSync and returns { stdout, stderr, exitCode },
 * regardless of whether the process exited non-zero (execFileSync throws in
 * that case — this normalizes both paths into one shape for assertions).
 * @param {string[]} args
 * @param {{cwd?: string}} [opts]
 */
function runCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [DETECT_MJS, ...args], {
      encoding: "utf8",
      ...opts,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.status };
  }
}

/**
 * Builds a throwaway git repo in a fresh temp dir with a "main" branch
 * commit, then a second commit on top that both modifies an existing file
 * (adding a slop pattern in a fresh hunk) and touches an untouched-relative
 * file with a pre-existing (out-of-scope) slop pattern already committed on
 * main. Returns { dir, baseSha }.
 */
function buildScopeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-scope-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);

  // Base commit: one file with a pre-existing slop pattern (out-of-scope for
  // any diff against this base — it's already on main untouched by HEAD).
  fs.writeFileSync(
    path.join(dir, "preexisting.tsx"),
    `export function Old() {\n  return <div className="uppercase transition-all">OLD</div>;\n}\n`,
  );
  git(["add", "."]);
  git(["commit", "-q", "-m", "base"]);
  const baseSha = git(["rev-parse", "HEAD"]).trim();

  // HEAD commit: a brand-new file containing a slop pattern — this is the
  // only in-scope change vs baseSha.
  fs.writeFileSync(
    path.join(dir, "changed.tsx"),
    `export function New() {\n  return <div className="bg-gradient-to-r from-purple-500 to-cyan-500">NEW</div>;\n}\n`,
  );
  git(["add", "."]);
  git(["commit", "-q", "-m", "add changed file with slop"]);

  return { dir, baseSha };
}

test("integration: --scope changed reports only findings in the new file, not the pre-existing one", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const { stdout } = runCli([".", "--scope", "changed", "--base", baseSha, "--json"], { cwd: dir });
    const result = JSON.parse(stdout);
    const files = result.findings.map((f) => f.file);
    assert.ok(files.some((f) => f.includes("changed.tsx")), "must report finding in the new/changed file");
    assert.ok(
      !files.some((f) => f.includes("preexisting.tsx")),
      "must NOT report finding in the untouched pre-existing file",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --scope files vs --scope changed both exclude the untouched file", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    for (const scope of ["files", "changed"]) {
      const { stdout } = runCli([".", "--scope", scope, "--base", baseSha, "--json"], { cwd: dir });
      const result = JSON.parse(stdout);
      const files = result.findings.map((f) => f.file);
      assert.ok(
        !files.some((f) => f.includes("preexisting.tsx")),
        `--scope ${scope} must exclude untouched file`,
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --scope full (default) matches no-scope output (parity, byte-identical)", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const withFlag = runCli([".", "--scope", "full", "--base", baseSha, "--json"], { cwd: dir });
    const withoutFlag = runCli([".", "--json"], { cwd: dir });
    assert.deepStrictEqual(JSON.parse(withFlag.stdout), JSON.parse(withoutFlag.stdout));
    assert.equal(withFlag.exitCode, withoutFlag.exitCode, "exit codes must match too");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: non-git directory falls back to full scan with a stderr note, no crash", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-nogit-"));
  try {
    fs.writeFileSync(path.join(dir, "slop.tsx"), fs.readFileSync(SLOP_FIXTURE, "utf8"));
    const { stdout, stderr, exitCode } = runCli([".", "--scope", "changed", "--json"], { cwd: dir });
    const result = JSON.parse(stdout);
    assert.ok(result.findings.length > 0, "fallback must run a full scan (slop fixture has findings)");
    assert.equal(exitCode, 1, "fail-on default 'error' still applies to the unfiltered fallback set");
    assert.ok(stderr.includes("falling back to full scan"), "must emit fallback note on stderr");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --fail-on exit-code matrix over scope-filtered findings", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    // --fail-on none: always exits 0, even though the in-scope file has a
    // critical finding.
    let result = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--fail-on", "none", "--json"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 0, "--fail-on none must always exit 0");

    // --fail-on error with the critical finding in scope: exits 1.
    result = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--fail-on", "error", "--json"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 1, "--fail-on error must exit 1 when an in-scope critical finding exists");

    // --fail-on error, but the critical finding is entirely OUT of scope
    // (scope=changed against a base where nothing changed): exits 0.
    result = runCli(
      [".", "--scope", "changed", "--base", "HEAD", "--fail-on", "error", "--json"],
      { cwd: dir },
    );
    assert.equal(
      result.exitCode,
      0,
      "--fail-on error must exit 0 when the critical finding is filtered out by scope (base=HEAD, no diff)",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --sarif output reflects scope-filtered results, not raw findings", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const { stdout } = runCli([".", "--scope", "changed", "--base", baseSha, "--sarif"], { cwd: dir });
    const sarif = JSON.parse(stdout);
    const uris = sarif.runs[0].results.map((r) => r.locations[0].physicalLocation.artifactLocation.uri);
    assert.ok(uris.some((u) => u.includes("changed.tsx")), "SARIF must include the in-scope finding");
    assert.ok(!uris.some((u) => u.includes("preexisting.tsx")), "SARIF must exclude the out-of-scope finding");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --fail-on error with --scope files and errors outside touched files exits 0 (JSON still emitted)", () => {
  const { dir } = buildScopeFixtureRepo();
  try {
    // Diff against HEAD (nothing changed) to isolate the "errors exist, but
    // outside scope" case with --scope files.
    const { stdout, exitCode } = runCli(
      [".", "--scope", "files", "--base", "HEAD", "--fail-on", "error", "--json"],
      { cwd: dir },
    );
    const result = JSON.parse(stdout);
    assert.ok(result.findings, "JSON output must still be emitted");
    assert.equal(exitCode, 0, "exit code must be 0 — no in-scope errors when base=HEAD (no diff)");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: deleted file vs base — no crash, no fabricated findings", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-deleted-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  try {
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);

    fs.writeFileSync(
      path.join(dir, "to-delete.tsx"),
      `export function Gone() {\n  return <div className="uppercase">GONE</div>;\n}\n`,
    );
    git(["add", "."]);
    git(["commit", "-q", "-m", "base"]);
    const baseSha = git(["rev-parse", "HEAD"]).trim();

    fs.rmSync(path.join(dir, "to-delete.tsx"));
    git(["add", "."]);
    git(["commit", "-q", "-m", "delete file"]);

    let stdout;
    assert.doesNotThrow(() => {
      stdout = runCli(
        [".", "--scope", "changed", "--base", baseSha, "--json", "--fail-on", "none"],
        { cwd: dir },
      ).stdout;
    });
    const result = JSON.parse(stdout);
    assert.ok(
      !result.findings.some((f) => f.file.includes("to-delete.tsx")),
      "deleted file must not appear in findings",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Slice B — renderGHAWorkflow(config): pure function, no gh/network calls.
// gh api / gh pr comment invocations inside the generated bash step are
// intentionally NOT unit-tested here — untestable without a live PR. See
// the manual smoke-test checklist in tasks (Phase B2.4).
// ---------------------------------------------------------------------------

test("renderGHAWorkflow: default config interpolates scope/fail-on flags", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(
    yaml.includes(`--scope ${DEFAULT_GHA_CONFIG.scope} --fail-on ${DEFAULT_GHA_CONFIG.failOn}`),
    "pull_request scan step must use configured scope/fail-on",
  );
  assert.ok(
    yaml.includes("--scope full --fail-on error"),
    "push scan step must always use --scope full regardless of config.scope",
  );
});

test("renderGHAWorkflow: includes pull-requests: write permission with justification", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("pull-requests: write"), "must declare pull-requests: write");
  assert.ok(
    /needed to post\/update the sticky PR summary comment/.test(yaml),
    "pull-requests: write must carry a one-line justification comment",
  );
  assert.ok(!/write-all/.test(yaml), "must not grant broader permissions than required");
});

test("renderGHAWorkflow: includes config and version marker lines", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("# ui-craft-detect-config:"), "must emit config marker line");
  assert.ok(yaml.includes("# ui-craft-detect-version:"), "must emit version marker line");
});

test("renderGHAWorkflow: config marker JSON round-trips via JSON.parse exactly", () => {
  const config = { scope: "changed", failOn: "warning", comment: true, inlineComments: true, status: true };
  const yaml = renderGHAWorkflow(config);

  const markerLine = yaml
    .split("\n")
    .find((line) => line.startsWith("# ui-craft-detect-config:"));
  assert.ok(markerLine, "config marker line must be present");

  const jsonText = markerLine.slice("# ui-craft-detect-config:".length).trim();
  const parsed = JSON.parse(jsonText);
  assert.deepEqual(parsed, config, "parsed marker JSON must exactly match the input config");
});

test("renderGHAWorkflow: includes the sticky-comment step gated on pull_request", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(
    yaml.includes("Post or update sticky PR summary comment"),
    "must include the sticky-comment step",
  );
  assert.ok(yaml.includes("<!-- ui-craft-detect -->"), "must embed the hidden marker string");
  assert.ok(
    yaml.includes("github.event_name == 'pull_request'"),
    "sticky-comment step must be gated on pull_request events",
  );
});

test("renderGHAWorkflow: comment=false omits the sticky-comment step", () => {
  const yaml = renderGHAWorkflow({ ...DEFAULT_GHA_CONFIG, comment: false });

  assert.ok(
    !yaml.includes("Post or update sticky PR summary comment"),
    "sticky-comment step must be omitted when comment is false",
  );
  // Config marker still reflects the requested (comment:false) config exactly.
  assert.ok(yaml.includes('"comment":false'), "config marker must reflect comment:false");
});

test("renderGHAWorkflow: output has no tab characters and consistent top-level key ordering", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(!yaml.includes("\t"), "generated YAML must not contain tab characters");

  const topLevelKeys = yaml
    .split("\n")
    .filter((line) => /^[a-zA-Z_-]+:/.test(line))
    .map((line) => line.split(":")[0]);
  const nameIdx = topLevelKeys.indexOf("name");
  const onIdx = topLevelKeys.indexOf("on");
  const permissionsIdx = topLevelKeys.indexOf("permissions");
  const jobsIdx = topLevelKeys.indexOf("jobs");
  assert.ok(
    nameIdx < onIdx && onIdx < permissionsIdx && permissionsIdx < jobsIdx,
    "top-level keys must appear in a consistent order: name, on, permissions, jobs",
  );
});

// ---------------------------------------------------------------------------
// Slice C1 — commit-status step: pure-function assertions on renderGHAWorkflow
// output only. The actual `gh api .../statuses/{sha}` invocation is NOT
// unit-tested — untestable without a live push event. See the manual
// smoke-test checklist in tasks (Phase C1.5).
// ---------------------------------------------------------------------------

test("renderGHAWorkflow: status=true includes the commit-status step gated on non-pull_request", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("Publish commit status"), "must include the commit-status step");
  assert.ok(
    yaml.includes("statuses/${{ github.sha }}"),
    "must POST to the statuses endpoint for the current commit SHA",
  );
  assert.ok(
    yaml.includes('context="ui-craft-detect"'),
    "must use the resolved context string ui-craft-detect",
  );
  assert.ok(
    yaml.includes(
      "target_url=\"${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"",
    ),
    "must use the resolved target_url string",
  );
});

test("renderGHAWorkflow: commit-status step is gated on github.event_name != 'pull_request' and continue-on-error", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const stepIdx = yaml.indexOf("Publish commit status");
  assert.ok(stepIdx !== -1, "commit-status step must be present");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 400);

  assert.ok(
    stepBlock.includes("if: always() && github.event_name != 'pull_request'"),
    "commit-status step must be gated on non-pull_request events and run even if the scan step failed (always())",
  );
  assert.ok(
    stepBlock.includes("continue-on-error: true"),
    "commit-status step must not block the authoritative fail-on gate",
  );
});

test("renderGHAWorkflow: commit-status step reuses the push-scan JSON output, no dedicated scan invocation of its own", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  const stepIdx = yaml.indexOf("Publish commit status");
  assert.ok(stepIdx !== -1, "commit-status step must be present");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 400);

  assert.ok(
    !stepBlock.includes("npx --yes ui-craft-detect@latest"),
    "commit-status step must not invoke the scan CLI itself — it reads the push-scan step's JSON output",
  );
  assert.ok(
    stepBlock.includes("SCAN_JSON_FILE"),
    "commit-status step must read the push-scan step's captured JSON output",
  );
});

test("renderGHAWorkflow: includes statuses: write permission with justification when status is enabled", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("statuses: write"), "must declare statuses: write");
  assert.ok(
    /needed to publish the ui-craft-detect commit status/.test(yaml),
    "statuses: write must carry a one-line justification comment",
  );
});

test("renderGHAWorkflow: status=false omits the commit-status step and the statuses: write permission", () => {
  const yaml = renderGHAWorkflow({ ...DEFAULT_GHA_CONFIG, status: false });

  assert.ok(
    !yaml.includes("Publish commit status"),
    "commit-status step must be omitted when status is false",
  );
  assert.ok(
    !yaml.includes("statuses: write"),
    "statuses: write permission must be omitted when status is false",
  );
  // Config marker still reflects the requested (status:false) config exactly.
  assert.ok(yaml.includes('"status":false'), "config marker must reflect status:false");
});

// ---------------------------------------------------------------------------
// Slice C2 — renderReviewComments(findings, commitSha): pure function, no
// gh/network calls. Callers MUST feed already scope-filtered ("changed")
// findings — this function trusts its input and does not re-filter by hunk
// ranges. The actual `gh api .../reviews --input` invocation inside the
// generated bash step is NOT unit-tested — untestable without a live PR.
// ---------------------------------------------------------------------------

test("renderReviewComments: builds a single review with one comment per finding", () => {
  const findings = [
    { file: "src/a.tsx", line: 5, description: "transition: all", fix: "list specific properties" },
    { file: "src/b.tsx", line: 12, description: "ALL CAPS heading", fix: "use sentence case" },
  ];
  const review = renderReviewComments(findings, "abc123");

  assert.equal(review.commit_id, "abc123");
  assert.equal(review.event, "COMMENT");
  assert.equal(review.comments.length, 2);
});

test("renderReviewComments: each comment has path, line, side RIGHT, and a body derived from description+fix", () => {
  const findings = [
    { file: "src/a.tsx", line: 5, description: "transition: all", fix: "list specific properties" },
  ];
  const review = renderReviewComments(findings, "abc123");
  const [comment] = review.comments;

  assert.equal(comment.path, "src/a.tsx");
  assert.equal(comment.line, 5);
  assert.equal(comment.side, "RIGHT");
  assert.ok(comment.body.includes("transition: all"), "body must include the finding description");
  assert.ok(comment.body.includes("list specific properties"), "body must include the fix suggestion");
  assert.ok(!("position" in comment), "must not include the deprecated position field");
});

test("renderReviewComments: side is always RIGHT regardless of input order/count", () => {
  const findings = [
    { file: "a.tsx", line: 1, description: "d1", fix: "f1" },
    { file: "b.tsx", line: 2, description: "d2", fix: "f2" },
    { file: "a.tsx", line: 9, description: "d3", fix: "f3" },
  ];
  const review = renderReviewComments(findings, "sha");
  assert.ok(review.comments.every((c) => c.side === "RIGHT"), "every comment must have side: RIGHT");
});

test("renderReviewComments: multiple findings across multiple files all land in one review's comments array", () => {
  const findings = [
    { file: "a.tsx", line: 1, description: "d1", fix: "f1" },
    { file: "b.tsx", line: 2, description: "d2", fix: "f2" },
    { file: "a.tsx", line: 9, description: "d3", fix: "f3" },
  ];
  const review = renderReviewComments(findings, "sha");
  const files = review.comments.map((c) => c.path);
  assert.deepEqual(files, ["a.tsx", "b.tsx", "a.tsx"]);
  assert.equal(review.comments.length, 3, "one review, three comments — not three separate reviews");
});

test("renderReviewComments: empty findings array returns null (guard against pointless empty review)", () => {
  assert.equal(renderReviewComments([], "sha"), null);
});

test("renderReviewComments: does not filter by hunk ranges itself — trusts already-scoped input", () => {
  // A finding that would be "out of scope" for a real diff still produces a
  // comment here, because renderReviewComments is a pure payload builder,
  // not a scope filter. The CLI wiring (--scope changed -> filterFindingsByScope
  // -> renderReviewComments) is what guarantees only diff-visible findings
  // are ever passed in; this test documents that renderReviewComments does
  // not re-derive that guarantee on its own.
  const findings = [{ file: "untouched.tsx", line: 999, description: "d", fix: "f" }];
  const review = renderReviewComments(findings, "sha");
  assert.equal(review.comments.length, 1);
});

// ---------------------------------------------------------------------------
// Slice C2 — --review-json CLI flag (integration, real git repo + real CLI
// invocation, no gh/network calls).
// ---------------------------------------------------------------------------

test("integration: --review-json requires --scope changed, else exits 2 with an error", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const { stderr, exitCode } = runCli([".", "--review-json", "--base", baseSha], { cwd: dir });
    assert.equal(exitCode, 2);
    assert.ok(/requires --scope changed/.test(stderr), "must explain the --scope changed requirement");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --review-json with --scope changed emits a Reviews API payload for the new file only", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const { stdout, exitCode } = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--review-json", "--commit-sha", "deadbeef", "--fail-on", "none"],
      { cwd: dir },
    );
    assert.equal(exitCode, 0);
    const review = JSON.parse(stdout);
    assert.equal(review.commit_id, "deadbeef");
    assert.equal(review.event, "COMMENT");
    assert.ok(review.comments.length > 0, "must include at least one comment for the new/changed file");
    assert.ok(
      review.comments.every((c) => c.path.includes("changed.tsx")),
      "must only include comments for the new/changed file, not the pre-existing untouched one",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --review-json defaults commit_id to HEAD when --commit-sha is omitted", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
    const { stdout, exitCode } = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--review-json", "--fail-on", "none"],
      { cwd: dir },
    );
    assert.equal(exitCode, 0);
    const review = JSON.parse(stdout);
    assert.equal(review.commit_id, headSha);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --review-json prints null when no findings survive --scope changed filtering", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-reviewjson-empty-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  try {
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(dir, "clean.ts"), "export const x = 1;\n");
    git(["add", "."]);
    git(["commit", "-q", "-m", "base"]);
    const baseSha = git(["rev-parse", "HEAD"]).trim();
    fs.writeFileSync(path.join(dir, "clean.ts"), "export const x = 2;\n");
    git(["add", "."]);
    git(["commit", "-q", "-m", "still clean"]);

    const { stdout, exitCode } = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--review-json", "--fail-on", "none"],
      { cwd: dir },
    );
    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "null");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Slice C2 — inline-comments bash step inside renderGHAWorkflow. Pure-function
// assertions on the generated YAML string only; the `gh api .../reviews`
// invocation itself is NOT unit-tested — untestable without a live PR. See
// the manual smoke-test checklist in tasks (Phase C2).
// ---------------------------------------------------------------------------

test("renderGHAWorkflow: inlineComments=true includes the inline-review-comments step gated on pull_request", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("Post inline review comments"), "must include the inline-comments step");
  assert.ok(
    yaml.includes("if: always() && github.event_name == 'pull_request'"),
    "inline-comments step must be gated on pull_request and run even if the scan step failed (always())",
  );
});

test("renderGHAWorkflow: inline-comments step invokes --review-json with --scope changed and pipes to gh api --input", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const stepIdx = yaml.indexOf("Post inline review comments");
  assert.ok(stepIdx !== -1, "inline-comments step must be present");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 900);

  assert.ok(
    stepBlock.includes("--scope changed") && stepBlock.includes("--review-json"),
    "must invoke the CLI with --scope changed --review-json to build the payload",
  );
  assert.ok(
    stepBlock.includes("gh api --method POST") && stepBlock.includes("/reviews") && stepBlock.includes("--input"),
    "must POST the payload to the pulls/{pr}/reviews endpoint via --input (full JSON body from file), not -f/-F field flags",
  );
  assert.ok(
    !/--input.*-f |{ -f .*reviews/.test(stepBlock),
    "must not mix --input with -f/-F field flags for the reviews POST",
  );
});

test("renderGHAWorkflow: inline-comments step has continue-on-error: true", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const stepIdx = yaml.indexOf("Post inline review comments");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 300);

  assert.ok(
    stepBlock.includes("continue-on-error: true"),
    "a 422 (force-push drift, renamed files) must never fail the job — the separate fail-on-derived scan step is the sole gate",
  );
});

test("renderGHAWorkflow: inline-comments step skips posting when the payload has zero comments", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const stepIdx = yaml.indexOf("Post inline review comments");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 900);

  assert.ok(
    /COMMENT_COUNT/.test(stepBlock) && /skipping review comment post/.test(stepBlock),
    "must guard against posting an empty/pointless review when no findings survive scope filtering",
  );
});

test("renderGHAWorkflow: inlineComments=false omits the inline-comments step (no new permission needed either way)", () => {
  const yaml = renderGHAWorkflow({ ...DEFAULT_GHA_CONFIG, inlineComments: false });

  assert.ok(
    !yaml.includes("Post inline review comments"),
    "inline-comments step must be omitted when inlineComments is false",
  );
  // pull-requests: write is already granted by Slice B for the sticky
  // comment; the Reviews API needs the same permission, no new grant.
  assert.ok(yaml.includes("pull-requests: write"), "pull-requests: write must remain present regardless");
  assert.ok(yaml.includes('"inlineComments":false'), "config marker must reflect inlineComments:false");
});

test("renderGHAWorkflow: pull-requests: write permission is not duplicated for the Reviews API — same grant as the sticky comment", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const occurrences = yaml.split("pull-requests: write").length - 1;
  assert.equal(occurrences, 1, "pull-requests: write must be declared exactly once, covering both sticky comment and Reviews API");
});

test("CLI entry guard: main() still runs when invoked through a symlink (npx/npm bin resolution)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-symlink-"));
  const binDir = path.join(dir, "node_modules", ".bin");
  fs.mkdirSync(binDir, { recursive: true });
  const symlinkPath = path.join(binDir, "ui-craft-detect");
  fs.symlinkSync(DETECT_MJS, symlinkPath);

  try {
    const stdout = execFileSync(process.execPath, [symlinkPath, "--version"], { encoding: "utf8" });
    assert.match(
      stdout,
      /^ui-craft-detect v\d+\.\d+\.\d+/,
      "main() must run (and print the version) when detect.mjs is invoked via a symlink, not silently exit 0",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("renderGHAWorkflow: checkout uses fetch-depth: 0 so --scope changed/files can resolve a merge-base in CI", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(
    /fetch-depth:\s*0/.test(yaml),
    "default (depth-1) checkout has no history for merge-base resolution — --scope would always fall back to full scan in real CI, and inline-comments would 422 the whole review batch on out-of-diff findings",
  );
});
