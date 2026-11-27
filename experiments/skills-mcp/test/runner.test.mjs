import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { runTool } from '../tool-runner.mjs';

const entry = fileURLToPath(new URL('./fixtures/worker.mjs', import.meta.url));
async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), 'ui-craft-runner-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function descendant(root) {
  for (let i = 0; i < (process.platform === 'win32' ? 750 : 100); i++) {
    for (const name of await readdir(root)) {
      try {
        const pid = Number(await readFile(join(root, name, 'descendant.pid'), 'utf8'));
        if (Number.isSafeInteger(pid) && pid > 0) return pid;
      }
      catch {}
    }
    await delay(20);
  }
  throw new Error('Fixture descendant did not start');
}
function dead(pid) {
  assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
}

test('progress is monotonic and cleanup kills TERM-resistant descendants even on success', async t => {
  const root = await scratch(t);
  const notifications = [], events = [];
  const result = runTool('slow', { delay: 1300 }, {
    _meta: { progressToken: 'test' }, notify: async n => notifications.push(n),
  }, { entry, tempRoot: root, onEvent: e => events.push(e) });
  const pid = await descendant(root);
  assert.equal((await result).content[0].text, 'done');
  assert.ok(notifications.length >= 4);
  assert.deepEqual(notifications.map(n => n.params.progress), notifications.map((_, i) => i));
  assert.ok(notifications.every(n => n.params.progressToken === 'test' && n.params.total === undefined));
  assert.equal(events.at(-1).event, 'completed-and-cleaned');
  dead(pid);
  assert.deepEqual(await readdir(root), []);
});

test('cancellation ends work, removes profiles and sends no completed progress', async t => {
  const root = await scratch(t), controller = new AbortController();
  const messages = [];
  const pending = runTool('slow', { hang: true }, {
    signal: controller.signal, _meta: { progressToken: 1 }, notify: async n => messages.push(n.params.message),
  }, { entry, tempRoot: root });
  const rejected = assert.rejects(pending, /cancelled by test/);
  const pid = await descendant(root);
  controller.abort(new Error('cancelled by test'));
  await rejected;
  dead(pid);
  assert.deepEqual(await readdir(root), []);
  assert.ok(!messages.includes('Check completed'));
});

test('hard deadline cleans an unresponsive worker and releases the concurrency slot', async t => {
  const root = await scratch(t);
  const pending = runTool('slow', { hang: true }, {}, { entry, tempRoot: root,
    timeoutMs: process.platform === 'win32' ? 12000 : 1200 });
  const rejected = assert.rejects(pending, /hard time limit/);
  const pid = await descendant(root);
  await rejected;
  dead(pid);
  assert.deepEqual(await readdir(root), []);
  await runTool('slow', {}, {}, { entry, tempRoot: root });
  assert.deepEqual(await readdir(root), []);
});

test('already-cancelled calls spawn nothing and quiet clients receive no progress', async t => {
  const root = await scratch(t), controller = new AbortController();
  controller.abort(new Error('already cancelled'));
  await assert.rejects(() => runTool('slow', {}, { signal: controller.signal }, { entry, tempRoot: root }), /already cancelled/);
  assert.deepEqual(await readdir(root), []);
  let sent = false;
  await runTool('slow', {}, { notify: async () => { sent = true; } }, { entry, tempRoot: root });
  assert.equal(sent, false);
});

test('a second render is refused and cancellation releases its dedicated slot', async t => {
  const root = await scratch(t), controller = new AbortController();
  const pending = runTool('check_fold', { hang: true }, { signal: controller.signal }, { entry, tempRoot: root });
  const rejected = assert.rejects(pending);
  await descendant(root);
  await assert.rejects(() => runTool('check_fold', {}, {}, { entry, tempRoot: root }), /busy/);
  controller.abort();
  await rejected;
  await runTool('check_fold', {}, {}, { entry, tempRoot: root });
  assert.deepEqual(await readdir(root), []);
});

test('two active checks bound the worker pool and a third is refused', async t => {
  const root = await scratch(t), controllers = [new AbortController(), new AbortController()];
  const jobs = controllers.map(controller => runTool('slow', { hang: true },
    { signal: controller.signal }, { entry, tempRoot: root }));
  const rejected = jobs.map(job => assert.rejects(job));
  await descendant(root);
  await assert.rejects(() => runTool('slow', {}, {}, { entry, tempRoot: root }), /busy/);
  controllers.forEach(controller => controller.abort());
  await Promise.all(rejected);
  assert.deepEqual(await readdir(root), []);
});

for (const phase of ['Starting isolated check', 'Running isolated check', 'Check still running', 'Check completed']) {
  test(`cancellation escapes blocked progress at ${phase} and releases its slot`, { timeout: 20000 }, async t => {
    const root = await scratch(t), controller = new AbortController();
    let rejectSend, sent = false;
    const events = [];
    await assert.rejects(runTool('slow', { delay: phase === 'Check still running' ? 1300 : 0 }, {
      signal: controller.signal, _meta: { progressToken: 'blocked' },
      notify: notification => {
        if (!notification.params.message.startsWith(phase)) return Promise.resolve();
        sent = true;
        queueMicrotask(() => controller.abort(new Error('cancel blocked progress')));
        return new Promise((_, reject) => { rejectSend = reject; });
      },
    }, { entry, tempRoot: root, onEvent: event => events.push(event) }), /cancel blocked progress/);
    assert.equal(sent, true);
    assert.equal(events.at(-1).event, 'cancelled-and-cleaned');
    assert.deepEqual(await readdir(root), []);
    // A late transport failure must remain handled after cancellation won.
    rejectSend(new Error('late progress send failure'));
    await delay(0);
    await runTool('slow', {}, {}, { entry, tempRoot: root });
    assert.deepEqual(await readdir(root), []);
  });
}

for (const phase of ['Starting isolated check', 'Check completed']) {
  test(`hard deadline escapes blocked ${phase} without client cancellation`, { timeout: 20000 }, async t => {
    const root = await scratch(t);
    let blocked = false;
    await assert.rejects(runTool('check_fold', {}, {
      _meta: { progressToken: 0 }, notify: notification => {
        if (notification.params.message !== phase) return Promise.resolve();
        blocked = true;
        return new Promise(() => {});
      },
    }, { entry, tempRoot: root, timeoutMs: process.platform === 'win32' ? 12000 : 1200 }), /hard time limit/);
    assert.equal(blocked, true);
    assert.deepEqual(await readdir(root), []);
    await runTool('check_fold', {}, {}, { entry, tempRoot: root });
  });
}

for (const scenario of ['success', 'active-cleanup-failure', 'previous-cleanup-failure']) {
  test(`SIGTERM reports ${scenario} truthfully`, {
    skip: process.platform === 'win32' && 'Requires POSIX SIGTERM delivery', timeout: 20000,
  }, async t => {
    const root = await scratch(t);
    const runner = new URL('../tool-runner.mjs', import.meta.url).href;
    const previous = scenario === 'previous-cleanup-failure';
    const fail = scenario !== 'success';
    const script = `import {runTool} from ${JSON.stringify(runner)};
      await runTool('slow', {hang: ${!previous}}, {}, {
        entry: ${JSON.stringify(entry)}, tempRoot: ${JSON.stringify(root)},
        onEvent(event) {
          if (event.event === 'started' && ${!previous})
            setTimeout(() => process.kill(process.pid, 'SIGTERM'), 100);
          // Inject a cleanup failure after real owned-process cleanup, never
          // leave a fixture descendant running just to exercise the status.
          if (${fail} && event.event.endsWith('-and-cleaned')) throw new Error('injected cleanup failure');
        }
      }).catch(() => {});
      if (${previous}) process.kill(process.pid, 'SIGTERM');`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8', timeout: 15000,
    });
    assert.ifError(child.error);
    assert.equal(child.signal, null, child.stderr);
    assert.equal(child.status, fail ? 1 : 0, child.stderr);
    assert.deepEqual(await readdir(root), []);
  });
}
