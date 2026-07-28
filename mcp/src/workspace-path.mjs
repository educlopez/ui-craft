/**
 * Filesystem boundary shared by MCP tools that accept a path.
 *
 * The server treats UI_CRAFT_WORKSPACE_ROOT as the authoritative workspace
 * when configured. Otherwise it discovers the nearest git root from cwd and
 * falls back to cwd. Every requested path is checked both before and after
 * realpath resolution so `..` and symlink escapes cannot leave that boundary.
 */

import { constants, existsSync, realpathSync } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const MCP_SCAN_LIMITS = Object.freeze({
  maxDepth: 20,
  maxFiles: 2_000,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
});

export class WorkspacePathError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'WorkspacePathError';
    this.code = code;
  }
}

export function isWithinWorkspace(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function findNearestMarker(startDir, marker) {
  let current = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(current, marker))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function getWorkspaceRoot(explicitRoot, options = {}) {
  const environmentRoot = Object.hasOwn(options, 'environmentRoot')
    ? options.environmentRoot
    : process.env.UI_CRAFT_WORKSPACE_ROOT;
  const configuredRoot = explicitRoot ?? environmentRoot;
  const startDir = options.startDir ?? process.cwd();
  const discoveredRoot = configuredRoot
    ? null
    : findNearestMarker(startDir, '.git') ?? findNearestMarker(startDir, 'package.json');
  const candidateRoot = configuredRoot ?? discoveredRoot;

  if (!candidateRoot) {
    throw new WorkspacePathError(
      'No verified project root found. Set UI_CRAFT_WORKSPACE_ROOT to an explicit project directory.',
      'workspace_root_unverified',
    );
  }

  let canonicalRoot;
  try {
    canonicalRoot = realpathSync(path.resolve(candidateRoot));
  } catch (error) {
    throw new WorkspacePathError(
      `Workspace root is not accessible: ${candidateRoot} — ${error?.message ?? String(error)}`,
      'workspace_root_unreadable',
    );
  }

  const filesystemRoot = path.parse(canonicalRoot).root;
  const canonicalHome = realpathSync(homedir());
  const allowUnsafe = options.allowUnsafe === true
    || process.env.UI_CRAFT_ALLOW_UNSAFE_WORKSPACE_ROOT === '1';
  if (!allowUnsafe && (canonicalRoot === filesystemRoot || canonicalRoot === canonicalHome)) {
    throw new WorkspacePathError(
      `Refusing unsafe workspace root "${canonicalRoot}". Choose a project directory. ` +
        'Set UI_CRAFT_ALLOW_UNSAFE_WORKSPACE_ROOT=1 only for an intentional, isolated override.',
      'workspace_root_unsafe',
    );
  }

  return canonicalRoot;
}

export async function resolveWorkspacePath(requestedPath, { workspaceRoot } = {}) {
  if (typeof requestedPath !== 'string' || requestedPath.trim() === '') {
    throw new WorkspacePathError('Path must be a non-empty string', 'invalid_path');
  }

  const root = getWorkspaceRoot(workspaceRoot);
  const lexicalPath = path.resolve(root, requestedPath);
  if (!isWithinWorkspace(root, lexicalPath)) {
    throw new WorkspacePathError(
      `Path escapes workspace root: ${requestedPath}`,
      'workspace_escape',
    );
  }

  let canonicalPath;
  try {
    canonicalPath = await realpath(lexicalPath);
  } catch (error) {
    throw new WorkspacePathError(
      `Path not found or not accessible: ${requestedPath} — ${error?.message ?? String(error)}`,
      'path_unreadable',
    );
  }

  if (!isWithinWorkspace(root, canonicalPath)) {
    throw new WorkspacePathError(
      `Path resolves outside workspace root through a symlink: ${requestedPath}`,
      'symlink_escape',
    );
  }

  let targetStat;
  try {
    targetStat = await stat(canonicalPath);
  } catch (error) {
    throw new WorkspacePathError(
      `Path not accessible: ${requestedPath} — ${error?.message ?? String(error)}`,
      'path_unreadable',
    );
  }

  return { path: canonicalPath, workspaceRoot: root, stat: targetStat };
}

export async function inspectWorkspaceEntry(filePath, { workspaceRoot } = {}) {
  const root = getWorkspaceRoot(workspaceRoot);
  let entryStat;
  try {
    entryStat = await lstat(filePath);
  } catch (error) {
    throw new WorkspacePathError(
      `Path not accessible: ${filePath} — ${error?.message ?? String(error)}`,
      'path_unreadable',
    );
  }
  if (entryStat.isSymbolicLink()) {
    throw new WorkspacePathError(
      `Symbolic links are not followed during workspace traversal: ${filePath}`,
      'symlink_not_allowed',
    );
  }
  const canonicalPath = await realpath(filePath);
  if (!isWithinWorkspace(root, canonicalPath)) {
    throw new WorkspacePathError(
      `Path resolves outside workspace root: ${filePath}`,
      'workspace_escape',
    );
  }
  return { path: canonicalPath, stat: entryStat, workspaceRoot: root };
}

export async function readWorkspaceFileNoFollow(filePath, { workspaceRoot, maxBytes } = {}) {
  const inspected = await inspectWorkspaceEntry(filePath, { workspaceRoot });
  if (!inspected.stat.isFile()) {
    throw new WorkspacePathError(`Path is not a regular file: ${filePath}`, 'unsupported_path_type');
  }

  let handle;
  try {
    handle = await open(
      inspected.path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    const openedStat = await handle.stat();
    if (
      !openedStat.isFile()
      || openedStat.dev !== inspected.stat.dev
      || openedStat.ino !== inspected.stat.ino
    ) {
      throw new WorkspacePathError(
        `File changed while it was being opened: ${filePath}`,
        'file_changed_during_scan',
      );
    }
    if (Number.isSafeInteger(maxBytes) && maxBytes >= 0 && openedStat.size > maxBytes) {
      throw new WorkspacePathError(
        `File size ${openedStat.size} exceeds the safe read limit of ${maxBytes} bytes`,
        'max_file_bytes_exceeded',
      );
    }
    const buffer = await handle.readFile();
    if (Number.isSafeInteger(maxBytes) && maxBytes >= 0 && buffer.byteLength > maxBytes) {
      throw new WorkspacePathError(
        `File size ${buffer.byteLength} exceeds the safe read limit of ${maxBytes} bytes`,
        'max_file_bytes_exceeded',
      );
    }
    const finalStat = await handle.stat();
    if (finalStat.dev !== openedStat.dev || finalStat.ino !== openedStat.ino) {
      throw new WorkspacePathError(
        `File changed while it was being read: ${filePath}`,
        'file_changed_during_scan',
      );
    }
    return { buffer, stat: openedStat, path: inspected.path };
  } catch (error) {
    if (error instanceof WorkspacePathError) throw error;
    const code = error?.code === 'ELOOP' ? 'symlink_not_allowed' : 'file_unreadable';
    throw new WorkspacePathError(
      `Could not safely read file: ${filePath} — ${error?.message ?? String(error)}`,
      code,
    );
  } finally {
    await handle?.close();
  }
}

export function pathErrorResult(error, requestedPath) {
  const message = error instanceof WorkspacePathError
    ? error.message
    : `Could not access path "${requestedPath}": ${error?.message ?? String(error)}`;
  const code = error instanceof WorkspacePathError ? error.code : 'path_unreadable';
  return {
    error: message,
    scan_errors: [{ path: requestedPath, code, message }],
    coverage: {
      complete: false,
      files_discovered: 0,
      files_scanned: 0,
      files_omitted: 1,
      bytes_scanned: 0,
    },
    scan_policy: {
      mode: 'fail-closed',
      clean_requires_complete_coverage: true,
    },
  };
}
