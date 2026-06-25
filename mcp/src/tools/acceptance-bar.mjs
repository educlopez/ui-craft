/**
 * acceptance-bar.mjs
 * MCP tool: acceptance_bar
 * Returns deterministic acceptance checklist items for a given UI surface.
 * Data source: acceptance-data.mjs (hand-derived from recipe-*.md + finish-bar.md).
 * Imported as an ESM module (not a runtime file read) so it inlines into the
 * published bundle and resolves from source on every Node version.
 */

import acceptanceData from '../acceptance-data.mjs';

// Derive KNOWN_SURFACES from the data so it can't drift from the source.
const KNOWN_SURFACES = acceptanceData ? Object.keys(acceptanceData) : ['dashboard', 'landing', 'auth', 'generic'];

/**
 * Return acceptance checklist items for the given surface.
 *
 * @param {{ surface: string }} input
 * @returns {{ surface: string, items: Array<{id: string, description: string, category: string}> } | { error: string }}
 */
export function acceptanceBar({ surface } = {}) {
  if (!surface) {
    return {
      error: 'Input required: provide `surface` (one of: dashboard, landing, auth, generic)',
      surface: null,
      items: [],
    };
  }

  if (!KNOWN_SURFACES.includes(surface)) {
    return {
      error: `Unrecognized surface: "${surface}". Known surfaces: ${KNOWN_SURFACES.join(', ')}`,
      surface,
      items: [],
    };
  }

  if (!acceptanceData) {
    return {
      error: 'Could not load acceptance-data.json — server data file is missing or corrupt',
      surface,
      items: [],
    };
  }

  const items = acceptanceData[surface];
  if (!items || !Array.isArray(items)) {
    return {
      error: `No acceptance data found for surface: "${surface}"`,
      surface,
      items: [],
    };
  }

  return {
    surface,
    items,
  };
}
