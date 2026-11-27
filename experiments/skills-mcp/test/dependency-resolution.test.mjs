import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { installLocalZodResolver } from '../dependency-resolution.mjs';

test('sources outside the candidate resolve pinned Zod without parent node_modules', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ui-craft-clean-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'server.mjs');
  await writeFile(source, 'import {z} from "zod"; export const schema=z.object({value:z.string()});');
  const result = await build({ entryPoints: [source], bundle: true, write: false,
    platform: 'node', format: 'esm', logLevel: 'silent',
    plugins: [{ name: 'candidate-zod', setup(context) {
      installLocalZodResolver(context, fileURLToPath(new URL('../', import.meta.url)));
    } }],
  });
  const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  assert.deepEqual(module.schema.parse({ value: 'isolated' }), { value: 'isolated' });
  assert.equal(module.schema.safeParse({ value: 1 }).success, false);
});
