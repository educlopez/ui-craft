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

// Fix 1: hex after url(//cdn...) must still be flagged (url // is not a line comment)
test('tokens_lint: hex after url(//cdn...) is correctly flagged (fix 1 false-negative)', async () => {
  const code = `
.card {
  background: url(//cdn.example.com/x); color: #ff0000;
}
`;
  const result = await tokensLint({ code });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  const colorFindings = result.findings.filter((f) => f.rule === 'tokens/color');
  assert.ok(colorFindings.length > 0, `Expected tokens/color finding for #ff0000 after url(//cdn...), got 0`);
});

// Fix 2: hex inside /* ... */ block comment must NOT be flagged
test('tokens_lint: hex inside block comment is not flagged (fix 2 false-positive)', async () => {
  const code = `
/*
 * fallback: #ff0000
 * also: #3b82f6
 */
.card {
  color: var(--accent-500);
}
`;
  const result = await tokensLint({ code });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  const colorFindings = result.findings.filter((f) => f.rule === 'tokens/color');
  assert.equal(colorFindings.length, 0, `Hex values inside block comments should not be flagged, got: ${JSON.stringify(colorFindings)}`);
});

// Fix 3: padding: 0px must NOT be flagged
test('tokens_lint: padding: 0px is not flagged (fix 3)', async () => {
  const code = `
.card {
  padding: 0px;
  margin: 0px;
}
`;
  const result = await tokensLint({ code });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  const spacingFindings = result.findings.filter((f) => f.rule === 'tokens/spacing');
  assert.equal(spacingFindings.length, 0, `padding: 0px and margin: 0px should not be flagged, got: ${JSON.stringify(spacingFindings)}`);
});

// Fix 4: empty string code is valid input → 0 findings, no error
test('tokens_lint: code: "" (empty string) → 0 findings, no error (fix 4)', async () => {
  const result = await tokensLint({ code: '' });

  assert.ok(!result.error, `Should not error on empty string: ${result.error}`);
  assert.ok(Array.isArray(result.findings), 'findings should be array');
  assert.equal(result.findings.length, 0, `Expected 0 findings for empty input`);
  assert.equal(result.summary.total, 0);
});
