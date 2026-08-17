/**
 * ux-coverage.test.mjs
 * Tests for the ux_coverage tool.
 *
 * The shape tests here are the load-bearing ones. An item that loses its `cost`
 * degrades into a presence checklist, and an item that loses its `craft` restates
 * what the references already say — either way the tool stops being worth calling.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uxCoverage, KNOWN_ARCHETYPES } from './ux-coverage.mjs';

test('ux_coverage: known archetype → items.length > 0', () => {
  const result = uxCoverage({ archetype: 'data-table' });

  assert.ok(!result.error, `Should not error: ${result.error}`);
  assert.equal(result.archetype, 'data-table');
  assert.ok(Array.isArray(result.items), 'items should be array');
  assert.ok(result.items.length > 0, 'data-table should have coverage items');
});

test('ux_coverage: every archetype has items, a label and a family', () => {
  assert.ok(KNOWN_ARCHETYPES.length >= 12, `expected at least 12 archetypes, got ${KNOWN_ARCHETYPES.length}`);

  for (const archetype of KNOWN_ARCHETYPES) {
    const result = uxCoverage({ archetype });
    assert.ok(!result.error, `${archetype} errored: ${result.error}`);
    assert.ok(result.items.length > 0, `${archetype} has no items`);
    assert.equal(typeof result.label, 'string', `${archetype} missing label`);
    assert.ok(
      ['web-app', 'website', 'flows'].includes(result.family),
      `${archetype} has unexpected family: ${result.family}`
    );
  }
});

test('ux_coverage: every item carries all four parts, non-empty', () => {
  for (const archetype of KNOWN_ARCHETYPES) {
    const { items } = uxCoverage({ archetype });

    for (const item of items) {
      for (const field of ['id', 'part', 'exists', 'craft', 'cost', 'category']) {
        assert.equal(typeof item[field], 'string', `${archetype}/${item.id}: ${field} must be a string`);
        assert.ok(item[field].length > 0, `${archetype}/${item.id}: ${field} must not be empty`);
      }
    }
  }
});

test('ux_coverage: item ids are unique across the whole dataset', () => {
  const seen = new Set();

  for (const archetype of KNOWN_ARCHETYPES) {
    for (const item of uxCoverage({ archetype }).items) {
      assert.ok(!seen.has(item.id), `duplicate item id: ${item.id}`);
      seen.add(item.id);
    }
  }
});

test('ux_coverage: cost is not a restatement of the part', () => {
  // A `cost` that just repeats the part name ("no export action") is a status, not
  // a reason. The value of the field is that it says what the user loses.
  for (const archetype of KNOWN_ARCHETYPES) {
    for (const item of uxCoverage({ archetype }).items) {
      assert.notEqual(
        item.cost.toLowerCase().trim(),
        item.part.toLowerCase().trim(),
        `${archetype}/${item.id}: cost restates part`
      );
      assert.ok(item.cost.length > 30, `${archetype}/${item.id}: cost too short to be a real consequence`);
    }
  }
});

test('ux_coverage: reporting contract ships with every successful lookup', () => {
  const { reporting } = uxCoverage({ archetype: 'checkout' });

  assert.ok(reporting, 'reporting contract missing');
  assert.deepEqual(
    reporting.markers.map((m) => m.marker),
    ['present', 'partial', 'missing', 'not-needed', 'unknown']
  );
  assert.ok(reporting.rules.length > 0, 'reporting rules missing');
});

test('ux_coverage: the no-score and no-gate rules are stated in the contract', () => {
  // These two rules are the whole reason coverage is a separate axis. If they stop
  // travelling with the data, a caller folds coverage into score_ui and the
  // distinction signal disappears under a hygiene metric that ties at the top.
  const { reporting } = uxCoverage({ archetype: 'settings' });
  const joined = reporting.rules.join(' ').toLowerCase();

  assert.ok(joined.includes('no score'), 'contract must forbid a score');
  assert.ok(joined.includes('percentage'), 'contract must forbid a percentage');
  assert.ok(joined.includes('never gates'), 'contract must state that coverage never gates');
});

test('ux_coverage: resolves label and synonyms, case- and separator-insensitively', () => {
  const cases = [
    ['Data table', 'data-table'],
    ['table', 'data-table'],
    ['DATA_TABLE', 'data-table'],
    ['plans', 'pricing'],
    ['are you sure', 'destructive-confirm'],
    ['getting started', 'onboarding'],
    ['  preferences  ', 'settings'],
  ];

  for (const [input, expected] of cases) {
    const result = uxCoverage({ archetype: input });
    assert.ok(!result.error, `"${input}" errored: ${result.error}`);
    assert.equal(result.archetype, expected, `"${input}" should resolve to ${expected}`);
  }
});

test('ux_coverage: no archetype → catalogue, not an error', () => {
  const result = uxCoverage({});

  assert.ok(!result.error, 'omitting the archetype is a valid call, not an error');
  assert.equal(result.archetype, null);
  assert.equal(result.catalogue.length, KNOWN_ARCHETYPES.length);
  for (const entry of result.catalogue) {
    assert.equal(typeof entry.label, 'string');
    assert.ok(Array.isArray(entry.also) && entry.also.length > 0, `${entry.archetype} has no synonyms`);
  }
});

test('ux_coverage: unknown archetype → structured error saying it is not a failure', () => {
  const result = uxCoverage({ archetype: 'nonsense' });

  assert.ok(result.error, 'Should have error field');
  assert.ok(result.error.includes('nonsense'), 'error should name the input');
  assert.ok(
    result.error.includes('not a failure'),
    'an unlisted surface must not read as the surface being wrong — coverage is deliberately partial'
  );
  assert.ok(Array.isArray(result.items));
  assert.equal(result.items.length, 0);
});

test('ux_coverage: does not claim the surfaces acceptance_bar already owns', () => {
  // dashboard, landing and auth have full outcome recipes and acceptance items.
  // Duplicating them here would give two homes to one requirement, which is how
  // one of them goes stale.
  for (const surface of ['dashboard', 'landing', 'auth']) {
    assert.ok(!KNOWN_ARCHETYPES.includes(surface), `${surface} belongs to acceptance_bar, not ux_coverage`);
  }
});

test('ux_coverage: archetypes declare their non-obvious states without restating the lattice', () => {
  for (const archetype of KNOWN_ARCHETYPES) {
    const { states } = uxCoverage({ archetype });
    assert.ok(Array.isArray(states) && states.length > 0, `${archetype} declares no states`);
  }
});
