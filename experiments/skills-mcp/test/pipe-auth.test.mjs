import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyWorkerGreeting } from '../pipe-auth.mjs';

test('worker pipe authenticates only the complete exact nonce frame', () => {
  const secret = 'ab'.repeat(32);
  assert.equal(verifyWorkerGreeting(secret + '\n', secret), true);
  for (const value of ['', secret, secret.slice(1) + '\n', 'cd'.repeat(32) + '\n',
    secret + '\r\n', secret + '\n\n', ' ' + secret + '\n', secret + '\ntrailing']) {
    assert.equal(verifyWorkerGreeting(value, secret), false);
  }
});

test('Windows helper pins pipe ownership and clears the nonce before child launch', async () => {
  const source = await readFile(new URL('../windows-job.cs', import.meta.url), 'utf8');
  assert.match(source, /GetNamedPipeServerProcessId\(input\.SafePipeHandle/);
  assert.match(source, /serverPid != parentId/);
  const clear = source.indexOf('Environment.SetEnvironmentVariable("UI_CRAFT_WORKER_PIPE_TOKEN", null)');
  const launch = source.indexOf('Check(CreateProcessW(');
  assert.ok(clear > 0 && clear < launch);
});
