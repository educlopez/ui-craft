/**
 * score-ui.test.mjs
 * Tests for the score_ui MCP tool.
 * Covers: slop input → low score, clean input → high score, bad input → structured error,
 * path input → within baseline band, and parity with direct scoreUI() call.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { scoreUiTool } from './score-ui.mjs';
import { scoreUI } from '../../../evals/quality/score.mjs';

// Resolve fixture paths relative to this file (fixtures live 3 dirs up from mcp/src/tools/)
// __dirname = .../ui-craft/mcp/src/tools → ../../../ = .../ui-craft (repo root)
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const FIXTURES_DESIGNER = join(REPO_ROOT, 'evals', 'quality', 'fixtures', 'designer');
const FIXTURES_SLOP = join(REPO_ROOT, 'evals', 'quality', 'fixtures', 'slop');

// ─── Test fixtures ────────────────────────────────────────────────────────────

// Slop snippet: intentional violations across all 3 dims
// - transition-all (anti-slop/transition-all)
// - raw hex color (tokens/color)
// - img without alt (a11y/img-no-alt)
// - div onClick without role/tabIndex (a11y/non-semantic-interactive)
// - purple-cyan gradient (anti-slop/gradient)
const SLOP_CODE = `
export default function SlopHero() {
  return (
    <div
      className="bg-gradient-to-r from-purple-500 to-cyan-500 transition-all"
      style={{ background: '#ff00ff' }}
      onClick={() => console.log('clicked')}
    >
      <img src="/hero.png" />
      <h1 className="uppercase text-white">WELCOME TO OUR PLATFORM</h1>
      <span tabIndex={3} className="cursor-pointer">Click me</span>
    </div>
  );
}
`;

// Clean snippet: no violations in any dim
const CLEAN_CODE = `
export default function CleanCard({ title, value }) {
  return (
    <article className="bg-surface-raised rounded-lg p-4 shadow-sm">
      <img src="/icon.png" alt="dashboard icon" />
      <p className="text-secondary text-sm">{title}</p>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <button type="button" className="btn-primary" onClick={() => {}}>
        View details
      </button>
    </article>
  );
}
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

test('score_ui: slop code → overall score < 70 (low quality, grade C or below)', async () => {
  const result = await scoreUiTool({ code: SLOP_CODE });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.ok(typeof result.overall?.score === 'number', 'overall.score should be a number');
  assert.ok(result.overall.score < 70, `Expected score < 70 for slop, got ${result.overall.score}`);
  assert.ok(typeof result.overall.grade === 'string', 'overall.grade should be a string');
  // Should not be an A or B grade
  assert.ok(!['A', 'B'].includes(result.overall.grade), `Expected grade C or below for slop, got ${result.overall.grade}`);
});

test('score_ui: clean code → overall score >= 80 (high quality)', async () => {
  const result = await scoreUiTool({ code: CLEAN_CODE });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.ok(typeof result.overall?.score === 'number', 'overall.score should be a number');
  assert.ok(result.overall.score >= 80, `Expected score >= 80 for clean code, got ${result.overall.score}`);
});

test('score_ui: result has required envelope shape', async () => {
  const result = await scoreUiTool({ code: CLEAN_CODE });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  // overall
  assert.ok('overall' in result, 'result must have overall');
  assert.ok('score' in result.overall, 'overall must have score');
  assert.ok('grade' in result.overall, 'overall must have grade');
  // dimensions
  assert.ok('dimensions' in result, 'result must have dimensions');
  assert.ok('anti_slop' in result.dimensions, 'dimensions must have anti_slop');
  assert.ok('token_discipline' in result.dimensions, 'dimensions must have token_discipline');
  assert.ok('a11y' in result.dimensions, 'dimensions must have a11y');
  // each dim has score + findings
  for (const dim of ['anti_slop', 'token_discipline', 'a11y']) {
    assert.ok('score' in result.dimensions[dim], `${dim} must have score`);
    assert.ok(Array.isArray(result.dimensions[dim].findings), `${dim}.findings must be array`);
  }
  // version
  assert.ok('version' in result, 'result must have version');
  assert.equal(result.version, '0.30.0');
});

test('score_ui: bad input (no code, no path) → structured error, no crash', async () => {
  const result = await scoreUiTool({});

  assert.ok(result.error, `Should have error field, got: ${JSON.stringify(result)}`);
  assert.ok(typeof result.error === 'string', 'error should be a string');
  assert.ok(!result.overall, 'should not have overall on error');
});

test('score_ui: undefined input → structured error, no crash', async () => {
  const result = await scoreUiTool(undefined);

  assert.ok(result.error, `Should have error field`);
  assert.ok(typeof result.error === 'string');
});

test('score_ui: slop code → slop dim has findings', async () => {
  const result = await scoreUiTool({ code: SLOP_CODE });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  // At least one dimension should have findings given the slop code
  const totalFindings =
    result.dimensions.anti_slop.findings.length +
    result.dimensions.token_discipline.findings.length +
    result.dimensions.a11y.findings.length;
  assert.ok(totalFindings > 0, `Expected findings in slop code, got 0 across all dims`);
});

test('score_ui: parity with direct scoreUI() call (code input)', async () => {
  // Both the tool wrapper and direct scoreUI should return byte-identical JSON
  const toolResult = await scoreUiTool({ code: CLEAN_CODE });
  const directResult = await scoreUI({ code: CLEAN_CODE });

  assert.equal(
    JSON.stringify(toolResult),
    JSON.stringify(directResult),
    'scoreUiTool and scoreUI should produce identical output for same code input'
  );
});

test('score_ui: path input → score within baseline band for designer fixture', async () => {
  // Use a known designer fixture (absolute path) that should score >= 90
  const fixturePath = join(FIXTURES_DESIGNER, 'clean-card.tsx');
  const result = await scoreUiTool({ path: fixturePath });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.ok(result.overall.score >= 90, `Expected score >= 90 for designer fixture, got ${result.overall.score}`);
  assert.ok(result.overall.score <= 100, `Score should not exceed 100, got ${result.overall.score}`);
});

test('score_ui: path input → score within baseline band for slop fixture', async () => {
  // Use a known slop fixture (absolute path) that should score low
  const fixturePath = join(FIXTURES_SLOP, 'all-violations.tsx');
  const result = await scoreUiTool({ path: fixturePath });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.ok(result.overall.score <= 15, `Expected score <= 15 for all-violations slop, got ${result.overall.score}`);
});

test('score_ui: nonexistent path → structured error, no crash', async () => {
  const result = await scoreUiTool({ path: '/nonexistent/path/that/does/not/exist.tsx' });

  // scoreUI returns { error: '...' } for unreadable paths
  assert.ok(result.error, `Expected error field for nonexistent path`);
  assert.ok(typeof result.error === 'string');
  assert.ok(!result.overall, 'should not have overall on error');
});
