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

test('home-boundary lookup failures are normalized and fail closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-home-failure-'));
  try {
    assert.throws(
      () => getWorkspaceRoot(root, {
        allowUnsafe: false,
        homedirFn: () => {
          throw new Error('home unavailable');
        },
      }),
      (error) => error.code === 'path_unreadable' && /home-directory boundary/.test(error.message),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace realpath failures are normalized as path_unreadable', () => {
  assert.throws(
    () => getWorkspaceRoot('/project', {
      allowUnsafe: false,
      realpathFn: () => {
        throw new Error('realpath unavailable');
      },
    }),
    (error) => error.code === 'path_unreadable',
  );
});

test('bounded reader rejects a statically oversized file before buffering it', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-static-limit-'));
  const file = path.join(root, 'large.tsx');
  fs.writeFileSync(file, '123456789');
  try {
    await assert.rejects(
      readWorkspaceFileNoFollow(file, { workspaceRoot: root, maxBytes: 8 }),
      (error) => error.code === 'max_file_bytes_exceeded',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('bounded reader detects file growth with a one-byte overflow probe', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-growth-limit-'));
  const file = path.join(root, 'growing.tsx');
  fs.writeFileSync(file, '1234');
  try {
    await assert.rejects(
      readWorkspaceFileNoFollow(file, {
        workspaceRoot: root,
        maxBytes: 4,
        testHooks: {
          afterOpen: () => fs.appendFileSync(file, '5'),
        },
      }),
      (error) => error.code === 'max_file_bytes_exceeded',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
