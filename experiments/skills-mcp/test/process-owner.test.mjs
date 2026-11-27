import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { workerLaunch } from '../process-owner.mjs';

test('POSIX launcher owns a detached worker without a shell', () => {
  const env = { TMPDIR: '/tmp/owned', PATH: '/usr/bin' };
  const launch = workerLaunch('/tmp/space in path/worker.mjs', env, 'darwin');
  assert.equal(launch.command, process.execPath);
  assert.deepEqual(launch.args, ['/tmp/space in path/worker.mjs']);
  assert.equal(launch.options.detached, true);
  assert.equal(launch.options.shell, undefined);
  assert.deepEqual(launch.options.env, env);
});

test('Windows launcher uses the system guard, literal paths, no profile and no policy bypass', t => {
  const previous = process.env.SystemRoot;
  process.env.SystemRoot = 'C:\\Windows';
  t.after(() => { if (previous === undefined) delete process.env.SystemRoot; else process.env.SystemRoot = previous; });
  const entry = 'C:\\a path\\worker.mjs';
  const launch = workerLaunch(entry, { TMPDIR: 'C:\\temp\\job' }, 'win32');
  assert.equal(launch.command, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.ok(launch.args.includes('-NoProfile'));
  assert.equal(launch.args[launch.args.indexOf('-InputFormat') + 1], 'None');
  assert.ok(!launch.args.some(a => /bypass|executionpolicy/i.test(a)));
  assert.ok(!launch.args.at(-1).includes(entry));
  assert.equal(launch.options.env.UI_CRAFT_WORKER_ENTRY, entry);
  assert.equal(launch.options.env.UI_CRAFT_WORKER_PARENT, String(process.pid));
  assert.equal(launch.options.env.OPENAI_API_KEY, undefined);
  assert.equal(launch.options.shell, undefined);
});

test('Windows guard attaches at creation, forbids breakaway and acknowledges empty jobs', async () => {
  const source = await readFile(new URL('../windows-job.cs', import.meta.url), 'utf8');
  assert.match(source, /new IntPtr\(0x2000D\)/);
  assert.match(source, /LimitFlags = 0x2000/);
  assert.match(source, /0x08080000/);
  assert.match(source, /accounting.ActiveProcesses == 0/);
  assert.match(source, /clock.ElapsedMilliseconds < 60000/);
  assert.match(source, /WaitForSingleObject\(parent, 0\)/);
  assert.doesNotMatch(source, /taskkill|AssignProcessToJobObject/);
});
