import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { wrapLegacyServer } from '../server-factory.mjs';

test('factory adapter produces identical source for LF and Windows CRLF checkouts', async () => {
  const original = await readFile(new URL('../../../mcp/src/server.mjs', import.meta.url), 'utf8');
  const lf = original.replaceAll('\r\n', '\n');
  assert.equal(wrapLegacyServer(lf), wrapLegacyServer(lf.replaceAll('\n', '\r\n')));
  assert.match(wrapLegacyServer(lf), /export function createServer/);
  assert.doesNotMatch(wrapLegacyServer(lf), /await server.connect\(transport\)/);
});

test('factory adapter fails closed when canonical bootstrap shape changes', () => {
  assert.throws(() => wrapLegacyServer('export const server = 1;\n'), /layout changed/);
  assert.throws(() => wrapLegacyServer('const server = new McpServer();\nconst transport = new StdioServerTransport();\nstartDifferently();\n'), /layout changed/);
});
