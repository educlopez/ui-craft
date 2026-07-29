/**
 * population.mjs — how far a fold sits from the crowd it belongs to.
 *
 * Every geometric invariant tried in this analyser turned out inverted when
 * measured: dominance passed generated pages and failed the references,
 * asymmetry would fail framer.com, and "exactly one primary action" passed
 * 7 of 7 generated folds against 4 of 18 references.
 *
 * The two corpora explain why. No metric separates a crafted fold from a
 * generated one by value — every generated range sits inside the reference
 * range. What differs is spread: the generated folds sit near the middle of
 * every axis and never leave it, while crafted folds each commit hard to
 * something. Coefficient of variation for primary actions is 0.71 across
 * references and 0.00 across generated pages.
 *
 * So this asks a different question. Not "is this fold good" — that question
 * has resisted every threshold — but "does this fold stand out anywhere at
 * all". That one is answerable, because it is a statement about a population
 * rather than about a page.
 */

/**
 * Median and scaled MAD per axis across the 18 reference folds in
 * evals/fold/reference-corpus.json, measured at 1440x900.
 *
 * Embedded rather than imported so the MCP bundle stays self-contained.
 * Regenerate with: node scripts/fold/corpus.mjs --out evals/fold/reference-corpus.json
 *
 * MAD rather than standard deviation: with 18 samples and folds like neon.com
 * at 6.47x dominance, one outlier would otherwise widen the scale enough to
 * make everything look ordinary.
 */
export const POPULATION = {
  n: 18,
  viewport: { width: 1440, height: 900 },
  axes: {
    dominance: { median: 1.7, mad: 0.623 },
    symmetry: { median: 0.49, mad: 0.193 },
    primaryActions: { median: 3, mad: 2.965 },
    structural: { median: 69, mad: 64.493 },
    textElements: { median: 18.5, mad: 16.309 },
  },
};

/**
 * Measured separation, leave-one-out on the references so nothing is compared
 * against itself.
 *
 *   references  median max-deviation 1.90, range 0.7-8.1
 *   generated   median max-deviation 0.82, range 0.7-1.8
 *
 * Real, and not clean. At a cut of 1.5 this catches 6 of 7 generated folds and
 * also flags 7 of 18 references — a well-crafted fold gets called ordinary
 * about two times in five. That is why this is reported and never enforced.
 */
export const SEPARATION = {
  referenceMedian: 1.9,
  generatedMedian: 0.82,
  cut: 1.5,
  caughtGenerated: '6/7',
  falsePositives: '7/18 references',
};

/**
 * How far this fold sits from the reference median on each axis, and which
 * axis it commits to hardest.
 *
 * @param {{dominance?: number, symmetry?: number, primaryActions?: number, structural?: number, textElements?: number}} m
 */
export function deviationProfile(m) {
  const axes = [];
  for (const [key, { median, mad }] of Object.entries(POPULATION.axes)) {
    const value = m[key];
    if (!Number.isFinite(value)) continue;
    axes.push({ axis: key, value, median, deviation: +Math.abs((value - median) / (mad || 1e-9)).toFixed(2) });
  }
  axes.sort((a, b) => b.deviation - a.deviation);

  const strongest = axes[0] ?? null;
  return {
    axes,
    strongest,
    maxDeviation: strongest?.deviation ?? 0,
    // Deliberately not a verdict. It names a fact about where this fold sits,
    // and leaves what to do about it to whoever is looking at the screenshot.
    reading: !strongest
      ? 'nothing measurable to compare'
      : strongest.deviation >= SEPARATION.cut
        ? `commits hardest on ${strongest.axis}: ${strongest.value} against a reference median of ${strongest.median} (${strongest.deviation}x the population spread)`
        : `sits near the reference median on every axis — closest to standing out on ${strongest.axis} at ${strongest.deviation}x the population spread. Generated folds cluster here (median ${SEPARATION.generatedMedian}) and so do ${SEPARATION.falsePositives}, so this is a prompt to look, not a fault`,
  };
}
