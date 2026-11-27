import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Explicit file lists work with Node 20 and Windows shells, which do not expand
// quoted globs the same way. Browser tests remain separate and serial.
const suite = process.argv[2] ?? 'unit';
if (!['unit', 'release', 'browser'].includes(suite)) throw new Error('Unknown test suite');
const here = fileURLToPath(new URL('./', import.meta.url));
const folder = suite === 'release' ? 'release-tests' : 'test';
const files = suite === 'browser' ? ['browser.integration.mjs']
  : readdirSync(join(here, folder)).filter(name => name.endsWith('.test.mjs')).sort();
if (!files.length) throw new Error('Empty test suite');
const result = spawnSync(process.execPath,
  ['--test', '--test-concurrency=1', '--test-timeout=120000', ...files.map(name => join(here, folder, name))],
  { cwd: here, stdio: 'inherit', timeout: 600000 });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
