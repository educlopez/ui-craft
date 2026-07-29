#!/usr/bin/env node
/**
 * corpus.mjs — measure a list of folds and record what they came out as.
 *
 * Exists because the first thresholds in this analyser were invented, and every
 * reference page failed them. A threshold is a claim about a distribution, so
 * the distribution has to be written down before anyone claims anything.
 *
 * Usage:
 *   node scripts/fold/corpus.mjs                 # measure the reference list
 *   node scripts/fold/corpus.mjs --out file.json # write the dataset
 *   node scripts/fold/corpus.mjs <url> [<url>]   # measure specific pages
 *
 * Needs a browser, which it finds rather than downloads. Pages that fail are
 * recorded as failures instead of quietly shrinking the sample.
 */

import { writeFile } from 'node:fs/promises';
import { measureFold } from './analyze.mjs';
import { classifyFold } from './classes.mjs';

/**
 * Landing pages held up as well-crafted, spread across composition classes on
 * purpose: a corpus of one shape teaches the analyser one shape.
 *
 * This is the positive half. The negative half — folds a designer would call
 * generic — cannot be assembled honestly by picking sites I happen to dislike;
 * it needs human labels. Until it exists, no threshold here is defensible.
 */
export const REFERENCE_FOLDS = [
  'https://stripe.com',
  'https://linear.app/homepage',
  'https://vercel.com',
  'https://resend.com',
  'https://www.framer.com',
  'https://clerk.com',
  'https://supabase.com',
  'https://railway.com',
  'https://neon.com',
  'https://sentry.io',
  'https://posthog.com',
  'https://cal.com',
  'https://dub.co',
  'https://www.raycast.com',
  'https://retool.com',
  'https://mux.com',
  'https://upstash.com',
  'https://www.prisma.io',
];

/** @param {number[]} xs @param {number} p */
function percentile(xs, p) {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}

/**
 * Measure one page into a corpus row. Never throws — a page that cannot be
 * measured is a fact about the corpus, not a reason to lose the run.
 */
export async function measureRow(url, opts = {}) {
  try {
    const m = await measureFold(url, { width: 1440, height: 900, ...opts });
    
    return {
      url,
      ok: true,
      composition: classifyFold(m).id,
      dominance: Number.isFinite(m.dominance) ? +m.dominance.toFixed(2) : null,
      symmetry: +m.symmetry.toFixed(2),
      heroTextElements: m.heroTextElements,
      heroWords: m.heroWords,
      heroScoped: m.heroScoped,
      textElements: m.textElements,
      primaryActions: m.primaryActions,
      structural: m.structural,
      namingStatement: (m.namingStatement || '').slice(0, 120),
    };
  } catch (error) {
    return { url, ok: false, error: error?.message ?? String(error) };
  }
}

/** @param {object[]} rows */
export function summariseCorpus(rows) {
  const good = rows.filter((r) => r.ok);
  const stat = (key) => {
    const xs = good.map((r) => r[key]).filter((x) => typeof x === 'number');
    return { n: xs.length, min: percentile(xs, 0), p25: percentile(xs, 25), median: percentile(xs, 50), p75: percentile(xs, 75), max: percentile(xs, 100) };
  };
  const classes = {};
  for (const r of good) classes[r.composition] = (classes[r.composition] ?? 0) + 1;
  return {
    measured: good.length,
    failed: rows.length - good.length,
    classes,
    dominance: stat('dominance'),
    symmetry: stat('symmetry'),
    heroTextElements: stat('heroTextElements'),
    heroWords: stat('heroWords'),
    heroScopedShare: good.length ? +(good.filter((r) => r.heroScoped).length / good.length).toFixed(2) : null,
  };
}

async function main(argv) {
  const outIndex = argv.indexOf('--out');
  const out = outIndex >= 0 ? argv[outIndex + 1] : null;
  const urls = argv.filter((a, i) => a.startsWith('http') && i !== outIndex + 1);
  const targets = urls.length ? urls : REFERENCE_FOLDS;

  const rows = [];
  for (const url of targets) {
    const row = await measureRow(url);
    rows.push(row);
    const label = url.replace(/^https?:\/\//, '').slice(0, 26).padEnd(26);
    console.log(
      row.ok
        ? `${label} ${String(row.dominance).padStart(5)}x  sym ${String(row.symmetry).padStart(4)}  hero ${String(row.heroTextElements).padStart(3)}/${String(row.heroWords).padStart(3)}${row.heroScoped ? '' : '*'}  ${row.composition}`
        : `${label} FAILED — ${row.error.slice(0, 60)}`,
    );
  }

  const summary = summariseCorpus(rows);
  console.log('\n' + JSON.stringify(summary, null, 2));
  console.log('\n* hero block could not be isolated — that row is not comparable on hero counts');

  if (out) {
    await writeFile(out, JSON.stringify({ measuredAt: null, viewport: { width: 1440, height: 900 }, rows, summary }, null, 2));
    console.log(`\nwritten to ${out}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
  });
}
