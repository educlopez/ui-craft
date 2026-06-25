/**
 * score-ui.mjs
 * MCP tool: score_ui
 * Invokes scoreUI() from evals/quality/score.mjs in-process.
 *
 * Cross-package import pattern: consistent with check-anti-slop.mjs importing
 * ../../../scripts/detect.mjs. The MCP package's files:["src"] does NOT include
 * evals/; score_ui is available in repo-local server (via .mcp.json npx/local path).
 * Flag for npm publish: add ../evals/quality to mcp files if standalone publish needed.
 *
 * Input:  { code?: string, path?: string } — same shape as check_anti_slop / tokens_lint
 * Output: UICraftScore result: { overall: {score, grade}, dimensions: {...}, version }
 *         or { error: string } on bad input or caught exception.
 */

import { scoreUI } from '../../../evals/quality/score.mjs';

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
export async function scoreUiTool({ code, path } = {}) {
  // Guard: if neither provided, return structured error (no crash)
  if (code === undefined && !path) {
    return {
      error: 'Input required: provide either `code` (string) or `path` (file path)',
    };
  }

  let result;
  try {
    // scoreUI accepts { code } or { path } — pass through as-is
    result = await scoreUI({ code, path });
  } catch (e) {
    return {
      error: `scoreUI failed: ${e?.message ?? String(e)}`,
    };
  }

  return result;
}
