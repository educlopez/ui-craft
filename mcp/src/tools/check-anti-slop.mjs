/**
 * check-anti-slop.mjs
 * MCP tool: check_anti_slop
 * Invokes scan() from scripts/detect.mjs in-process (no subprocess spawn).
 */

import { scan } from '../../../scripts/detect.mjs';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Run the anti-slop scanner on code (string) or path.
 *
 * @param {{ code?: string, path?: string }} input
 * @returns {{ findings: Array, summary: { total: number, errors: number, warnings: number } }}
 */
export async function checkAntiSlop({ code, path } = {}) {
  if (!code && !path) {
    return {
      error: 'Input required: provide either `code` (string) or `path` (file path or directory)',
      findings: [],
      summary: { total: 0, errors: 0, warnings: 0 },
    };
  }

  let target;
  let tempFile = null;

  if (code !== undefined) {
    // Write code to a temporary file so scan() can process it
    const id = randomBytes(8).toString('hex');
    tempFile = join(tmpdir(), `ui-craft-slop-${id}.tsx`);
    try {
      writeFileSync(tempFile, code, 'utf8');
    } catch (e) {
      return {
        error: `Failed to write temporary file: ${e.message}`,
        findings: [],
        summary: { total: 0, errors: 0, warnings: 0 },
      };
    }
    target = tempFile;
  } else {
    target = path;
  }

  let result;
  try {
    result = await scan(target);
  } catch (e) {
    if (tempFile) {
      try { unlinkSync(tempFile); } catch {}
    }
    return {
      error: `Scan failed: ${e.message}`,
      findings: [],
      summary: { total: 0, errors: 0, warnings: 0 },
    };
  } finally {
    if (tempFile) {
      try { unlinkSync(tempFile); } catch {}
    }
  }

  if (!result || !Array.isArray(result.findings)) {
    return {
      error: 'Scan returned unexpected result shape',
      findings: [],
      summary: { total: 0, errors: 0, warnings: 0 },
    };
  }

  // Normalize findings — if code was inline, replace tempFile path with <inline>
  // scan() may return relative or absolute paths; normalize with basename/resolve for comparison
  const tempFileBase = tempFile ? basename(tempFile) : null;
  const findings = result.findings.map((f) => {
    const filePath = f.file ?? '<unknown>';
    const isTemp = tempFile && (
      filePath === tempFile ||
      basename(filePath) === tempFileBase ||
      resolve(filePath) === resolve(tempFile)
    );
    return {
      severity: f.severity ?? 'error',
      rule: f.rule ?? f.description ?? 'unknown',
      file: isTemp ? '<inline>' : filePath,
      line: f.line ?? null,
      message: f.description ?? f.message ?? f.rule ?? 'Anti-slop violation',
    };
  });

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;

  return {
    version: result.version,
    findings,
    summary: { total: findings.length, errors, warnings },
  };
}
