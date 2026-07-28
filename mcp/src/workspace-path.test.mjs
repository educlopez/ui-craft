import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getWorkspaceRoot,
  readWorkspaceFileNoFollow,
} from './workspace-path.mjs';

test('implicit workspace root requires a Git or package marker', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-unverified-'));
  try {
    assert.throws(
      () => getWorkspaceRoot(undefined, { startDir: dir, environmentRoot: null }),
      (error) => error.code === 'workspace_root_unverified',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('filesystem root and home are rejected unless the unsafe override is explicit', () => {
  assert.throws(
    () => getWorkspaceRoot(path.parse(process.cwd()).root),
    (error) => error.code === 'workspace_root_unsafe',
  );
  assert.throws(
    () => getWorkspaceRoot(os.homedir()),
    (error) => error.code === 'workspace_root_unsafe',
  );
  assert.equal(
    getWorkspaceRoot(path.parse(process.cwd()).root, { allowUnsafe: true }),
    path.parse(process.cwd()).root,
  );
});

test('no-follow reader rejects a symlink even when its target stays in the workspace', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-no-follow-'));
  fs.writeFileSync(path.join(root, 'target.tsx'), 'export const Safe = true;');
  fs.symlinkSync(path.join(root, 'target.tsx'), path.join(root, 'link.tsx'));
  try {
    await assert.rejects(
      readWorkspaceFileNoFollow(path.join(root, 'link.tsx'), { workspaceRoot: root }),
      (error) => error.code === 'symlink_not_allowed',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
