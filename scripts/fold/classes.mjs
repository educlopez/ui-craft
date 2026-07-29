/**
 * classes.mjs — composition classes for the fold.
 *
 * The catalogue exists for one reason: variety cannot be requested in prose.
 * Ten blind builds produced the same fold whether it was prescribed, permitted,
 * or explicitly forbidden. So the fold class is *drawn*, not chosen — from the
 * classes a project has not spent yet — and the result is classified back from
 * geometry to confirm what was actually built.
 *
 * A class says what the fold IS structurally. It never says what it contains.
 */

/**
 * @typedef {object} CompositionClass
 * @property {string} id
 * @property {string} name
 * @property {string} structure   what makes a fold belong to this class
 * @property {string} demands     what this class is hard to do well, and must earn
 * @property {string} sacrifices  what the class gives up — the cost that makes it distinct
 */

/** @type {CompositionClass[]} */
export const COMPOSITION_CLASSES = [
  {
    id: 'type-only',
    name: 'Type-only',
    structure: 'No visual occupies meaningful area in the fold. Language carries the whole composition.',
    demands: 'The words must be worth the space. Weak copy has nothing to hide behind.',
    sacrifices: 'Any product demonstration above the fold.',
  },
  {
    id: 'full-bleed-overlay',
    name: 'Full-bleed with overlay',
    structure: 'One visual spans the fold edge to edge; text sits over it.',
    demands: 'Legibility against a surface you do not fully control, and a visual good enough to survive being looked at.',
    sacrifices: 'Fine typographic control — the type must stay simple to stay readable.',
  },
  {
    id: 'split',
    name: 'Split',
    structure: 'Text on one side, a visual on the other, side by side, neither overlapping.',
    demands: 'Almost nothing. This is the default every generator reaches for.',
    sacrifices: 'Distinctiveness. Choosing it means the composition will read as generic unless something else carries the page.',
  },
  {
    id: 'stacked',
    name: 'Stacked',
    structure: 'A text block, then the visual beneath it, in one column. Vertical reading order.',
    demands: 'Ruthless economy in the text block, or the visual never gets seen.',
    sacrifices: 'Density — you can show one idea above the fold, not two.',
  },
  {
    id: 'product-dominant',
    name: 'Product-dominant',
    structure: 'The product itself occupies most of the fold; text is a narrow band above or below it, not over it.',
    demands: 'A product that reads instantly at a glance. Complex UI fails here.',
    sacrifices: 'Narrative. There is no room to explain, only to show.',
  },
  {
    id: 'band',
    name: 'Horizontal band',
    structure: 'A row of sibling elements of equal height runs across the fold as the dominant structure — a sequence, a ticker, a strip.',
    demands: 'The order has to mean something. A strip of unrelated items is a card grid lying down.',
    sacrifices: 'A single focal point — attention is distributed by design.',
  },
];

export const CLASS_IDS = COMPOSITION_CLASSES.map((c) => c.id);

/**
 * Draw `count` classes for a fresh attempt, preferring ones this project has
 * not used. This is the only source of run-to-run variance in the system: it
 * comes from recorded state, not from asking the model to be different.
 *
 * `split` is drawn last on purpose — never as a first suggestion — because it
 * is the class every model reaches for unprompted.
 *
 * @param {{ used?: string[], count?: number }} [opts]
 * @returns {CompositionClass[]}
 */
export function drawClasses({ used = [], count = 3 } = {}) {
  const spent = new Set(used);
  const rank = (c) => (spent.has(c.id) ? 2 : 0) + (c.id === 'split' ? 1 : 0);
  return [...COMPOSITION_CLASSES]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .slice(0, Math.max(1, Math.min(count, COMPOSITION_CLASSES.length)))
    .map(({ c }) => c);
}

const overlap = (a, b) => {
  if (!a || !b) return 0;
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return w * h;
};

const area = (b) => (b ? Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top) : 0);

/**
 * Classify a measured fold back into a class. Reported alongside the class that
 * was drawn, so "we asked for type-only and built a split" is visible rather
 * than a matter of opinion.
 *
 * @param {import('./analyze.mjs').FoldMeasurement} m
 * @returns {{ id: string, confidence: 'high'|'low', why: string }}
 */
export function classifyFold(m) {
  const foldArea = m.viewport.width * m.viewport.height;
  const vis = m.visual;
  const txt = m.text;
  const visArea = area(vis) / foldArea;
  const visWidth = vis ? (vis.right - vis.left) / m.viewport.width : 0;

  if (!vis || visArea < 0.08) {
    return { id: 'type-only', confidence: visArea < 0.03 ? 'high' : 'low', why: `no visual above 8% of the fold (largest: ${(visArea * 100).toFixed(0)}%)` };
  }
  if (m.bandRun >= 3) {
    return { id: 'band', confidence: 'high', why: `${m.bandRun} equal-height siblings run across the fold` };
  }
  const textOverVisual = txt && vis ? overlap(txt, vis) / Math.max(area(txt), 1) : 0;
  if (visWidth > 0.85 && textOverVisual > 0.5) {
    return { id: 'full-bleed-overlay', confidence: 'high', why: `visual spans ${(visWidth * 100).toFixed(0)}% of width with ${(textOverVisual * 100).toFixed(0)}% of the text over it` };
  }
  if (visArea > 0.5 && textOverVisual < 0.2) {
    return { id: 'product-dominant', confidence: 'high', why: `visual holds ${(visArea * 100).toFixed(0)}% of the fold, text sits clear of it` };
  }
  if (txt && vis) {
    // Side by side: they share a horizontal band, and one sits clear of the other on x.
    const sharesBand = Math.min(txt.bottom, vis.bottom) - Math.max(txt.top, vis.top) > 0;
    const clearOnX = txt.right <= vis.left + 24 || vis.right <= txt.left + 24;
    if (sharesBand && clearOnX) {
      return { id: 'split', confidence: 'high', why: 'text and visual share a vertical band, side by side' };
    }
    if (!sharesBand) {
      return { id: 'stacked', confidence: 'high', why: 'text and visual are stacked vertically' };
    }
    return { id: 'split', confidence: 'low', why: 'text and visual overlap without one covering the fold' };
  }
  return { id: 'split', confidence: 'low', why: 'could not resolve the relationship between text and visual' };
}

/** @param {string} id */
export function classById(id) {
  return COMPOSITION_CLASSES.find((c) => c.id === id) ?? null;
}
