import { test } from 'node:test';
import assert from 'node:assert';
import { summarise, evaluateFold, extract, foldExtractorSource, REFERENCE_RANGE, CORPUS_FINDING } from './analyze.mjs';
import { drawClasses, classifyFold, CLASS_IDS } from './classes.mjs';
import { findBrowser, noBrowserMessage } from './browser.mjs';

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

test('only the invariants that survived two corpora carry a verdict', () => {
  // Every geometric invariant has now been checked against 18 reference folds
  // and 7 AI-generated ones, and every one of them was inverted: dominance
  // passed the generated pages, asymmetry would fail framer.com, and "exactly
  // one primary action" passed 7 of 7 generated folds against 4 of 18
  // references. What is left is the text and the declaration.
  const v = evaluateFold(splitFold());
  const judged = v.checks.map((c) => c.id).sort();
  assert.deepStrictEqual(judged, [5, 7], 'nothing geometric is judged until a corpus says where the line is');

  const observed = v.observations.map((o) => o.id).sort();
  assert.deepStrictEqual(observed, [1, 2, 3, 4, 6]);
  for (const o of v.observations) {
    assert.equal('pass' in o, false, `${o.name} must not expose a verdict`);
    assert.ok(o.note.length > 20, `${o.name} must say why it is not judged`);
  }
  assert.equal(v.total, 2, 'the summary counts judged checks only');
});

test('the two-corpus finding is recorded: generic is variance, not value', () => {
  // No metric separates the groups by value — every generated range sits
  // inside the reference range. The difference is spread.
  assert.equal(CORPUS_FINDING.separatingMetric, null);
  assert.ok(CORPUS_FINDING.cv.primaryActions.generated < CORPUS_FINDING.cv.primaryActions.reference);
  assert.ok(CORPUS_FINDING.cv.heroTextElements.generated < CORPUS_FINDING.cv.heroTextElements.reference);
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

test('the browser is found among the ones people already have', () => {
  const mac = (p) => p === '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  assert.match(findBrowser({ env: {}, exists: mac, os: 'darwin' }), /Google Chrome$/);

  // Chromium, Edge and Brave all speak CDP — nobody should have to install
  // a second browser to measure a page.
  const brave = (p) => p.includes('Brave');
  assert.match(findBrowser({ env: {}, exists: brave, os: 'darwin' }), /Brave/);

  assert.equal(findBrowser({ env: {}, exists: () => false, os: 'darwin' }), null);
});

test('UI_CRAFT_CHROME wins, and is not silently ignored when wrong', () => {
  const env = { UI_CRAFT_CHROME: '/opt/my/chrome' };
  assert.equal(findBrowser({ env, exists: (p) => p === '/opt/my/chrome', os: 'linux' }), '/opt/my/chrome');
  // Falling back to a different browser than the one that was named would hide
  // a typo behind results measured somewhere else.
  assert.equal(findBrowser({ env, exists: (p) => p === '/usr/bin/google-chrome', os: 'linux' }), null);
});

test('the no-browser message names every way out', () => {
  const msg = noBrowserMessage();
  for (const hint of ['Chrome', 'Chromium', 'Edge', 'Brave', 'UI_CRAFT_CHROME', 'puppeteer']) {
    assert.ok(msg.includes(hint), `message should mention ${hint}`);
  }
});

test('classifying a fold with no detected visual admits when it may be blind', () => {
  const base = {
    viewport: VIEWPORT,
    bandRun: 0,
    elements: [el({ box: box(80, 200, 900, 320), fontSize: 56, text: 'One kiln, one potter' })],
  };
  const plain = classifyFold(summarise(base));
  assert.equal(plain.confidence, 'high', 'a genuinely bare fold is type-only and we can say so');

  // A CSS-drawn product mock is invisible to the visual detector but leaves a
  // crowd of textless boxes behind. Claiming type-only there is the
  // confident-wrong failure this tool exists to avoid.
  const drawn = classifyFold(summarise({ ...base, structural: 120 }));
  assert.equal(drawn.confidence, 'low');
  assert.match(drawn.why, /cannot see|screenshot/);
});

test('a wrapper chain around one background counts once', () => {
  // Three nested wrappers of the same full-bleed background used to be the
  // three heaviest elements in the fold, so dominance compared a background
  // against copies of itself and came out at 1.00 on every reference page.
  const bg = (i) => el({ tag: 'div', role: 'visual', box: box(i, i, 1440 - i, 900 - i), text: '' });
  const m = summarise({
    viewport: VIEWPORT,
    bandRun: 0,
    elements: [bg(0), bg(2), bg(4), el({ box: box(120, 300, 900, 420), fontSize: 64, text: 'Payments for the internet' })],
  });
  assert.ok(m.dominance > 1.5, `a headline over one background should dominate, got ${m.dominance.toFixed(2)}×`);
});

test('a full-bleed background is ground, and ground never wins dominance', () => {
  const m = summarise({
    viewport: VIEWPORT,
    bandRun: 0,
    elements: [
      el({ tag: 'div', role: 'visual', box: box(0, 0, 1440, 900), text: '' }),
      el({ box: box(120, 300, 900, 420), fontSize: 64, text: 'Payments for the internet' }),
      el({ box: box(120, 460, 700, 500), fontSize: 18, text: 'Millions of businesses.' }),
    ],
  });
  assert.equal(m.elements[0].role, 'text', 'the figure is what the eye lands on, not the backdrop');
});

test('the hero scope admits when it failed to find a hero', () => {
  assert.equal(summarise({ viewport: VIEWPORT, bandRun: 0, elements: [], heroTextElements: 4 }).heroScoped, true);
  // clerk.com resolved to 80 — that is a page, not a hero.
  assert.equal(summarise({ viewport: VIEWPORT, bandRun: 0, elements: [], heroTextElements: 80 }).heroScoped, false);
});

test('the reference range is recorded so the next threshold is not invented', () => {
  for (const key of ['dominance', 'symmetry', 'heroTextElements', 'heroWords']) {
    assert.ok(REFERENCE_RANGE[key], `${key} needs a measured reference range`);
  }
  // The first thresholds were guesses and every reference page failed them.
  const note = evaluateFold(splitFold()).observations.find((o) => o.id === 2).note;
  assert.ok(note.includes(REFERENCE_RANGE.dominance), 'the note must carry the measured range');
});

test('every class carries a stated sacrifice — that is what makes it a class', () => {
  for (const c of drawClasses({ count: 6 })) {
    assert.ok(c.sacrifices.length > 10, `${c.id} must state what it gives up`);
  }
});
