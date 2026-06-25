/**
 * Functional smoke test — spawns the REAL server over stdio via an MCP client.
 * Catches server-startup failures (e.g. bad tool registration) that module-level
 * unit tests miss. Regression guard for the v0.29/v0.30 registerTool Zod-schema bug.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Defaults to the source server; set UI_CRAFT_MCP_SERVER (e.g. dist/server.mjs)
// to smoke the published bundle — same regression guard, real artifact.
const SERVER = process.env.UI_CRAFT_MCP_SERVER
  ? join(process.cwd(), process.env.UI_CRAFT_MCP_SERVER)
  : join(__dirname, 'server.mjs');

test('server boots over stdio and lists the 4 tools', async () => {
  const transport = new StdioClientTransport({ command: 'node', args: [SERVER] });
  const client = new Client({ name: 'smoke', version: '0.0.0' }, { capabilities: {} });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepStrictEqual(names, ['acceptance_bar', 'check_anti_slop', 'score_ui', 'tokens_lint']);
  } finally {
    await client.close();
  }
});

test('check_anti_slop + score_ui return content over stdio', async () => {
  const transport = new StdioClientTransport({ command: 'node', args: [SERVER] });
  const client = new Client({ name: 'smoke', version: '0.0.0' }, { capabilities: {} });
  await client.connect(transport);
  try {
    const slop = 'export default () => <div className="bg-gradient-to-r from-purple-500 to-cyan-500"><img src="/x.png"/></div>;';
    const anti = await client.callTool({ name: 'check_anti_slop', arguments: { code: slop } });
    assert.ok(anti.content?.[0]?.text, 'check_anti_slop returns text content');
    const score = await client.callTool({ name: 'score_ui', arguments: { code: slop } });
    const parsed = JSON.parse(score.content[0].text);
    assert.ok(typeof parsed.overall?.score === 'number', 'score_ui returns a numeric score');
    const bar = await client.callTool({ name: 'acceptance_bar', arguments: { surface: 'dashboard' } });
    assert.ok(bar.content?.[0]?.text, 'acceptance_bar returns content');
  } finally {
    await client.close();
  }
});
