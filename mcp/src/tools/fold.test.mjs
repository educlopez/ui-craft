/**
 * fold.test.mjs — the MCP layer over the fold draw.
 *
 * `scripts/fold/fold.test.mjs` covers the ordering itself. What is only true here is where
 * the seed comes from: the tool has to supply one on its own, because nothing in the skill
 * or the command passes a project path. If it did not, seeding would be dead code and every
 * project would go on drawing the same three classes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldCandidates } from './fold.mjs';
import { CLASS_IDS } from '../../../scripts/fold/classes.mjs';

test('fold_candidates seeds itself from the working directory', () => {
  const r = foldCandidates({ count: 3 });
  assert.ok(r.seed, 'a draw with no explicit seed must still report one');
  assert.match(r.seed, /^[0-9a-f]{8}$/, 'the seed is reported as a digest, not as a path');
  assert.equal(r.candidates.length, 3);
});

test('fold_candidates does not echo the path it was seeded with', () => {
  // The seed is a directory on someone's machine and the response goes into a transcript.
  // A digest answers "will I get these again" without carrying the path along.
  const secret = '/Users/someone/private/client-work';
  const r = foldCandidates({ count: 3, seed: secret });
  assert.ok(!JSON.stringify(r).includes(secret), 'the raw seed must not appear in the response');
});

test('fold_candidates: different projects get different candidates', () => {
  const a = foldCandidates({ count: 3, seed: '/projects/alpha' }).candidates.map((c) => c.id);
  const b = foldCandidates({ count: 3, seed: '/projects/beta' }).candidates.map((c) => c.id);
  const c = foldCandidates({ count: 3, seed: '/projects/gamma' }).candidates.map((c) => c.id);
  assert.ok(
    new Set([a, b, c].map((x) => x.join(','))).size > 1,
    `three projects drew identically: ${a.join(',')}`
  );
});

test('fold_candidates: the same project draws the same thing every time', () => {
  const once = foldCandidates({ count: 3, seed: '/projects/alpha' }).candidates.map((c) => c.id);
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(foldCandidates({ count: 3, seed: '/projects/alpha' }).candidates.map((c) => c.id), once);
  }
});

test('fold_candidates still rejects an unknown class, and still marks spent ones', () => {
  const bad = foldCandidates({ used: ['not-a-class'] });
  assert.match(bad.error, /Unknown composition class/);
  assert.deepEqual(bad.candidates, []);

  const seed = '/projects/alpha';
  const first = foldCandidates({ count: 3, seed }).candidates[0].id;
  const after = foldCandidates({ count: 3, seed, used: [first] });
  assert.ok(!after.candidates.some((c) => c.id === first), 'a spent class drops out');
  assert.ok(after.candidates.every((c) => CLASS_IDS.includes(c.id)));
});
