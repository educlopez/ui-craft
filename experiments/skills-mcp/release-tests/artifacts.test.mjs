import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Client as V1Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport as V1Transport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client as V2Client } from '@modelcontextprotocol/client';
import { StdioClientTransport as V2Transport } from '@modelcontextprotocol/client/stdio';
import { SkillsClient } from '@modelcontextprotocol/client/ext/skills';
import { MCP_CANDIDATE_VERSION, PLUGIN_CANDIDATE_VERSION, STABLE_TARGET_VERSION } from '../release-config.mjs';

const stable = process.env.UI_CRAFT_RELEASE_STABLE === '1';
const version = stable ? STABLE_TARGET_VERSION : MCP_CANDIDATE_VERSION;
const pluginVersion = stable ? PLUGIN_CANDIDATE_VERSION.split('-')[0] : PLUGIN_CANDIDATE_VERSION;

const here = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../../../dist/marketplace-v2/', import.meta.url));
const python = process.env.UI_CRAFT_TEST_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

async function extracted(t, archive = `ui-craft-mcp-${version}.tgz`) {
  const directory = await mkdtemp(join(tmpdir(), 'ui craft niño extracted '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Archives are locally built and separately validated for traversal/symlinks.
  execFileSync(python, [join(here, 'extract-test-archive.py'), join(output, archive), directory], { timeout: 15000 });
  return directory;
}

async function connect(t, entry, legacy, skills) {
  const Transport = legacy ? V1Transport : V2Transport;
  const Peer = legacy ? V1Client : V2Client;
  const transport = new Transport({ command: process.execPath, args: [entry],
    cwd: tmpdir(), env: { UI_CRAFT_MCP_SKILLS: skills }, stderr: 'pipe' });
  const client = new Peer({ name: 'release-artifact-test', version: '1' },
    legacy ? {} : { versionNegotiation: { mode: 'auto' } });
  let diagnostic = '';
  transport.stderr.on('data', chunk => { diagnostic += chunk; });
  t.after(() => client.close());
  try { await client.connect(transport); }
  catch (error) { throw new Error(`${error.message}\n${diagnostic}`, { cause: error }); }
  return client;
}

test('archives, manifests, links and preserved source hashes pass structural validation', () => {
  execFileSync(python, [join(here, 'verify-release.py')], { timeout: 30000, stdio: 'pipe' });
});

for (const legacy of [true, false]) for (const skills of ['0', '1']) {
  test(`extracted dependency-free npm package: ${legacy ? 'legacy' : 'modern'}, skills=${skills}`, async t => {
    const directory = await extracted(t);
    const entry = join(directory, 'package/dist/server.mjs');
    const client = await connect(t, entry, legacy, skills);
    const info = client.getServerVersion();
    assert.equal(info.name, 'ui-craft');
    assert.equal(info.version, version);
    assert.equal(info.title, 'UI Craft');
    assert.equal(info.icons.length, 2);
    assert.equal((await client.listTools()).tools.length, 8);
    const result = await client.callTool({ name: 'score_ui', arguments: { code: '<button>Save</button>' } });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    assert.ok(result.structuredContent);
    for (const [name, args] of [
      ['check_anti_slop', { code: '<div className="bg-gradient-to-r from-purple-500 to-cyan-500" />' }],
      ['tokens_lint', { code: '<div style={{color:"#123456"}} />' }],
      ['acceptance_bar', { surface: 'dashboard' }],
      ['ux_coverage', { archetype: 'settings' }],
      ['fold_candidates', { used: ['type-only'], seed: 'release' }],
      ['route_task', { prompt: 'analytics panel with KPIs' }],
    ]) {
      const answer = await client.callTool({ name, arguments: args });
      assert.notEqual(answer.isError, true, `${name}: ${JSON.stringify(answer)}`);
      assert.ok(answer.structuredContent, name);
    }
    if (!legacy) {
      const catalog = new SkillsClient(client);
      assert.equal(catalog.supported, skills === '1');
      if (skills === '1') {
        const { skills: entries, invalid } = await catalog.list();
        assert.deepEqual(invalid, []);
        assert.equal(entries.length, 64);
        for (const skill of entries) {
          const resource = await catalog.read(skill);
          assert.equal(resource.verified, true);
          assert.match(resource.text, /MCP delivery rules/);
          assert.ok(resource.bytes.length < 100000);
        }
      }
    }
    const pkg = JSON.parse(await readFile(join(directory, 'package/package.json'), 'utf8'));
    assert.equal(pkg.private, !stable);
    assert.equal('prepublishOnly' in pkg.scripts, !stable);
    assert.deepEqual(pkg.dependencies, {});
    assert.match(await readFile(join(directory, 'package/dist/THIRD_PARTY_NOTICES.txt'), 'utf8'), /@modelcontextprotocol\/server@2\.4\.0/);
  });
}

test('extracted OpenAI package launches without npm and without duplicate MCP skills', async t => {
  const directory = await extracted(t, `ui-craft-openai-${pluginVersion}.zip`);
  const config = JSON.parse(await readFile(join(directory, 'mcp.json'), 'utf8')).mcpServers['ui-craft-mcp'];
  const entry = config.args[0].replace('${PLUGIN_ROOT}', directory);
  const client = await connect(t, entry, false, config.env.UI_CRAFT_MCP_SKILLS);
  assert.equal((await client.listTools()).tools.length, 8);
  assert.equal(new SkillsClient(client).supported, false);
});
