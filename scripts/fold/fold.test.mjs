import { test } from 'node:test';
import assert from 'node:assert';
import { summarise, evaluateFold, extract, foldExtractorSource } from './analyze.mjs';
import { drawClasses, classifyFold, CLASS_IDS } from './classes.mjs';

const VIEWPORT = { width: 1440, height: 900 };
const box = (left, top, right, bottom) => ({ left, top, right, bottom });

function el(overrides = {}) {
  const b = overrides.box ?? box(0, 0, 100, 100);
  return {
    tag: 'div',
    role: 'text',
    box: b,
    area: (b.right - b.left) * (b.bottom - b.top),
    fontSize: 16,
    fontWeight: 400,
    contrast: 10,
    text: '',
    isAction: false,
    filled: false,
    ...overrides,
    box: b,
  };
}

/** The fold every model builds: headline left, visual right, one filled CTA. */
function splitFold(extra = []) {
  return summarise({
    viewport: VIEWPORT,
    bandRun: 0,
    elements: [
      el({ box: box(80, 200, 620, 320), fontSize: 56, text: 'Webhooks that never miss' }),
      el({ box: box(80, 340, 620, 380), fontSize: 18, text: 'Retries, replay and delivery logs for every event.' }),
      el({ tag: 'a', box: box(80, 420, 260, 468), fontSize: 16, text: 'Start free trial', isAction: true, filled: true }),
      el({ tag: 'img', role: 'visual', box: box(760, 160, 1440, 720), text: '' }),
      ...extra,
    ],
  });
}

test('summarise derives dominance, symmetry and text budget from geometry', () => {
  const m = splitFold();
  assert.equal(m.textElements, 3);
  assert.equal(m.primaryActions, 1);
  assert.equal(m.namingStatement, 'Webhooks that never miss');
  assert.equal(m.supportingWords, 11, 'naming statement is excluded from the supporting budget');
  assert.ok(m.dominance > 1, 'dominance is a ratio between the two heaviest elements');
});

test('classifyFold names the split fold for what it is', () => {
  const c = classifyFold(splitFold());
  assert.equal(c.id, 'split');
  assert.equal(c.confidence, 'high');
});

test('classifyFold recognises a type-only fold', () => {
  const m = summarise({
    viewport: VIEWPORT,
    bandRun: 0,
    elements: [
      el({ box: box(120, 240, 1320, 520), fontSize: 128, text: 'Fired once. Owned forever.' }),
      el({ tag: 'a', box: box(120, 600, 300, 648), text: 'See the kiln log', isAction: true, filled: true }),
    ],
  });
  const c = classifyFold(m);
  assert.equal(c.id, 'type-only');
  assert.equal(c.confidence, 'high');
});

test('classifyFold recognises a full-bleed fold with text over the visual', () => {
  const m = summarise({
    viewport: VIEWPORT,
    bandRun: 0,
    elements: [
      el({ tag: 'img', role: 'visual', box: box(0, 0, 1440, 900), text: '' }),
      el({ box: box(120, 620, 800, 720), fontSize: 64, text: 'One kiln, one potter' }),
    ],
  });
  assert.equal(classifyFold(m).id, 'full-bleed-overlay');
});

test('classifyFold recognises a band before anything else', () => {
  const m = summarise({
    viewport: VIEWPORT,
    bandRun: 5,
    elements: [
      el({ box: box(80, 120, 600, 200), fontSize: 40, text: 'Five firings a year' }),
      el({ tag: 'img', role: 'visual', box: box(80, 300, 1360, 600), text: '' }),
    ],
  });
  assert.equal(classifyFold(m).id, 'band');
});

test('classifyFold separates stacked from split by vertical band, not by column count', () => {
  const stacked = summarise({
    viewport: VIEWPORT,
    bandRun: 0,
    elements: [
      el({ box: box(400, 80, 1040, 200), fontSize: 56, text: 'Every event, accounted for' }),
      el({ tag: 'img', role: 'visual', box: box(200, 320, 1240, 860), text: '' }),
    ],
  });
  assert.equal(classifyFold(stacked).id, 'stacked');
});

test('the uncalibrated invariants are measured but never judged', () => {
  // Calibration against reference landing pages inverted the dominance ratio —
  // it passed generated pages and failed the references. Until that is rebuilt,
  // these four report a value and no verdict, so nothing downstream can treat
  // them as a gate.
  const v = evaluateFold(splitFold());
  const judged = v.checks.map((c) => c.id).sort();
  assert.deepStrictEqual(judged, [3, 5, 7], 'only the three trustworthy invariants carry a verdict');

  const observed = v.observations.map((o) => o.id).sort();
  assert.deepStrictEqual(observed, [1, 2, 4, 6]);
  for (const o of v.observations) {
    assert.equal('pass' in o, false, `${o.name} must not expose a verdict`);
    assert.ok(o.note.length > 20, `${o.name} must say why it is not judged`);
  }
  assert.equal(v.total, 3, 'the summary counts judged checks only');
});

test('identification is reported with the statement it found, unjudged', () => {
  const m = summarise({
    viewport: VIEWPORT,
    bandRun: 0,
    elements: [el({ box: box(80, 200, 900, 300), fontSize: 56, text: 'The platform for modern teams' })],
  });
  const id = evaluateFold(m).observations.find((o) => o.id === 1);
  assert.match(id.value, /platform for modern teams/);
  assert.match(id.note, /category abstraction/);
});

test('chrome is excluded from the text budget it would otherwise blow', () => {
  const m = summarise({
    viewport: VIEWPORT,
    bandRun: 0,
    elements: [
      el({ box: box(0, 0, 200, 40), fontSize: 14, text: 'Product Pricing Docs Sign in', chrome: true }),
      el({ box: box(80, 200, 900, 320), fontSize: 56, text: 'Webhooks that never miss' }),
    ],
  });
  assert.equal(m.textElements, 1, 'nav, header and footer are page furniture, not composition');
  assert.equal(m.namingStatement, 'Webhooks that never miss');
});

test('evaluateFold rejects unverifiable superlatives as evidence', () => {
  const m = splitFold([el({ box: box(80, 500, 620, 540), text: 'Blazing fast and loved by thousands' })]);
  const evidence = evaluateFold(m).checks.find((c) => c.id === 5);
  assert.equal(evidence.pass, false);
  assert.match(evidence.detail, /blazing fast/);
});

test('the costly detail invariant fails until it is named', () => {
  const m = splitFold();
  assert.equal(evaluateFold(m).checks.find((c) => c.id === 7).pass, false);
  const named = evaluateFold(m, { costlyDetail: 'hand-set delivery ledger; cost: no room for a logo wall' });
  assert.equal(named.checks.find((c) => c.id === 7).pass, true);
});

test('drawClasses deprioritises spent classes and never opens with split', () => {
  const first = drawClasses({ count: 3 });
  assert.equal(first.length, 3);
  assert.ok(!first.some((c) => c.id === 'split'), 'split is never a first suggestion');

  const afterTypeOnly = drawClasses({ used: ['type-only'], count: 3 });
  assert.ok(!afterTypeOnly.some((c) => c.id === 'type-only'), 'a spent class drops out of the draw');

  const exhausted = drawClasses({ used: CLASS_IDS, count: 3 });
  assert.equal(exhausted.length, 3, 'when every class is spent the draw still returns candidates');
});

test('the injectable payload is a serialisation of the extractor, not a second copy', () => {
  const src = foldExtractorSource();
  // Drift between a node runtime and a browser runtime of the same rules is
  // invisible until they disagree about a page. This asserts they cannot: the
  // payload contains the one function, verbatim.
  assert.ok(src.includes(extract.toString()), 'payload must be derived from extract itself');
  assert.match(src, /^\(function extract\(\)/, 'payload is a self-invoking function');
  assert.match(src, /\)\(\)$/);
});

test('the payload reads colours outside sRGB', () => {
  // Chrome returns computed colours in their authored space, so a token spine
  // written in OKLCH never yields rgb(). Reading only rgb() made every filled
  // control on such a page look transparent — on pages built exactly the way
  // this project tells you to build them. Verified live: 0 primary actions
  // became 1 on a fold whose CTA is oklch(0.42 0.16 258).
  const src = foldExtractorSource();
  assert.match(src, /okl\(\?:ch\|ab\)|okl\(?:ch\|ab\)|oklch|oklab/, 'payload must parse perceptual colour spaces');
  assert.match(src, /transparent\s*=/, 'emptiness is decided without needing a luminance');
});

test('the payload is self-contained — nothing to resolve at injection time', () => {
  const src = foldExtractorSource();
  for (const forbidden of ['import ', 'require(', 'export ', 'module.exports']) {
    assert.ok(!src.includes(forbidden), `payload must not contain "${forbidden}"`);
  }
  // Parses standalone: a content script or console paste would accept it.
  assert.doesNotThrow(() => new Function(`return ${src.replace(/\)\(\)$/, ')')}`));
});

test('every class carries a stated sacrifice — that is what makes it a class', () => {
  for (const c of drawClasses({ count: 6 })) {
    assert.ok(c.sacrifices.length > 10, `${c.id} must state what it gives up`);
  }
});
