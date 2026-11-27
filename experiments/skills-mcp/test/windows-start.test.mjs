import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workerLaunch, stopWorker } from '../process-owner.mjs';
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

test('Windows guard bootstraps a fixture over redirected stdio', {
  skip: process.platform !== 'win32', timeout: 40000,
}, async t => {
  const root = await mkdtemp(join(tmpdir(), 'ui craft guard '));
  const entry = fileURLToPath(new URL('./fixtures/worker.mjs', import.meta.url));
  const env = { ...getDefaultEnvironment(), TMPDIR: root, TMP: root, TEMP: root,
    UI_CRAFT_MCP_TOOL_WORKER: '1', UI_CRAFT_MCP_SKILLS: '0' };
  const launch = workerLaunch(entry, env);
  // Diagnostics belong to this controlled fixture only, never real tool data.
  launch.args[launch.args.length - 1] = launch.args.at(-1)
    .replace("$ErrorActionPreference='Stop';", "$ErrorActionPreference='Stop'; [Console]::Error.WriteLine('guard-script-entered');")
    .replace('[UICraftJob]::Run()', "[Console]::Error.WriteLine('guard-helper-compiled'); [UICraftJob]::Run()");
  const child = spawn(launch.command, launch.args, { ...launch.options, stdio: ['pipe', 'pipe', 'pipe'] });
  const exited = new Promise(resolve => { child.once('exit', resolve); child.once('error', () => resolve(-1)); });
  let stderr = '', stdout = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8192); });
  t.after(async () => {
    await stopWorker(child, exited, env);
    await rm(root, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Guard handshake timed out: ${stderr}`)), 18000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Guard exited ${code}: ${stderr}`)); });
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.includes('\n')) { clearTimeout(timer); resolve(); }
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
  });
  assert.equal(JSON.parse(stdout.split('\n')[0]).result.serverInfo.name, 'fixture');
});
