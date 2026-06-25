/**
 * score.mjs
 * UICraftScore — composite design-quality scorer.
 * Composes three deterministic dimensions into a single 0-100 score + letter grade.
 *
 * Dimensions:
 *   anti_slop      → scan()       from scripts/detect.mjs
 *   token_discipline → scanTokens() from mcp/src/tokens-rules.mjs
 *   a11y           → scanA11y()   from ./a11y-static.mjs
 *
 * This score is DETERMINISTIC and reproducible by design — identical input
 * always yields the identical score. The judged usability dimension
 * (UsabilityScore) deliberately lives OUTSIDE this module: it is host-agent
 * judgment via the rubric in references/heuristics.md, surfaced by the
 * /heuristic command. The two compose in an "extended report" but are never
 * averaged — collapsing reproducible + judged would hide the distinction
 * this module exists to guarantee.
 *
 * Zero external deps. Node 18+.
 */

import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';

import { scan } from '../../scripts/detect.mjs';
import { scanTokens } from '../../mcp/src/tokens-rules.mjs';
import { scanA11y } from './a11y-static.mjs';

export const EVAL_VERSION = '0.30.0';

/**
 * Penalty weights per severity per dimension.
 * Exported for tests and the published formula claim.
 */
export const WEIGHTS = {
  anti_slop: { critical: 8, major: 4, warn: 1 },
  token_discipline: { per_finding: 2 }, // flat: error or warning both count -2
  a11y: { critical: 8, major: 4 },
};

/**
 * Letter-grade thresholds (inclusive lower bound).
 * Exported for tests and published formula claim.
 */
export const GRADE_BANDS = [
  { grade: 'A', min: 90 },
  { grade: 'B', min: 80 },
  { grade: 'C', min: 70 },
  { grade: 'D', min: 60 },
  { grade: 'F', min: 0 },
];

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

function toGrade(score) {
  for (const band of GRADE_BANDS) {
    if (score >= band.min) return band.grade;
  }
  return 'F';
}

/**
 * Score UI source code or a file path.
 *
 * @param {string | { code?: string, path?: string }} input
 *   - bare string → treated as a file path
 *   - { code }   → scan the code string
 *   - { path }   → scan the file at path
 * @returns {Promise<{
 *   overall: { score: number, grade: string },
 *   dimensions: {
 *     anti_slop: { score: number, findings: Array },
 *     token_discipline: { score: number, findings: Array },
 *     a11y: { score: number, findings: Array }
 *   },
 *   version: string
 * } | { error: string }>}
 */
export async function scoreUI(input) {
  // ─── Normalize input ─────────────────────────────────────────────────────
  let code = undefined;
  let filePath = undefined;

  if (typeof input === 'string') {
    filePath = input;
  } else if (input && typeof input === 'object') {
    code = input.code;
    filePath = input.path;
  }

  // Edge case: empty string → score 100, no findings
  if (code !== undefined && code === '') {
    return _buildResult([], [], [], EVAL_VERSION);
  }

  // Edge case: no input
  if (code === undefined && !filePath) {
    return { error: 'Input required: provide either code (string) or path (file path)' };
  }

  // ─── Resolve code string for scanTokens + scanA11y ───────────────────────
  let codeStr;
  let tempFile = null;
  let targetForScan;

  if (code !== undefined) {
    // For scan() (detect.mjs), we need a real file on disk — use temp file pattern
    // from check-anti-slop.mjs (proven, deterministic)
    const id = randomBytes(8).toString('hex');
    tempFile = join(tmpdir(), `ui-craft-eval-${id}.tsx`);
    try {
      writeFileSync(tempFile, code, 'utf8');
    } catch (e) {
      return { error: `Failed to write temporary file: ${e.message}` };
    }
    codeStr = code;
    targetForScan = tempFile;
  } else {
    // filePath mode — read the file content for scanTokens + scanA11y
    targetForScan = filePath;
    try {
      codeStr = await fs.readFile(resolvePath(filePath), 'utf8');
    } catch (e) {
      return { error: `Cannot read file "${filePath}": ${e.message}` };
    }
  }

  // ─── Run all three scanners ───────────────────────────────────────────────
  let antiSlopFindings = [];
  let tokenFindings = [];
  let a11yFindings = [];

  try {
    // 1. Anti-slop via scan()
    // Pass config:{} (empty, no ignore rules) so .uicraftrc.json ignore patterns
    // don't suppress findings — scoreUI always evaluates the file as-is.
    let scanResult;
    try {
      scanResult = await scan(targetForScan, { config: {} });
    } catch (e) {
      scanResult = { findings: [] };
    }
    antiSlopFindings = Array.isArray(scanResult?.findings) ? scanResult.findings : [];

    // 2. Token discipline via scanTokens()
    tokenFindings = scanTokens(codeStr);

    // 3. Static a11y
    a11yFindings = scanA11y(codeStr);
  } finally {
    // Always clean up temp file
    if (tempFile) {
      try { unlinkSync(tempFile); } catch {}
    }
  }

  return _buildResult(antiSlopFindings, tokenFindings, a11yFindings, EVAL_VERSION);
}

/**
 * Build the result envelope from raw findings arrays.
 * Exported for testing (allows injecting known finding sets without real files).
 *
 * @param {Array} antiSlopRaw - findings from scan() (severity: critical|major|warn)
 * @param {Array} tokensRaw   - findings from scanTokens() (severity: error|warning)
 * @param {Array} a11yRaw     - findings from scanA11y() (severity: critical|major)
 * @param {string} version
 */
export function _buildResult(antiSlopRaw, tokensRaw, a11yRaw, version) {
  // ─── Anti-slop dimension ──────────────────────────────────────────────────
  let antiSlopPenalty = 0;
  for (const f of antiSlopRaw) {
    if (f.severity === 'critical') antiSlopPenalty += WEIGHTS.anti_slop.critical;
    else if (f.severity === 'major') antiSlopPenalty += WEIGHTS.anti_slop.major;
    else if (f.severity === 'warn') antiSlopPenalty += WEIGHTS.anti_slop.warn;
  }
  const antiSlopScore = clamp(100 - antiSlopPenalty);
  const antiSlopFindings = antiSlopRaw.map(f => ({
    rule: f.rule ?? f.description ?? 'unknown',
    severity: f.severity,
    message: f.description ?? f.message ?? f.rule ?? '',
  }));

  // ─── Token-discipline dimension ───────────────────────────────────────────
  // Flat -2 per finding (both error and warning severities)
  const tokenPenalty = tokensRaw.length * WEIGHTS.token_discipline.per_finding;
  const tokenScore = clamp(100 - tokenPenalty);
  const tokenFindings = tokensRaw.map(f => ({
    rule: f.rule ?? 'unknown',
    severity: 'major', // normalized output severity (spec schema)
    message: f.fix ?? f.snippet ?? '',
  }));

  // ─── A11y dimension ───────────────────────────────────────────────────────
  let a11yPenalty = 0;
  for (const f of a11yRaw) {
    if (f.severity === 'critical') a11yPenalty += WEIGHTS.a11y.critical;
    else if (f.severity === 'major') a11yPenalty += WEIGHTS.a11y.major;
  }
  const a11yScore = clamp(100 - a11yPenalty);
  const a11yFindings = a11yRaw.map(f => ({
    rule: f.rule,
    severity: f.severity,
    message: f.fix ?? f.snippet ?? '',
  }));

  // ─── Composite score ──────────────────────────────────────────────────────
  const overallScore = clamp(100 - antiSlopPenalty - tokenPenalty - a11yPenalty);
  const grade = toGrade(overallScore);

  return {
    overall: { score: overallScore, grade },
    dimensions: {
      anti_slop: { score: antiSlopScore, findings: antiSlopFindings },
      token_discipline: { score: tokenScore, findings: tokenFindings },
      a11y: { score: a11yScore, findings: a11yFindings },
    },
    version,
  };
}
