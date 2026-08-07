#!/usr/bin/env node
/**
 * A test that isolates HOME must isolate USERPROFILE too.
 *
 * `os.UserHomeDir` reads `$HOME` on Unix and `%USERPROFILE%` on Windows. Twelve tests set
 * only HOME, which isolates them everywhere except the one platform whose rule differs — so
 * on Windows they read and wrote the *real* user profile. On CI that meant a doctor test
 * reporting skills from `C:\Users\runneradmin\.codex`, and three tests looking for a
 * state.json the code had correctly written somewhere else entirely. On a contributor's
 * Windows machine it means `go test ./...` edits their actual ui-craft install.
 *
 * None of those failures said "HOME isolation is incomplete". They said "expected state.json
 * to exist", which points at the code under test. That is why this is a guard and not a
 * comment: the symptom never names the cause.
 *
 * Usage: node scripts/check-home-isolation.mjs
 * Exit 0 clean · 1 unpaired setter · 2 could not run. Zero dependencies. Node 18+.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'cli');

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s);
const dim = (s) => c('2', s);

if (!existsSync(CLI)) {
  process.stderr.write('check-home-isolation: no cli/ directory to scan.\n');
  process.exit(2);
}

const testFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('_test.go')) testFiles.push(p);
  }
})(CLI);

if (!testFiles.length) {
  process.stderr.write('check-home-isolation: found no Go test files — that itself is wrong.\n');
  process.exit(2);
}

// Pair them per function body, not per file: one test isolating both does not excuse
// another in the same file isolating only HOME.
const problems = [];
for (const file of testFiles) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let fnName = '(file scope)';
  // Every pending setter, not just the newest. Tracking one meant a second
  // t.Setenv("HOME", ...) overwrote the first: if only the second was paired, the guard
  // passed and the code between the two setters still ran against the real Windows profile.
  let pending = [];
  const flush = () => {
    for (const h of pending) problems.push({ file, line: h.line, fn: h.fn, value: h.value });
    pending = [];
  };
  lines.forEach((line, i) => {
    const fn = line.match(/^func (\w+)\(/);
    if (fn) {
      flush();
      fnName = fn[1];
    }
    const setHome = line.match(/t\.Setenv\("HOME",\s*([^)]+)\)/);
    if (setHome) pending.push({ line: i + 1, value: setHome[1].trim(), fn: fnName });
    const setProfile = line.match(/t\.Setenv\("USERPROFILE",\s*([^)]+)\)/);
    if (setProfile) {
      const v = setProfile[1].trim();
      pending = pending.filter((h) => h.value !== v);
    }
  });
  flush();
}

if (problems.length) {
  process.stderr.write(`\n${red(`check-home-isolation: ${problems.length} test(s) isolate HOME but not USERPROFILE`)}\n\n`);
  for (const p of problems) {
    process.stderr.write(`  ${path.relative(ROOT, p.file)}:${p.line}  in ${p.fn}\n`);
    process.stderr.write(dim(`    add: t.Setenv("USERPROFILE", ${p.value})\n`));
  }
  process.stderr.write(
    `\n${dim(
      'os.UserHomeDir reads %USERPROFILE% on Windows and $HOME elsewhere. Setting only HOME\n' +
        'leaves the test pointed at the real user profile on Windows — it will read whatever is\n' +
        "installed there and write into it. The failure it produces names the code under test,\n" +
        'never the missing variable.\n'
    )}\n`
  );
  process.exit(1);
}

process.stdout.write(
  `✓ check-home-isolation: every HOME override in ${testFiles.length} Go test files is paired with USERPROFILE\n`
);
