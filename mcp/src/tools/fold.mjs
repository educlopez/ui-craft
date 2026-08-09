/**
 * fold.mjs — MCP tools for the fold: draw a composition, then verify the render.
 *
 * check_fold returns the screenshot as an image block alongside the numbers, so
 * the agent looks at what it built instead of reasoning about source it wrote.
 */

import { measureFold, evaluateFold } from '../../../scripts/fold/analyze.mjs';
import { drawClasses, classById, CLASS_IDS } from '../../../scripts/fold/classes.mjs';


/** The project the server was started in, or null where there is no cwd to read. */
function safeCwd() {
  try {
    return process.cwd() || null;
  } catch {
    return null; // a deleted working directory throws rather than returning ''
  }
}

/**
 * A short digest of the seed, reported instead of the seed itself. Enough to answer "why
 * these three, and will I get them again", without echoing an absolute path back into a
 * transcript.
 */
function shortSeed(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Draw composition classes for a fresh attempt.
 *
 * The seed defaults to the working directory, which is the project the server was started
 * in. That is what makes two projects differ: the ordering was previously the array index,
 * so every project's first landing drew the same three classes and the across-project
 * variance of the one anti-sameness mechanism was zero. Within a project the draw stays
 * stable across runs, because a directory is not a random number.
 *
 * @param {{ used?: string[], count?: number, seed?: string }} input
 */
export function foldCandidates({ used = [], count = 3, seed } = {}) {
  const unknown = used.filter((id) => !CLASS_IDS.includes(id));
  if (unknown.length) {
    return { error: `Unknown composition class: ${unknown.join(', ')}. Known: ${CLASS_IDS.join(', ')}`, candidates: [] };
  }
  const resolvedSeed = seed ?? safeCwd();
  const drawn = drawClasses({ used, count, seed: resolvedSeed });
  return {
    seed: resolvedSeed ? shortSeed(resolvedSeed) : null,
    candidates: drawn.map((c) => ({
      id: c.id,
      name: c.name,
      structure: c.structure,
      demands: c.demands,
      sacrifices: c.sacrifices,
      spent: used.includes(c.id),
    })),
    used,
    instruction:
      'Build one fold per candidate, each committing fully to its class — a half-hearted version of a class is a split in disguise. ' +
      'Render each and run check_fold, then choose on the evidence. Do not converge the three toward one another.',
  };
}

/**
 * Render a URL and judge its fold.
 * @param {{ url?: string, costly_detail?: string, expected_class?: string, width?: number, height?: number }} input
 */
export async function checkFold({ url, costly_detail, expected_class, width, height } = {}) {
  if (!url) {
    return { error: 'Input required: `url` of the rendered page (a dev server URL is fine)', checks: [] };
  }
  if (expected_class && !CLASS_IDS.includes(expected_class)) {
    return { error: `Unknown expected_class "${expected_class}". Known: ${CLASS_IDS.join(', ')}`, checks: [] };
  }

  let measurement;
  try {
    measurement = await measureFold(url, { width, height });
  } catch (e) {
    return { error: e?.message ?? String(e), checks: [] };
  }

  const { screenshot, ...m } = measurement;
  const verdict = evaluateFold(m, { costlyDetail: costly_detail });

  const drift =
    expected_class && verdict.composition.id !== expected_class
      ? `Drift: asked for "${classById(expected_class)?.name ?? expected_class}", built "${classById(verdict.composition.id)?.name ?? verdict.composition.id}" — ${verdict.composition.why}.`
      : null;

  return {
    url,
    composition: verdict.composition,
    expected_class: expected_class ?? null,
    drift,
    checks: verdict.checks,
    observations: verdict.observations,
    summary: { passed: verdict.passed, total: verdict.total, ok: verdict.ok && !drift },
    measured: {
      dominance: Number.isFinite(m.dominance) ? +m.dominance.toFixed(2) : null,
      symmetry: +m.symmetry.toFixed(2),
      text_elements: m.textElements,
      supporting_words: m.supportingWords,
      primary_actions: m.primaryActions,
    },
    screenshot,
  };
}
