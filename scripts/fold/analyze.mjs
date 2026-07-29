/**
 * analyze.mjs — measure a rendered fold, then judge it against the invariants.
 *
 * Split in two on purpose:
 *   measureFold()  needs a browser. Geometry and contrast are pixel facts.
 *   evaluateFold() is pure. It takes a measurement and returns pass/fail with
 *                  numbers, so it can be tested against fixtures with no browser.
 *
 * Two of the seven invariants — single dominance and deliberate asymmetry —
 * cannot be checked from source at all. That is the whole reason this file
 * exists: without a render they are advice, and advice loses.
 */

import { classifyFold } from './classes.mjs';
import { findBrowser, withPage, noBrowserMessage } from './browser.mjs';

// ─── Browser ────────────────────────────────────────────────────────────────

async function loadPuppeteer() {
  try {
    const mod = await import('puppeteer');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

/**
 * Runs inside the page. Returns plain JSON — no DOM nodes cross the boundary.
 *
 * Exported because the transport is not the point: this same function is the
 * payload whether it is handed to a headless page, injected as a content
 * script, or pasted into a console. Headless Chromium is one delivery option,
 * not a dependency of the idea.
 */
/* c8 ignore start — executes in the browser context, not under node coverage */
export function extract() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const inFold = (r) => r.top < vh && r.bottom > 0 && r.width > 0 && r.height > 0;

  const srgb = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  // Chrome returns computed colours in the space they were authored in, so a
  // token spine written in OKLCH never yields rgb(). Reading only rgb() made
  // every filled control on such a page look transparent — which is every page
  // built the way this project recommends building one.
  const transparent = (s) => !s || s === 'transparent' || /rgba?\([^)]*,\s*0\s*\)$/.test(s);
  const lum = (color) => {
    if (transparent(color)) return null;
    const rgb = /rgba?\(([^)]+)\)/.exec(color);
    if (rgb) {
      const [r, g, b] = rgb[1].split(',').map((n) => parseFloat(n));
      return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
    }
    // oklch(L C H) / oklab(L a b) / lch() / lab(): the first component is
    // perceptual lightness. Y ≈ L³ is an approximation, good enough to rank
    // contrast, and far better than treating the colour as absent.
    const perceptual = /(?:okl(?:ch|ab)|l(?:ch|ab))\(\s*([\d.]+)(%?)/.exec(color);
    if (perceptual) {
      const l = parseFloat(perceptual[1]) / (perceptual[2] === '%' ? 100 : 1);
      return Math.min(1, Math.max(0, l)) ** 3;
    }
    return null;
  };
  const backdropLum = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const l = lum(getComputedStyle(node).backgroundColor);
      if (l !== null) return l;
      node = node.parentElement;
    }
    return 1;
  };

  // tagName for inline SVG is lowercase "svg" — compare case-insensitively or
  // every SVG-illustrated fold reads as text-only.
  const VISUAL = new Set(['IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE']);
  const foldArea = vw * vh;
  const elements = [];
  let bandRun = 0;

  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!inFold(r)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;

    const box = { left: r.left, top: r.top, right: r.right, bottom: Math.min(r.bottom, vh) };
    const visible = Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
    if (visible < 200) continue;

    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();

    const tag = el.tagName.toUpperCase();
    const hasBgImage = cs.backgroundImage && cs.backgroundImage !== 'none';
    // Most "screenshots" in generated pages are neither <img> nor background
    // image — they are CSS-drawn blocks. A sizeable textless surface carrying
    // its own fill, border or shadow is a visual whatever it is made of.
    const drawnSurface =
      !ownText &&
      visible > 0.08 * foldArea &&
      (!transparent(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none');
    const isVisual = VISUAL.has(tag) || hasBgImage || drawnSurface;

    if (!ownText && !isVisual) continue;

    const fg = lum(cs.color) ?? 0;
    const bg = backdropLum(el);
    const contrast = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);

    elements.push({
      tag: tag.toLowerCase(),
      role: isVisual ? 'visual' : 'text',
      box,
      area: visible,
      fontSize: parseFloat(cs.fontSize) || 0,
      fontWeight: parseFloat(cs.fontWeight) || 400,
      contrast: Number.isFinite(contrast) ? contrast : 1,
      text: ownText.slice(0, 300),
      // Nav, header and footer are chrome. They sit in the fold but they are
      // not the composition, and counting them blows the restraint budget on
      // every real page.
      chrome: !!el.closest('nav,header,footer'),
    });
  }

  // A primary action is resolved on the control itself, not on the element that
  // happens to hold the label — the text usually lives in a child span, and a
  // gradient button carries its fill in background-image, not backgroundColor.
  let primaryActions = 0;
  for (const ctl of document.querySelectorAll('a,button,[role="button"]')) {
    const r = ctl.getBoundingClientRect();
    if (!inFold(r) || r.width * r.height < 200) continue;
    if (ctl.closest('nav,header,footer')) continue;
    const cs = getComputedStyle(ctl);
    // "Filled" only needs to know a background exists, in any colour space —
    // no luminance required, so no colour format can silently exclude a control.
    const filled = !transparent(cs.backgroundColor) || (cs.backgroundImage && cs.backgroundImage !== 'none');
    if (filled) primaryActions++;
  }

  // Equal-height siblings running across the fold — a band.
  for (const parent of document.querySelectorAll('body *')) {
    const kids = [...parent.children].filter((k) => {
      const r = k.getBoundingClientRect();
      return inFold(r) && r.width > 40;
    });
    if (kids.length < 3) continue;
    const rects = kids.map((k) => k.getBoundingClientRect());
    const h = rects[0].height;
    const sameHeight = rects.every((r) => Math.abs(r.height - h) < 8);
    const horizontal = rects.every((r, i) => i === 0 || r.left >= rects[i - 1].left);
    const spans = Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left));
    if (sameHeight && horizontal && spans > vw * 0.6) bandRun = Math.max(bandRun, kids.length);
  }

  // Structural boxes carry no text and are not recognised as visuals, but a
  // product mock drawn in CSS is made of hundreds of them. Counting them is how
  // "no visual found" can tell a genuinely type-only fold from one whose visual
  // this extractor simply cannot see.
  let structural = 0;
  for (const el of document.querySelectorAll('div,section,article,figure,span')) {
    const r = el.getBoundingClientRect();
    if (!inFold(r) || r.width * r.height < 200) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!own) structural++;
  }

  return { viewport: { width: vw, height: vh }, elements, bandRun, primaryActions, structural };
}
/* c8 ignore stop */

/**
 * The extractor as a standalone snippet, for the transports that cannot import
 * a module: a content script, a `web_accessible_resources` payload, an
 * `Runtime.evaluate` over CDP, or a paste into a console.
 *
 * Derived from `extract` itself rather than maintained as a second copy. Two
 * hand-written runtimes of one rule set drift, and the drift is invisible until
 * the two disagree about a page. Here they cannot disagree: there is one
 * function, and this is a serialisation of it.
 *
 * @returns {string} an IIFE that evaluates to the extraction JSON
 */
export function foldExtractorSource() {
  return `(${extract.toString()})()`;
}

const union = (boxes) =>
  boxes.length
    ? boxes.reduce((a, b) => ({
        left: Math.min(a.left, b.left),
        top: Math.min(a.top, b.top),
        right: Math.max(a.right, b.right),
        bottom: Math.max(a.bottom, b.bottom),
      }))
    : null;

/**
 * Turn the raw in-page extraction into the measurement evaluateFold expects.
 * Exported so fixtures can be built without a browser.
 * @param {{viewport:{width:number,height:number}, elements:any[], bandRun:number}} raw
 */
export function summarise(raw) {
  const { viewport, elements, bandRun } = raw;
  const structural = raw.structural ?? 0;
  const texts = elements.filter((e) => e.role === 'text' && e.text);
  const visuals = elements.filter((e) => e.role === 'visual');
  // The restraint budget is about the composition, not the page furniture.
  const content = texts.filter((t) => !t.chrome);

  // Visual weight: how much of the eye an element takes. Area carries it,
  // contrast against the backdrop scales it, type size lifts text that is
  // small in area but loud in presence.
  const weigh = (e) => {
    const base = e.area * Math.min(e.contrast, 21);
    return e.role === 'text' ? base * (1 + e.fontSize / 48) : base;
  };
  const weighted = elements
    .map((e) => ({ ...e, weight: weigh(e) }))
    .sort((a, b) => b.weight - a.weight);

  const largestVisual = visuals.sort((a, b) => b.area - a.area)[0] ?? null;
  const naming = [...content].sort((a, b) => b.fontSize - a.fontSize)[0] ?? null;

  // Mirror symmetry about the vertical centre line: for each element, is there
  // another of similar size at the mirrored x position?
  const cx = viewport.width / 2;
  let mirrored = 0;
  for (const e of elements) {
    const eCx = (e.box.left + e.box.right) / 2;
    const target = 2 * cx - eCx;
    const twin = elements.find(
      (o) => o !== e && Math.abs((o.box.left + o.box.right) / 2 - target) < 24 && Math.abs(o.area - e.area) / Math.max(o.area, e.area) < 0.35,
    );
    // An element straddling the centre line is symmetric with itself.
    if (twin || Math.abs(eCx - cx) < 24) mirrored++;
  }

  return {
    viewport,
    elements: weighted,
    text: union(texts.map((t) => t.box)),
    visual: largestVisual ? largestVisual.box : null,
    bandRun,
    structural,
    textElements: content.length,
    namingStatement: naming?.text ?? '',
    supportingWords: content
      .filter((t) => t !== naming)
      .reduce((n, t) => n + t.text.split(/\s+/).filter(Boolean).length, 0),
    primaryActions:
      raw.primaryActions ?? elements.filter((e) => e.isAction && e.filled).length,
    symmetry: elements.length ? mirrored / elements.length : 0,
    dominance: weighted.length > 1 ? weighted[0].weight / Math.max(weighted[1].weight, 1) : Infinity,
  };
}

/**
 * @typedef {ReturnType<typeof summarise>} FoldMeasurement
 */

/**
 * Render a URL and measure its fold.
 * @param {string} url
 * @param {{ width?: number, height?: number, timeoutMs?: number, executablePath?: string }} [opts]
 */
export async function measureFold(url, opts = {}) {
  // Prefer the browser already on the machine over anything that needs
  // installing. Only fall back to puppeteer for people who already have it.
  const exe = opts.executablePath ?? findBrowser();
  if (exe) {
    return withPage(url, { ...opts, executablePath: exe }, async (page) => {
      const raw = await page.evaluate(foldExtractorSource());
      const screenshot = await page.screenshot();
      return { ...summarise(raw), url, screenshot, engine: 'cdp' };
    });
  }

  const puppeteer = await loadPuppeteer();
  if (!puppeteer) throw new Error(noBrowserMessage());

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: opts.width ?? 1440, height: opts.height ?? 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: opts.timeoutMs ?? 30000 });
    const raw = await page.evaluate(extract);
    const screenshot = await page.screenshot({ encoding: 'base64' });
    return { ...summarise(raw), url, screenshot, engine: 'puppeteer' };
  } finally {
    await browser.close();
  }
}

// ─── Judgement (pure) ───────────────────────────────────────────────────────

const EMPTY_PHRASES = [
  'platform for', 'solution for', 'the future of', 'reimagined', 'supercharge',
  'take your', 'to the next level', 'all-in-one', 'everything you need',
];
const SUPERLATIVES = [
  'blazing fast', 'lightning fast', 'world-class', 'best-in-class', 'seamless',
  'effortless', 'loved by thousands', 'trusted by thousands', 'game-changing', 'revolutionary',
];

const words = (s) => s.split(/\s+/).filter(Boolean).length;

/**
 * Judge a measurement against the fold invariants.
 * Invariant 7 cannot be measured — it is passed in as a declaration.
 *
 * @param {FoldMeasurement} m
 * @param {{ costlyDetail?: string }} [declared]
 */
export function evaluateFold(m, declared = {}) {
  const fold = (m.elements ?? []).map((e) => e.text ?? '').join(' ').toLowerCase();
  const hasNumber = /\b\d+(\.\d+)?\s*(%|ms|s|x|k|m|gb|mb|\/)/i.test(fold) || /\b\d{2,}\b/.test(fold);
  const hasVisualProof = !!m.visual;
  const superlative = SUPERLATIVES.find((s) => fold.includes(s));
  const abstraction = EMPTY_PHRASES.find((p) => m.namingStatement.toLowerCase().includes(p));

  // Only three invariants are judged. The rest are measured and reported
  // without a verdict, because calibration against linear.app and stripe.com
  // showed the thresholds do not yet discriminate — the dominance ratio was
  // outright inverted, passing generated pages and failing both references.
  // A confident wrong number is worse than no number.
  const checks = [
    {
      id: 3, name: 'One primary action',
      pass: m.primaryActions === 1,
      detail: `${m.primaryActions} filled actions in the fold, outside nav and footer`,
    },
    {
      id: 5, name: 'Evidence over assertion',
      pass: (hasNumber || hasVisualProof) && !superlative,
      detail: superlative
        ? `unverifiable superlative: "${superlative}"`
        : hasNumber ? 'measured figure present' : hasVisualProof ? 'visual proof present' : 'no concrete proof in the fold',
    },
    {
      id: 7, name: 'A costly detail',
      pass: !!declared.costlyDetail,
      detail: declared.costlyDetail ? `declared: ${declared.costlyDetail}` : 'not declared — an unnamed costly detail does not exist',
    },
  ];

  const observations = [
    {
      id: 1, name: 'Identification',
      value: m.namingStatement ? `"${m.namingStatement}" (${words(m.namingStatement)} words)` : 'none found',
      note: abstraction
        ? `reads as a category abstraction ("${abstraction}") — judge it yourself`
        : 'headline detection misses folds that split their type across per-character spans',
    },
    {
      id: 2, name: 'Single dominance',
      value: m.dominance === Infinity ? '∞' : `${m.dominance.toFixed(2)}×`,
      note: 'not judged: nested wrappers of one full-bleed background count as separate elements, which collapses the ratio toward 1 on exactly the pages that are composed best',
    },
    {
      id: 4, name: 'Deliberate asymmetry',
      value: `${(m.symmetry * 100).toFixed(0)}% mirrored`,
      note: 'measured but unjudged: discriminates plausibly across references, threshold not yet calibrated',
    },
    {
      id: 6, name: 'Restraint budget',
      value: `${m.textElements} text elements, ${m.supportingWords} supporting words`,
      note: 'not judged: every reference fold measured 90-140 supporting words, so the budget belongs to the hero block rather than the whole viewport',
    },
  ];

  const composition = classifyFold(m);
  return {
    composition,
    checks,
    observations,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    ok: checks.every((c) => c.pass),
  };
}
