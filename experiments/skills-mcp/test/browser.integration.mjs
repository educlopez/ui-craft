import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const entry = process.env.UI_CRAFT_TEST_ENTRY ?? fileURLToPath(new URL('../dist/server.mjs', import.meta.url));
async function until(predicate, message) {
  for (let i = 0; i < (process.platform === 'win32' ? 600 : 160); i++) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error(message);
}

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'ui-craft-browser-test-'));
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write('<!doctype html><html><head><title>Local fixture</title></head><body><main><h1>Design review</h1><p>A local lifecycle fixture.</p><button>Save review</button></main>');
    if (req.url !== '/slow') res.end('</body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], stderr: 'pipe',
    env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root, UI_CRAFT_MCP_SKILLS: '0' } });
  let stderr = '';
  transport.stderr.on('data', data => { stderr += data.toString(); });
  const client = new Client({ name: 'browser-lifecycle', version: '0' }, {
    versionNegotiation: { mode: 'auto' },
  });
  t.after(async () => {
    await client.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  await client.connect(transport);
  return { client, transport, root, requests, url, stderr: () => stderr };
}

test('real browser returns screenshot, structured result and progress, then removes its profile', async t => {
  const f = await setup(t), progress = [];
  const result = await f.client.callTool({ name: 'check_fold', arguments: {
    url: `${f.url}/fast`, expected_class: 'type-only', costly_detail: 'Test fixture, not a design evaluation',
  } }, { onprogress: update => progress.push(update) });
  assert.notEqual(result.isError, true, result.content?.[0]?.text);
  assert.ok(result.content.some(item => item.type === 'image' && item.data.length > 0));
  assert.ok(result.structuredContent.composition);
  assert.ok(progress.length >= 3);
  assert.equal(progress.at(-1).message, 'Check completed');
  assert.deepEqual(await readdir(f.root), []);
  await until(() => /completed-and-cleaned/.test(f.stderr()), 'Missing completion cleanup receipt');
});

test('real browser cancellation cleans its process group and profile', async t => {
  const f = await setup(t), controller = new AbortController(), progress = [];
  const pending = f.client.callTool({ name: 'check_fold', arguments: { url: `${f.url}/slow` } }, {
    signal: controller.signal, onprogress: update => progress.push(update),
  });
  const rejected = assert.rejects(pending);
  await until(() => f.requests.includes('/slow'), 'Chrome did not navigate to slow fixture');
  controller.abort(new Error('Browser cancellation integration test'));
  await rejected;
  await until(() => /cancelled-and-cleaned/.test(f.stderr()), 'Missing cancellation cleanup receipt');
  assert.deepEqual(await readdir(f.root), []);
  assert.ok(progress.some(update => /Rendering page/.test(update.message)));
  assert.ok(!progress.some(update => update.message === 'Check completed'));
});

test('disconnect during a real browser render cleans its process group and profile', async t => {
  const f = await setup(t);
  const pending = f.client.callTool({ name: 'check_fold', arguments: { url: `${f.url}/slow` } });
  const rejected = assert.rejects(pending);
  await until(() => f.requests.includes('/slow'), 'Chrome did not navigate to disconnect fixture');
  await f.client.close();
  await rejected;
  await until(async () => (await readdir(f.root)).length === 0, 'Disconnect left a browser profile');
  assert.match(f.stderr(), /cancelled-and-cleaned/);
});

test('SIGTERM to the prototype server cleans the active browser before exit', { skip: process.platform === 'win32' && 'Windows uses owner-death Job Object cleanup rather than POSIX signals.' }, async t => {
  const f = await setup(t);
  const pending = f.client.callTool({ name: 'check_fold', arguments: { url: `${f.url}/slow` } });
  const rejected = assert.rejects(pending);
  await until(() => f.requests.includes('/slow'), 'Chrome did not navigate to shutdown fixture');
  assert.ok(f.transport.pid > 0);
  process.kill(f.transport.pid, 'SIGTERM');
  await rejected;
  await until(async () => (await readdir(f.root)).length === 0, 'Shutdown left a browser profile');
  assert.match(f.stderr(), /cancelled-and-cleaned/);
});
