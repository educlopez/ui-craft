/**
 * acceptance-bar.mjs
 * MCP tool: acceptance_bar
 * Returns deterministic acceptance checklist items for a given UI surface.
 * Data source: bundled acceptance-data.json (hand-derived from recipe-*.md + finish-bar.md).
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'acceptance-data.json');

// Load once at module init
let acceptanceData;
try {
  acceptanceData = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
} catch (e) {
  acceptanceData = null;
}

const KNOWN_SURFACES = ['dashboard', 'landing', 'auth', 'generic'];

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
