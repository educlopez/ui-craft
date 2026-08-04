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
export async function makeContext({ workspace, transcript = '', preCode = null, toolUses = [], refsRead = [] }) {
  const files = await walk(workspace);
  const contents = new Map();
  for (const f of files) {
    contents.set(f, await fs.readFile(f, 'utf8').catch(() => ''));
  }

  const checks = [];
  const record = (name, pass, evidence, opts = {}) => {
    if (!evidence) throw new Error(`check "${name}" recorded with no evidence — a check with no evidence is not a check`);
    checks.push({ name, pass: Boolean(pass), evidence: String(evidence).slice(0, 400), ...opts });
    return Boolean(pass);
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
     * prevent. Falls back to the full transcript when the driver could not order events, so
     * a recorded fixture without ordering still scores rather than silently passing.
     */
    preCode: preCode ?? transcript,
    /** Tool names in call order — `toolUses.includes('Skill')` is how an arm proves itself. */
    toolUses,
    /** Reference files opened before the first write, in order. */
    refsRead,
    /** Absolute paths of every source file the agent produced. */
    files: () => [...contents.keys()],
    /** Paths relative to the workspace — what a report should show. */
    rel: (p) => path.relative(workspace, p),
    /** Source of one file, matched by path suffix (e.g. "components/Hero.jsx"). */
    file: (suffix) => {
      for (const [p, src] of contents) if (p.endsWith(suffix)) return src;
      return null;
    },
    /** Every file whose path matches, as [relPath, source] pairs. */
    match: (re) => [...contents].filter(([p]) => re.test(p)).map(([p, src]) => [path.relative(workspace, p), src]),
    /** All produced source concatenated — for "does this appear anywhere" questions. */
    all: () => [...contents.values()].join('\n'),
    /** First regex hit across the workspace, with the file it came from. */
    find: (re) => {
      for (const [p, src] of contents) {
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
  const failed = ctx.checks.filter((c) => !c.pass);
  return {
    pass: failed.length === 0,
    total: ctx.checks.length,
    failed: failed.length,
    checks: ctx.checks,
  };
}
