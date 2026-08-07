#!/usr/bin/env node
/**
 * Verify a published release against what the shipped binary will actually ask for.
 *
 * #124 was not a logic bug anyone could see by reading: the code was internally consistent
 * and its tests agreed with it. It only became visible when someone compared the name
 * `self-update` requests against the assets a release contains — which is a check nothing
 * performed, on either side.
 *
 * So this performs it. Given a tag, it renders the archive name for every platform in the
 * build matrix and asserts each one exists in the release, and that checksums.txt lists it.
 *
 * Precisely: this closes **template ↔ release**. It would NOT have caught #124 on its own —
 * the assets were always named correctly and the template always matched them; the wrong
 * link was **code ↔ template**, and that one is held by
 * TestArchiveNameMatchesGoreleaserTemplate in cli/core. Together the two make code ↔ release
 * transitive, and neither is redundant: this one catches renamed assets, a platform added to
 * the matrix but never built, and a build that silently produced fewer artifacts than the
 * matrix promises — none of which a unit test can see.
 *
 * Usage:
 *   node scripts/check-release-assets.mjs            # newest release
 *   node scripts/check-release-assets.mjs v1.0.15
 *
 * Needs `gh` authenticated. Exit 0 clean · 1 mismatch · 2 could not run. Node 18+.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s);
const green = (s) => c('32', s);
const dim = (s) => c('2', s);

/** The build matrix and the archive template — the release config is the only authority. */
function releaseShape() {
  const raw = readFileSync(path.join(ROOT, '.goreleaser.yaml'), 'utf8');
  const builds = raw.match(/^builds:[\s\S]*?^archives:/m)?.[0];
  if (!builds) throw new Error('no builds section in .goreleaser.yaml');

  const list = (key) => {
    const block = builds.match(new RegExp(`${key}:\\s*\\n((?:\\s*-\\s*\\w+\\n)+)`))?.[1];
    return block ? [...block.matchAll(/-\s*(\w+)/g)].map((m) => m[1]) : [];
  };

  const tmpl = raw.match(/name_template:\s*"([^"]*\{\{[^"]*)"/)?.[1];
  if (!tmpl) throw new Error('no archive name_template in .goreleaser.yaml');
  return { oses: list('goos'), arches: list('goarch'), tmpl };
}

function render(tmpl, { version, os, arch }) {
  const out = tmpl
    .replaceAll('{{ .ProjectName }}', 'ui-craft')
    .replaceAll('{{ .Version }}', version)
    .replaceAll('{{ .Os }}', os)
    .replaceAll('{{ .Arch }}', arch);
  if (out.includes('{{')) throw new Error(`name_template uses a field this script cannot render: ${tmpl}`);
  return out + (os === 'windows' ? '.zip' : '.tar.gz');
}

let tag = process.argv[2];
try {
  if (!tag) {
    tag = execFileSync('gh', ['release', 'view', '--json', 'tagName', '-q', '.tagName'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
  }
} catch (e) {
  process.stderr.write(`Cannot determine the release tag (${e.message.split('\n')[0]}).\n`);
  process.exit(2);
}

let assets;
let checksums = '';
try {
  assets = JSON.parse(
    execFileSync('gh', ['release', 'view', tag, '--json', 'assets', '-q', '[.assets[].name]'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
  );
  if (assets.includes('checksums.txt')) {
    checksums = execFileSync('gh', ['release', 'download', tag, '-p', 'checksums.txt', '-O', '-'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  }
} catch (e) {
  process.stderr.write(`Cannot read release ${tag} (${e.message.split('\n')[0]}).\n`);
  process.exit(2);
}

const { oses, arches, tmpl } = releaseShape();
const version = tag.replace(/^v/, '');
const problems = [];
const checked = [];

for (const os of oses) {
  for (const arch of arches) {
    const want = render(tmpl, { version, os, arch });
    checked.push(want);
    if (!assets.includes(want)) {
      problems.push(
        `${os}/${arch}: self-update will request ${want}, which ${tag} does not contain.\n` +
          `    Published: ${assets.filter((a) => a !== 'checksums.txt').join(', ') || '(none)'}`
      );
      continue;
    }
    if (checksums && !checksums.includes(want)) {
      problems.push(`${os}/${arch}: ${want} is published but missing from checksums.txt — self-update verifies against it.`);
    }
  }
}

if (problems.length) {
  process.stderr.write(`\n${red(`check-release-assets: ${tag} — ${problems.length} problem(s)`)}\n\n`);
  for (const p of problems) process.stderr.write(`  ${p}\n\n`);
  process.stderr.write(
    dim(
      'The name comes from the archive name_template in .goreleaser.yaml, rendered per platform.\n' +
        'If the template changed, cli/core/selfupdate.go must change with it — that mismatch is #124.\n\n'
    )
  );
  process.exit(1);
}

process.stdout.write(
  `${green('✓')} check-release-assets: ${tag} contains all ${checked.length} archives self-update can request` +
    `${checksums ? ', each listed in checksums.txt' : dim(' (no checksums.txt to cross-check)')}\n`
);
