import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workerLaunch } from '../process-owner.mjs';
import { getDefaultEnvironment } from '@modelcontextprotocol/client/stdio';
import { runTool } from '../tool-runner.mjs';

test('Windows owned transport connects using its credential-free environment', {
  skip: process.platform !== 'win32', timeout: 40000,
}, async t => {
  const root = await mkdtemp(join(tmpdir(), 'ui craft transport '));
  t.after(() => rm(root, { recursive: true, force: true }));
  let diagnostics = '';
  const started = Date.now();
  try {
    const result = await runTool('slow', {}, {}, {
      entry: fileURLToPath(new URL('./fixtures/worker.mjs', import.meta.url)),
      tempRoot: root, onDiagnostic: text => { diagnostics = (diagnostics + `[${Date.now() - started}ms] ${text}`).slice(-8192); },
    });
    assert.equal(result.content[0].text, 'done');
  } catch (error) {
    throw new Error(`${error.message}\nControlled fixture diagnostics: ${diagnostics}`, { cause: error });
  }
});

test('Windows helper compiles with NUL stdin before the private worker starts', {
  skip: process.platform !== 'win32', timeout: 25000,
}, async t => {
  const root = await mkdtemp(join(tmpdir(), 'ui craft compile '));
  t.after(() => rm(root, { recursive: true, force: true }));
  const entry = fileURLToPath(new URL('./fixtures/worker.mjs', import.meta.url));
  const launch = workerLaunch(entry, { ...getDefaultEnvironment(), TMPDIR: root, TMP: root, TEMP: root });
  launch.args[launch.args.length - 1] = launch.args.at(-1)
    .replace('[UICraftJob]::Run()', "[Console]::Out.WriteLine('helper-compiled')");
  const child = spawnSync(launch.command, launch.args, { ...launch.options,
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 20000 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /helper-compiled/);
});
