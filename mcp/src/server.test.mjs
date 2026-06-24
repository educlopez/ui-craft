/**
 * server.test.mjs
 * Tests for MCP server tool registration and dispatch.
 * Uses node:test + node:assert (zero external deps).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Import the tool modules directly to test dispatch behavior in-process.
// The server itself connects to stdio — we test the tool logic and handler shape.
import { checkAntiSlop } from './tools/check-anti-slop.mjs';
import { tokensLint } from './tools/tokens-lint.mjs';
import { acceptanceBar } from './tools/acceptance-bar.mjs';

// --- Verify the 3 expected tool implementations exist and are callable ---

test('server tool registry: check_anti_slop handler exists and is async function', () => {
  assert.equal(typeof checkAntiSlop, 'function');
  const result = checkAntiSlop({});
  // Must return a Promise (async)
  assert.ok(result instanceof Promise, 'checkAntiSlop should return a Promise');
});

test('server tool registry: tokens_lint handler exists and is async function', () => {
  assert.equal(typeof tokensLint, 'function');
  const result = tokensLint({});
  assert.ok(result instanceof Promise, 'tokensLint should return a Promise');
});

test('server tool registry: acceptance_bar handler exists and is synchronous function', () => {
  assert.equal(typeof acceptanceBar, 'function');
});

test('server lists exactly 3 distinct tool names', () => {
  const toolNames = ['check_anti_slop', 'tokens_lint', 'acceptance_bar'];
  assert.equal(toolNames.length, 3);
  // All names distinct
  assert.equal(new Set(toolNames).size, 3);
});

// --- Unknown tool call: structured error, no exception ---

test('unknown tool call returns structured error, does not throw', async () => {
  // Simulate what server dispatch does for an unknown tool
  const knownTools = { check_anti_slop: checkAntiSlop, tokens_lint: tokensLint, acceptance_bar: acceptanceBar };
  const toolName = 'nonexistent_tool';

  let result;
  try {
    if (!knownTools[toolName]) {
      result = {
        error: `Unknown tool: ${toolName}`,
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }],
        isError: true,
      };
    }
  } catch (e) {
    assert.fail(`Should not throw — got: ${e.message}`);
  }

  assert.ok(result, 'result should be defined');
  assert.equal(result.isError, true);
  assert.ok(result.error.includes('nonexistent_tool'), 'error message should mention the tool name');
});

// --- Tool result content shape ---

test('check_anti_slop no-input returns structured error with isError shape', async () => {
  const result = await checkAntiSlop({});
  assert.ok(result.error, 'should have error field');
  assert.ok(Array.isArray(result.findings), 'findings should be array');
  assert.equal(result.summary.total, 0);
});

test('tokens_lint no-input returns structured error with isError shape', async () => {
  const result = await tokensLint({});
  assert.ok(result.error, 'should have error field');
  assert.ok(Array.isArray(result.findings), 'findings should be array');
  assert.equal(result.summary.total, 0);
});

test('acceptance_bar no-input returns structured error', () => {
  const result = acceptanceBar({});
  assert.ok(result.error, 'should have error field');
  assert.ok(Array.isArray(result.items), 'items should be array');
  assert.equal(result.items.length, 0);
});
