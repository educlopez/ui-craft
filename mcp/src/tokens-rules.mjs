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

// Allowed spacing px values: 4, 8, 16, 24, 32, 48, 64, 96 (8pt scale + 4px base)
const ALLOWED_SPACING_PX = new Set([4, 8, 16, 24, 32, 48, 64, 96]);

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

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineText = lines[i];

    // Rule: tokens/color — raw hex not in CSS var definition
    // Skip lines that define a CSS custom property (--var: #hex is fine, it IS the token)
    const isCssPropDef = /^\s*--[a-zA-Z]/.test(lineText);
    if (!isCssPropDef) {
      let m;
      hexColorRe.lastIndex = 0;
      while ((m = hexColorRe.exec(lineText)) !== null) {
        // Skip if inside a var() call context — heuristic: preceded by `var(--`
        const before = lineText.slice(0, m.index);
        if (/var\([^)]*$/.test(before)) continue;
        // Skip if in a comment
        if (/\/\/.*$/.test(before) || /\/\*/.test(before)) continue;
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
            expected: 'One of: 4, 8, 16, 24, 32, 48, 64, 96px (8pt scale)',
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
