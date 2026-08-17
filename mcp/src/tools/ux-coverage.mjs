/**
 * ux-coverage.mjs
 * MCP tool: ux_coverage
 *
 * Returns the parts a screen of a given kind needs in order to be complete, plus the
 * reporting contract for saying which are present. Data source: coverage-data.mjs.
 *
 * This is the completeness axis, not the distinction axis. acceptance_bar answers
 * "is this designed"; ux_coverage answers "does this have the parts screens of its
 * kind need". They are reported side by side and never combined into one number.
 *
 * Report-only by contract: the response carries the marker vocabulary and the
 * no-score rule with it, so the reporting discipline travels with the data instead
 * of living only in a reference file the caller may not have opened.
 */

import coverageData from '../coverage-data.mjs';

const ARCHETYPES = coverageData?.archetypes ?? {};
const KNOWN = Object.keys(ARCHETYPES);

/**
 * The reporting contract, returned with every successful lookup.
 *
 * Markers instead of a score because coverage is a hygiene axis, and hygiene axes
 * tie at the top — score_ui already demonstrated that on this codebase. A count or
 * a percentage also turns `not-needed` into a failure, which is the one reading the
 * marker set exists to prevent.
 */
const REPORTING = {
  markers: [
    { marker: 'present', meaning: 'the part is there, doing what it describes' },
    { marker: 'partial', meaning: 'there but incomplete or weakened — say which half is missing' },
    { marker: 'missing', meaning: 'not there, and it should be — say what it costs the user' },
    { marker: 'not-needed', meaning: 'absent and that is correct here — requires a stated reason, not just an absence you would rather not flag' },
    { marker: 'unknown', meaning: 'what you were given does not show enough to tell — say whether more input would settle it' },
  ],
  rules: [
    'Report every item, in order. Never merge, split, reorder or drop one.',
    'No score, no count, no percentage. "6 of 8" makes not-needed read as a failure and turns a review into a grade.',
    'Report alongside the distinction axis (check_anti_slop / score_ui), never folded into it.',
    'Coverage never gates. It does not fail a build and does not exit non-zero.',
    'not-needed requires a reason. If you cannot say why it does not apply, it is missing.',
    'Do not invent presence. If you cannot see it, you cannot confirm it, however likely it is to exist.',
    'A missing item is reported with its cost, not just its name — the cost is what makes it arguable.',
  ],
};

/**
 * Look up the coverage parts for a screen archetype.
 *
 * Called with no archetype, returns the catalogue rather than an error — a caller
 * that does not yet know the vocabulary can pick from one round-trip instead of two.
 *
 * @param {{ archetype?: string }} input
 * @returns {object}
 */
export function uxCoverage({ archetype } = {}) {
  if (!coverageData || KNOWN.length === 0) {
    return {
      error: 'Could not load coverage-data.mjs — server data file is missing or corrupt',
      archetype: archetype ?? null,
      items: [],
    };
  }

  if (!archetype) {
    return {
      archetype: null,
      catalogue: KNOWN.map((key) => ({
        archetype: key,
        label: ARCHETYPES[key].label,
        family: ARCHETYPES[key].family,
        also: ARCHETYPES[key].also,
      })),
      items: [],
      note: 'Pass one `archetype` from the catalogue. Match on `also` when the user\'s words do not match the key.',
    };
  }

  const key = resolveArchetype(archetype);

  if (!key) {
    return {
      error:
        `No coverage data for "${archetype}". Known archetypes: ${KNOWN.join(', ')}. ` +
        'Coverage is deliberately partial — dashboard, landing and auth are served by acceptance_bar instead, ' +
        'and an unlisted surface is not a failure. Review it without a coverage pass.',
      archetype,
      items: [],
    };
  }

  const entry = ARCHETYPES[key];

  return {
    archetype: key,
    label: entry.label,
    family: entry.family,
    states: entry.states,
    items: entry.items,
    reporting: REPORTING,
  };
}

/**
 * Resolve a caller's word to an archetype key: exact key, then label, then the
 * `also` vocabulary. Case- and separator-insensitive, because "data table",
 * "data-table" and "Data Table" are the same request.
 */
function resolveArchetype(input) {
  const norm = normalize(input);

  if (ARCHETYPES[input]) return input;

  for (const key of KNOWN) {
    if (normalize(key) === norm) return key;
    if (normalize(ARCHETYPES[key].label) === norm) return key;
    if ((ARCHETYPES[key].also ?? []).some((a) => normalize(a) === norm)) return key;
  }

  return null;
}

function normalize(s) {
  return String(s).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

export const KNOWN_ARCHETYPES = KNOWN;
