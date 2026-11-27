import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const registry = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'));

test('MCP Registry ownership marker and npm package descriptor stay aligned', () => {
  assert.equal(registry.$schema, 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json');
  assert.equal(registry.name, pkg.mcpName);
  assert.equal(registry.name, 'io.github.educlopez/ui-craft');
  assert.equal(registry.version, pkg.version);
  assert.ok(registry.description.length > 0 && registry.description.length <= 100);
  assert.equal(registry.repository.url, pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, ''));
  assert.equal(registry.repository.source, 'github');
  assert.deepEqual(registry.packages, [{
    registryType: 'npm',
    identifier: pkg.name,
    version: pkg.version,
    transport: { type: 'stdio' },
    environmentVariables: [{
      name: 'UI_CRAFT_MCP_SKILLS',
      description: 'Set 1 only when the host supports Skills over MCP and native UI Craft skills are not installed; otherwise keep 0.',
      default: '0',
      choices: ['0', '1'],
      isRequired: false,
      isSecret: false,
    }],
  }]);
  assert.equal(registry.websiteUrl, pkg.homepage);
  assert.deepEqual(registry.icons, [{
    src: 'https://raw.githubusercontent.com/educlopez/ui-craft/main/assets/icon.svg',
    mimeType: 'image/svg+xml',
    sizes: ['any'],
  }]);
});
