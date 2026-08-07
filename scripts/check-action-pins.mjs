#!/usr/bin/env node
/**
 * Every GitHub Action must be pinned to a commit SHA, never a tag.
 *
 * A tag is mutable: `@v4` resolves to whatever the action's author points it at today, so
 * trusting one is trusting every future commit they make. That matters here more than in
 * most repos, because these workflows publish to npm over OIDC trusted publishing and sign
 * release binaries with attestations — an action swapped underneath us runs inside that.
 *
 * The repo already enforces immutable specs elsewhere: the MCP launcher pins an exact
 * version, and `supply-chain-security` argues this case for npm dependencies. Leaving the
 * actions themselves on floating tags was the inconsistency.
 *
 * A `# vX.Y.Z` comment after the SHA is required too. A bare 40-char hash is unreviewable —
 * nobody can tell v4.4.0 from a hostile fork by reading it, and an unreadable pin gets
 * bumped by whoever is in a hurry.
 *
 * Usage: node scripts/check-action-pins.mjs
 * Exit 0 clean · 1 unpinned or uncommented. Zero dependencies. Node 18+.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, '.github', 'workflows');

const tty = process.stdout.isTTY;
const red = (s) => (tty ? `\x1b[31m${s}\x1b[0m` : s);
const dim = (s) => (tty ? `\x1b[2m${s}\x1b[0m` : s);

const problems = [];
let pinned = 0;

for (const file of readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f))) {
  readFileSync(path.join(DIR, file), 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const m = line.match(/uses:\s*([\w.-]+\/[\w./-]+)@(\S+)/);
      if (!m) return; // local actions (./path) and docker:// are out of scope
      const [, action, ref] = m;
      const where = `${file}:${i + 1}`;
      if (!/^[0-9a-f]{40}$/.test(ref)) {
        problems.push(`${where}  ${action}@${ref}\n    pinned to a mutable tag — resolve it to a commit SHA`);
        return;
      }
      if (!/#\s*v?\d+\.\d+/.test(line)) {
        problems.push(`${where}  ${action}\n    pinned, but no "# vX.Y.Z" comment — a bare hash is unreviewable`);
        return;
      }
      pinned++;
    });
}

if (problems.length) {
  process.stderr.write(`\n${red(`check-action-pins: ${problems.length} problem(s)`)}\n\n`);
  for (const p of problems) process.stderr.write(`  ${p}\n\n`);
  process.stderr.write(
    dim(
      'Resolve a tag with:\n' +
        '  gh api repos/OWNER/REPO/git/ref/tags/TAG -q .object.sha\n' +
        'then write:  uses: OWNER/REPO@<sha>  # vX.Y.Z\n\n'
    )
  );
  process.exit(1);
}

process.stdout.write(`✓ check-action-pins: ${pinned} action use(s), all SHA-pinned with a version comment\n`);
