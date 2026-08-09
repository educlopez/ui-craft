#!/usr/bin/env node
/**
 * The MCP version the CLI pins must already exist on npm.
 *
 * `cli/core/plan.go` writes `npx -y ui-craft-mcp@X.Y.Z` into every generated MCP config, so a
 * binary shipped while that version is unpublished installs nothing: the user's first launch
 * fails at the registry, on a version string they never chose and cannot correct.
 *
 * The window is real and it is the normal order of work. The pin bump and the npm publish are
 * two separate steps — a merged PR, then a workflow_dispatch — and the CLI release is a third.
 * Nothing connected them, so shipping the binary between steps two and three was a matter of
 * remembering.
 *
 * Deliberately NOT part of `pnpm verify`. The pin bump lands on main before the publish, and a
 * check that fails on the PR that raises the pin would either block the release or teach people
 * to ignore it. It belongs where the binary is built.
 *
 * Usage: node scripts/check-pin-published.mjs
 * Exit 0 published · 1 missing · 2 could not run. Zero dependencies. Node 18+.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const dim = (s) => c('2', s);

let pkg, want;
try {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'distribution-manifest.json'), 'utf8'));
  pkg = manifest.components.mcp.package ?? 'ui-craft-mcp';
  want = manifest.components.mcp.version;
} catch (e) {
  process.stderr.write(`Cannot read the pinned MCP version from distribution-manifest.json (${e.message}).\n`);
  process.exit(2);
}
if (!want) {
  process.stderr.write('distribution-manifest.json has no components.mcp.version to check.\n');
  process.exit(2);
}

const url = `https://registry.npmjs.org/${pkg.replace('/', '%2F')}`;
let doc;
try {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`registry returned ${res.status}`);
  doc = await res.json();
} catch (e) {
  // A registry we cannot reach is not a published version. Failing open here would let the
  // exact release this exists to stop go out on a flaky network.
  process.stderr.write(
    `${yellow('check-pin-published: COULD NOT RUN')} — ${pkg} could not be read from npm (${e.message}).\n` +
      dim('This is not a pass. Nothing was verified.\n')
  );
  process.exit(2);
}

const versions = Object.keys(doc.versions ?? {});
if (!versions.includes(want)) {
  const recent = versions.slice(-5).join(', ') || '(none)';
  process.stderr.write(
    `\n${red(`check-pin-published: ${pkg}@${want} is not published`)}\n\n` +
      `  The manifest pins ${pkg}@${want}, and cli/core/plan.go writes that spec into every\n` +
      `  generated MCP config. A binary shipped now installs nothing on first launch.\n\n` +
      `  Published: ${recent}\n\n` +
      dim(
        'Publish the MCP first — workflow_dispatch of npm-release.yml with the matching version —\n' +
          'then tag the CLI. The order is publish, then ship the thing that depends on it.\n'
      )
  );
  process.exit(1);
}

process.stdout.write(`✓ check-pin-published: ${pkg}@${want} is on npm, so the pin the CLI writes resolves\n`);
