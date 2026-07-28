/**
 * score-ui.mjs
 * MCP tool: score_ui
 * Invokes scoreUI() from evals/quality/score.mjs in-process.
 *
 * Cross-package import pattern: consistent with check-anti-slop.mjs importing
 * ../../../scripts/detect.mjs. The publishable package ships only dist/, where
 * esbuild bundles this first-party eval source into the standalone server.
 *
 * Input:  { code?: string, path?: string } — same shape as check_anti_slop / tokens_lint
 * Output: UICraftScore result: { overall: {score, grade}, dimensions: {...}, version }
 *         or { error: string } on bad input or caught exception.
 */

import { scoreUI } from '../../../evals/quality/score.mjs';
import {
  MCP_SCAN_LIMITS,
  failClosedResult,
  pathErrorResult,
  readWorkspaceFileNoFollow,
  resolveWorkspacePath,
} from '../workspace-path.mjs';

function scoreFailure({
  error,
  path = '<input>',
  code = 'score_failed',
  filesDiscovered = 0,
  limits,
}) {
  return failClosedResult({
    error,
    path,
    code,
    message: error,
    filesDiscovered,
    limits,
  });
}

/**
 * Run the UICraftScore on code (string) or file path.
 *
 * @param {{ code?: string, path?: string }} input
 * @returns {Promise<{
 *   overall: { score: number, grade: string },
 *   dimensions: {
 *     anti_slop: { score: number, findings: Array },
 *     token_discipline: { score: number, findings: Array },
 *     a11y: { score: number, findings: Array }
 *   },
 *   version: string
 * } | { error: string }>}
 */
export async function scoreUiTool({ code, path } = {}, options = {}) {
  // Guard: if neither provided, return structured error (no crash)
  if (code === undefined && !path) {
    return scoreFailure({
      error: 'Input required: provide either `code` (string) or `path` (file path)',
      code: 'invalid_input',
    });
  }

  let safeInput = { code };
  let coverage;
  if (code === undefined) {
    let resolved;
    try {
      resolved = await resolveWorkspacePath(path, { workspaceRoot: options.workspaceRoot });
    } catch (error) {
      return pathErrorResult(error, path);
    }
    if (!resolved.stat.isFile()) {
      return scoreFailure({
        error: `score_ui requires a regular file path: ${path}`,
        path,
        code: 'unsupported_path_type',
        filesDiscovered: 1,
      });
    }

    const limits = { ...MCP_SCAN_LIMITS, ...options.limits };
    if (resolved.stat.size > limits.maxFileBytes || resolved.stat.size > limits.maxTotalBytes) {
      const maxBytes = Math.min(limits.maxFileBytes, limits.maxTotalBytes);
      return scoreFailure({
        error: `scan incomplete: file size ${resolved.stat.size} exceeds the limit of ${maxBytes} bytes`,
        path,
        code: 'max_file_bytes_exceeded',
        filesDiscovered: 1,
        limits,
      });
    }

    let opened;
    try {
      opened = await readWorkspaceFileNoFollow(resolved.path, {
        workspaceRoot: resolved.workspaceRoot,
        maxBytes: Math.min(limits.maxFileBytes, limits.maxTotalBytes),
      });
    } catch (error) {
      return pathErrorResult(error, path);
    }
    const { buffer } = opened;
    if (buffer.byteLength > limits.maxFileBytes || buffer.byteLength > limits.maxTotalBytes) {
      const maxBytes = Math.min(limits.maxFileBytes, limits.maxTotalBytes);
      return scoreFailure({
        error: `scan incomplete: file size ${buffer.byteLength} exceeds the limit of ${maxBytes} bytes`,
        path,
        code: 'max_file_bytes_exceeded',
        filesDiscovered: 1,
        limits,
      });
    }
    safeInput = { code: buffer.toString('utf8') };
    coverage = {
      complete: true,
      files_discovered: 1,
      files_scanned: 1,
      files_omitted: 0,
      bytes_scanned: buffer.byteLength,
      limits,
    };
  }

  let result;
  try {
    result = await scoreUI(safeInput);
  } catch (e) {
    return scoreFailure({
      error: `scoreUI failed: ${e?.message ?? String(e)}`,
      path: code === undefined ? path : '<inline>',
      code: 'score_failed',
      filesDiscovered: 1,
    });
  }

  if (result?.error) {
    return scoreFailure({
      error: result.error,
      path: code === undefined ? path : '<inline>',
      code: 'score_failed',
      filesDiscovered: 1,
      limits: coverage?.limits,
    });
  }

  if (coverage && !result.error) {
    return {
      ...result,
      coverage,
      scan_errors: [],
      scan_policy: {
        mode: 'fail-closed',
        clean_requires_complete_coverage: true,
      },
    };
  }
  return result;
}
