import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const dead = pid => { try { process.kill(pid, 0); return false; } catch (e) { if (e.code === 'ESRCH') return true; throw e; } };
async function until(check, message) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { if (await check()) return; await delay(25); }
  throw new Error(message);
}

test('Windows job kills worker descendants after abrupt owner death', { skip: process.platform !== 'win32' && 'Requires native Windows Job Objects' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'ui craft owner '));
  let guard, descendant;
  const runner = new URL('../tool-runner.mjs', import.meta.url).href;
  const entry = fileURLToPath(new URL('./fixtures/worker.mjs', import.meta.url));
  const code = `import {runTool} from ${JSON.stringify(runner)};
    await runTool('slow',{hang:true},{},{entry:${JSON.stringify(entry)},tempRoot:${JSON.stringify(root)}});`;
  const owner = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let stderr = '';
  owner.stderr.on('data', data => { stderr += data; });
  const exited = new Promise(resolve => owner.once('exit', resolve));
  t.after(async () => {
    if (!dead(owner.pid)) owner.kill('SIGKILL');
    await exited;
    // Kill only this test's owned guard as a last-resort kernel Job close.
    if (guard && !dead(guard)) process.kill(guard, 'SIGKILL');
    if (descendant) await until(() => dead(descendant), 'Test descendant still alive after guard close');
    await rm(root, { recursive: true, force: true });
  });
  await until(async () => {
    const match = stderr.match(/"event":"started"[^\n]*"pid":(\d+)/);
    if (match) guard = Number(match[1]);
    for (const directory of await readdir(root)) {
      try { descendant = Number(await readFile(join(root, directory, 'descendant.pid'), 'utf8')); } catch {}
    }
    return guard && descendant;
  }, 'Owned guard/descendant did not start');
  owner.kill('SIGKILL');
  await exited;
  await until(() => dead(guard) && dead(descendant), 'Owner death left an owned Windows process alive');
  assert.ok(dead(descendant));
});
