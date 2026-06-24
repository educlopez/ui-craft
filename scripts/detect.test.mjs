// detect.test.mjs — CLI parity + scan() unit tests
// Uses node:test and node:assert (zero external deps).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { scan } from "./detect.mjs";

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
