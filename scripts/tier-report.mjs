#!/usr/bin/env node
/**
 * tier-report.mjs — what a build actually read, against what the skill requires.
 *
 * SKILL.md labels seven references "Tier 1 — Required before writing UI". Whether a passing
 * build opens all seven is an empirical question, and answering it by reading the skill is
 * exactly the mistake the build evals exist to stop.
 *
 * Reads the persisted `.ndjson` streams under results/ — no agent runs.
 *
 * Usage:
 *   node scripts/tier-report.mjs                    # every stream in results/
 *   node scripts/tier-report.mjs <file.ndjson> ...  # specific streams
 *
 * Zero external dependencies. Node 18+.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseStream } from '../evals/build/_lib/experiments.mjs';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_MD = path.join(REPO_ROOT, 'skills', 'ui-craft', 'SKILL.md');
const RESULTS_DIR = path.join(REPO_ROOT, 'results');

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);

/**
 * The tier tables are the source of truth for what is "required" — parse, never hardcode.
 *
 * Keyed by the FULL heading, not by its digit. Keying on `Tier (\d)` folded "Tier 1b" into
 * "Tier 1" and the later section overwrote the earlier one, so the report declared seven
 * always-load refs and silently dropped the one that actually is. An instrument that
 * mismeasures the distinction it exists to check is worse than no instrument.
 */
async function readTiers() {
  const md = await fs.readFile(SKILL_MD, 'utf8');
  const tiers = new Map();
  const sections = md.split(/\n### (Tier [0-9a-z]+[^\n]*)\n/);
  for (let i = 1; i < sections.length; i += 2) {
    const label = sections[i].trim();
    const refs = [...sections[i + 1].matchAll(/\[([a-z0-9-]+)\.md\]\(references\//g)].map((m) => m[1]);
    tiers.set(label, [...new Set(refs)]);
  }
  return tiers;
}

/** The always-load tier is the one whose heading says so — not the one numbered lowest. */
function alwaysTier(tiers) {
  for (const [label, refs] of tiers) if (/always/i.test(label)) return { label, refs };
  for (const [label, refs] of tiers) if (/^Tier 1\b/.test(label)) return { label, refs };
  return { label: 'none found', refs: [] };
}

async function main() {
  const args = process.argv.slice(2);
  let files = args;
  if (!files.length) {
    const entries = await fs.readdir(RESULTS_DIR).catch(() => []);
    files = entries.filter((f) => f.endsWith('.stream.ndjson')).map((f) => path.join(RESULTS_DIR, f));
  }
  if (!files.length) {
    process.stderr.write('No .ndjson streams found. Run an eval first, or pass paths.\n');
    process.exit(2);
  }

  const tiers = await readTiers();
  const { label, refs: tier1 } = alwaysTier(tiers);
  process.stdout.write(`${bold(label)} (${tier1.length}): ${tier1.join(', ') || dim('none')}\n`);
  for (const [l, refs] of tiers) {
    if (l !== label) process.stdout.write(`${dim(`${l} (${refs.length}): ${refs.join(', ')}`)}\n`);
  }
  process.stdout.write('\n');

  // The three recipes are ONE slot, not three: a dashboard build must not read
  // recipe-landing. Counting them separately makes every run look like it missed two
  // required refs, which understates compliance by measuring the wrong denominator.
  const SLOT = 'the surface recipe';
  const isRecipe = (r) => r.startsWith('recipe-');
  const slots = [...new Set(tier1.map((r) => (isRecipe(r) ? SLOT : r)))];

  const readCount = new Map(slots.map((r) => [r, 0]));
  const rows = [];

  for (const f of files) {
    const raw = await fs.readFile(f, 'utf8');
    const { refsRead } = parseStream(raw);
    const hit = [];
    for (const slot of slots) {
      if (slot === SLOT) {
        const which = refsRead.find(isRecipe);
        if (which) hit.push(`${SLOT} (${which})`);
      } else if (refsRead.includes(slot)) {
        hit.push(slot);
      }
    }
    for (const h of hit) readCount.set(h.startsWith(SLOT) ? SLOT : h, readCount.get(h.startsWith(SLOT) ? SLOT : h) + 1);
    const other = refsRead.filter((r) => !tier1.includes(r));
    rows.push({ run: path.basename(f, '.stream.ndjson'), hitTier1: hit, other, slots });
  }

  for (const r of rows) {
    process.stdout.write(`${bold(r.run)}\n`);
    process.stdout.write(`  always-tier read: ${r.hitTier1.length}/${r.slots.length} — ${r.hitTier1.join(', ') || dim('none')}\n`);
    const missed = r.slots.filter((sl) => !r.hitTier1.some((h) => h === sl || h.startsWith(sl)));
    process.stdout.write(`  missed:      ${dim(missed.join(', ') || 'none')}\n`);
    if (r.other.length) process.stdout.write(`  also read:   ${r.other.join(', ')}\n`);
    process.stdout.write('\n');
  }

  process.stdout.write(`${bold('Across')} ${rows.length} run(s)\n`);
  for (const [ref, n] of [...readCount].sort((a, b) => b[1] - a[1])) {
    const bar = n ? green('█'.repeat(n)) : yellow('·');
    process.stdout.write(`  ${ref.padEnd(16)} ${bar} ${n}/${rows.length}\n`);
  }

  const never = [...readCount].filter(([, n]) => n === 0).map(([r]) => r);
  if (never.length) {
    process.stdout.write(
      `\n${yellow('Never opened before a write:')} ${never.join(', ')}\n` +
        `${dim('A reference labelled required that no build opens is not required — it is aspirational.\nThat is a finding about the label, not about the reference.')}\n`
    );
  }
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(2);
});
