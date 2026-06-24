/**
 * tokens-lint.test.mjs
 * Tests for the tokens_lint tool.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokensLint } from './tokens-lint.mjs';

// Code with off-system color and radius
const COLOR_AND_RADIUS_CODE = `
.card {
  color: #3b82f6;
  border-radius: 7px;
}
`;

// CSS using custom properties (compliant)
const COMPLIANT_CSS = `
.card {
  color: var(--accent-500);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}
`;

// Code with off-system spacing
const SPACING_CODE = `
.section {
  padding: 7px;
  margin: 20px;
}
`;

// Code with magic z-index
const Z_INDEX_CODE = `
.modal {
  z-index: 999;
}
`;

// Code defining CSS custom properties (allowed — these ARE the tokens)
const CSS_PROP_DEF = `
:root {
  --brand-blue: #3b82f6;
  --radius-card: 7px;
}
`;

test('tokens_lint: off-system color #3b82f6 → finding with rule tokens/color', async () => {
  const result = await tokensLint({ code: COLOR_AND_RADIUS_CODE });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.ok(Array.isArray(result.findings), 'findings should be array');

  const colorFinding = result.findings.find((f) => f.rule === 'tokens/color');
  assert.ok(colorFinding, `Expected tokens/color finding, got: ${result.findings.map(f => f.rule).join(', ')}`);
  assert.ok(colorFinding.message || colorFinding.snippet, 'finding should have snippet or message');
});

test('tokens_lint: off-system border-radius 7px → finding with rule tokens/radius', async () => {
  const result = await tokensLint({ code: COLOR_AND_RADIUS_CODE });

  const radiusFinding = result.findings.find((f) => f.rule === 'tokens/radius');
  assert.ok(radiusFinding, `Expected tokens/radius finding, got: ${result.findings.map(f => f.rule).join(', ')}`);
});

test('tokens_lint: compliant CSS custom properties → empty findings', async () => {
  const result = await tokensLint({ code: COMPLIANT_CSS });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.equal(result.findings.length, 0, `Expected 0 findings but got ${result.findings.length}: ${JSON.stringify(result.findings)}`);
  assert.equal(result.summary.total, 0);
});

test('tokens_lint: off-system spacing → finding with rule tokens/spacing', async () => {
  const result = await tokensLint({ code: SPACING_CODE });

  assert.ok(!result.error);
  const spacingFinding = result.findings.find((f) => f.rule === 'tokens/spacing');
  assert.ok(spacingFinding, `Expected tokens/spacing finding`);
});

test('tokens_lint: magic z-index 999 → finding with rule tokens/z-index', async () => {
  const result = await tokensLint({ code: Z_INDEX_CODE });

  assert.ok(!result.error);
  const zFinding = result.findings.find((f) => f.rule === 'tokens/z-index');
  assert.ok(zFinding, `Expected tokens/z-index finding`);
});

test('tokens_lint: summary fields match findings array', async () => {
  const result = await tokensLint({ code: COLOR_AND_RADIUS_CODE });

  assert.equal(result.summary.total, result.findings.length, 'summary.total should match findings length');
  const errors = result.findings.filter(f => f.severity === 'error').length;
  const warnings = result.findings.filter(f => f.severity === 'warning').length;
  assert.equal(result.summary.errors, errors);
  assert.equal(result.summary.warnings, warnings);
});

test('tokens_lint: bad input (no code, no path) → structured error, no crash', async () => {
  const result = await tokensLint({});

  assert.ok(result.error, 'Should have error field');
  assert.ok(Array.isArray(result.findings), 'findings should be array');
  assert.equal(result.findings.length, 0);
  assert.equal(result.summary.total, 0);
});

test('tokens_lint: CSS custom property definitions are not flagged as off-system', async () => {
  // Lines defining --var: #hex should not be flagged (they ARE the token)
  const result = await tokensLint({ code: CSS_PROP_DEF });

  assert.ok(!result.error);
  // Color findings should be 0 (property definitions are excluded)
  const colorFindings = result.findings.filter((f) => f.rule === 'tokens/color');
  assert.equal(colorFindings.length, 0, `CSS custom property definitions should not be flagged`);
});
