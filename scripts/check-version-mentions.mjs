#!/usr/bin/env node
/**
 * Every stated `ui-craft-mcp@X.Y.Z` in the repository must be the version the manifest pins.
 *
 * `check-distribution-contract.mjs` already enforces this — for the three launchers listed in
 * the manifest's `pinnedLaunchers`. That is an allowlist, and an allowlist answers "are the
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

/** Text formats a pin can be written in. Binary and lockfiles are not authored by hand. */
const SCAN_EXT = new Set([
  '.go', '.json', '.jsonc', '.md', '.mdx', '.mjs', '.js', '.ts', '.tsx', '.sh', '.ps1',
  '.yaml', '.yml', '.toml', '.txt', '.example',
]);

const EXEMPT = [
  {
    match: (rel) => rel === 'VERSIONS.md',
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
    .filter((rel) => rel && SCAN_EXT.has(path.extname(rel)))
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
let carriers = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const exemption = EXEMPT.find((e) => e.match(rel));
  const lines = readFileSync(file, 'utf8').split('\n');
  let fileHasPin = false;

  lines.forEach((line, i) => {
    for (const m of line.matchAll(PIN)) {
      fileHasPin = true;
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
  if (fileHasPin) carriers++;
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

process.stdout.write(
  `✓ check-version-mentions: ${checked} mention(s) of ui-craft-mcp across ${carriers} file(s) all state ${expected}\n`
);
for (const e of EXEMPT) {
  const n = exemptSeen.get(e.why);
  if (n > 0) process.stdout.write(dim(`  ${n} exempt — ${e.why}\n`));
}
if (stale.length) {
  process.stdout.write(
    `${yellow('  stale exemption(s):')} ${stale.map((e) => e.why).join('; ')}\n` +
      dim('  Nothing matched them. Remove the exemption or it silently widens what goes unchecked.\n')
  );
}
