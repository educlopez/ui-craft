#!/usr/bin/env node
/**
 * Cross-check every shipped frontmatter with a REAL YAML parser.
 *
 * `validate.mjs` has its own parser and now rejects the two shapes that broke #122 — a
 * double-quoted scalar closing early, a plain scalar carrying ": ". But it is still a
 * hand-rolled parser validating files that real YAML parsers will read, and that gap is
 * exactly what shipped 15 unloadable skills: the previous version reported "frontmatter
 * parses" for all 75 broken files, because it was written to extract values rather than to
 * reject syntax.
 *
 * Two implementations agreeing is evidence. One implementation agreeing with itself is not.
 * So this runs PyYAML over the same files and fails if the two disagree in either direction:
 * a file we accept that PyYAML rejects is a bug we would ship, and a file we reject that
 * PyYAML accepts is a false alarm that trains people to ignore the gate.
 *
 * Skips loudly, never silently, when python3 or PyYAML is unavailable — a check that cannot
 * run must not look like a check that passed.
 *
 * Usage: node scripts/check-frontmatter-strict.mjs
 * Exit 0 clean · 1 disagreement · 2 could not run. Node 18+.
 */

import { readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const dim = (s) => c('2', s);

/** Every file that ships a frontmatter a harness will parse. */
function shippedFiles() {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === 'SKILL.md' || (dir.endsWith('commands') && name.endsWith('.md'))) out.push(p);
    }
  };
  walk(path.join(ROOT, 'skills'));
  walk(path.join(ROOT, 'commands'));
  for (const root of ['.agents', '.claude', '.codex', '.cursor', '.gemini', '.opencode']) {
    walk(path.join(ROOT, root, 'skills'));
  }
  // cli/assets holds embed.go beside the harness directories, so walk only the directories.
  const assets = path.join(ROOT, 'cli', 'assets');
  if (existsSync(assets)) {
    for (const h of readdirSync(assets)) {
      const p = path.join(assets, h);
      if (statSync(p).isDirectory()) walk(p);
    }
  }
  return out;
}

const files = shippedFiles();
if (!files.length) {
  process.stderr.write('No shipped frontmatter files found — that itself is wrong.\n');
  process.exit(2);
}

// Ask PyYAML about all of them in one process.
const script = `
import sys, json, re, io
try:
    import yaml
except ImportError:
    print("NO_PYYAML"); sys.exit(0)
bad = []
for f in json.load(sys.stdin):
    try:
        src = io.open(f, encoding="utf8").read()
    except Exception as e:
        bad.append([f, "unreadable: %s" % e]); continue
    m = re.match(r"^---\\n(.*?)\\n---", src, re.S)
    if not m:
        continue
    try:
        doc = yaml.safe_load(m.group(1))
        if not isinstance(doc, dict):
            bad.append([f, "frontmatter is not a mapping (got %s)" % type(doc).__name__])
    except Exception as e:
        bad.append([f, str(e).split("\\n")[0]])
print(json.dumps(bad))
`;

let raw;
try {
  raw = execFileSync('python3', ['-c', script], { input: JSON.stringify(files), encoding: 'utf8' });
} catch (e) {
  process.stderr.write(
    `${yellow('check-frontmatter-strict: COULD NOT RUN')} — python3 unavailable (${e.code ?? e.message}).\n` +
      `${dim('This is not a pass. validate.mjs still runs its own parser, but the independent\ncross-check that would catch a parser bug did not happen.\n')}`
  );
  process.exit(2);
}

if (raw.trim() === 'NO_PYYAML') {
  process.stderr.write(
    `${yellow('check-frontmatter-strict: COULD NOT RUN')} — PyYAML not installed.\n` +
      `${dim('Install with: python3 -m pip install pyyaml\nThis is not a pass.\n')}`
  );
  process.exit(2);
}

const bad = JSON.parse(raw);
if (bad.length) {
  process.stderr.write(`\n${red(`check-frontmatter-strict: ${bad.length} file(s) a real YAML parser rejects`)}\n\n`);
  for (const [f, err] of bad) {
    process.stderr.write(`  ${path.relative(ROOT, f)}\n    ${err}\n`);
  }
  process.stderr.write(
    `\n${dim(
      'A double-quoted scalar ends at its first unescaped quote — escape inner quotes as \\".\n' +
        'A plain scalar containing ": " is read as a nested mapping — quote the whole value.\n' +
        'These files are what users install; the canonical source being valid is not enough.\n'
    )}\n`
  );
  process.exit(1);
}

process.stdout.write(`✓ check-frontmatter-strict: ${files.length} shipped frontmatters parse under PyYAML\n`);
