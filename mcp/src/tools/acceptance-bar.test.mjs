/**
 * acceptance-bar.test.mjs
 * Tests for the acceptance_bar tool.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptanceBar } from './acceptance-bar.mjs';

test('acceptance_bar: dashboard surface → items.length > 0', () => {
  const result = acceptanceBar({ surface: 'dashboard' });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.equal(result.surface, 'dashboard');
  assert.ok(Array.isArray(result.items), 'items should be array');
  assert.ok(result.items.length > 0, 'dashboard should have acceptance items');
});

test('acceptance_bar: dashboard items have id, description, category', () => {
  const result = acceptanceBar({ surface: 'dashboard' });

  assert.ok(result.items.length > 0, 'Need items for field check');
  for (const item of result.items) {
    assert.ok('id' in item, `item missing id: ${JSON.stringify(item)}`);
    assert.ok('description' in item, `item missing description: ${JSON.stringify(item)}`);
    assert.ok('category' in item, `item missing category: ${JSON.stringify(item)}`);
    assert.equal(typeof item.id, 'string');
    assert.equal(typeof item.description, 'string');
    assert.equal(typeof item.category, 'string');
  }
});

test('acceptance_bar: landing surface → items.length > 0', () => {
  const result = acceptanceBar({ surface: 'landing' });

  assert.ok(!result.error);
  assert.equal(result.surface, 'landing');
  assert.ok(result.items.length > 0);
});

test('acceptance_bar: auth surface → items.length > 0', () => {
  const result = acceptanceBar({ surface: 'auth' });

  assert.ok(!result.error);
  assert.equal(result.surface, 'auth');
  assert.ok(result.items.length > 0);
});

test('acceptance_bar: generic surface → items from finish-bar, length === 10', () => {
  const result = acceptanceBar({ surface: 'generic' });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.equal(result.surface, 'generic');
  assert.ok(Array.isArray(result.items));
  assert.equal(result.items.length, 10, `finish-bar should have 10 passes, got ${result.items.length}`);
});

test('acceptance_bar: unknown surface → structured error, not crash', () => {
  const result = acceptanceBar({ surface: 'nonsense' });

  assert.ok(result.error, 'Should have error field');
  assert.ok(result.error.includes('nonsense') || result.error.includes('Unrecognized'), 'error should mention the surface');
  assert.ok(Array.isArray(result.items), 'items should be array');
  assert.equal(result.items.length, 0);
});

test('acceptance_bar: empty input → structured error, not crash', () => {
  const result = acceptanceBar({});

  assert.ok(result.error, 'Should have error field');
  assert.ok(Array.isArray(result.items));
  assert.equal(result.items.length, 0);
});

test('acceptance_bar: surface field echoed in response', () => {
  for (const surface of ['dashboard', 'landing', 'auth', 'generic']) {
    const result = acceptanceBar({ surface });
    assert.equal(result.surface, surface, `surface field should be echoed for ${surface}`);
  }
});
