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
    // What was seeded, never a value derived from it. An eight-hex FNV-1a of a path looks
    // like redaction and is not: paths are guessable, so anyone holding a candidate list can
    // confirm which one produced the digest. The only thing worth reporting here is whether
    // the order will repeat, and that needs no value at all.
    seeded_by: resolvedSeed ? 'project' : null,
    candidates: drawn.map((c) => ({
      id: c.id,
      name: c.name,
      structure: c.structure,
      demands: c.demands,
      sacrifices: c.sacrifices,
      spent: used.includes(c.id),
    })),
    used,
    // Asked for three folds until 2026-08-13, and across seven measured builds not one agent
    // built more than one. Asking for something nobody does spends the instruction's only
    // read on the part that gets ignored — and the part that got ignored with it was the
    // verification, which is cheap and was skipped in 5 of 7. So: one committed fold, and
    // name expected_class, because a check_fold call without it compares nothing and reads
    // as agreement.
    instruction:
      'Pick ONE of these and commit to it fully — a half-hearted version of a class is a split in disguise. ' +
      'Then render it and call check_fold with `expected_class` set to the id you picked: without that argument it ' +
      'reports what the fold is and cannot tell you whether it is what you intended. If you want to compare classes, ' +
      'build them as separate attempts rather than blending them into one fold.',
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

  // Three outcomes, not two. Without `expected_class` nothing was compared, and reporting
  // that as "no drift" is the shape a false pass takes: measured n=7, one run called this
  // tool as `{"url": …}` alone, got no drift back, and read as compliance — while the class
  // it built was not even among the three it had been offered.
  const compared = Boolean(expected_class);
  const drift =
    compared && verdict.composition.id !== expected_class
      ? `Drift: asked for "${classById(expected_class)?.name ?? expected_class}", built "${classById(verdict.composition.id)?.name ?? verdict.composition.id}" — ${verdict.composition.why}.`
      : null;
  const drift_status = !compared
    ? 'not-compared'
    : drift
      ? 'drifted'
      : 'matched';
  const drift_note = compared
    ? null
    : `Nothing was compared. Pass \`expected_class\` with the class you set out to build — without it this reports what the fold IS and cannot tell you whether it is what you intended. Built: "${classById(verdict.composition.id)?.name ?? verdict.composition.id}".`;

  return {
    url,
    composition: verdict.composition,
    expected_class: expected_class ?? null,
    drift,
    drift_status,
    ...(drift_note ? { drift_note } : {}),
    checks: verdict.checks,
    observations: verdict.observations,
    summary: { passed: verdict.passed, total: verdict.total, ok: verdict.ok && !drift && compared },
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
