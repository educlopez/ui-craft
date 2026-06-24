/**
 * tokens-rules.mjs
 * Regex-based ruleset for off-system token values.
 * Source of truth: references/tokens.md
 *
 * Off-system means: a value used for color, radius, or spacing that bypasses
 * the token system — raw hex, raw px radius not on the scale, raw px spacing
 * not on the 8pt scale, or arbitrary z-index integers.
 */

// Token scale data derived from tokens.md

// Allowed border-radius px values: 0, 2, 6, 10, 14, 20, 9999
const ALLOWED_RADIUS_PX = new Set([0, 2, 6, 10, 14, 20, 9999]);

// Allowed spacing px values: 0, 4, 8, 16, 24, 32, 48, 64, 96
// Fix 3: 0/0px is always legal for spacing (e.g. padding: 0px resets are valid)
const ALLOWED_SPACING_PX = new Set([0, 4, 8, 16, 24, 32, 48, 64, 96]);

// Semantic z-index values from tokens.md
const ALLOWED_Z = new Set([0, 1, 10, 20, 30, 40, 50, 60]);

/**
 * Scan lines of code for token violations.
 * Returns an array of findings: { rule, line, snippet, fix, expected, severity }
 *
 * @param {string} code - source code string
 * @param {string} [filename='<inline>'] - filename for reporting
 * @returns {Array<{rule: string, line: number, snippet: string, fix: string, expected: string, severity: string}>}
 */
export function scanTokens(code, filename = '<inline>') {
  const lines = code.split('\n');
  const findings = [];

  // Patterns
  // 1. Raw hex colors not inside var(--...) context
  //    Matches #rrggbb or #rgb or #rrggbbaa not preceded by: --var-name: (CSS custom property definition context is fine)
  const hexColorRe = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

  // 2. Raw border-radius: Npx (not on scale)
  //    Catches: border-radius: 7px, border-radius: 12px, etc.
  const radiusPxRe = /border-radius\s*:\s*(\d+)px/g;

  // 3. Tailwind arbitrary radius: rounded-[Npx]
  const twRadiusRe = /rounded-\[(\d+)px\]/g;

  // 4. Raw spacing (padding/margin/gap) Npx not on 8pt scale
  //    Catches: padding: 7px, margin: 20px, gap: 5px, etc.
  //    Only flags plain single-value px (multi-value shorthand more complex — flag px values)
  const spacingRe = /(?:padding|margin|gap)\s*:\s*(\d+)px(?!\s*\d)/g;

  // 5. Magic z-index integer: z-index: N (not in token set)
  const zIndexRe = /z-index\s*:\s*(\d+)/g;

  // Fix 2: Track block-comment state across lines.
  // `inBlockComment` is true when the current position is inside a /* ... */ block.
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineText = lines[i];

    // Fix 2: Capture block-comment state at START of this line, then advance to end-of-line state.
    const blockCommentAtLineStart = inBlockComment;

    // Advance inBlockComment to reflect the end of this line.
    {
      let tmp = lineText;
      let state = inBlockComment;
      while (tmp.length > 0) {
        if (!state) {
          const open = tmp.indexOf('/*');
          if (open === -1) break;
          state = true;
          tmp = tmp.slice(open + 2);
        } else {
          const close = tmp.indexOf('*/');
          if (close === -1) break;
          state = false;
          tmp = tmp.slice(close + 2);
        }
      }
      inBlockComment = state;
    }

    // If the entire line starts inside a block comment, skip all rules.
    // (Lines partially inside a block comment are handled per-match in the color rule below.)
    if (blockCommentAtLineStart) continue;

    // Rule: tokens/color — raw hex not in CSS var definition
    // Skip lines that define a CSS custom property (--var: #hex is fine, it IS the token)
    const isCssPropDef = /^\s*--[a-zA-Z]/.test(lineText);
    if (!isCssPropDef) {
      let m;
      hexColorRe.lastIndex = 0;
      while ((m = hexColorRe.exec(lineText)) !== null) {
        const before = lineText.slice(0, m.index);

        // Skip if inside a var() call context — heuristic: preceded by `var(--`
        if (/var\([^)]*$/.test(before)) continue;

        // Fix 1: detect line comment only when // is NOT part of :// and NOT inside url(...)
        // Strip url(...) blocks from `before`, then check for a standalone // that opens a comment.
        const beforeNoUrl = before.replace(/url\([^)]*\)/gi, 'url()');
        // Match // not preceded by : (i.e. not part of ://)
        if (/(?<!:)\/\//.test(beforeNoUrl)) continue;

        // Fix 2: skip if match is inside a block comment opened earlier on this same line
        // Walk `before` to see if we entered a /* without a closing */ before this match.
        {
          let tmp = before;
          let inBlock = false; // line started outside a block comment (blockCommentAtLineStart already handled)
          let insideBlock = false;
          while (tmp.length > 0) {
            if (!inBlock) {
              const open = tmp.indexOf('/*');
              if (open === -1) break;
              inBlock = true;
              tmp = tmp.slice(open + 2);
            } else {
              const close = tmp.indexOf('*/');
              if (close === -1) { insideBlock = true; break; }
              inBlock = false;
              tmp = tmp.slice(close + 2);
            }
          }
          if (insideBlock || inBlock) continue;
        }

        findings.push({
          rule: 'tokens/color',
          line: lineNum,
          snippet: m[0],
          fix: 'Replace with a CSS custom property from the token spine (e.g. var(--accent-500))',
          expected: 'A token reference: var(--<color-token>)',
          severity: 'error',
          file: filename,
        });
      }
    }

    // Rule: tokens/radius — raw border-radius px not on scale
    {
      let m;
      radiusPxRe.lastIndex = 0;
      while ((m = radiusPxRe.exec(lineText)) !== null) {
        const val = parseInt(m[1], 10);
        if (!ALLOWED_RADIUS_PX.has(val)) {
          findings.push({
            rule: 'tokens/radius',
            line: lineNum,
            snippet: m[0],
            fix: `Replace with a token: var(--radius-sm/md/lg/xl/2xl) — allowed px: ${[...ALLOWED_RADIUS_PX].join(', ')}`,
            expected: 'One of: 0, 2, 6, 10, 14, 20, 9999px (token scale)',
            severity: 'error',
            file: filename,
          });
        }
      }
    }

    // Rule: tokens/radius — tailwind arbitrary rounded-[Npx]
    {
      let m;
      twRadiusRe.lastIndex = 0;
      while ((m = twRadiusRe.exec(lineText)) !== null) {
        const val = parseInt(m[1], 10);
        if (!ALLOWED_RADIUS_PX.has(val)) {
          findings.push({
            rule: 'tokens/radius',
            line: lineNum,
            snippet: m[0],
            fix: `Replace with a Tailwind radius class matching the token scale`,
            expected: 'A token-mapped radius class (rounded-sm, rounded-md, rounded-lg, etc.)',
            severity: 'error',
            file: filename,
          });
        }
      }
    }

    // Rule: tokens/spacing — raw px spacing not on 8pt scale
    {
      let m;
      spacingRe.lastIndex = 0;
      while ((m = spacingRe.exec(lineText)) !== null) {
        const val = parseInt(m[1], 10);
        if (!ALLOWED_SPACING_PX.has(val)) {
          findings.push({
            rule: 'tokens/spacing',
            line: lineNum,
            snippet: m[0],
            fix: `Replace with a token: var(--space-xs/sm/md/lg/xl/2xl/3xl/4xl) — allowed: ${[...ALLOWED_SPACING_PX].join(', ')}px`,
            expected: 'One of: 0, 4, 8, 16, 24, 32, 48, 64, 96px (8pt scale)',
            severity: 'warning',
            file: filename,
          });
        }
      }
    }

    // Rule: tokens/z-index — magic z-index not in semantic set
    {
      let m;
      zIndexRe.lastIndex = 0;
      while ((m = zIndexRe.exec(lineText)) !== null) {
        const val = parseInt(m[1], 10);
        if (!ALLOWED_Z.has(val)) {
          findings.push({
            rule: 'tokens/z-index',
            line: lineNum,
            snippet: m[0],
            fix: `Replace with a token: var(--z-base/raised/dropdown/sticky/modal-backdrop/modal/toast/tooltip)`,
            expected: 'One of: 0, 1, 10, 20, 30, 40, 50, 60 (semantic z-index scale)',
            severity: 'warning',
            file: filename,
          });
        }
      }
    }
  }

  return findings;
}
