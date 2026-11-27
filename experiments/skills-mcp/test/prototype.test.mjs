import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client as V1Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport as V1Transport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client as V2Client } from '@modelcontextprotocol/client';
import { StdioClientTransport as V2Transport } from '@modelcontextprotocol/client/stdio';
import { SkillsClient } from '@modelcontextprotocol/client/ext/skills';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';

const here = fileURLToPath(new URL('../', import.meta.url));
const server = join(here, 'dist/server.mjs');
const baseline = join(here, 'dist/baseline/server.mjs');
const expectedNames = ['acceptance_bar', 'check_anti_slop', 'check_fold',
  'fold_candidates', 'route_task', 'score_ui', 'tokens_lint', 'ux_coverage'];

async function connect(t, { version = 2, flag = '0', entry = server, cwd = tmpdir() } = {}) {
  const Transport = version === 1 ? V1Transport : V2Transport;
  const Client = version === 1 ? V1Client : V2Client;
  const env = { ...process.env };
  delete env.UI_CRAFT_MCP_SKILLS;
  if (flag !== null) env.UI_CRAFT_MCP_SKILLS = flag;
  const transport = new Transport({ command: process.execPath, args: [entry], cwd, env, stderr: 'pipe' });
  const client = new Client({ name: 'ui-craft-prototype-test', version: '0.0.0' }, {
    capabilities: {},
    ...(version === 2 ? { versionNegotiation: { mode: 'auto', probe: { timeoutMs: 1500 } } } : {}),
  });
  t.after(() => client.close());
  await client.connect(transport);
  return client;
}

function normalizeSchema(value) {
  if (Array.isArray(value)) return value.map(normalizeSchema);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== '$schema')
      .map(([key, nested]) => [key, normalizeSchema(nested)]));
  return value;
}

async function isolatedCopy(t) {
  const temp = await mkdtemp(join(tmpdir(), 'ui-craft-skills-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  await cp(join(here, 'dist'), join(temp, 'dist'), { recursive: true });
  await symlink(join(here, 'node_modules'), join(temp, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  return join(temp, 'dist/server.mjs');
}

for (const version of [1, 2]) {
  for (const flag of ['0', '1']) {
    test(`v${version} client, opt-in ${flag}: eight tools preserve schemas and results`, async t => {
      const original = await connect(t, { version, entry: baseline });
      const candidate = await connect(t, { version, flag });
      if (version === 2) {
        assert.equal(candidate.getProtocolEra(), 'modern');
        assert.equal(candidate.getNegotiatedProtocolVersion(), '2026-07-28');
        assert.equal(original.getProtocolEra(), 'legacy');
      }
      const oldTools = (await original.listTools()).tools;
      const newTools = (await candidate.listTools()).tools;
      assert.deepEqual(newTools.map(tool => tool.name).sort(), expectedNames);
      const info = candidate.getServerVersion();
      assert.equal(info.title, 'UI Craft — local prototype');
      assert.equal(info.websiteUrl, 'https://ui-craft.smoothui.dev');
      assert.equal(info.icons[0].mimeType, 'image/png');
      assert.ok(info.icons[0].src.startsWith('data:image/png;base64,'));
      assert.deepEqual(info.icons[0].sizes, ['1024x1024']);
      assert.equal(info.icons[1].mimeType, 'image/svg+xml');
      for (const tool of newTools) {
        assert.deepEqual(tool.icons, info.icons);
        const browser = tool.name === 'check_fold';
        assert.deepEqual(tool.annotations, { readOnlyHint: !browser, destructiveHint: false,
          idempotentHint: !browser, openWorldHint: browser });
      }
      // v2 drops legacy execution.taskSupport: forbidden. No tasks are added;
      // compare every other field, including the complete input/output schemas.
      for (const tool of oldTools) assert.deepEqual(tool.execution, { taskSupport: 'forbidden' });
      const expectedTools = structuredClone(oldTools).map(({ execution, ...tool }) => {
        if (['check_anti_slop', 'tokens_lint'].includes(tool.name)) {
          tool.outputSchema.properties.findings.items.additionalProperties = {};
        }
        return tool;
      });
      assert.deepEqual(normalizeSchema(newTools.map(({ icons, annotations, ...tool }) => tool)), normalizeSchema(expectedTools));
      const cases = [
        ['check_anti_slop', { code: '<div className="bg-gradient-to-r from-purple-500 to-cyan-500" />' }],
        ['tokens_lint', { code: '<div style={{color:"#123456"}} />' }],
        ['score_ui', { code: '<button>Save</button>' }],
        ['acceptance_bar', { surface: 'dashboard' }],
        ['ux_coverage', { archetype: 'settings' }],
        ['fold_candidates', { used: ['type-only'], seed: 'prototype' }],
        ['route_task', { prompt: 'analytics panel with KPIs' }],
        ['check_anti_slop', {}],
      ];
      for (const [name, args] of cases) {
        const request = { name, arguments: args };
        // Raw protocol request retains the legacy payload, including metadata
        // its advertised output schema currently (incorrectly) disallows.
        const expected = await original.request({ method: 'tools/call', params: request },
          z.object({ content: z.array(z.unknown()) }).passthrough());
        const actual = await candidate.callTool(request);
        if (version === 2) {
          assert.deepEqual(actual._meta, {
            'io.modelcontextprotocol/serverInfo': info,
          });
          const { _meta, ...payload } = actual;
          assert.deepEqual(payload, expected, name);
        } else {
          assert.deepEqual(actual, expected, name);
        }
      }
      const error = await candidate.callTool({ name: 'check_anti_slop', arguments: {} });
      assert.equal(error.isError, true);
      assert.equal(error.structuredContent, undefined);
      assert.ok(error.content[0].text);
    });
  }
}

test('default launch does not advertise skills or require catalog files', async t => {
  const entry = await isolatedCopy(t);
  await rm(join(dirname(entry), 'skills'), { recursive: true });
  const client = await connect(t, { entry, flag: null });
  assert.equal(new SkillsClient(client).supported, false);
  assert.equal(client.getServerCapabilities().resources, undefined);
});

test('opt-in discovers and verifies the complete catalog from a relocated artifact', async t => {
  const entry = await isolatedCopy(t);
  const client = await connect(t, { entry, flag: '1' });
  const skills = new SkillsClient(client);
  assert.equal(skills.supported, true);
  const { skills: entries, invalid } = await skills.list();
  assert.deepEqual(invalid, []);
  const report = JSON.parse(await readFile(join(dirname(entry), 'catalog-report.json'), 'utf8'));
  assert.equal(entries.length, report.length);
  assert.ok(entries.length < 100);
  assert.equal(new Set(entries.map(s => s.uri)).size, entries.length);
  const uris = new Set(entries.map(s => s.uri));
  for (const item of report) assert.ok(uris.has(item.uri), item.uri);
  assert.equal(report.filter(item => item.source.startsWith('commands/')).length, 25);
  assert.equal(report.filter(item => /^skills\/[^/]+\/SKILL\.md$/.test(item.source)).length, 4);
  assert.equal(report.filter(item => item.name.startsWith('ui-craft-ref-')).length, 35);
  const main = entries.find(skill => skill.uri === 'skill://ui-craft/SKILL.md');
  assert.deepEqual((await skills.get(main.uri)).skill, main);
  for (const skill of entries) {
    const file = await skills.read(skill);
    assert.equal(file.verified, true);
    assert.ok(file.bytes.length < 100_000);
    assert.ok(file.text.includes('MCP prototype delivery rules'));
    for (const match of file.text.matchAll(/skill:\/\/[^\s)`\]"#]+/g)) {
      assert.ok(uris.has(match[0]), `unresolved URI: ${match[0]}`);
    }
  }
});

test('resource reads reject unknown and traversal URIs', async t => {
  const client = await connect(t, { flag: '1' });
  for (const uri of ['skill://missing/SKILL.md', 'skill://ui-craft/../../package.json',
    'skill://ui-craft/%2e%2e/package.json', 'file:///etc/passwd']) {
    await assert.rejects(() => client.readResource({ uri }), undefined, uri);
  }
});

test('changed resource bytes are rejected after the manifest is published', async t => {
  const entry = await isolatedCopy(t);
  const client = await connect(t, { entry, flag: '1' });
  const skills = new SkillsClient(client);
  const { skills: entries } = await skills.list();
  const skill = entries.find(s => s.uri === 'skill://ui-craft/SKILL.md');
  assert.ok(skill);
  await writeFile(join(dirname(entry), 'skills/ui-craft/SKILL.md'), 'tampered');
  await assert.rejects(() => skills.read(skill));
});

test('legacy scanner schema defect is reproduced and fixed only in the adapter', async t => {
  const original = await connect(t, { version: 1, entry: baseline });
  const candidate = await connect(t, { version: 1 });
  const request = { name: 'tokens_lint', arguments: {
    code: '<div style={{color:"#123456"}} />',
  } };
  await original.listTools();
  await candidate.listTools();
  await assert.rejects(() => original.callTool(request), /additional properties/);
  const result = await candidate.callTool(request);
  assert.ok(result.structuredContent.findings.length > 0);
});

test('strict catalog rejects symlinks rather than serving outside files', { skip: process.platform === 'win32' && 'File symlinks require a privileged Windows runner; directory junction relocation is tested separately.' }, async t => {
  const entry = await isolatedCopy(t);
  await symlink(join(here, 'package.json'), join(dirname(entry), 'skills/ui-craft/outside.json'));
  const child = spawnSync(process.execPath, [entry], {
    env: { ...process.env, UI_CRAFT_MCP_SKILLS: '1' },
    encoding: 'utf8', timeout: 5000,
  });
  assert.equal(child.error, undefined);
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /SkillCatalogError/);
});

test('invalid opt-in and missing catalog fail closed instead of silently skipping skills', async t => {
  const entry = await isolatedCopy(t);
  for (const flag of ['true', '1']) {
    if (flag === '1') await rm(join(dirname(entry), 'skills'), { recursive: true });
    const child = spawnSync(process.execPath, [entry], {
      cwd: tmpdir(), env: { ...process.env, UI_CRAFT_MCP_SKILLS: flag },
      encoding: 'utf8', timeout: 5000,
    });
    assert.equal(child.error, undefined);
    assert.notEqual(child.status, 0);
  }
});
