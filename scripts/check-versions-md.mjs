#!/usr/bin/env node
/**
 * Guard the four ways VERSIONS.md silently breaks a release.
 *
 * The file is not a changelog. `.github/workflows/release.yml` reads it to decide which tag
 * to create and what the release notes say, and that tag dispatches the binary build. So a
 * heading in the wrong place does not produce a typo — it produces the wrong release, or no
 * release at all.
 *
 * All four hazards below were hit in production within three days, and every one was caught
 * by a human reading a diff. Nothing else could have caught them:
 *
 *   1. The auto-tag reads the FIRST `## vX.Y.Z`. CLI entries once sat in ascending order, so
 *      it resolved to the oldest, found that tag present, and skipped — three releases could
 *      not have been tagged through it.
 *   2. The release body runs from that heading to the NEXT `## vX.Y.Z`. An `## ui-craft-mcp
 *      vX.Y.Z` heading does not stop the scan, so a CLI entry placed above one swallows that
 *      whole section into its own notes.
 *   3. A blanket version sweep (`git grep -l "ui-craft-mcp@X" | xargs perl -pi`) rewrites the
 *      already-shipped entries too, making old releases claim a pin their binaries do not
 *      carry. Fired twice.
 *   4. The newest CLI entry can claim a pin the manifest has not reached.
 *
 * Usage: node scripts/check-versions-md.mjs
 * Exit 0 clean, 1 on any hazard. Zero dependencies. Node 18+.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSIONS = path.join(ROOT, 'VERSIONS.md');
const MANIFEST = path.join(ROOT, 'distribution-manifest.json');

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s);
const dim = (s) => c('2', s);

const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

const md = readFileSync(VERSIONS, 'utf8');
const manifestVersion = JSON.parse(readFileSync(MANIFEST, 'utf8')).components.mcp.version;
const lines = md.split('\n');

/** Every heading, in file order, tagged by which kind it is. */
const headings = [];
lines.forEach((line, i) => {
  const cli = line.match(/^## v(\d+\.\d+\.\d+)\b/);
  const mcp = line.match(/^## ui-craft-mcp v(\d+\.\d+\.\d+)\b/);
  if (cli) headings.push({ kind: 'cli', version: cli[1], line: i + 1, text: line });
  else if (mcp) headings.push({ kind: 'mcp', version: mcp[1], line: i + 1, text: line });
  else if (/^## /.test(line)) headings.push({ kind: 'other', line: i + 1, text: line });
});

const cliEntries = headings.filter((h) => h.kind === 'cli');
const mcpEntries = headings.filter((h) => h.kind === 'mcp');
const problems = [];

// ── 1. The tag the workflow would create must be the newest CLI entry ────────
if (cliEntries.length > 1) {
  const first = cliEntries[0];
  const newest = [...cliEntries].sort((a, b) => cmp(b.version, a.version))[0];
  if (first.version !== newest.version) {
    problems.push(
      `release.yml would tag v${first.version} (line ${first.line}), but v${newest.version} ` +
        `(line ${newest.line}) is newer.\n    CLI entries must be newest-first: the workflow reads the ` +
        `FIRST heading, finds the old tag already exists, and skips — shipping nothing.`
    );
  }
}

// ── 2. Nothing may sit between the first two CLI entries ─────────────────────
if (cliEntries.length > 1) {
  const [first, second] = cliEntries;
  const between = headings.filter((h) => h.line > first.line && h.line < second.line);
  if (between.length) {
    problems.push(
      `"${between[0].text.trim()}" (line ${between[0].line}) sits between the first two CLI entries.\n` +
        `    The release body runs from the first \`## vX.Y.Z\` to the NEXT one, and no other heading ` +
        `stops it — so v${first.version}'s notes would swallow that section whole.`
    );
  }
}

// ── 3. Shipped entries must not have been rewritten ──────────────────────────
//
// The only authority on what a released entry said is the tag it was released under, so
// this asks git rather than reasoning about the text. An earlier version of this check
// compared pins downward and assumed a newer pin in an older entry was the tell — it does
// not work: v1.0.13 and v1.0.14 legitimately share @0.8.1, so a sweep that flattens every
// entry to the same pin reads as valid. It missed the exact bug it was written for.
//
// It compares the PINS a shipped entry states, not its prose. Two kinds of post-release edit
// are legitimate and showed up the moment this ran over real history: redacting a name we do
// not publish, and retitling an entry "superseded by vX". Forbidding every edit would have
// flagged both as corruption. A pin is different — the binary carrying it is already
// published, so the pin cannot change and a rewrite is always a bug.
//
// Entries whose tag is missing (shallow clone, tags not fetched) are counted and reported,
// never silently skipped: "checked nothing" and "found nothing" must not look alike.
const bodyOf = (text, version) => {
  const all = text.split('\n');
  const start = all.findIndex((l) => new RegExp(`^## v${version.replace(/\./g, '\\.')}\\b`).test(l));
  if (start === -1) return null;
  const rest = all.slice(start + 1).findIndex((l) => /^## /.test(l));
  return all.slice(start, rest === -1 ? undefined : start + 1 + rest).join('\n').trim();
};

let compared = 0;
const unverifiable = [];
for (const entry of cliEntries) {
  const tag = `v${entry.version}`;
  let tagged;
  try {
    execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: ROOT, stdio: 'pipe' });
    tagged = execFileSync('git', ['show', `${tag}:VERSIONS.md`], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    unverifiable.push(tag);
    continue;
  }
  const then = bodyOf(tagged, entry.version);
  const now = bodyOf(md, entry.version);
  if (!then) continue; // entry was written after its own tag — nothing to compare
  compared++;
  const pins = (body) => [...body.matchAll(/ui-craft-mcp@(\d+\.\d+\.\d+)/g)].map((m) => m[1]).join(', ');
  if (pins(then) !== pins(now)) {
    problems.push(
      `The v${entry.version} entry (line ${entry.line}) claims ui-craft-mcp@${pins(now) || '—'}, but tag ` +
        `${tag} shipped @${pins(then) || '—'}.\n    That binary is published and its pin cannot change. A ` +
        `blanket version sweep rewrites shipped entries in place — exclude VERSIONS.md and edit it by hand.`
    );
  }
}

// ── 4. No entry may claim a pin the manifest has not reached ─────────────────
/** The ui-craft-mcp pin an entry states, read from its own body. */
const pinOf = (start, end) =>
  lines
    .slice(start, end === undefined ? lines.length : end - 1)
    .join('\n')
    .match(/ui-craft-mcp@(\d+\.\d+\.\d+)/)?.[1];

for (let i = 0; i < cliEntries.length; i++) {
  const pin = pinOf(cliEntries[i].line, cliEntries[i + 1]?.line);
  if (pin && cmp(pin, manifestVersion) > 0) {
    problems.push(
      `v${cliEntries[i].version} (line ${cliEntries[i].line}) claims ui-craft-mcp@${pin}, ahead of the ` +
        `manifest's ${manifestVersion}.\n    A release cannot ship a pin that does not exist yet.`
    );
  }
}

// ── MCP entries are newest-first too, for the same readability contract ──────
for (let i = 0; i < mcpEntries.length - 1; i++) {
  if (cmp(mcpEntries[i].version, mcpEntries[i + 1].version) < 0) {
    problems.push(
      `ui-craft-mcp v${mcpEntries[i].version} (line ${mcpEntries[i].line}) is older than ` +
        `v${mcpEntries[i + 1].version} below it. MCP entries are newest-first.`
    );
  }
}

if (problems.length) {
  process.stderr.write(`\n${red(`check-versions-md: ${problems.length} problem(s)`)}\n\n`);
  for (const p of problems) process.stderr.write(`  ${p}\n\n`);
  process.stderr.write(
    dim(
      'VERSIONS.md decides which tag release.yml creates and what the notes say.\n' +
        'A heading in the wrong place does not make a typo — it makes the wrong release.\n\n'
    )
  );
  process.exit(1);
}

process.stdout.write(
  `✓ check-versions-md: ${cliEntries.length} CLI + ${mcpEntries.length} MCP entries ordered, ` +
    `${compared} shipped pin${compared === 1 ? '' : 's'} verified against their tags, ` +
    `newest pin within manifest ${manifestVersion}\n`
);
if (unverifiable.length) {
  process.stdout.write(
    dim(
      `  ${unverifiable.length} entr${unverifiable.length === 1 ? 'y' : 'ies'} unverifiable — tag not present ` +
        `(${unverifiable.slice(0, 4).join(', ')}${unverifiable.length > 4 ? ', …' : ''}).\n` +
        `  Fetch tags for the full check; a shallow clone can only order the file, not police its history.\n`
    )
  );
}
