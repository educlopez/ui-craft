/**
 * tokens-lint.mjs
 * MCP tool: tokens_lint
 * Flags off-system token values in source code via static regex analysis.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { scanTokens } from '../tokens-rules.mjs';

/**
 * Run the tokens linter on code (string) or path (file/directory).
 *
 * @param {{ code?: string, path?: string }} input
 * @returns {{ findings: Array, summary: { total: number, errors: number, warnings: number } }}
 */
export async function tokensLint({ code, path } = {}) {
  // Fix 4: use `=== undefined` so empty string code: '' is treated as valid input (0 findings)
  if (code === undefined && !path) {
    return {
      error: 'Input required: provide either `code` (string) or `path` (file path)',
      findings: [],
      summary: { total: 0, errors: 0, warnings: 0 },
    };
  }

  let allFindings = [];

  if (code !== undefined) {
    allFindings = scanTokens(code, '<inline>');
  } else {
    // path mode
    let stat;
    try {
      stat = statSync(path);
    } catch {
      return {
        error: `Path not found or not accessible: ${path}`,
        findings: [],
        summary: { total: 0, errors: 0, warnings: 0 },
      };
    }

    if (stat.isFile()) {
      let content;
      try {
        content = readFileSync(path, 'utf8');
      } catch (e) {
        return {
          error: `Could not read file: ${path} — ${e.message}`,
          findings: [],
          summary: { total: 0, errors: 0, warnings: 0 },
        };
      }
      allFindings = scanTokens(content, path);
    } else if (stat.isDirectory()) {
      // Recursively scan code files in the directory
      // Fix 6: readdirSync now comes from the static import above (no redundant dynamic import)
      // Fix 5: use join() from node:path instead of string concatenation (Windows-safe)
      const CODE_EXTS = /\.(mjs|js|ts|jsx|tsx|css|scss|svelte|vue|html)$/;

      function scanDir(dir) {
        let entries;
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const full = join(dir, entry.name);
          if (entry.isDirectory() && entry.name !== 'node_modules') {
            scanDir(full);
          } else if (entry.isFile() && CODE_EXTS.test(entry.name)) {
            try {
              const content = readFileSync(full, 'utf8');
              allFindings.push(...scanTokens(content, full));
            } catch {
              // skip unreadable files
            }
          }
        }
      }
      scanDir(path);
    } else {
      return {
        error: `Path is neither a file nor a directory: ${path}`,
        findings: [],
        summary: { total: 0, errors: 0, warnings: 0 },
      };
    }
  }

  const errors = allFindings.filter((f) => f.severity === 'error').length;
  const warnings = allFindings.filter((f) => f.severity === 'warning').length;

  return {
    findings: allFindings,
    summary: { total: allFindings.length, errors, warnings },
  };
}
