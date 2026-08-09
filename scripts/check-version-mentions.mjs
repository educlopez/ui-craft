#!/usr/bin/env node
/**
 * Every stated `ui-craft-mcp@X.Y.Z` in the repository must be the version the manifest pins.
 *
 * `check-distribution-contract.mjs` (the `contracts` suite in `verify.mjs`) enforces this — for the
 * three launchers listed in
 * manifest's `pinnedLaunchers`. That is an allowlist, and an allowlist answers "are the
 * files we remembered correct?" rather than "is anything wrong?". Thirty-nine places state the
 * pin. Three were checked. The other thirty-six included the install snippet in the README
 * that users copy by hand, the same snippet in `cli/README.md` and `mcp/README.md`, and the
 * doc comments in `cli/harness` that describe the config we write.
 *
 * None of those is load-bearing the way `plan.go` is, which is exactly why they rot quietly:
 * a stale pin in a README is a user typing an old version into their config and getting
 * whatever behaviour that version had. Nothing fails. Nobody finds out.
 *
 * So this is the closed-world complement: scan everything, require every occurrence to match,
 * and name the two places where a different version is correct rather than pretending they
 * do not exist.
 *
 * Exemptions, both deliberate:
 *   - VERSIONS.md — released entries state the pin their binaries actually shipped with. That
 *     pin cannot change; rewriting it is itself the bug, and `check-versions-md.mjs` fails the
 *     build if a shipped entry's pin no longer matches its tag.
 *   - scripts/**\/*.test.mjs — fixtures assert behaviour against invented versions. A fixture
 *     that tracked the real pin would stop testing what it was written to test.
 *
 * A stale exemption is reported too: if an exempt file no longer states any pin, the exemption
 * has outlived its reason and is quietly widening what goes unchecked.
 *
 * Usage: node scripts/check-version-mentions.mjs
 * Exit 0 clean · 1 drift · 2 could not run. Zero dependencies. Node 18+.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const dim = (s) => c('2', s);

const PIN = /ui-craft-mcp@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/g;

// No extension allowlist. An allowlist here would repeat the mistake this check exists to
// fix — Dockerfiles, Makefiles and .env carry no suffix, and e2e/installer has three
// Dockerfiles that install the CLI. Every tracked file is read, and binary content is
// skipped by looking for a NUL byte rather than by guessing from the name.
const MAX_BYTES = 4 << 20;

const EXEMPT = [
  {
    // Only the release entries, not the whole file. VERSIONS.md opens with a "Current
    // distribution contract" section that states the pin as present tense, and exempting the
    // file wholesale let that sentence go stale through a release — it still claimed 0.8.2
    // while every launcher had moved to 0.8.3. History starts at the first version heading;
    // everything above it describes now and must match the manifest like anything else.
    match: (rel, lineNo, firstEntryLine) => rel === 'VERSIONS.md' && firstEntryLine !== null && lineNo >= firstEntryLine,
    why: 'released entries must state the pin their binaries shipped with (guarded by check-versions-md.mjs)',
  },
  {
    match: (rel) => /^scripts[/\\].*\.test\.mjs$/.test(rel),
    why: 'fixtures assert behaviour against invented versions',
  },
];

let expected;
try {
  expected = JSON.parse(readFileSync(path.join(ROOT, 'distribution-manifest.json'), 'utf8'))
    .components.mcp.version;
} catch (e) {
  process.stderr.write(`Cannot read the pinned version from distribution-manifest.json (${e.message}).\n`);
  process.exit(2);
}
if (!expected) {
  process.stderr.write('distribution-manifest.json has no components.mcp.version to compare against.\n');
  process.exit(2);
}

// Tracked files only, asked of git rather than walked.
//
// A directory walk sees whatever happens to be on the disk. The first run of this check
// failed on an untracked local .codex/config.toml pinning a four-release-old version — a
// real finding on that machine, and a false one for the repository, which does not contain
// that file. CI would have passed while a contributor's checkout failed, and a guard that
// disagrees with CI is a guard people learn to skip.
let files;
try {
  files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 << 20 })
    .split('\0')
    .filter(Boolean)
    .map((rel) => path.join(ROOT, rel));
} catch (e) {
  process.stderr.write(
    `${yellow('check-version-mentions: COULD NOT RUN')} — git ls-files failed (${e.message.split('\n')[0]}).\n` +
      dim('This is not a pass. Nothing was scanned.\n')
  );
  process.exit(2);
}

if (!files.length) {
  process.stderr.write('check-version-mentions: nothing to scan — that itself is wrong.\n');
  process.exit(2);
}

const problems = [];
const exemptSeen = new Map(EXEMPT.map((e) => [e.why, 0]));
let checked = 0;

let skippedBinary = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);

  let raw;
  try {
    raw = readFileSync(file);
  } catch {
    continue; // deleted or unreadable since git listed it
  }
  if (raw.length > MAX_BYTES || raw.includes(0)) {
    skippedBinary++;
    continue;
  }
  const lines = raw.toString('utf8').split('\n');

  // Where this file's history begins, for exemptions that cover only part of a file.
  const idx = lines.findIndex((l) => /^## (?:ui-craft-mcp )?v\d+\.\d+\.\d+/.test(l));
  const firstEntryLine = idx === -1 ? null : idx + 1;

  lines.forEach((line, i) => {
    for (const m of line.matchAll(PIN)) {
      const exemption = EXEMPT.find((e) => e.match(rel, i + 1, firstEntryLine));
      if (exemption) {
        exemptSeen.set(exemption.why, exemptSeen.get(exemption.why) + 1);
        continue;
      }
      checked++;
      if (m[1] !== expected) {
        problems.push({ rel, line: i + 1, found: m[1], text: line.trim().slice(0, 110) });
      }
    }
  });
}

// An exemption that protects nothing is an exemption nobody will notice widening.
const stale = EXEMPT.filter((e) => exemptSeen.get(e.why) === 0);

if (problems.length) {
  process.stderr.write(`\n${red(`check-version-mentions: ${problems.length} mention(s) disagree with the manifest`)}\n\n`);
  process.stderr.write(`  manifest pins ${dim('ui-craft-mcp@')}${expected}\n\n`);
  for (const p of problems) {
    process.stderr.write(`  ${p.rel}:${p.line}  states @${p.found}\n`);
    process.stderr.write(dim(`    ${p.text}\n`));
  }
  process.stderr.write(
    `\n${dim(
      'The manifest is the authority. Update these to match it — but never with a blanket sweep:\n' +
        "`git grep -l | xargs perl -pi` also rewrites VERSIONS.md's released entries, making old\n" +
        'releases claim a pin their published binaries do not carry. That has happened twice.\n'
    )}\n`
  );
  process.exit(1);
}

const exemptTotal = [...exemptSeen.values()].reduce((a, b) => a + b, 0);
process.stdout.write(
  `✓ check-version-mentions: ${checked} non-exempt mention(s) of ui-craft-mcp state ${expected}, ` +
    `across ${files.length - skippedBinary} tracked text file(s)\n`
);
for (const e of EXEMPT) {
  const n = exemptSeen.get(e.why);
  if (n > 0) process.stdout.write(dim(`  ${n} exempt — ${e.why}\n`));
}
if (exemptTotal) {
  process.stdout.write(
    dim(`  ${exemptTotal} exempt mention(s) were NOT compared; they may legitimately differ.\n`)
  );
}
if (stale.length) {
  process.stdout.write(
    `${yellow('  stale exemption(s):')} ${stale.map((e) => e.why).join('; ')}\n` +
      dim('  Nothing matched them. Remove the exemption or it silently widens what goes unchecked.\n')
  );
}
