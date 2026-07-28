import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MCP_VERSION } from './version.mjs';

test('MCP server version comes from package.json', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(MCP_VERSION, packageJson.version);
});
