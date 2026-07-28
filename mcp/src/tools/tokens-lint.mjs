/**
 * tokens-lint.mjs
 * MCP tool: tokens_lint
 * Flags off-system token values in source code via static regex analysis.
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { scanTokens } from '../tokens-rules.mjs';
import {
  MCP_SCAN_LIMITS,
  inspectWorkspaceEntry,
  pathErrorResult,
  readWorkspaceFileNoFollow,
  resolveWorkspacePath,
} from '../workspace-path.mjs';

const CODE_EXTS = /\.(mjs|js|ts|jsx|tsx|css|scss|svelte|vue|html)$/;

function createCoverage(limits) {
  return {
    complete: true,
    files_discovered: 0,
    files_scanned: 0,
    files_omitted: 0,
    bytes_scanned: 0,
    limits,
  };
}

function addScanError(state, filePath, code, message) {
  state.coverage.complete = false;
  state.coverage.files_omitted++;
  state.scanErrors.push({
    path: path.relative(state.workspaceRoot, filePath) || '.',
    code,
    message,
  });
}

async function scanFile(filePath, state) {
  if (state.stopped) return;
  state.coverage.files_discovered++;
  if (state.coverage.files_discovered > state.limits.maxFiles) {
    addScanError(
      state,
      filePath,
      'max_files_exceeded',
      `File count exceeds the limit of ${state.limits.maxFiles}`,
    );
    state.stopped = true;
    return;
  }

  let inspected;
  try {
    inspected = await inspectWorkspaceEntry(filePath, { workspaceRoot: state.workspaceRoot });
  } catch (error) {
    addScanError(
      state,
      filePath,
      error?.code ?? 'file_unreadable',
      error?.message ?? String(error),
    );
    return;
  }

  const fileStat = inspected.stat;
  if (fileStat.size > state.limits.maxFileBytes) {
    addScanError(
      state,
      filePath,
      'max_file_bytes_exceeded',
      `File size ${fileStat.size} exceeds the per-file limit of ${state.limits.maxFileBytes} bytes`,
    );
    return;
  }
  if (state.coverage.bytes_scanned + fileStat.size > state.limits.maxTotalBytes) {
    addScanError(
      state,
      filePath,
      'max_total_bytes_exceeded',
      `Total input exceeds the limit of ${state.limits.maxTotalBytes} bytes`,
    );
    state.stopped = true;
    return;
  }

  let opened;
  try {
    opened = await readWorkspaceFileNoFollow(filePath, {
      workspaceRoot: state.workspaceRoot,
      maxBytes: state.limits.maxFileBytes,
    });
  } catch (error) {
    addScanError(
      state,
      filePath,
      error?.code ?? 'file_unreadable',
      error?.message ?? String(error),
    );
    return;
  }

  const { buffer } = opened;
  if (buffer.byteLength > state.limits.maxFileBytes) {
    addScanError(
      state,
      filePath,
      'max_file_bytes_exceeded',
      `File size ${buffer.byteLength} exceeds the per-file limit of ${state.limits.maxFileBytes} bytes`,
    );
    return;
  }
  if (state.coverage.bytes_scanned + buffer.byteLength > state.limits.maxTotalBytes) {
    addScanError(
      state,
      filePath,
      'max_total_bytes_exceeded',
      `Total input exceeds the limit of ${state.limits.maxTotalBytes} bytes`,
    );
    state.stopped = true;
    return;
  }

  state.coverage.files_scanned++;
  state.coverage.bytes_scanned += buffer.byteLength;
  state.findings.push(...scanTokens(buffer.toString('utf8'), filePath));
}

async function scanDirectory(dir, state, depth = 0) {
  if (state.stopped || state.visitedDirectories.has(dir)) return;
  state.visitedDirectories.add(dir);
  if (depth > state.limits.maxDepth) {
    addScanError(
      state,
      dir,
      'max_depth_exceeded',
      `Directory depth exceeds the limit of ${state.limits.maxDepth}`,
    );
    return;
  }

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    addScanError(state, dir, 'directory_unreadable', `Could not read directory: ${error.message}`);
    return;
  }

  for (const entry of entries) {
    if (state.stopped) return;
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);

    let inspected;
    try {
      inspected = await inspectWorkspaceEntry(fullPath, { workspaceRoot: state.workspaceRoot });
    } catch (error) {
      addScanError(
        state,
        fullPath,
        error?.code ?? 'path_unreadable',
        error?.message ?? String(error),
      );
      continue;
    }

    if (inspected.stat.isDirectory()) {
      await scanDirectory(inspected.path, state, depth + 1);
    } else if (inspected.stat.isFile() && CODE_EXTS.test(entry.name)) {
      await scanFile(inspected.path, state);
    }
  }
}

function buildResult(findings, coverage, scanErrors) {
  const errors = findings.filter((finding) => finding.severity === 'error').length;
  const warnings = findings.filter((finding) => finding.severity === 'warning').length;
  const result = {
    findings,
    summary: {
      total: findings.length,
      errors,
      warnings,
      files_scanned: coverage.files_scanned,
      files_omitted: coverage.files_omitted,
    },
    coverage,
    scan_errors: scanErrors,
    scan_policy: {
      mode: 'fail-closed',
      clean_requires_complete_coverage: true,
    },
  };
  if (!coverage.complete) {
    result.error = `scan incomplete: ${scanErrors.length} filesystem or limit error(s)`;
  }
  return result;
}

/**
 * Run the tokens linter on code (string) or path (file/directory).
 *
 * @param {{ code?: string, path?: string }} input
 * @param {{ workspaceRoot?: string, limits?: object }} options
 */
export async function tokensLint({ code, path: requestedPath } = {}, options = {}) {
  if (code === undefined && !requestedPath) {
    return {
      error: 'Input required: provide either `code` (string) or `path` (file path)',
      findings: [],
      summary: { total: 0, errors: 0, warnings: 0 },
    };
  }

  const limits = { ...MCP_SCAN_LIMITS, ...options.limits };
  if (code !== undefined) {
    const findings = scanTokens(code, '<inline>');
    const coverage = {
      ...createCoverage(limits),
      files_discovered: 1,
      files_scanned: 1,
      bytes_scanned: Buffer.byteLength(code),
    };
    return buildResult(findings, coverage, []);
  }

  let resolved;
  try {
    resolved = await resolveWorkspacePath(requestedPath, { workspaceRoot: options.workspaceRoot });
  } catch (error) {
    const failure = pathErrorResult(error, requestedPath);
    return {
      ...failure,
      findings: [],
      summary: { total: 0, errors: 0, warnings: 0, files_scanned: 0, files_omitted: 1 },
    };
  }

  const state = {
    findings: [],
    scanErrors: [],
    coverage: createCoverage(limits),
    limits,
    workspaceRoot: resolved.workspaceRoot,
    visitedDirectories: new Set(),
    stopped: false,
  };

  if (resolved.stat.isFile()) {
    if (!CODE_EXTS.test(resolved.path)) {
      state.coverage.files_discovered = 1;
      addScanError(
        state,
        resolved.path,
        'unsupported_file_type',
        `Unsupported file type for tokens_lint: ${requestedPath}`,
      );
      return buildResult([], state.coverage, state.scanErrors);
    }
    await scanFile(resolved.path, state);
  } else if (resolved.stat.isDirectory()) {
    await scanDirectory(resolved.path, state);
  } else {
    addScanError(
      state,
      resolved.path,
      'unsupported_path_type',
      'Path is neither a regular file nor a directory',
    );
  }

  return buildResult(state.findings, state.coverage, state.scanErrors);
}
