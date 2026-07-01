// detect.test.mjs — CLI parity + scan() unit tests
// Uses node:test and node:assert (zero external deps).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  scan,
  parseUnifiedDiff,
  filterFindingsByScope,
  resolveBaseRef,
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
