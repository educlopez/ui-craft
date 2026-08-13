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
import { foldCandidates, checkFold } from './fold.mjs';
import { CLASS_IDS } from '../../../scripts/fold/classes.mjs';
import { isBrowserUnavailable } from '../../../scripts/fold/browser.mjs';

test('fold_candidates seeds itself from the working directory', () => {
  const r = foldCandidates({ count: 3 });
  assert.equal(r.seeded_by, 'project', 'a draw with no explicit seed still reports that it was seeded');
  assert.equal(r.candidates.length, 3);
});

test('fold_candidates leaks nothing derived from the seed', () => {
  // The seed is a directory on someone's machine and the response goes into a transcript.
  // An earlier version reported an 8-hex FNV-1a of it, which reads as redaction and is not:
  // paths are guessable, so a candidate list plus the digest confirms which one it was. The
  // response now carries no function of the seed at all — only that one was used.
  const secret = '/Users/someone/private/client-work';
  const r = foldCandidates({ count: 3, seed: secret });
  const body = JSON.stringify(r);
  assert.ok(!body.includes(secret), 'the raw seed must not appear');
  for (const part of secret.split('/').filter(Boolean)) {
    assert.ok(!body.includes(part), `no path component may appear (${part})`);
  }
  assert.equal(r.seeded_by, 'project');
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

// ── drift has three outcomes, not two ───────────────────────────────────────
//
// Measured over seven landing builds (#141), one called this tool as `{"url": …}` with no
// expected_class, got no drift back, and read as compliance — while the class it built was
// not among the three it had been offered. An absent drift field is not evidence of none.


/**
 * Only a genuinely undrivable browser may skip a test.
 *
 * The first version skipped on any `checkFold` error, which meant a navigation, fixture or
 * measurement regression would report as "skipped: no browser" — the same cannot-check-reads-
 * as-checked shape this file exists to close, in the test rather than the tool. The second
 * matched one message and missed the other: CI runs Node 20, where driving CDP without
 * puppeteer is impossible for a reason that is still "no browser available". The predicate
 * now lives beside the messages, in scripts/fold/browser.mjs.
 */
function assertRan(t, r) {
  if (r.error && isBrowserUnavailable(r.error)) {
    t.skip(`browser not drivable here: ${r.error}`);
    return false;
  }
  assert.equal(r.error, undefined, `checkFold failed for a reason that is not a missing browser: ${r.error}`);
  return true;
}

/** Serve one HTML page on an ephemeral port for the duration of `body`. */
async function withPage(html, body) {
  const http = await import('node:http');
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    return await body(url);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const PAGE = `<main style="font-family:system-ui">
  <section style="height:70vh;display:flex;flex-direction:column;gap:24px;padding:48px">
    <h1 style="font-size:72px;margin:0">A headline that occupies the fold</h1>
    <p style="font-size:20px;max-width:40ch">Subtext that says what the product does, in a measured 14 words here.</p>
    <a href="#x" style="background:#3355ff;color:#fff;padding:14px 22px;width:fit-content">Start free</a>
  </section>
</main>`;

test('check_fold: no expected_class reports not-compared, not "no drift"', async (t) => {
  const r = await withPage(PAGE, (url) => checkFold({ url }));
  if (assertRan(t, r)) {
    assert.equal(r.drift_status, 'not-compared');
    assert.equal(r.drift, null, 'drift stays null — the status is what carries the meaning');
    assert.match(r.drift_note ?? '', /Nothing was compared/);
    assert.equal(r.summary.ok, false, 'ok must not claim success when nothing was compared');
  }
});

test('check_fold: a declared class that matches reports matched', async (t) => {
  const first = await withPage(PAGE, (url) => checkFold({ url }));
  if (!assertRan(t, first)) return;
  // Declare whatever the page actually is, so this tests the matched path rather than the
  // page's geometry.
  const built = first.composition.id;
  const r = await withPage(PAGE, (url) => checkFold({ url, expected_class: built }));
  assert.equal(r.drift_status, 'matched');
  assert.equal(r.drift, null);
  assert.equal(r.drift_note, undefined);
});

test('check_fold: a declared class that differs reports drifted', async (t) => {
  const first = await withPage(PAGE, (url) => checkFold({ url }));
  if (!assertRan(t, first)) return;
  const other = CLASS_IDS.find((id) => id !== first.composition.id);
  const r = await withPage(PAGE, (url) => checkFold({ url, expected_class: other }));
  assert.equal(r.drift_status, 'drifted');
  assert.match(r.drift ?? '', /^Drift: asked for/);
  assert.equal(r.summary.ok, false);
});
