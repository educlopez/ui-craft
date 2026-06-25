#!/usr/bin/env node
/**
 * eval.mjs — UICraftScore CLI / benchmark regression gate
 *
 * Usage:
 *   node scripts/eval.mjs <path>            # score one file or directory
 *   node scripts/eval.mjs <path> --json     # JSON output only
 *   node scripts/eval.mjs --baseline        # score all fixtures, assert bands
 *   node scripts/eval.mjs --help
 *
 * Exit codes:
 *   0  — clean / all fixtures within band / score ≥ threshold
 *   1  — score below threshold / fixture out of band / regression detected
 *   2  — arg error / unreadable path
 *
 * Zero external dependencies. Node 18+.
 */

import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreUI } from '../evals/quality/score.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dir, '..');
const BASELINES_PATH = path.join(REPO_ROOT, 'evals', 'quality', 'baselines.json');
const FIXTURES_DIR = path.join(REPO_ROOT, 'evals', 'quality', 'fixtures');

// ─── TTY color helpers ────────────────────────────────────────────────────────
const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const green = (s) => c('32', s);
const cyan = (s) => c('36', s);

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = {
    json: false,
    baseline: false,
    help: false,
    threshold: 70,
    min: null,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.json = true;
    else if (a === '--baseline' || a === '--check') flags.baseline = true;
    else if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--threshold') {
      const val = parseInt(argv[++i], 10);
      if (isNaN(val)) { process.stderr.write('--threshold requires a number\n'); process.exit(2); }
      flags.threshold = val;
    } else if (a.startsWith('--threshold=')) {
      const val = parseInt(a.slice('--threshold='.length), 10);
      if (isNaN(val)) { process.stderr.write('--threshold requires a number\n'); process.exit(2); }
      flags.threshold = val;
    } else if (a === '--min') {
      const val = parseInt(argv[++i], 10);
      if (isNaN(val)) { process.stderr.write('--min requires a number\n'); process.exit(2); }
      flags.min = val;
    } else if (!a.startsWith('--')) {
      positional.push(a);
    }
  }

  return { flags, positional };
}

// ─── Walk (recursive, .tsx only) ─────────────────────────────────────────────

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

// ─── Human output helpers ─────────────────────────────────────────────────────

function gradeColor(grade) {
  if (grade === 'A') return green;
  if (grade === 'B') return cyan;
  if (grade === 'C') return yellow;
  return red;
}

function scoreBar(score) {
  const filled = Math.round(score / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  return `${bar} ${String(score).padStart(3)}`;
}

function printResult(filePath, result, threshold) {
  if (result.error) {
    process.stdout.write(red(`Error: ${result.error}\n`));
    return;
  }
  const { overall, dimensions } = result;
  const gc = gradeColor(overall.grade);
  process.stdout.write('\n');
  process.stdout.write(bold(path.relative(REPO_ROOT, filePath)) + '\n');
  process.stdout.write('─'.repeat(60) + '\n');
  process.stdout.write(`  Overall   ${gc(bold(overall.grade))}  ${scoreBar(overall.score)}\n`);
  process.stdout.write(`  Anti-slop    ${scoreBar(dimensions.anti_slop.score)}  (${dimensions.anti_slop.findings.length} findings)\n`);
  process.stdout.write(`  Tokens       ${scoreBar(dimensions.token_discipline.score)}  (${dimensions.token_discipline.findings.length} findings)\n`);
  process.stdout.write(`  A11y         ${scoreBar(dimensions.a11y.score)}  (${dimensions.a11y.findings.length} findings)\n`);

  const allFindings = [
    ...dimensions.anti_slop.findings.map(f => ({ ...f, dim: 'anti-slop' })),
    ...dimensions.token_discipline.findings.map(f => ({ ...f, dim: 'tokens' })),
    ...dimensions.a11y.findings.map(f => ({ ...f, dim: 'a11y' })),
  ];

  if (allFindings.length > 0) {
    process.stdout.write('\n  Findings:\n');
    for (const f of allFindings) {
      const sevColor = f.severity === 'critical' ? red : (f.severity === 'major' ? yellow : dim);
      process.stdout.write(`    ${dim(`[${f.dim}]`)} ${sevColor(f.severity.padEnd(8))} ${f.rule}\n`);
      if (f.message) process.stdout.write(`              ${dim(f.message.slice(0, 80))}\n`);
    }
  }

  const limitScore = flags_singleton?.min ?? threshold;
  if (overall.score < limitScore) {
    process.stdout.write(red(`\n  Score ${overall.score} is below threshold ${limitScore}\n`));
  }
}

// Singleton ref so printResult can access flags (set before calls)
let flags_singleton = null;

// ─── Baseline mode ────────────────────────────────────────────────────────────

async function runBaseline(flags) {
  let baselines;
  try {
    const raw = readFileSync(BASELINES_PATH, 'utf8');
    baselines = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`Cannot read baselines.json: ${e.message}\n`);
    process.exit(2);
  }

  const fixtures = baselines.fixtures;
  let passed = 0;
  let failed = 0;
  const rows = [];

  for (const [relPath, band] of Object.entries(fixtures)) {
    const absPath = path.join(REPO_ROOT, relPath);
    let result;
    try {
      result = await scoreUI({ path: absPath });
    } catch (e) {
      rows.push({ relPath, status: 'ERROR', score: '?', band: `[${band.scoreMin}, ${band.scoreMax}]`, note: e.message });
      failed++;
      continue;
    }

    if (result.error) {
      rows.push({ relPath, status: 'ERROR', score: '?', band: `[${band.scoreMin}, ${band.scoreMax}]`, note: result.error });
      failed++;
      continue;
    }

    const { score } = result.overall;
    const ok = score >= band.scoreMin && score <= band.scoreMax;
    if (ok) passed++;
    else failed++;
    rows.push({
      relPath,
      status: ok ? 'PASS' : 'FAIL',
      score: String(score),
      band: `[${band.scoreMin}, ${band.scoreMax}]`,
      note: ok ? '' : `score ${score} outside band`,
    });
  }

  if (flags.json) {
    process.stdout.write(JSON.stringify({ passed, failed, rows }, null, 2) + '\n');
  } else {
    process.stdout.write('\n' + bold('Baseline regression check') + '\n');
    process.stdout.write('─'.repeat(70) + '\n');
    for (const row of rows) {
      const sc = row.status === 'PASS' ? green : red;
      const label = sc(row.status.padEnd(5));
      const name = path.basename(row.relPath).padEnd(35);
      process.stdout.write(`  ${label} ${name} score=${row.score.padStart(3)}  band=${row.band}\n`);
      if (row.note) process.stdout.write(`        ${red(row.note)}\n`);
    }
    process.stdout.write('─'.repeat(70) + '\n');
    process.stdout.write(`  ${green(String(passed))} passed  ${failed > 0 ? red(String(failed)) : dim('0')} failed\n\n`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp() {
  process.stdout.write(`UICraftScore CLI v0.30.0\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  node scripts/eval.mjs <path>          # score a file or directory\n`);
  process.stdout.write(`  node scripts/eval.mjs --baseline      # regression gate (all fixtures)\n\n`);
  process.stdout.write(`Options:\n`);
  process.stdout.write(`  --json              emit JSON to stdout (no other output)\n`);
  process.stdout.write(`  --threshold N       exit 1 if score < N (default 70)\n`);
  process.stdout.write(`  --min N             alias for --threshold\n`);
  process.stdout.write(`  --baseline          score fixtures, assert bands, exit 1 on drift\n`);
  process.stdout.write(`  --help, -h          this help\n\n`);
  process.stdout.write(`Exit codes: 0 clean | 1 below threshold / regression | 2 arg error\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// Guard: only run when executed as a script (not imported)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  flags_singleton = flags;

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  if (flags.baseline) {
    await runBaseline(flags);
    // runBaseline exits internally
  }

  if (positional.length === 0) {
    printHelp();
    process.exit(2);
  }

  const target = positional[0];
  let stat;
  try {
    stat = await fs.stat(path.resolve(target));
  } catch {
    process.stderr.write(`Cannot read path: ${target}\n`);
    process.exit(2);
  }

  let files = [];
  if (stat.isDirectory()) {
    files = await walk(path.resolve(target));
    if (files.length === 0) {
      process.stderr.write(`No .tsx files found in ${target}\n`);
      process.exit(2);
    }
  } else {
    files = [path.resolve(target)];
  }

  // Single file mode
  if (files.length === 1) {
    const result = await scoreUI({ path: files[0] });
    if (flags.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      if (result.error) process.exit(1);
      const threshold = flags.min ?? flags.threshold;
      process.exit(result.overall.score >= threshold ? 0 : 1);
    } else {
      printResult(files[0], result, flags.min ?? flags.threshold);
      if (result.error) process.exit(1);
      process.exit(result.overall.score >= (flags.min ?? flags.threshold) ? 0 : 1);
    }
  }

  // Directory mode — summary table
  const results = [];
  for (const f of files) {
    const r = await scoreUI({ path: f });
    results.push({ file: f, result: r });
  }

  if (flags.json) {
    const out = results.map(({ file, result }) => ({
      file: path.relative(REPO_ROOT, file),
      ...result,
    }));
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    process.stdout.write('\n' + bold(`UICraftScore — ${files.length} files`) + '\n');
    process.stdout.write('─'.repeat(60) + '\n');
    for (const { file, result } of results) {
      if (result.error) {
        process.stdout.write(`  ${red('ERROR')}  ${path.relative(REPO_ROOT, file)}: ${result.error}\n`);
        continue;
      }
      const gc = gradeColor(result.overall.grade);
      const rel = path.relative(REPO_ROOT, file).padEnd(50);
      process.stdout.write(`  ${gc(result.overall.grade)}  ${String(result.overall.score).padStart(3)}  ${rel}\n`);
    }
    process.stdout.write('─'.repeat(60) + '\n');
  }

  const threshold = flags.min ?? flags.threshold;
  const anyBelow = results.some(({ result }) => result.error || (result.overall?.score ?? 0) < threshold);
  process.exit(anyBelow ? 1 : 0);
}
