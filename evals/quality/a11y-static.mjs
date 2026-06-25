/**
 * a11y-static.mjs
 * Static accessibility checks for the UICraftScore eval harness.
 * Zero dependencies. Regex/line-based, matching detect.mjs's style.
 *
 * Overlap audit — confirm ZERO duplicate rule IDs vs detect.mjs:
 *   detect.mjs existing a11y rules (as of v0.5.0):
 *     a11y/icon-only-button-no-label  (critical)
 *     a11y/outline-none-no-replacement (critical)
 *     a11y/heading-order-skip         (major)
 *     a11y/modal-without-dialog       (critical)
 *     a11y/streaming-no-live-region   (critical)
 *     no-focus-visible                (major)
 *     forms/placeholder-as-label      (critical)
 *     forms/autocomplete-missing      (major)
 *     perf/image-no-dimensions        (major)  — checks for width/height/aspect-ratio; does NOT check alt
 *
 *   NEW rules in this module (all DISTINCT patterns/IDs):
 *     a11y/img-no-alt                 (critical) — alt attribute absent entirely (vs perf/image-no-dimensions which checks w/h/aspect-ratio)
 *     a11y/non-semantic-interactive   (critical) — div/span + onClick + no role + no tabIndex
 *     a11y/positive-tabindex          (major)    — tabIndex > 0 (never in detect.mjs)
 *     a11y/aria-invalid-no-describedby (major)   — aria-invalid="true" without aria-describedby
 *     a11y/no-reduced-motion          (major)    — animation/transition without prefers-reduced-motion (file-scope)
 *
 *   RESULT: Zero overlap. Each new check targets a distinct anti-pattern not covered by detect.mjs.
 */

/**
 * @typedef {Object} A11yFinding
 * @property {string} rule
 * @property {number} line
 * @property {string} snippet
 * @property {"critical"|"major"} severity
 * @property {string} fix
 */

/** @type {Array<{id: string, severity: "critical"|"major", description: string, fix: string}>} */
export const a11yRules = [
  {
    id: 'a11y/img-no-alt',
    severity: 'critical',
    description: '<img> missing alt attribute',
    fix: 'Add alt="" for decorative images or alt="descriptive text" for informative images',
  },
  {
    id: 'a11y/non-semantic-interactive',
    severity: 'critical',
    description: 'div/span with onClick but no role or tabIndex (non-semantic interactive)',
    fix: 'Use <button> or add role="button" + tabIndex={0} + onKeyDown handler for keyboard support',
  },
  {
    id: 'a11y/positive-tabindex',
    severity: 'major',
    description: 'tabIndex > 0 disrupts natural tab order',
    fix: 'Use tabIndex={0} for focusable elements; never use positive tabIndex values',
  },
  {
    id: 'a11y/aria-invalid-no-describedby',
    severity: 'major',
    description: 'aria-invalid="true" without aria-describedby to link error message',
    fix: 'Add aria-describedby="error-id" pointing to an element that explains the validation error',
  },
  {
    id: 'a11y/no-reduced-motion',
    severity: 'major',
    description: 'animation/transition without prefers-reduced-motion media query',
    fix: 'Wrap animations in @media (prefers-reduced-motion: no-preference) { ... } or check window.matchMedia at runtime',
  },
];

/**
 * Scan source code for static accessibility violations.
 *
 * @param {string} code - source code string (TSX/JSX/CSS)
 * @param {string} [filename='<inline>'] - filename for context
 * @returns {A11yFinding[]}
 */
export function scanA11y(code, filename = '<inline>') {
  if (!code) return [];
  const lines = code.split(/\r?\n/);
  const findings = [];

  // ─── Check 1: a11y/img-no-alt (critical, per-line) ───────────────────────
  // Flag <img …> tags that lack an alt= attribute.
  // Skip: aria-hidden="true" or role="presentation" (decorative intent already declared).
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Find every <img …> on this line (may be multi-tag line)
    const imgRe = /<img\b([^>]*)>/gi;
    let m;
    while ((m = imgRe.exec(line)) !== null) {
      const attrs = m[1];
      // Skip decorative images that already announce themselves
      if (/\baria-hidden\s*=\s*["']true["']/i.test(attrs)) continue;
      if (/\brole\s*=\s*["']presentation["']/i.test(attrs)) continue;
      // Flag if alt= is absent
      if (!/\balt\s*=/.test(attrs)) {
        findings.push({
          rule: 'a11y/img-no-alt',
          line: i + 1,
          snippet: m[0].slice(0, 100),
          severity: 'critical',
          fix: a11yRules.find(r => r.id === 'a11y/img-no-alt').fix,
        });
      }
    }
  }

  // ─── Check 2: a11y/non-semantic-interactive (critical, per-line) ─────────
  // Flag <div onClick…> or <span onClick…> that lack role= AND tabIndex.
  // Does NOT fire when: role= is present OR tabIndex is also present.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for div/span with onClick or onKeyDown
    const divSpanRe = /<(div|span)\b([^>]*)(?:onClick|onKeyDown)\s*=/gi;
    let m;
    while ((m = divSpanRe.exec(line)) !== null) {
      const attrs = m[2] + line.slice(m.index + m[0].length, m.index + m[0].length + 100);
      // Safe if role= is present
      if (/\brole\s*=/.test(attrs)) continue;
      // Safe if tabIndex is present (indicates deliberate keyboard handling)
      if (/\btabIndex\s*=|\btabindex\s*=/.test(attrs)) continue;
      findings.push({
        rule: 'a11y/non-semantic-interactive',
        line: i + 1,
        snippet: line.trim().slice(0, 100),
        severity: 'critical',
        fix: a11yRules.find(r => r.id === 'a11y/non-semantic-interactive').fix,
      });
    }
  }

  // ─── Check 3: a11y/positive-tabindex (major, per-line) ───────────────────
  // Flag tabIndex/tabindex with a value > 0.
  // Does NOT fire on tabIndex={0}, tabIndex={-1}, tabIndex="0", tabIndex="-1".
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // JSX: tabIndex={N} where N > 0
    const jsxRe = /\btabIndex\s*=\s*\{(\d+)\}/gi;
    let m;
    while ((m = jsxRe.exec(line)) !== null) {
      const val = parseInt(m[1], 10);
      if (val > 0) {
        findings.push({
          rule: 'a11y/positive-tabindex',
          line: i + 1,
          snippet: m[0],
          severity: 'major',
          fix: a11yRules.find(r => r.id === 'a11y/positive-tabindex').fix,
        });
      }
    }
    // HTML attr: tabindex="N" or tabIndex="N" where N > 0
    const htmlRe = /\btabindex\s*=\s*["'](\d+)["']/gi;
    while ((m = htmlRe.exec(line)) !== null) {
      const val = parseInt(m[1], 10);
      if (val > 0) {
        findings.push({
          rule: 'a11y/positive-tabindex',
          line: i + 1,
          snippet: m[0],
          severity: 'major',
          fix: a11yRules.find(r => r.id === 'a11y/positive-tabindex').fix,
        });
      }
    }
  }

  // ─── Check 4: a11y/aria-invalid-no-describedby (major, per-line) ─────────
  // Flag elements with aria-invalid="true" that lack aria-describedby in the same tag.
  // We use a window approach: look at the current line + up to 3 following lines for the closing >.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/aria-invalid\s*=\s*["']true["']/i.test(line)) continue;
    // Build a small window to find aria-describedby
    let window = line;
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      window += '\n' + lines[j];
      if (/>/.test(lines[j])) break;
    }
    if (!/\baria-describedby\s*=/.test(window)) {
      findings.push({
        rule: 'a11y/aria-invalid-no-describedby',
        line: i + 1,
        snippet: line.trim().slice(0, 100),
        severity: 'major',
        fix: a11yRules.find(r => r.id === 'a11y/aria-invalid-no-describedby').fix,
      });
    }
  }

  // ─── Check 5: a11y/no-reduced-motion (major, file-scope) ─────────────────
  // Flag files containing animation/transition signals without prefers-reduced-motion anywhere.
  const hasAnimation =
    /\btransition\s*:|\banimation\s*:|\b@keyframes\b/.test(code) ||
    /\banimate\s*=/.test(code) ||          // Framer Motion animate=
    /\btransition-all\b|\btransition-\[/.test(code); // Tailwind transition classes

  if (hasAnimation) {
    const hasReducedMotion = /prefers-reduced-motion/.test(code);
    if (!hasReducedMotion) {
      // Find the first animation line for reporting
      let firstLine = 1;
      const animRe = /\btransition\s*:|\banimation\s*:|\b@keyframes\b|\banimate\s*=|\btransition-all\b|\btransition-\[/;
      for (let i = 0; i < lines.length; i++) {
        if (animRe.test(lines[i])) {
          firstLine = i + 1;
          break;
        }
      }
      findings.push({
        rule: 'a11y/no-reduced-motion',
        line: firstLine,
        snippet: 'file uses animation/transition without prefers-reduced-motion',
        severity: 'major',
        fix: a11yRules.find(r => r.id === 'a11y/no-reduced-motion').fix,
      });
    }
  }

  return findings;
}
