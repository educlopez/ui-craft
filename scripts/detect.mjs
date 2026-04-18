#!/usr/bin/env node
// ui-craft anti-slop detector v0.4.0
// Scans CSS/JSX/TSX/Vue/Svelte/etc for common AI-generated UI anti-patterns.
// Zero dependencies. Node 18+. Rules mirror skills/ui-craft/SKILL.md "Anti-Slop Test".
//
// Usage:
//   node scripts/detect.mjs [path] [--json] [--sarif] [--fix] [--fix-dry-run]
// Exit codes:
//   0 clean (or only warnings), 1 errors present, 2 arg error / unreadable path

import { promises as fs } from "node:fs";
import path from "node:path";

const VERSION = "0.4.0";

const SCAN_EXTENSIONS = new Set([
  ".css", ".scss", ".sass",
  ".tsx", ".jsx", ".ts", ".js",
  ".vue", ".svelte",
  ".html", ".astro",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git",
  ".next", ".nuxt", ".svelte-kit", ".astro",
  "dist", "build", "out", "coverage", ".turbo",
  // our own harness mirrors — scanning them would double-flag against docs
  ".codex", ".cursor", ".gemini", ".opencode", ".agents",
]);

// ANSI colors — only used when stdout is a TTY.
const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c("31", s);
const yellow = (s) => c("33", s);
const dim = (s) => c("2", s);
const bold = (s) => c("1", s);

// --- Rules ---------------------------------------------------------------
//
// @typedef {Object} Rule
// @property {string} id            - slug identifier, also the machine key
// @property {"critical"|"major"|"warn"} severity - default severity
// @property {string} description   - short human label
// @property {string} fix           - one-line suggestion
// @property {"line"|"file"} [scope] - "line" (default) or "file"
// @property {(line: string, ctx: Object) => false | true | { snippet: string }} [match]
// @property {(content: string, lines: string[], ctx: Object) =>
//            Array<{ line: number, snippet: string }>} [matchFile]
// @property {(content: string) => { content: string, fixed: number }} [fix_apply]
//
// Per-line rules are checked once per line. File-level rules return an array
// of findings (line is just the first occurrence for reporting).
// --------------------------------------------------------------------------

/** @type {Rule[]} */
const rules = [
  // ===== ORIGINAL 11 RULES (unchanged behavior) =====
  {
    id: "transition-all",
    severity: "critical",
    description: "transition: all",
    fix: "list specific properties (transform, opacity, background-color)",
    scope: "line",
    match(line) {
      const re = /\btransition:\s*["']?all\b|\btransition-all\b/;
      const m = line.match(re);
      return m ? { snippet: m[0] } : false;
    },
    fix_apply(content) {
      let fixed = 0;
      let out = content.replace(/\btransition:\s*all\b/g, () => {
        fixed++;
        return "transition: opacity, transform";
      });
      out = out.replace(/\btransition-all\b/g, () => {
        fixed++;
        return "transition-[opacity,transform]";
      });
      return { content: out, fixed };
    },
  },
  {
    id: "bounce-elastic-easing",
    severity: "critical",
    description: "bounce/elastic easing",
    fix: "use ease-out or cubic-bezier(0.22, 1, 0.36, 1)",
    scope: "line",
    match(line) {
      const patterns = [
        /ease:\s*["']bounce["']/i,
        /ease:\s*["']elastic["']/i,
        /easeInOutBounce|easeOutBounce|easeInBounce/,
        /easeInOutElastic|easeOutElastic|easeInElastic/,
        /cubic-bezier\(\s*0\.68\s*,\s*-0?\.55/,
      ];
      for (const re of patterns) {
        const m = line.match(re);
        if (m) return { snippet: m[0] };
      }
      if (/\btransition\b|\banimation\b/.test(line)) {
        const m = line.match(/\b(bounce|elastic)\b/i);
        if (m) return { snippet: m[0] };
      }
      return false;
    },
  },
  {
    id: "animate-bounce",
    severity: "critical",
    description: "animate-bounce class",
    fix: "remove — bouncing UI feels unserious; use a subtle ease-out fade/slide",
    scope: "line",
    match(line) {
      const m = line.match(/\banimate-bounce\b/);
      return m ? { snippet: m[0] } : false;
    },
    fix_apply(content) {
      let fixed = 0;
      // Case 1: class is alone in attribute → replace whole attribute with TODO comment annotation.
      // Match className="animate-bounce" or class="animate-bounce" (only token).
      const aloneRe = /(\s+)(class|className)=(["'])\s*animate-bounce\s*\3/g;
      let out = content.replace(aloneRe, (_m, ws, attr) => {
        fixed++;
        return `${ws}/* TODO(ui-craft): animate-bounce removed — choose a subtle motion */ ${attr}=""`;
      });
      // Case 2: class is one of many → strip token from class list, preserve neighbors.
      const inListRe = /(class|className)=(["'])([^"']*?)\banimate-bounce\b([^"']*?)\2/g;
      out = out.replace(inListRe, (_m, attr, q, before, after) => {
        fixed++;
        const cleaned = (before + " " + after).replace(/\s+/g, " ").trim();
        return `${attr}=${q}${cleaned}${q}`;
      });
      return { content: out, fixed };
    },
  },
  {
    id: "purple-cyan-gradient",
    severity: "critical",
    description: "purple/cyan gradient",
    fix: "single brand accent, no gradients",
    scope: "line",
    match(line) {
      const tw = /bg-gradient-to-[rlbt]{1,2}\s+from-(?:purple|violet|fuchsia|indigo)-\d+(?:\s+via-\S+)?\s+to-(?:cyan|sky|blue|teal)-\d+/;
      let m = line.match(tw);
      if (m) return { snippet: m[0] };
      return false;
    },
  },
  {
    id: "uppercase-heading",
    severity: "critical",
    description: "ALL CAPS heading",
    fix: "use sentence case; reserve uppercase for small labels (≤13px) with wide tracking",
    scope: "line",
    match(line) {
      const jsx = /<h[1-4]\b[^>]*\b(?:class|className)\s*=\s*["'][^"']*\buppercase\b[^"']*["']/;
      const mJsx = line.match(jsx);
      if (mJsx) {
        if (/\btext-xs\b/.test(mJsx[0])) return false;
        return { snippet: mJsx[0].slice(0, 80) };
      }
      const css = /h[1-4][^{]*\{[^}]*text-transform:\s*uppercase/;
      const mCss = line.match(css);
      if (mCss) return { snippet: "text-transform: uppercase" };
      return false;
    },
  },
  {
    id: "gradient-text-metric",
    severity: "major",
    description: "gradient text on large number",
    fix: "solid color for metrics — gradients fight legibility",
    scope: "line",
    match(line) {
      if (!/\bbg-clip-text\b/.test(line)) return false;
      if (!/\btext-transparent\b/.test(line)) return false;
      const big = line.match(/\btext-(?:[4-9]xl|[5-9]\dxl|\[[5-9]\d+px\])\b/);
      if (big) return { snippet: `bg-clip-text text-transparent ${big[0]}` };
      return false;
    },
  },
  {
    id: "emoji-feature-icon",
    severity: "major",
    description: "emoji as feature icon",
    fix: "use a real icon set (Lucide, Phosphor) — emoji rendering varies per OS",
    scope: "line",
    match(line) {
      const re = /([\u{1F300}-\u{1FAFF}])\s*<(h[234]|p\b[^>]*font-semibold)/u;
      const m = line.match(re);
      return m ? { snippet: m[0].slice(0, 60) } : false;
    },
  },
  {
    id: "pure-black-text",
    severity: "major",
    description: "pure black text",
    fix: "use oklch(~15% 0.005 250) or neutral-900 — pure black is too harsh",
    scope: "line",
    match(line) {
      if (/\bcolor:\s*(#000\b|#000000\b|black\b)/i.test(line)) {
        return { snippet: line.match(/\bcolor:\s*\S+/i)[0] };
      }
      const tw = /\btext-black\b/;
      const m = line.match(tw);
      if (m && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
        return { snippet: m[0] };
      }
      return false;
    },
  },
  {
    id: "generic-cta",
    severity: "major",
    description: "generic CTA label",
    fix: 'be specific — "See pricing details", "Start 14-day trial", etc.',
    scope: "line",
    match(line) {
      const generic = [
        "Learn more",
        "Click here",
        "Get started",
        "Submit",
        "OK",
      ];
      const re = /<(?:button|a)\b[^>]*>\s*([^<>]+?)\s*<\/(?:button|a)>/;
      const m = line.match(re);
      if (!m) return false;
      const text = m[1].trim().replace(/\s+/g, " ");
      if (generic.includes(text)) return { snippet: `"${text}"` };
      return false;
    },
  },
  // glassmorphism-stack and uniform-border-radius are kept as file-level (see scanFile).

  // ===== NEW v0.2 RULES =====
  {
    id: "left-top-animation",
    severity: "critical",
    description: "animating layout properties",
    fix: "animate transform/opacity instead — left/top/width trigger layout",
    scope: "line",
    match(line) {
      // CSS: transition with one of left/top/right/bottom/width/height/margin
      const css = /\btransition:\s*(?:[^;]*\s)?(left|top|right|bottom|width|height|margin)\b/;
      const mCss = line.match(css);
      if (mCss) return { snippet: `transition: ...${mCss[1]}...` };
      // Tailwind arbitrary: transition-[left] etc.
      const tw = /\btransition-\[(left|top|width|height|right|bottom|margin)\]/;
      const mTw = line.match(tw);
      if (mTw) return { snippet: mTw[0] };
      return false;
    },
  },
  {
    id: "absolute-zindex",
    severity: "major",
    description: "nuclear z-index",
    fix: "use a small layered z-index scale (10/20/30…); 9999+ signals stacking-context bug",
    scope: "line",
    match(line) {
      // CSS: z-index: 9999 or higher
      const css = /\bz-index:\s*(9{4,}|999999\d*)/;
      const mCss = line.match(css);
      if (mCss) return { snippet: mCss[0] };
      // Tailwind arbitrary: z-[9999], z-[99999], etc.
      const tw = /\bz-\[(9{4,})\]/;
      const mTw = line.match(tw);
      if (mTw) return { snippet: mTw[0] };
      return false;
    },
  },
  {
    id: "setTimeout-animation",
    severity: "major",
    description: "setTimeout-driven animation",
    fix: "use CSS transitions or requestAnimationFrame; setTimeout for animation is fragile",
    scope: "line",
    match(line) {
      // setTimeout(() => ... .classList or .style ...) within ~80 chars
      const re = /setTimeout\s*\(\s*\(\s*\)\s*=>[\s\S]{0,80}?\.(?:classList|style)\b/;
      const m = line.match(re);
      return m ? { snippet: m[0].slice(0, 80) } : false;
    },
  },
  {
    id: "inline-any-style",
    severity: "warn",
    description: "long inline style",
    fix: "extract to a class or component — inline style bypasses the design system",
    scope: "line",
    match(line) {
      // JSX style={{ ...80+ chars... }}
      const obj = /style:\s*\{\s*[^}]{80,}\}|style=\{\{[^}]{80,}\}\}/;
      const mObj = line.match(obj);
      if (mObj) return { snippet: mObj[0].slice(0, 80) + "…" };
      // HTML-style style="..." > 100 chars
      const attr = /style="([^"]{100,})"/;
      const mAttr = line.match(attr);
      if (mAttr) return { snippet: `style="${mAttr[1].slice(0, 60)}…"` };
      return false;
    },
  },
  {
    id: "aria-label-emoji",
    severity: "major",
    description: "emoji in aria-label",
    fix: "describe the action, not the glyph — screen readers announce emoji literally",
    scope: "line",
    match(line) {
      const re = /aria-label="[^"]*[\u{1F300}-\u{1FAFF}][^"]*"/u;
      const m = line.match(re);
      return m ? { snippet: m[0].slice(0, 80) } : false;
    },
  },
  {
    id: "no-focus-visible",
    severity: "major",
    description: "hover state without focus-visible",
    fix: "pair every :hover with :focus-visible (or hover:/focus-visible: in Tailwind)",
    scope: "file",
    matchFile(content, lines) {
      const hasHover = /:hover\b|\bhover:/.test(content);
      if (!hasHover) return [];
      const hasFocusVisible = /:focus-visible\b|\bfocus-visible:/.test(content);
      if (hasFocusVisible) return [];
      // Find first hover line for reporting
      let hoverLine = 1;
      for (let i = 0; i < lines.length; i++) {
        if (/:hover\b|\bhover:/.test(lines[i])) {
          hoverLine = i + 1;
          break;
        }
      }
      return [{ line: hoverLine, snippet: "file uses :hover / hover: but no :focus-visible / focus-visible:" }];
    },
  },
  {
    id: "pixel-radius-inconsistency",
    severity: "major",
    description: "mixed token + pixel border-radius",
    fix: "pick one source of truth for radii — design tokens OR raw pixels, not both",
    scope: "file",
    matchFile(content, lines) {
      const hasRoundedToken = /\brounded-(?:none|xs|sm|md|lg|xl|2xl|3xl|full)\b/.test(content);
      const hasPxRadius = /border-radius:\s*\d+px/.test(content);
      if (!(hasRoundedToken && hasPxRadius)) return [];
      let firstLine = 1;
      for (let i = 0; i < lines.length; i++) {
        if (/border-radius:\s*\d+px/.test(lines[i])) {
          firstLine = i + 1;
          break;
        }
      }
      return [{ line: firstLine, snippet: "rounded-* tokens mixed with raw border-radius: Npx" }];
    },
  },
  {
    id: "unit-mixing",
    severity: "warn",
    description: "mixed length units in same block",
    fix: "pick one unit per block (rem for layout, px for borders) — mixing makes scaling unpredictable",
    scope: "file",
    matchFile(content, lines) {
      // Walk balanced { ... } blocks. Naive but adequate for CSS/SCSS.
      const findings = [];
      const blockRe = /\{([^{}]*)\}/g;
      const lengthProps = /\b(width|height|min-width|min-height|max-width|max-height|padding|margin|top|left|right|bottom|gap|font-size|line-height)\b/;
      // Build a position→line index for reporting.
      const lineStarts = [0];
      for (let i = 0; i < content.length; i++) {
        if (content[i] === "\n") lineStarts.push(i + 1);
      }
      const lineFor = (pos) => {
        let lo = 0, hi = lineStarts.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (lineStarts[mid] <= pos) lo = mid;
          else hi = mid - 1;
        }
        return lo + 1;
      };
      let m;
      const seenLines = new Set();
      while ((m = blockRe.exec(content)) !== null) {
        const body = m[1];
        if (!lengthProps.test(body)) continue;
        const hasPx = /\b\d+px\b/.test(body);
        const hasRem = /\b\d+(?:\.\d+)?rem\b/.test(body);
        if (hasPx && hasRem) {
          const ln = lineFor(m.index);
          if (seenLines.has(ln)) continue;
          seenLines.add(ln);
          findings.push({ line: ln, snippet: "px and rem mixed in same block" });
        }
      }
      return findings;
    },
  },

  // ===== NEW v0.3 RULES =====
  {
    id: "dark-pattern/confirmshaming",
    severity: "critical",
    description: "confirmshaming copy",
    fix: "make the dismissive option neutral — 'Not now' / 'No thanks' without guilt-tripping",
    scope: "line",
    match(line) {
      const patterns = [
        /no\s+thanks[^<>"']{0,80}?\b(miss|stay|hate|regret|ignore|disappoint)/i,
        /\b(i'?ll|i)\s+(do\s+not|don'?t|refuse\s+to)[^<>"']{0,80}?\b(want|need|believe|care)\b/i,
        /\b(continue\s+without|skip)[^<>"']{0,80}?\b(security|savings|benefits|protection)\b/i,
      ];
      for (const re of patterns) {
        const m = line.match(re);
        if (m) return { snippet: m[0].slice(0, 120) };
      }
      return false;
    },
  },
  {
    id: "dark-pattern/destructive-no-confirm",
    severity: "critical",
    description: "destructive button without confirmation",
    fix: "wrap destructive actions in an AlertDialog / confirmation modal; include the item name in the confirm button label",
    scope: "file",
    matchFile(content, lines) {
      const findings = [];
      // Destructive verbs inside a <button>…</button> or <a>…</a>
      const btnRe = /<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      const verbRe = /\b(delete|remove|cancel\s+subscription|destroy|wipe|uninstall|purge|factory\s+reset)\b/i;
      const confirmRe = /\b(AlertDialog|ConfirmDialog|confirm\s*\(|onConfirm|useConfirm|ConfirmationModal)\b|Dialog[^\n]*destructive/;
      // Build position->line index
      const lineStarts = [0];
      for (let i = 0; i < content.length; i++) {
        if (content[i] === "\n") lineStarts.push(i + 1);
      }
      const lineFor = (pos) => {
        let lo = 0, hi = lineStarts.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (lineStarts[mid] <= pos) lo = mid;
          else hi = mid - 1;
        }
        return lo + 1;
      };
      const seenLines = new Set();
      let m;
      while ((m = btnRe.exec(content)) !== null) {
        const inner = m[2];
        // Strip tags to get visible text
        const visible = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const vm = visible.match(verbRe);
        if (!vm) continue;
        const ln = lineFor(m.index);
        // Look in a window of +/- 40 lines for confirmation signals
        const startLine = Math.max(0, ln - 1 - 40);
        const endLine = Math.min(lines.length, ln - 1 + 40);
        const window = lines.slice(startLine, endLine).join("\n");
        if (confirmRe.test(window)) continue;
        if (seenLines.has(ln)) continue;
        seenLines.add(ln);
        findings.push({ line: ln, snippet: `<${m[1]}>…${vm[0]}…</${m[1]}> with no confirmation nearby` });
      }
      return findings;
    },
  },
  {
    id: "a11y/icon-only-button-no-label",
    severity: "critical",
    description: "icon-only button without accessible name",
    fix: 'add `aria-label` describing the action (e.g., `aria-label="Close dialog"`), not the icon',
    scope: "file",
    matchFile(content, lines) {
      const findings = [];
      const openRe = /<button\b([^>]*)>/;
      const iconOnlyRe = /^\s*(<svg\b|<Icon\b|<[A-Z]\w*Icon\b|\{\s*[A-Za-z_$][\w$]*\s*\}\s*$)/;
      const labelRe = /\b(aria-label|aria-labelledby|title)\s*=/;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const openMatch = line.match(openRe);
        if (!openMatch) continue;
        // Skip self-closing buttons
        if (/<button\b[^>]*\/\s*>/.test(line)) continue;
        const attrs = openMatch[1];
        if (labelRe.test(attrs)) continue;
        // If opening tag already has text after `>` on the same line, use that as the first inner
        const afterOpen = line.slice(line.indexOf(openMatch[0]) + openMatch[0].length);
        let inner = afterOpen.trim();
        // If inner is a closing tag or empty, look at following non-whitespace line
        if (inner === "" || /^<\/button>/.test(inner)) {
          // Find next non-whitespace line within next 2 lines
          let found = null;
          for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
            const t = lines[j].trim();
            if (t === "") continue;
            found = t;
            break;
          }
          if (!found) continue;
          inner = found;
        }
        // If inner line contains plain text before tags, it's labelled — skip
        const stripped = inner.replace(/<[^>]+>/g, "").trim();
        // If there's meaningful text content (not just whitespace/punctuation), skip
        if (stripped && /[A-Za-z0-9]{2,}/.test(stripped)) continue;
        if (!iconOnlyRe.test(inner)) continue;
        findings.push({ line: i + 1, snippet: `<button> with only ${inner.slice(0, 40)} and no aria-label` });
      }
      return findings;
    },
  },
  {
    id: "dataviz/categorical-rainbow",
    severity: "major",
    description: "chart with unnamed rainbow palette",
    fix: "use a named palette — viridis (sequential), Okabe-Ito (categorical, colorblind-safe), or Tableau 10. See references/dataviz.md",
    scope: "file",
    matchFile(content) {
      const chartLib = /\b(recharts|nivo|chart\.js|@visx|victory|d3-scale-chromatic)\b/;
      if (!chartLib.test(content)) return [];
      const namedPalette = /\b(viridis|cividis|okabe|tableau|colorBrewer|categorical10|setMagma)\b/i;
      if (namedPalette.test(content)) return [];
      // Scan arrays for ≥6 color strings
      const findings = [];
      const arrRe = /\[([^\[\]]{20,2000})\]/g;
      const colorRe = /"#[0-9a-fA-F]{3,8}"|"hsla?\([^"]+\)"|"rgba?\([^"]+\)"|"oklch\([^"]+\)"|"(?:fill|text|bg|stroke)-(?:red|blue|green|yellow|orange|purple|pink|cyan|teal|indigo|violet|fuchsia|rose|amber|lime|emerald|sky|slate|gray|zinc|neutral|stone)-\d+"/g;
      // Precompute line for position
      const lineStarts = [0];
      for (let i = 0; i < content.length; i++) {
        if (content[i] === "\n") lineStarts.push(i + 1);
      }
      const lineFor = (pos) => {
        let lo = 0, hi = lineStarts.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (lineStarts[mid] <= pos) lo = mid;
          else hi = mid - 1;
        }
        return lo + 1;
      };
      let m;
      const seenLines = new Set();
      while ((m = arrRe.exec(content)) !== null) {
        const body = m[1];
        const colors = body.match(colorRe);
        if (!colors || colors.length < 6) continue;
        const ln = lineFor(m.index);
        if (seenLines.has(ln)) continue;
        seenLines.add(ln);
        findings.push({ line: ln, snippet: `${colors.length} colors in array, no named palette` });
      }
      return findings;
    },
  },
  {
    id: "state/missing-empty-or-error",
    severity: "major",
    description: "data-fetching component without empty/error states",
    fix: "data-fetching components should render empty/error states explicitly. See references/state-design.md — design the unhappy path first",
    scope: "file",
    matchFile(content, lines) {
      const fetchSignal = /\b(useQuery|useSWR|useFetch|useAsync|createResource|useSuspenseQuery)\b|\bfetch\(/;
      if (!fetchSignal.test(content)) return [];
      const branchSignals = [
        /\bisError\b/,
        /\berror\s*\?/,
        /\bisLoading\s*\?/,
        /\bif\s*\([^)]*empty/i,
        /\bdata\?\.length\s*===?\s*0/,
        /\bdata\s*\|\|\s*\[\s*\]/,
        /\bEmptyState\b/,
        /\bErrorState\b/,
        /<NoData\b/,
        /\bcase\b[^:]*\bempty\b/i,
        /\bcase\b[^:]*\berror\b/i,
      ];
      for (const re of branchSignals) {
        if (re.test(content)) return [];
      }
      // Flag on first fetch-signal line
      let ln = 1;
      for (let i = 0; i < lines.length; i++) {
        if (fetchSignal.test(lines[i])) {
          ln = i + 1;
          break;
        }
      }
      return [{ line: ln, snippet: "data-fetching hook/call with no empty or error branch in file" }];
    },
  },
  {
    id: "copy/placeholder-shipped",
    severity: "critical",
    description: "placeholder copy not replaced",
    fix: "replace placeholder text with real content before shipping. Use production copy or obviously-fake-but-plausible domain content (e.g., 'Acme Industries' not 'Lorem ipsum')",
    scope: "line",
    match(line) {
      const patterns = [
        /\bLorem ipsum\b/i,
        />\s*TODO\s*</,
        /placeholder:\s*["']TODO["']/,
        />\s*XXX\s*</,
        />\s*Placeholder\s+[A-Z]\w*\s*</,
        />\s*(Lorem|Dolor|Consectetur)\s/,
        />\s*A{4,}\s*</,
        />\s*555-?0\d{3}\s*</,
        />\s*(John|Jane)\s+Doe\s*</,
      ];
      for (const re of patterns) {
        const m = line.match(re);
        if (m) return { snippet: m[0].slice(0, 80) };
      }
      return false;
    },
  },

  // ===== NEW v0.4 RULES =====
  {
    id: "a11y/modal-without-dialog",
    severity: "critical",
    description: "custom modal without native <dialog> or [popover]",
    fix: "Prefer native <dialog> or [popover] over custom divs. Native elements give you focus trap, ESC handling, and backdrop click out of the box. See references/modern-css.md → Popover API + <dialog>.",
    scope: "file",
    matchFile(content, lines) {
      // Skip if file imports a known accessible dialog library.
      const a11yLibRe = /from\s+["'](?:@radix-ui\/[^"']+|@headlessui\/react|@ariakit\/react|@reach\/[^"']+|vaul|react-aria(?:-components)?|react-modal)["']/;
      if (a11yLibRe.test(content)) return [];

      // Signals of a modal-like pattern.
      const hasDivDialogRole = /<div\b[^>]*\brole\s*=\s*["'](?:dialog|alertdialog)["']/.test(content);
      const hasModalClass = /\b(?:class|className)\s*=\s*["'][^"']*\b(?:modal|overlay)\b[^"']*["']/.test(content);
      // Backdrop pattern: position fixed + inset 0 near a state gate like isOpen && / open ?
      const hasBackdrop = (
        (/position:\s*fixed/.test(content) && /inset:\s*0\b/.test(content)) ||
        /\bfixed\s+inset-0\b/.test(content)
      );
      const hasStateGate = /\b(?:isOpen|open)\s*&&|\b(?:isOpen|open)\s*\?/.test(content);

      const modalish = hasDivDialogRole || hasModalClass || (hasBackdrop && hasStateGate);
      if (!modalish) return [];

      // If any native-dialog signal exists, we're fine.
      const nativeSignals = /<dialog\b|\bshowModal\s*\(|\bpopover\s*=|\bpopoverTarget\s*=|\bHTMLDialogElement\b/;
      if (nativeSignals.test(content)) return [];

      // Find first offending line for reporting.
      let ln = 1;
      for (let i = 0; i < lines.length; i++) {
        if (
          /<div\b[^>]*\brole\s*=\s*["'](?:dialog|alertdialog)["']/.test(lines[i]) ||
          /\b(?:class|className)\s*=\s*["'][^"']*\b(?:modal|overlay)\b[^"']*["']/.test(lines[i])
        ) {
          ln = i + 1;
          break;
        }
      }
      return [{ line: ln, snippet: "modal-like pattern without <dialog>/[popover] or accessible-dialog lib" }];
    },
  },
  {
    id: "forms/placeholder-as-label",
    severity: "critical",
    description: "input/textarea with placeholder but no label",
    fix: "Placeholders are not labels — they disappear on focus and break screen readers. Add a <label>, aria-label, or aria-labelledby. See references/forms.md and references/accessibility.md.",
    scope: "line",
    match(line, ctx) {
      const re = /<(input|textarea)\b[^>]*\bplaceholder\s*=/;
      const m = line.match(re);
      if (!m) return false;
      const tag = m[0];
      // Skip inputs that don't need labels.
      if (/\btype\s*=\s*["'](?:hidden|submit|button|reset|image)["']/.test(tag)) return false;
      // Already has an accessible name?
      if (/\baria-label\s*=/.test(tag) || /\baria-labelledby\s*=/.test(tag)) return false;
      // Check the same JSX element — a placeholder attr might span lines. Approximate by
      // peeking ahead a couple of lines for closing > or aria-* before it.
      const lines = ctx && ctx.lines;
      const idx = ctx && ctx.lineIdx;
      if (lines && typeof idx === "number") {
        // Build a small window from the opening tag to its first closing >.
        let window = line;
        for (let j = idx + 1; j < Math.min(lines.length, idx + 4); j++) {
          window += "\n" + lines[j];
          if (/>/.test(lines[j])) break;
        }
        if (/\baria-label\s*=/.test(window) || /\baria-labelledby\s*=/.test(window)) return false;

        // Check preceding 3 lines for a wrapping <label …> or htmlFor/for pointing at this.
        const from = Math.max(0, idx - 3);
        const preceding = lines.slice(from, idx).join("\n");
        if (/<label\b/.test(preceding)) return false;
      }
      return { snippet: line.match(/<(?:input|textarea)\b[^>]*\bplaceholder\s*=\s*["'][^"']*["']/)?.[0]?.slice(0, 100) || "placeholder without label" };
    },
  },
  {
    id: "a11y/outline-none-no-replacement",
    severity: "critical",
    description: "outline removed without focus-visible replacement",
    fix: "Removing outline without replacement breaks keyboard accessibility. Pair every outline: none with a :focus-visible ring or outline replacement — focus-visible:ring-2 ring-offset-2 in Tailwind.",
    scope: "line",
    match(line, ctx) {
      const cssRe = /outline:\s*(?:none|0|0px)\b/;
      const twRe = /\b(?:outline-none|focus:outline-none)\b/;
      const hit = cssRe.test(line) || twRe.test(line);
      if (!hit) return false;

      const lines = ctx && ctx.lines;
      const idx = ctx && ctx.lineIdx;
      if (lines && typeof idx === "number") {
        const from = Math.max(0, idx - 6);
        const to = Math.min(lines.length, idx + 7);
        const window = lines.slice(from, to).join("\n");
        // Replacement signals.
        const hasFocusVisible = /:focus-visible\b|\bfocus-visible:/.test(window);
        const hasFocusRule = /:focus\b\s*[,{]/.test(window); // CSS :focus { ... } or :focus,
        const hasFocusVisibleRing = /\bfocus-visible:[\w-]*(?:ring|outline)\b/.test(window);
        if (hasFocusVisible || hasFocusRule || hasFocusVisibleRing) return false;
      }
      const m = line.match(cssRe) || line.match(twRe);
      return { snippet: m ? m[0] : "outline removed" };
    },
  },
  {
    id: "tables/no-overflow-handling",
    severity: "major",
    description: "table without overflow handling or sticky header",
    fix: "Tables need horizontal overflow on mobile and a sticky header for long lists. Wrap in overflow-x: auto and apply position: sticky; top: 0 to thead/th.",
    scope: "file",
    matchFile(content, lines) {
      const hasTable = /<table\b|\brole\s*=\s*["']table["']|display:\s*table\b/.test(content);
      if (!hasTable) return [];

      const hasOverflow = /\boverflow-auto\b|\boverflow-x-auto\b|\boverflow-scroll\b|\boverflow-x-scroll\b|overflow:\s*auto\b|overflow-x:\s*auto\b|overflow:\s*scroll\b|overflow-x:\s*scroll\b/.test(content);
      const hasStickyHead = (
        /position:\s*sticky[\s\S]{0,200}?(?:thead|th\b)/.test(content) ||
        /(?:thead|th)\b[\s\S]{0,200}?position:\s*sticky/.test(content) ||
        /<thead\b[^>]*\bclassName\s*=\s*["'][^"']*\bsticky\b[^"']*\btop-0\b/.test(content) ||
        /<thead\b[^>]*\bclassName\s*=\s*["'][^"']*\btop-0\b[^"']*\bsticky\b/.test(content) ||
        /<th\b[^>]*\bclassName\s*=\s*["'][^"']*\bsticky\b[^"']*\btop-0\b/.test(content) ||
        /<th\b[^>]*\bclassName\s*=\s*["'][^"']*\btop-0\b[^"']*\bsticky\b/.test(content)
      );

      if (hasOverflow && hasStickyHead) return [];

      // Find the first table-ish line for reporting.
      let ln = 1;
      for (let i = 0; i < lines.length; i++) {
        if (/<table\b|\brole\s*=\s*["']table["']|display:\s*table\b/.test(lines[i])) {
          ln = i + 1;
          break;
        }
      }

      const findings = [];
      if (!hasOverflow) {
        findings.push({
          line: ln,
          snippet: "Tables without horizontal overflow break on mobile (~320px). Wrap in an element with overflow-x: auto.",
        });
      }
      if (!hasStickyHead) {
        findings.push({
          line: ln,
          snippet: "Long tables benefit from position: sticky; top: 0; on thead/th — header stays visible while scrolling rows.",
        });
      }
      return findings;
    },
  },
];

// --- Config loading ------------------------------------------------------

const CONFIG_FILENAME = ".uicraftrc.json";

/**
 * Walk up from startDir until we find .uicraftrc.json or hit a git root / fs root.
 * Returns { config, path } or { config: null, path: null }.
 */
async function loadConfig(startDir) {
  let dir = path.resolve(startDir);
  // If we were given a file, start from its directory.
  try {
    const st = await fs.stat(dir);
    if (st.isFile()) dir = path.dirname(dir);
  } catch {
    return { config: null, path: null };
  }
  while (true) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    try {
      const raw = await fs.readFile(candidate, "utf8");
      try {
        const parsed = JSON.parse(raw);
        return { config: parsed, path: candidate };
      } catch (err) {
        process.stderr.write(
          `warning: ${candidate} has invalid JSON (${err.message}); using defaults\n`,
        );
        return { config: null, path: null };
      }
    } catch {
      // not here; check for .git as a stop boundary
      try {
        await fs.stat(path.join(dir, ".git"));
        return { config: null, path: null }; // hit git root, stop
      } catch {
        // not a git root — keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return { config: null, path: null };
    dir = parent;
  }
}

/**
 * Apply config to a finding: returns null if disabled ("off"), or a finding
 * with possibly remapped severity ("warn" / "error").
 */
function applyConfigToFinding(finding, config) {
  if (!config || !config.rules) return finding;
  const setting = config.rules[finding.rule];
  if (!setting) return finding;
  if (setting === "off") return null;
  if (setting === "warn") return { ...finding, severity: "warn" };
  if (setting === "error") return { ...finding, severity: "critical" };
  return finding;
}

/**
 * Convert a tiny glob (supports *, **, ?) to a RegExp.
 * Doesn't handle character classes or brace expansion — that's fine for our scope.
 */
function globToRegex(glob) {
  let re = "^";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        // ** matches across path separators
        re += ".*";
        i += 2;
        if (glob[i] === "/") i++; // consume trailing slash
      } else {
        re += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      re += "[^/]";
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      re += "\\" + ch;
      i++;
    } else {
      re += ch;
      i++;
    }
  }
  re += "$";
  return new RegExp(re);
}

function isIgnoredByConfig(filePath, config, baseDir) {
  if (!config || !Array.isArray(config.ignore)) return false;
  // Use POSIX-style relative path for glob matching.
  const rel = path.relative(baseDir, filePath).split(path.sep).join("/");
  for (const pattern of config.ignore) {
    if (globToRegex(pattern).test(rel)) return true;
  }
  return false;
}

// --- Ignore comments -----------------------------------------------------

/**
 * Pre-scan a file's lines for ignore comments. Returns:
 *   { fileIgnored: boolean, skip: Map<lineNumber, Set<ruleId|"*">> }
 *
 * Supported markers (anywhere in the line, /*…*\/, //…, or <!--…-->):
 *   ui-craft-detect-ignore                     → skip current line
 *   ui-craft-detect-ignore-next-line           → skip next non-empty line
 *   ui-craft-detect-ignore-file                → skip entire file
 *   ui-craft-detect-ignore-rule: <rule-id>     → skip only that rule on current line
 */
function applyIgnoreComments(lines) {
  const skip = new Map();
  let fileIgnored = false;
  const add = (lineNum, ruleId) => {
    if (!skip.has(lineNum)) skip.set(lineNum, new Set());
    skip.get(lineNum).add(ruleId);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/ui-craft-detect-ignore-file\b/.test(line)) {
      fileIgnored = true;
      continue;
    }
    if (/ui-craft-detect-ignore-next-line\b/.test(line)) {
      // Find next non-empty line
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== "") {
          add(j + 1, "*");
          break;
        }
      }
      continue;
    }
    const ruleMatch = line.match(/ui-craft-detect-ignore-rule:\s*([a-zA-Z0-9_-]+)/);
    if (ruleMatch) {
      add(i + 1, ruleMatch[1]);
      continue;
    }
    // Plain ignore — must check AFTER the more specific patterns above.
    if (/ui-craft-detect-ignore\b(?!-)/.test(line)) {
      add(i + 1, "*");
    }
  }
  return { fileIgnored, skip };
}

function isFindingIgnored(finding, ignoreInfo) {
  if (!ignoreInfo) return false;
  const set = ignoreInfo.skip.get(finding.line);
  if (!set) return false;
  return set.has("*") || set.has(finding.rule);
}

// --- Scanning ------------------------------------------------------------

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".DS_Store")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.has(ext)) out.push(full);
    }
  }
  return out;
}

function scanFile(filePath, content, config) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  const ext = path.extname(filePath);
  const ctx = { filePath, lines, ext };

  const ignoreInfo = applyIgnoreComments(lines);
  if (ignoreInfo.fileIgnored) return [];

  // Per-line rules
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    ctx.lineIdx = i;
    for (const rule of rules) {
      if (rule.scope === "file") continue;
      if (config && config.rules && config.rules[rule.id] === "off") continue;
      const res = rule.match(line, ctx);
      if (!res) continue;
      const finding = {
        file: filePath,
        line: i + 1,
        severity: rule.severity,
        rule: rule.id,
        description: rule.description,
        snippet: (typeof res === "object" && res.snippet ? res.snippet : line.trim()).slice(0, 160),
        fix: rule.fix,
      };
      if (isFindingIgnored(finding, ignoreInfo)) continue;
      const adjusted = applyConfigToFinding(finding, config);
      if (adjusted) findings.push(adjusted);
    }
  }

  // File-level rules from the rules array
  for (const rule of rules) {
    if (rule.scope !== "file" || typeof rule.matchFile !== "function") continue;
    if (config && config.rules && config.rules[rule.id] === "off") continue;
    const hits = rule.matchFile(content, lines, ctx);
    for (const hit of hits) {
      const finding = {
        file: filePath,
        line: hit.line,
        severity: rule.severity,
        rule: rule.id,
        description: rule.description,
        snippet: hit.snippet,
        fix: rule.fix,
      };
      if (isFindingIgnored(finding, ignoreInfo)) continue;
      const adjusted = applyConfigToFinding(finding, config);
      if (adjusted) findings.push(adjusted);
    }
  }

  // Legacy file-level rule: glassmorphism stack.
  if (!config || !config.rules || config.rules["glassmorphism-stack"] !== "off") {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasBlur = /\bbackdrop-blur(?:-\w+)?\b|backdrop-filter:\s*blur/.test(line);
      const hasBgWhite = /\bbg-white\/\d+\b|background(?:-color)?:\s*rgba\(\s*255\s*,\s*255\s*,\s*255/.test(line);
      const hasBorderWhite = /\bborder-white\/\d+\b|border(?:-color)?:\s*rgba\(\s*255\s*,\s*255\s*,\s*255/.test(line);
      if (hasBlur && hasBgWhite && hasBorderWhite) {
        const finding = {
          file: filePath,
          line: i + 1,
          severity: "critical",
          rule: "glassmorphism-stack",
          description: "glassmorphism stack",
          snippet: "backdrop-blur + bg-white/… + border-white/…",
          fix: "pick one — frosted panels age badly; solid fill or hairline border is cleaner",
        };
        if (isFindingIgnored(finding, ignoreInfo)) continue;
        const adjusted = applyConfigToFinding(finding, config);
        if (adjusted) findings.push(adjusted);
      }
    }
  }

  // Legacy file-level rule: uniform border-radius.
  if (!config || !config.rules || config.rules["uniform-border-radius"] !== "off") {
    const roundedCounts = new Map();
    const roundedFirstLine = new Map();
    const roundedRe = /\brounded-(?:none|xs|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\])\b/g;
    for (let i = 0; i < lines.length; i++) {
      const matches = lines[i].match(roundedRe);
      if (!matches) continue;
      for (const m of matches) {
        roundedCounts.set(m, (roundedCounts.get(m) || 0) + 1);
        if (!roundedFirstLine.has(m)) roundedFirstLine.set(m, i + 1);
      }
    }
    const totalVariants = roundedCounts.size;
    for (const [token, count] of roundedCounts) {
      if (count > 5 && totalVariants === 1) {
        const finding = {
          file: filePath,
          line: roundedFirstLine.get(token),
          severity: "major",
          rule: "uniform-border-radius",
          description: "uniform border-radius",
          snippet: `${token} used ${count}× with no variation`,
          fix: "vary radii by element role — cards, pills, inputs want different shapes",
        };
        if (!isFindingIgnored(finding, ignoreInfo)) {
          const adjusted = applyConfigToFinding(finding, config);
          if (adjusted) findings.push(adjusted);
        }
        break;
      }
    }
  }

  return findings;
}

// --- Fix mode ------------------------------------------------------------

/**
 * Apply auto-fixes to file content. Returns { content, fixedByRule: Map<ruleId, count> }.
 * Only rules with a `fix_apply` method on the rule definition are applied.
 */
function applyFix(content) {
  let cur = content;
  const fixedByRule = new Map();
  for (const rule of rules) {
    if (typeof rule.fix_apply !== "function") continue;
    const before = cur;
    const { content: next, fixed } = rule.fix_apply(cur);
    if (fixed > 0 && next !== before) {
      cur = next;
      fixedByRule.set(rule.id, (fixedByRule.get(rule.id) || 0) + fixed);
    }
  }
  return { content: cur, fixedByRule };
}

/**
 * Minimal unified-style diff for --fix-dry-run. Not exact unified format, but
 * good enough to eyeball changes without a dependency.
 */
function makeDiff(before, after) {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const out = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) out.push(`- ${a[i]}`);
    if (b[i] !== undefined) out.push(`+ ${b[i]}`);
  }
  return out.join("\n");
}

// --- SARIF output --------------------------------------------------------

function toSarif(findings, ruleDefs) {
  const usedRules = [...new Set(findings.map((f) => f.rule))];
  const ruleIndex = new Map(usedRules.map((id, i) => [id, i]));
  const cwd = process.cwd();
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ui-craft-detect",
            version: VERSION,
            informationUri: "https://github.com/educlopez/ui-craft",
            rules: usedRules.map((id) => {
              const def = ruleDefs.find((r) => r.id === id);
              return {
                id,
                name: id,
                shortDescription: { text: def ? def.description : id },
                helpUri: "https://github.com/educlopez/ui-craft",
                defaultConfiguration: {
                  level: severityToSarifLevel(def ? def.severity : "warn"),
                },
              };
            }),
          },
        },
        results: findings.map((f) => ({
          ruleId: f.rule,
          ruleIndex: ruleIndex.get(f.rule),
          level: severityToSarifLevel(f.severity),
          message: { text: `${f.description} — ${f.snippet}. Fix: ${f.fix}` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: path.relative(cwd, f.file).split(path.sep).join("/"),
                },
                region: { startLine: f.line },
              },
            },
          ],
        })),
      },
    ],
  };
}

function severityToSarifLevel(sev) {
  if (sev === "critical") return "error";
  if (sev === "major") return "warning";
  if (sev === "warn") return "warning";
  return "note";
}

// --- Main ----------------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    json: false,
    sarif: false,
    fix: false,
    fixDryRun: false,
    version: false,
    help: false,
  };
  const positional = [];
  for (const a of argv) {
    if (a === "--json") flags.json = true;
    else if (a === "--sarif") flags.sarif = true;
    else if (a === "--fix") flags.fix = true;
    else if (a === "--fix-dry-run") flags.fixDryRun = true;
    else if (a === "--version" || a === "-v") flags.version = true;
    else if (a === "--help" || a === "-h") flags.help = true;
    else if (!a.startsWith("--")) positional.push(a);
  }
  return { flags, positional };
}

function printHelp() {
  process.stdout.write(
    `ui-craft-detect v${VERSION}\n\n` +
      `Usage: ui-craft-detect [path] [options]\n\n` +
      `Options:\n` +
      `  --json           Machine-readable JSON output\n` +
      `  --sarif          SARIF 2.1.0 output (GitHub code-scanning)\n` +
      `  --fix            Auto-fix supported rules in place\n` +
      `  --fix-dry-run    Show diff of would-be fixes without writing\n` +
      `  --version, -v    Print version\n` +
      `  --help, -h       This help\n\n` +
      `Config: looks for .uicraftrc.json upward from scan root.\n` +
      `Ignore comments: ui-craft-detect-ignore[-file|-next-line|-rule: <id>]\n`,
  );
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    process.exit(0);
  }
  if (flags.version) {
    process.stdout.write(`ui-craft-detect v${VERSION}\n`);
    process.exit(0);
  }

  const targetRaw = positional[0] || ".";
  const target = path.resolve(targetRaw);

  let stat;
  try {
    stat = await fs.stat(target);
  } catch (err) {
    process.stderr.write(`error: cannot read path "${targetRaw}": ${err.message}\n`);
    process.exit(2);
  }

  // Load config from scan root upward.
  const configStartDir = stat.isDirectory() ? target : path.dirname(target);
  const { config, path: configPath } = await loadConfig(configStartDir);
  if (config && config.extends) {
    if (config.extends !== "recommended") {
      process.stderr.write(`warning: unknown extends value "${config.extends}"; ignoring\n`);
    }
    // "recommended" is currently a no-op; reserved for future.
  }

  let files = [];
  if (stat.isDirectory()) {
    files = await walk(target);
  } else if (stat.isFile()) {
    const ext = path.extname(target);
    if (SCAN_EXTENSIONS.has(ext)) files = [target];
  }

  // Apply config-level ignore globs.
  if (config && Array.isArray(config.ignore)) {
    files = files.filter((f) => !isIgnoredByConfig(f, config, configStartDir));
  }

  // Count config rule overrides for the summary line.
  const overrideCount = config && config.rules ? Object.keys(config.rules).length : 0;

  // ===== FIX MODE =====
  if (flags.fix || flags.fixDryRun) {
    let totalFixed = 0;
    let totalFindingsBefore = 0;
    let totalNonFixable = 0;
    const perFile = [];

    for (const f of files) {
      let original;
      try {
        original = await fs.readFile(f, "utf8");
      } catch {
        continue;
      }
      const findingsBefore = scanFile(f, original, config);
      totalFindingsBefore += findingsBefore.length;
      const { content: nextContent, fixedByRule } = applyFix(original);
      const totalFixedHere = [...fixedByRule.values()].reduce((a, b) => a + b, 0);
      const findingsAfter = scanFile(f, nextContent, config);
      const nonFixable = findingsAfter.length;
      totalFixed += totalFixedHere;
      totalNonFixable += nonFixable;

      if (totalFixedHere === 0 && nextContent === original) continue;

      if (flags.fixDryRun) {
        const rel = path.relative(process.cwd(), f);
        process.stdout.write(`\n${bold("--- " + rel)}\n${makeDiff(original, nextContent)}\n`);
      } else {
        // Atomic-ish: re-read just before write to detect concurrent edits.
        try {
          const recheck = await fs.readFile(f, "utf8");
          if (recheck !== original) {
            process.stderr.write(`warning: ${f} changed during processing; skipped\n`);
            continue;
          }
          await fs.writeFile(f, nextContent, "utf8");
        } catch (err) {
          process.stderr.write(`warning: could not write ${f}: ${err.message}\n`);
          continue;
        }
      }
      perFile.push({
        file: f,
        fixed: totalFixedHere,
        before: findingsBefore.length,
        nonFixable,
      });
    }

    // Fix summary table
    process.stdout.write(`\n${bold("ui-craft-detect")} v${VERSION} — fix summary\n`);
    if (configPath) {
      const relCfg = path.relative(process.cwd(), configPath);
      process.stdout.write(dim(`config: ${relCfg} (${overrideCount} rules overridden)\n`));
    }
    if (perFile.length === 0) {
      process.stdout.write(dim("No fixable findings.\n"));
    } else {
      for (const r of perFile) {
        const rel = path.relative(process.cwd(), r.file);
        process.stdout.write(
          `  ${rel}: fixed ${r.fixed} / ${r.before} findings; ${r.nonFixable} non-fixable remain\n`,
        );
      }
    }
    process.stdout.write(
      `\n${files.length} files scanned. Auto-fixed: ${totalFixed}. Non-fixable remaining: ${totalNonFixable}.${flags.fixDryRun ? " (dry run — no files written)" : ""}\n`,
    );
    process.exit(totalNonFixable > 0 ? 1 : 0);
  }

  // ===== NORMAL SCAN =====
  const findings = [];
  for (const f of files) {
    let content;
    try {
      content = await fs.readFile(f, "utf8");
    } catch {
      continue;
    }
    const fileFindings = scanFile(f, content, config);
    findings.push(...fileFindings);
  }

  const flaggedFiles = new Set(findings.map((f) => f.file));
  const errors = findings.filter((f) => f.severity === "critical").length;
  const majors = findings.filter((f) => f.severity === "major").length;
  const warnings = findings.filter((f) => f.severity === "warn").length;
  // Exit code is driven by "error" severity (critical) only. major + warn → 0
  // unless config promoted to error (which is mapped to "critical" already).
  const errorCount = errors;
  const warningCount = majors + warnings;

  const summary = {
    files_scanned: files.length,
    files_flagged: flaggedFiles.size,
    errors: errorCount,
    warnings: warningCount,
    auto_fixed: 0,
  };

  if (flags.sarif) {
    const sarif = toSarif(findings, rules);
    process.stdout.write(JSON.stringify(sarif, null, 2) + "\n");
    process.exit(errorCount > 0 ? 1 : 0);
  }

  if (flags.json) {
    const out = {
      version: VERSION,
      summary,
      config: configPath ? { path: configPath, overrides: overrideCount } : null,
      findings: findings.map((f) => ({
        file: path.relative(process.cwd(), f.file),
        line: f.line,
        severity: f.severity,
        rule: f.rule,
        description: f.description,
        snippet: f.snippet,
        fix: f.fix,
      })),
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    process.exit(errorCount > 0 ? 1 : 0);
  }

  // Human-readable output
  const displayPath = path.relative(process.cwd(), target) || ".";
  process.stdout.write(
    `${bold("ui-craft anti-slop detector")} ${dim("v" + VERSION)}\n` +
      `Scanned ${summary.files_scanned} files in ./${displayPath}` +
      ` (${summary.files_flagged} of them flagged)\n\n`,
  );

  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  for (const [file, fs_] of byFile) {
    const rel = path.relative(process.cwd(), file);
    for (const f of fs_) {
      const dot =
        f.severity === "critical" ? red("●") : f.severity === "major" ? yellow("●") : dim("●");
      process.stdout.write(`${rel}:${f.line}\n`);
      process.stdout.write(`  ${dot} ${f.description}  ${dim("— " + f.snippet)}\n`);
      process.stdout.write(`     ${dim("fix: " + f.fix)}\n\n`);
    }
  }

  if (findings.length === 0) {
    process.stdout.write(dim("No anti-slop patterns found.\n"));
  }

  // Summary line
  let summaryLine = `${summary.files_scanned} files scanned, ${summary.files_flagged} flagged (${errorCount} errors, ${warningCount} warnings).`;
  if (configPath) {
    const relCfg = path.relative(process.cwd(), configPath);
    summaryLine += ` Config: ${relCfg} (${overrideCount} rules overridden).`;
  }
  summaryLine += ` Auto-fixed: 0.`;
  process.stdout.write(summaryLine + "\n");

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`error: ${err.stack || err.message}\n`);
  process.exit(2);
});
