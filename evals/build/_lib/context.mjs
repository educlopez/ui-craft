/**
 * context.mjs — the scoring context handed to every build eval's EVAL.mjs.
 *
 * A build eval scores TWO artifacts, and the split matters:
 *
 *   - the workspace  — the files the agent produced
 *   - the transcript — what the agent said before it produced them
 *
 * Half of what the skill promises is transcript-only. "Output the Craft Read before
 * writing code" cannot be checked against a directory: the files look identical whether
 * the agent declared its read or improvised silently. The first blind audit found exactly
 * that — right elements, wrong shape — and no file-based scorer would have caught it.
 *
 * Scorers get helpers, never raw plumbing: `check()` records a named pass/fail with the
 * evidence that decided it, so a failing eval reports WHY without the author writing
 * reporting code. A check with no evidence is not a check.
 *
 * Boundary: this file knows how to LOOK, never what is good. Every threshold lives in the
 * eval that asserts it, next to the rule it came from.
 *
 * Zero external dependencies. Node 18+.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreUI } from '../../quality/score.mjs';
import { scan } from '../../../scripts/detect.mjs';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const SOURCE_EXT = new Set(['.jsx', '.tsx', '.js', '.ts', '.css', '.html', '.vue', '.svelte', '.astro']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.git', '.next', 'coverage']);

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name)) await walk(path.join(dir, e.name), out);
    } else if (SOURCE_EXT.has(path.extname(e.name))) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

/** Every file, whatever its extension — used for seeds, where markdown is the payload. */
async function walkAll(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name)) await walkAll(path.join(dir, e.name), out);
    } else out.push(path.join(dir, e.name));
  }
  return out;
}

/** Strip JSX tags and expressions so word counts measure prose, not markup. */
export function visibleText(jsxSnippet) {
  return String(jsxSnippet)
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(text) {
  const t = visibleText(text);
  return t ? t.split(' ').filter(Boolean).length : 0;
}

/**
 * Build the context for one scoring run.
 *
 * @param {{ workspace: string, transcript: string }} input
 */
export async function makeContext({
  workspace,
  transcript = '',
  preCode = null,
  toolUses = [],
  refsRead = [],
  seedDir = null,
}) {
  const files = await walk(workspace);
  const contents = new Map();
  for (const f of files) {
    contents.set(f, await fs.readFile(f, 'utf8').catch(() => ''));
  }

  // What the harness provisioned, so a scorer can credit the agent only for its own deltas.
  // Without this a redesign eval scores the seed it was handed: the dated page it was asked
  // to modernise already contains the headings and CTAs the checklist wants preserved.
  // Walked WITHOUT the source-extension filter. The first version reused it and so could not
  // see `.ui-craft/brief.md` or `tokens.md` — the two files a seeded project exists to
  // provide. It reported one seed file out of three and the eval read as under-provisioned
  // when the provisioning was fine.
  const seed = new Map();
  if (seedDir) {
    for (const f of await walkAll(seedDir)) {
      seed.set(path.relative(seedDir, f), await fs.readFile(f, 'utf8').catch(() => ''));
    }
  }
  // "Provisioned" means UNTOUCHED, not "started as seed". A redesign edits the seed in
  // place, so excluding every seeded path left that scorer reading an empty workspace and
  // reporting that headings, routes and pricing tiers had all been dropped — from a build
  // that preserved every one. The agent's work is the new files plus the changed ones.
  const seedAbs = new Set(
    [...seed]
      .map(([rel, original]) => [path.join(workspace, rel), original])
      .filter(([abs, original]) => contents.has(abs) && contents.get(abs) === original)
      .map(([abs]) => abs)
  );

  const checks = [];
  const record = (name, pass, evidence, opts = {}) => {
    if (!evidence) throw new Error(`check "${name}" recorded with no evidence — a check with no evidence is not a check`);
    checks.push({ name, pass: Boolean(pass), evidence: String(evidence).slice(0, 400), ...opts });
    return Boolean(pass);
  };

  /**
   * A check whose question is "did this happen BEFORE the first write".
   *
   * When the transcript cannot answer that, this records UNMEASURABLE instead of a verdict.
   * `ctx.check()` already refuses an empty evidence string on the principle that a check
   * which cannot say what decided it is not a check; recording a pass for a question the
   * input cannot answer is the same failure wearing a ✓.
   */
  const recordOrdered = (name, pass, evidence) => {
    if (preCode === null) {
      return record(
        name,
        true,
        `UNMEASURABLE — this transcript carries no tool-use events, so there is no first write to order against. Not a pass: the question was not asked.`,
        { unmeasurable: true }
      );
    }
    return record(name, pass, evidence);
  };

  return {
    workspace,
    transcript,
    /**
     * Only what the agent said BEFORE its first Write/Edit.
     *
     * The checklist asks whether the Craft Read came before the code, and that is not the
     * same question as whether it appears at all: a read produced after the files exist is
     * a summary of decisions already made, which is exactly the habit the gate exists to
     * prevent.
     *
     * Falls back to the full transcript when the driver could not order events — a plain
     * `.txt` recorded transcript carries no tool-use events, so there is no first write to
     * split on. The fallback keeps such a fixture scoreable, but it turns "before the first
     * write" into "appears anywhere", and the old comment here claimed that was the opposite
     * of a silent pass. It is exactly a silent pass: the only fixture that ever passed the
     * Craft Read check was a `.txt` one, and its ✓ meant "somewhere in the transcript".
     *
     * So the fallback stays and `orderingKnown` tells the truth about it. Ordering-dependent
     * checks must use `checkOrdered`, which reports UNMEASURABLE rather than a verdict.
     */
    preCode: preCode ?? transcript,
    /** Whether preCode is really "before the first write" or the whole transcript. */
    orderingKnown: preCode !== null,
    /** Tool names in call order — `toolUses.includes('Skill')` is how an arm proves itself. */
    toolUses,
    /** Reference files opened before the first write, in order. */
    refsRead,
    /** Absolute paths of every source file in the workspace, seed included. */
    files: () => [...contents.keys()],
    /** The starting state, as [relPath, source] pairs — empty when the eval has no seed. */
    seedFiles: () => [...seed],
    /** A seeded file's ORIGINAL content, for before/after comparisons. */
    seedOf: (suffix) => {
      for (const [p, src] of seed) if (p.endsWith(suffix)) return src;
      return null;
    },
    /** True when the agent created this file rather than being handed it. */
    isNew: (relPath) => seed.size > 0 && !seed.has(relPath),
    /** Paths relative to the workspace — what a report should show. */
    rel: (p) => path.relative(workspace, p),
    /** Source of one file, matched by path suffix (e.g. "components/Hero.jsx"). */
    file: (suffix) => {
      for (const [p, src] of contents) if (p.endsWith(suffix)) return src;
      return null;
    },
    /** Every file whose path matches, as [relPath, source] pairs. */
    match: (re) => [...contents].filter(([p]) => re.test(p)).map(([p, src]) => [path.relative(workspace, p), src]),
    /** Produced source concatenated, seed excluded — for "does this appear anywhere". */
    all: ({ includeSeed = false } = {}) =>
      [...contents]
        .filter(([p]) => includeSeed || !seedAbs.has(p))
        .map(([, src]) => src)
        .join('\n'),
    /**
     * First regex hit across the workspace, with the file it came from.
     *
     * Skips seeded files. Scoring what the harness provisioned is the failure this whole
     * seed mechanism was supposed to prevent, and the first seeded eval walked straight into
     * it: the raw-hex check flagged `#ffffff` in the token spine the harness handed over.
     * Pass `{ includeSeed: true }` when a check is deliberately about the starting state.
     */
    find: (re, { includeSeed = false } = {}) => {
      for (const [p, src] of contents) {
        if (!includeSeed && seedAbs.has(p)) continue;
        const m = src.match(re);
        if (m) return { file: path.relative(workspace, p), match: m[0], groups: m.slice(1) };
      }
      return null;
    },
    /**
     * Deterministic UICraftScore over the produced files.
     *
     * `scoreUI` grades one file, so a surface is graded file by file and reported as the
     * MINIMUM, not the mean. A surface is seen whole: one component with no focus states
     * is a broken surface however clean its neighbours are, and a mean would let eleven
     * good files hide it. `worst` names the file so a failure is actionable.
     */
    score: async () => {
      const results = [];
      for (const [p] of contents) {
        const r = await scoreUI({ path: p });
        if (r?.overall) results.push({ file: path.relative(workspace, p), ...r.overall });
      }
      if (!results.length) return { min: 0, mean: 0, worst: null, files: [] };
      results.sort((a, b) => a.score - b.score);
      const mean = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
      return { min: results[0].score, mean, worst: results[0], files: results };
    },
    /**
     * Every class name on the first element matching `tagRe`, however className is written.
     *
     * Real React does not hand you `className="..."`. It hands you `className={[...].join(' ')}`,
     * `clsx(...)`, template literals, or a ternary — and a regex that only understands quoted
     * strings reports "could not read the classes" on a perfectly fine component. That is a
     * false failure, which is worse than a miss: it accuses the build of something the build
     * did not do. So this collects every string literal inside the className expression and
     * concatenates them, which is what the browser effectively sees.
     */
    classes: (src, tagRe) => {
      const el = String(src ?? '').match(new RegExp(`<${tagRe.source ?? tagRe}\\b[\\s\\S]{0,1200}?>`, 'i'));
      if (!el) return '';
      const attr = el[0].match(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]*)\})/);
      if (!attr) return '';
      if (attr[1] ?? attr[2]) return (attr[1] ?? attr[2]).trim();
      // An expression. Two passes, because the forms nest: template literals carry literal
      // text with `${...}` holes in it, and those holes often contain a ternary whose
      // branches are themselves class strings. Collecting only one form loses the other.
      const expr = attr[3];
      const out = [];
      // Backtick text, with interpolations removed — a `${x}` is not a class name, and
      // leaving it in risks matching a class that only appears inside an expression.
      for (const m of expr.matchAll(/`([^`]*)`/g)) out.push(m[1].replace(/\$\{[^}]*\}/g, ' '));
      // Every quoted literal anywhere in the expression: array-join entries, clsx arguments,
      // and both branches of a ternary. Either branch can be the class the user sees.
      for (const m of expr.matchAll(/(?:"([^"]*)"|'([^']*)')/g)) out.push(m[1] ?? m[2]);
      return out.join(' ').replace(/\s+/g, ' ').trim();
    },
    /**
     * Source of the component playing a role, found by filename alias.
     *
     * Looking up `KpiCard.jsx` by exact name fails the moment a build calls its cards
     * `StatTile` or `MetricTile` — a vocabulary miss reported as a craft failure, which is
     * the worst kind of false negative because it looks like a finding.
     */
    component: (aliases) => {
      const re = new RegExp(`(${aliases.join('|')})[^/]*\\.(jsx|tsx)$`, 'i');
      for (const [p, src] of contents) if (re.test(p)) return { file: path.relative(workspace, p), src };
      return null;
    },
    /** Anti-slop findings over the produced files. */
    detect: () => scan(workspace),
    /** Record a named result. `pass` false is a finding, not an exception. */
    check: record,
    checkOrdered: recordOrdered,
    checks,
    wordCount,
    visibleText,
    REPO_ROOT,
  };
}

/**
 * Run one eval's scorer and fold its checks into a verdict.
 * A scorer that throws fails the eval rather than crashing the run — a broken scorer is
 * a result, and swallowing it would report a clean sweep that never ran.
 */
export async function runScorer(scorer, ctx) {
  try {
    await scorer(ctx);
  } catch (e) {
    ctx.checks.push({
      name: 'scorer executed',
      pass: false,
      evidence: `scorer threw: ${e?.message ?? String(e)}`,
      fatal: true,
    });
  }
  // Unmeasurable checks are excluded from the ratio rather than counted as passes. Left in
  // the denominator they would read as coverage the run does not have.
  const measured = ctx.checks.filter((c) => !c.unmeasurable);
  const unmeasurable = ctx.checks.filter((c) => c.unmeasurable);
  const failed = measured.filter((c) => !c.pass);
  return {
    pass: failed.length === 0,
    total: measured.length,
    failed: failed.length,
    unmeasurable: unmeasurable.length,
    checks: ctx.checks,
  };
}
