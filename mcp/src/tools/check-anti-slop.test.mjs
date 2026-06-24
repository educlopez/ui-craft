/**
 * check-anti-slop.test.mjs
 * Tests for the check_anti_slop tool.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAntiSlop } from './check-anti-slop.mjs';

// Known anti-slop pattern: purple-cyan gradient
const SLOP_CODE = `
export default function Hero() {
  return (
    <div className="bg-gradient-to-r from-purple-500 to-cyan-500 transition-all">
      <h1 className="text-white uppercase">WELCOME TO OUR PLATFORM</h1>
      <button className="bg-blue-500">GET STARTED</button>
    </div>
  );
}
`;

// Clean code: no anti-slop patterns
const CLEAN_CODE = `
export default function Card({ title, value }) {
  return (
    <div className="bg-surface-raised rounded-lg p-4 shadow-md">
      <p className="text-secondary text-sm">{title}</p>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
`;

test('check_anti_slop: slop code → findings.length > 0 with correct rule', async () => {
  const result = await checkAntiSlop({ code: SLOP_CODE });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.ok(Array.isArray(result.findings), 'findings should be array');
  assert.ok(result.findings.length > 0, `Expected findings but got 0`);
  assert.equal(result.summary.total, result.findings.length, 'summary.total should match findings count');

  // Check that at least one finding references the gradient rule
  const hasGradient = result.findings.some(
    (f) => f.rule && f.rule.toLowerCase().includes('gradient')
  );
  assert.ok(hasGradient, `Expected a gradient-related finding, got rules: ${result.findings.map(f => f.rule).join(', ')}`);
});

test('check_anti_slop: clean code → empty findings', async () => {
  const result = await checkAntiSlop({ code: CLEAN_CODE });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.ok(Array.isArray(result.findings), 'findings should be array');
  assert.equal(result.findings.length, 0, `Expected 0 findings but got ${result.findings.length}: ${JSON.stringify(result.findings)}`);
  assert.equal(result.summary.total, 0);
});

test('check_anti_slop: findings have required fields', async () => {
  const result = await checkAntiSlop({ code: SLOP_CODE });

  assert.ok(result.findings.length > 0, 'Need at least one finding for field check');
  const f = result.findings[0];
  assert.ok('severity' in f, 'finding must have severity');
  assert.ok('rule' in f, 'finding must have rule');
  assert.ok('file' in f, 'finding must have file');
  assert.ok('message' in f, 'finding must have message');
});

test('check_anti_slop: inline code file field is <inline>', async () => {
  const result = await checkAntiSlop({ code: SLOP_CODE });

  assert.ok(result.findings.length > 0, 'Need findings');
  for (const f of result.findings) {
    assert.equal(f.file, '<inline>', `file should be '<inline>' for code input, got '${f.file}'`);
  }
});

test('check_anti_slop: bad input (no code, no path) → structured error, no crash', async () => {
  const result = await checkAntiSlop({});

  assert.ok(result.error, 'Should have error field');
  assert.ok(Array.isArray(result.findings), 'findings should be array even on error');
  assert.equal(result.findings.length, 0);
  assert.equal(result.summary.total, 0);
});

test('check_anti_slop: nonexistent path → structured error, no crash', async () => {
  const result = await checkAntiSlop({ path: '/nonexistent/path/that/does/not/exist.tsx' });

  // May succeed with 0 findings or return an error — either way, no throw
  assert.ok(Array.isArray(result.findings), 'findings should be array');
  assert.equal(typeof result.summary.total, 'number');
});

// Fix 4: empty string code is valid input → 0 findings, no error
test('check_anti_slop: code: "" (empty string) → 0 findings, no error (fix 4)', async () => {
  const result = await checkAntiSlop({ code: '' });

  assert.ok(!result.error, `Should not error on empty string: ${result.error}`);
  assert.ok(Array.isArray(result.findings), 'findings should be array');
  assert.equal(result.findings.length, 0, `Expected 0 findings for empty input`);
  assert.equal(result.summary.total, 0);
});
