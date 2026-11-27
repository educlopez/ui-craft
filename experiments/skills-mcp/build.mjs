import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { copyFile, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { buildCatalog } from './catalog.mjs';
import { MCP_CANDIDATE_VERSION, STABLE_TARGET_VERSION } from './release-config.mjs';
import { wrapLegacyServer } from './server-factory.mjs';
import { installLocalZodResolver } from './dependency-resolution.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const release = process.argv.includes('--release');
const releaseVersion = process.argv.includes('--stable') ? STABLE_TARGET_VERSION : MCP_CANDIDATE_VERSION;
const output = release ? resolve(root, 'dist/marketplace-v2/runtime') : resolve(here, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(resolve(output, 'assets'), { recursive: true });
await copyFile(resolve(root, 'assets/icon.svg'), resolve(output, 'assets/icon.svg'));
await copyFile(resolve(here, 'assets/icon.png'), resolve(output, 'assets/icon.png'));
await copyFile(resolve(here, 'windows-job.cs'), resolve(output, 'windows-job.cs'));
await buildCatalog(root, resolve(output, 'skills'), { release });
const result = await build({
  absWorkingDir: here,
  stdin: {
    contents: `import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadCatalog } from './adapter.mjs';
import { createServer } from '../../mcp/src/server.mjs';
const catalog = await loadCatalog();
if (process.env.UI_CRAFT_MCP_TOOL_WORKER === '1') {
  // Independent safety net if the owning client process disappears abruptly.
  setTimeout(() => { try { process.kill(process.platform === 'win32' ? process.pid : -process.pid, 'SIGKILL'); } catch {} }, 60000).unref();
}
serveStdio(() => {
  const server = createServer();
  if (catalog) catalog.attach(server);
  return server;
}, { onerror: error => console.error(error) });`,
    resolveDir: here, sourcefile: 'prototype-entry.mjs', loader: 'js',
  },
  outfile: resolve(output, 'server.mjs'),
  bundle: true,
  metafile: release,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: release ? [] : ['@modelcontextprotocol/server', '@modelcontextprotocol/client', 'zod'],
  banner: release ? { js: '#!/usr/bin/env node\nimport { createRequire as _createRequire } from "node:module"; const require = _createRequire(import.meta.url);' } : undefined,
  define: { 'process.env.UI_CRAFT_BUNDLE': '"1"',
    'process.env.UI_CRAFT_RELEASE_BUILD': JSON.stringify(release ? '1' : '0') },
  plugins: [{
    name: 'isolated-sdk-v2',
    setup(context) {
      installLocalZodResolver(context, here);
      context.onLoad({ filter: /mcp[\\/]src[\\/]server\.mjs$/ }, async ({ path }) => {
        return {
          contents: wrapLegacyServer(await readFile(path, 'utf8')),
          loader: 'js', resolveDir: resolve(root, 'mcp/src'),
        };
      });
      context.onResolve({ filter: /^@modelcontextprotocol\/sdk\/server\/mcp\.js$/ }, () => ({
        path: resolve(here, 'adapter.mjs'),
      }));
      context.onResolve({ filter: /^@modelcontextprotocol\/sdk\/server\/stdio\.js$/ }, async () => release
        ? context.resolve('@modelcontextprotocol/server/stdio', { resolveDir: here, kind: 'import-statement' })
        : { path: '@modelcontextprotocol/server/stdio', external: true });
      context.onLoad({ filter: /mcp[\\/]src[\\/]version\.mjs$/ }, () => ({
        contents: `export const MCP_VERSION = ${JSON.stringify(release ? releaseVersion : '0.0.0-local')};`, loader: 'js',
      }));
    },
  }],
  legalComments: 'none',
  logLevel: 'warning',
});
if (release) {
  // Bundle runtime dependencies as well as first-party code: desktop packages
  // must not download npm modules at first use. Include bundled license texts.
  const notices = new Map();
  for (const input of Object.keys(result.metafile.inputs)) {
    if (!input.includes('node_modules')) continue;
    let directory = dirname(resolve(here, input));
    while (directory !== dirname(directory)) {
      try {
        const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
        if (!pkg.name || !pkg.version) { directory = dirname(directory); continue; }
        const key = `${pkg.name}@${pkg.version}`;
        if (!notices.has(key)) {
          const files = (await readdir(directory)).filter(name => /^(license|copying|notice)(\.|$)/i.test(name));
          if (!files.length) throw new Error(`No license text for bundled dependency ${key}`);
          notices.set(key, (await Promise.all(files.map(name => readFile(resolve(directory, name), 'utf8')))).join('\n'));
        }
        break;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      directory = dirname(directory);
    }
  }
  await writeFile(resolve(output, 'THIRD_PARTY_NOTICES.txt'), [...notices].sort()
    .map(([name, license]) => `===== ${name} =====\n${license}`).join('\n\n'));
}
console.error(release ? `Built isolated release candidate ${releaseVersion}; skills remain opt-in.` : 'Built local SDK v2 prototype; skills remain opt-in.');

// Reproducible legacy baseline using this experiment's pinned v1 dependency,
// not the existing installation under mcp/node_modules.
if (!release) await build({
  entryPoints: [resolve(root, 'mcp/src/server.mjs')],
  outfile: resolve(output, 'baseline/server.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node20',
  external: ['@modelcontextprotocol/sdk', 'zod'],
  define: { 'process.env.UI_CRAFT_BUNDLE': '"1"' },
  plugins: [{ name: 'baseline-version', setup(context) {
    context.onLoad({ filter: /mcp[\\/]src[\\/]version\.mjs$/ }, () => ({
      contents: 'export const MCP_VERSION = "0.0.0-local";', loader: 'js',
    }));
  } }],
  logLevel: 'warning', legalComments: 'none',
});
