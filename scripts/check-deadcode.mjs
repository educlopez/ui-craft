#!/usr/bin/env node
/**
 * Fail when unreachable Go functions increase.
 *
 * A ratchet, not a gate: the current count is recorded and only growth fails. Demanding zero
 * would be dishonest — most of what remains is `export_test.go` scaffolding, exported so one
 * package's tests can reach another's internals, which is unreachable by construction and
 * correct.
 *
 * It earns its place on the other side. `selfUpdateTitleCase` survived as dead code until
 * someone noticed by eye while fixing #124; its only remaining ability was producing the
 * wrong archive name, and a stray caller would have reintroduced the bug. Removing the last
 * caller of something is invisible in a diff — this makes it loud.
 *
 * Runs with `-test`, which counts test files as callers. Without it the number is 42 instead
 * of 8, nearly all of them helpers that tests do use — a baseline that inflated would train
 * people to bump it without reading, which is a ratchet that has stopped ratcheting.
 *
 * Usage:
 *   node scripts/check-deadcode.mjs           # compare against the baseline
 *   node scripts/check-deadcode.mjs --update  # record the current count, after removing code
 *
 * Exit 0 same-or-fewer · 1 grew · 2 could not run. Node 18+.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'cli', 'deadcode-baseline.json');

const tty = process.stdout.isTTY;
const red = (s) => (tty ? `\x1b[31m${s}\x1b[0m` : s);
const green = (s) => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const dim = (s) => (tty ? `\x1b[2m${s}\x1b[0m` : s);

let out;
try {
  out = execFileSync('go', ['run', 'golang.org/x/tools/cmd/deadcode@v0.31.0', '-test', './...'], {
    cwd: path.join(ROOT, 'cli'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  process.stderr.write(
    `check-deadcode: COULD NOT RUN — ${String(e.stderr || e.message).split('\n')[0]}\n` +
      dim('  This is not a pass. Needs network on first run to fetch the tool.\n')
  );
  process.exit(2);
}

const found = out
  .split('\n')
  .filter((l) => l.includes('unreachable func:'))
  .map((l) => l.trim())
  .sort();

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify({ count: found.length, functions: found }, null, 2)}\n`);
  process.stdout.write(`✓ baseline recorded: ${found.length} unreachable function(s)\n`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  process.stderr.write(`check-deadcode: no baseline at ${path.relative(ROOT, BASELINE)} — run with --update\n`);
  process.exit(2);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
if (found.length > base.count) {
  const added = found.filter((f) => !base.functions.includes(f));
  process.stderr.write(
    `\n${red(`check-deadcode: unreachable functions grew ${base.count} → ${found.length}`)}\n\n` +
      added.map((a) => `  + ${a}`).join('\n') +
      `\n\n${dim(
        'Something lost its last caller. Delete it, or wire it up.\n' +
          'If it is deliberate — new test scaffolding, say — record it:\n' +
          '  node scripts/check-deadcode.mjs --update\n\n'
      )}`
  );
  process.exit(1);
}

const removed = base.functions.filter((f) => !found.includes(f));
process.stdout.write(
  `${green('✓')} check-deadcode: ${found.length} unreachable function(s), baseline ${base.count}` +
    `${removed.length ? ` — ${removed.length} fewer than the baseline; run --update to lock it in` : ''}\n`
);
