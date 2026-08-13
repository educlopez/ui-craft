#!/usr/bin/env node
/**
 * eval-build.mjs — agent-backed build evals.
 *
 * Where scripts/eval.mjs scores fixtures that never change, this runs an agent against a
 * prompt and scores what it produces. That is the only way to test the half of the skill
 * that is about behaviour rather than rules: whether the instruction was followed, not
 * whether it was written.
 *
 * Usage:
 *   node scripts/eval-build.mjs --list
 *   node scripts/eval-build.mjs --eval craft-dashboard-001 --experiment skill
 *   node scripts/eval-build.mjs --suite benchmark --experiment skill,no-skill
 *   node scripts/eval-build.mjs --eval craft-landing-001 --record path/to/workspace \
 *                               --transcript path/to/transcript.txt
 *
 * Flags accept repeats or comma-separated values. `--record` scores an existing workspace
 * and spends no agent run, which is how the scorers get tested in CI.
 *
 * Exit codes:
 *   0  — every pair passed
 *   1  — at least one pair failed a check
 *   2  — arg error / eval not found / driver missing
 *
 * Zero external dependencies. Node 18+.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { makeContext, runScorer } from '../evals/build/_lib/context.mjs';
import { EXPERIMENTS, resolveExperiments, parseStream } from '../evals/build/_lib/experiments.mjs';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVALS_DIR = path.join(REPO_ROOT, 'evals', 'build');
const RESULTS_DIR = path.join(REPO_ROOT, 'results');
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);
const red = (s) => c('31', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);
const cyan = (s) => c('36', s);

function parseArgs(argv) {
  const flags = { eval: [], experiment: [], suite: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => String(argv[++i] ?? '').split(',').filter(Boolean);
    if (a === '--eval') flags.eval.push(...take());
    else if (a === '--experiment') flags.experiment.push(...take());
    else if (a === '--suite') flags.suite.push(...take());
    else if (a === '--record') flags.record = argv[++i];
    else if (a === '--transcript') flags.transcript = argv[++i];
    else if (a === '--model') flags.model = argv[++i];
    else if (a === '--timeout') flags.timeout = Number(argv[++i]) * 1000;
    else if (a === '--json') flags.json = true;
    else if (a === '--keep') flags.keep = true;
    else if (a === '--list') flags.list = true;
    else if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--') break;
    else if (a.startsWith('-')) return { error: `unknown flag: ${a}` };
  }
  return flags;
}

/** Frontmatter is deliberately hand-parsed: one dependency here would be one too many. */
function parsePrompt(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, text: raw.trim() };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, text: m[2].trim() };
}

async function loadEvals() {
  const out = [];
  let dirs;
  try {
    dirs = await fs.readdir(EVALS_DIR, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const d of dirs) {
    if (!d.isDirectory() || d.name.startsWith('_')) continue;
    const dir = path.join(EVALS_DIR, d.name);
    const promptPath = path.join(dir, 'PROMPT.md');
    const scorerPath = path.join(dir, 'EVAL.mjs');
    try {
      const raw = await fs.readFile(promptPath, 'utf8');
      await fs.access(scorerPath);
      const { meta, text } = parsePrompt(raw);
      out.push({ id: meta.id ?? d.name, dir, scorerPath, meta, prompt: text });
    } catch (e) {
      out.push({ id: d.name, dir, broken: `missing PROMPT.md or EVAL.mjs (${e.code ?? e.message})` });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Copy an eval's `local/` starting state into the sandbox. Returns how many files landed. */
async function copySeed(from, to) {
  try {
    await fs.access(from);
  } catch {
    return 0;
  }
  let n = 0;
  const walk = async (src, dst) => {
    await fs.mkdir(dst, { recursive: true });
    for (const e of await fs.readdir(src, { withFileTypes: true })) {
      const s = path.join(src, e.name);
      const d = path.join(dst, e.name);
      if (e.isDirectory()) await walk(s, d);
      else {
        await fs.copyFile(s, d);
        n++;
      }
    }
  };
  await walk(from, to);
  return n;
}

function printChecks(result) {
  for (const ch of result.checks) {
    const mark = ch.unmeasurable ? yellow('  ⊘') : ch.pass ? green('  ✓') : red('  ✗');
    process.stdout.write(`${mark} ${ch.name}\n${dim(`      ${ch.evidence}`)}\n`);
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.error) {
    process.stderr.write(`${flags.error}\n`);
    process.exit(2);
  }
  if (flags.help) return printHelp();

  const evals = await loadEvals();
  if (flags.list) {
    process.stdout.write(`${bold('Build evals')}\n`);
    for (const e of evals) {
      process.stdout.write(
        e.broken
          ? `  ${red(e.id)} — ${e.broken}\n`
          : `  ${cyan(e.id)}  suite=${e.meta.suite ?? '?'} track=${e.meta.track ?? '?'} surface=${e.meta.surface ?? '?'}\n`
      );
    }
    process.stdout.write(`\n${bold('Experiments')}\n`);
    for (const [name, x] of Object.entries(EXPERIMENTS)) {
      process.stdout.write(`  ${cyan(name)}  ${dim(x.description)}\n`);
    }
    return;
  }

  const broken = evals.filter((e) => e.broken);
  if (broken.length) {
    process.stderr.write(`${red('Unloadable evals:')} ${broken.map((b) => `${b.id} (${b.broken})`).join(', ')}\n`);
    process.exit(2);
  }

  let selected = evals;
  if (flags.eval.length) selected = evals.filter((e) => flags.eval.includes(e.id));
  if (flags.suite.length) selected = selected.filter((e) => flags.suite.includes(e.meta.suite));
  if (!selected.length) {
    process.stderr.write(`No evals matched. Try --list.\n`);
    process.exit(2);
  }

  // ── Recorded mode: score an existing workspace, spend no agent run ─────────
  if (flags.record) {
    if (selected.length !== 1) {
      process.stderr.write(`--record scores one eval; select exactly one with --eval.\n`);
      process.exit(2);
    }
    const e = selected[0];
    // A .ndjson transcript is a raw stream — from a completed run or a killed one — and is
    // folded the same way live runs fold it, so a rescued partial scores identically.
    let transcript = '';
    let preCode = null;
    let toolUses = [];
    let refsRead = [];
    if (flags.transcript) {
      const rawT = await fs.readFile(flags.transcript, 'utf8');
      if (flags.transcript.endsWith('.ndjson') || rawT.trimStart().startsWith('{')) {
        ({ transcript, preCode, toolUses, refsRead } = parseStream(rawT));
      } else {
        transcript = rawT;
      }
    }
    const { default: scorer } = await import(e.scorerPath);
    const ctx = await makeContext({
      workspace: path.resolve(flags.record),
      transcript,
      preCode,
      toolUses,
      refsRead,
      seedDir: path.join(e.dir, 'local'),
    });
    const result = await runScorer(scorer, ctx);
    if (flags.json) process.stdout.write(`${JSON.stringify({ eval: e.id, experiment: 'recorded', ...result }, null, 2)}\n`);
    else {
      process.stdout.write(`\n${bold(`${e.id}`)} ${dim('× recorded')} → ${result.pass ? green('PASS') : red('FAIL')} ${dim(`(${result.total - result.failed}/${result.total})`)}${result.unmeasurable ? yellow(` ⊘${result.unmeasurable} unmeasurable`) : ''}\n`);
      printChecks(result);
    }
    process.exit(result.pass ? 0 : 1);
  }

  // ── Live mode: agent per (eval × experiment) pair ──────────────────────────
  const names = flags.experiment.length ? flags.experiment : ['skill'];
  let experiments;
  try {
    experiments = resolveExperiments(names);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  const rows = [];
  let failures = 0;

  for (const e of selected) {
    for (const x of experiments) {
      const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `uicraft-eval-${e.id}-${x.name}-`));
      // A seed, when the eval has one. Greenfield cannot answer every question: a redesign
      // needs something to redesign, and whether the skill reads a project's brief and tokens
      // is unanswerable in an empty directory — the files it would read do not exist, so their
      // absence from the read log says nothing. `local/` is that starting state.
      const seeded = await copySeed(path.join(e.dir, 'local'), workspace);
      process.stdout.write(
        `${dim('→')} ${bold(e.id)} ${dim('×')} ${cyan(x.name)} ${dim(workspace)}` +
          `${seeded ? dim(` (seeded: ${seeded} file${seeded === 1 ? '' : 's'})`) : ''}\n`
      );

      const streamPath = path.join(RESULTS_DIR, `${e.id}__${x.name}.stream.ndjson`);
      await fs.rm(streamPath, { force: true });
      const run = await x.run({
        prompt: e.prompt,
        workspace,
        model: flags.model,
        timeoutMs: flags.timeout ?? DEFAULT_TIMEOUT_MS,
        streamTo: streamPath,
      });

      if (run.code !== 0 && !run.transcript) {
        process.stdout.write(`${red('  driver produced nothing')} ${dim(run.stderr?.slice(0, 300) ?? '')}\n`);
      }

      const { default: scorer } = await import(e.scorerPath);
      const ctx = await makeContext({
        workspace,
        transcript: run.transcript ?? '',
        preCode: run.preCode ?? null,
        toolUses: run.toolUses ?? [],
        refsRead: run.refsRead ?? [],
        seedDir: path.join(e.dir, 'local'),
      });
      const result = await runScorer(scorer, ctx);

      // Every run is written out whether it passed or not. A harness that only keeps
      // failures cannot answer "did this get better", which is the question that matters.
      const stamp = `${e.id}__${x.name}`;
      await fs.writeFile(
        path.join(RESULTS_DIR, `${stamp}.json`),
        `${JSON.stringify(
          {
            eval: e.id,
            experiment: x.name,
            meta: e.meta,
            workspace,
            timedOut: Boolean(run.timedOut),
            driverExit: run.code,
            // Whether the arm did what it claims: a `skill` run that never called Skill is
            // not a skill run, and reading it as one would misattribute the whole result.
            usedSkill: Boolean(run.usedSkill),
            toolUses: run.toolUses ?? [],
            refsRead: run.refsRead ?? [],
            ...result,
          },
          null,
          2
        )}\n`
      );
      await fs.writeFile(path.join(RESULTS_DIR, `${stamp}.transcript.txt`), run.transcript ?? '');

      if (!flags.json) {
        process.stdout.write(`${result.pass ? green('  PASS') : red('  FAIL')} ${dim(`${result.total - result.failed}/${result.total}`)}${result.unmeasurable ? yellow(` ⊘${result.unmeasurable}`) : ''}\n`);
        printChecks(result);
      }
      rows.push({ eval: e.id, experiment: x.name, pass: result.pass, failed: result.failed, total: result.total });
      if (!result.pass) failures++;
    }
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  } else {
    process.stdout.write(`\n${bold('Summary')}\n`);
    for (const r of rows) {
      process.stdout.write(
        `  ${r.pass ? green('PASS') : red('FAIL')}  ${r.eval} × ${r.experiment}  ${dim(`${r.total - r.failed}/${r.total}`)}\n`
      );
    }
    process.stdout.write(`${dim(`\nResults written to results/. Workspaces left in ${os.tmpdir()} for inspection.`)}\n`);
  }

  process.exit(failures ? 1 : 0);
}

function printHelp() {
  process.stdout.write(`${bold('eval-build.mjs')} — agent-backed build evals

  --list                       show evals and experiments
  --eval <id[,id]>             select evals (default: all)
  --suite <name[,name]>        filter by frontmatter suite
  --experiment <name[,name]>   agent setups to run (default: skill)
  --record <dir>               score an existing workspace, spend no agent run
  --transcript <file>          transcript to pair with --record
  --model <name>               model override for the driver
  --timeout <seconds>          per-run cap (default 600)
  --json                       machine-readable output
  --help

${bold('Why two experiments')}
  Running \`--experiment skill,no-skill\` on the same eval measures what the skill
  contributes, instead of assuming it contributes anything. That is the test
  writing-skills asks for and the one a repo of rules cannot do by reading itself.
`);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(2);
});
