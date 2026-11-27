import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deliveryGuide } from '../catalog.mjs';

const entries = [
  { name: 'ui-craft', uri: 'skill://ui-craft/SKILL.md' },
  { name: 'ui-craft-ref-review', uri: 'skill://ui-craft-ref-review/SKILL.md' },
];

test('delivery guidance separates catalog names, resource addresses and host invocations', () => {
  const guide = deliveryGuide('polish', 'Load the `ui-craft` skill. Read `skill://ui-craft-ref-review/SKILL.md`.', entries);
  assert.match(guide, /entry's catalog name is `polish`/);
  assert.match(guide, /resource address is\n`skill:\/\/polish\/SKILL.md`/);
  assert.match(guide, /NOT an argument for the host's Skill tool/);
  assert.match(guide, /reuse the actual server prefix of the current invocation/);
  assert.match(guide, /Never pass a resource address/);
  assert.match(guide, /\| ui-craft \| skill:\/\/ui-craft\/SKILL.md \|/);
  assert.match(guide, /\| ui-craft-ref-review \| skill:\/\/ui-craft-ref-review\/SKILL.md \|/);
  assert.doesNotMatch(guide, /ui-craft-prototype:/);
});

test('anchors and repeated links map to a single dependency row', () => {
  const guide = deliveryGuide('polish', '[Review](skill://ui-craft-ref-review/SKILL.md#polish) and `skill://ui-craft-ref-review/SKILL.md`.', entries);
  assert.equal(guide.split('| ui-craft-ref-review |').length - 1, 1);
});

test('unknown resource links fail instead of silently inventing skill names', () => {
  assert.throws(() => deliveryGuide('polish', '`skill://unknown/SKILL.md`', entries), /Unknown skill resource URI/);
});

test('generated polish keeps transport links and supplies their correct catalog names', async () => {
  const text = await readFile(new URL('../dist/skills/polish/SKILL.md', import.meta.url), 'utf8');
  assert.match(text, /\| ui-craft-ref-review \| skill:\/\/ui-craft-ref-review\/SKILL.md \|/);
  assert.match(text, /\| ui-craft \| skill:\/\/ui-craft\/SKILL.md \|/);
  assert.match(text, /same server|SAME server/);
  assert.match(text, /approval flow/);
});
