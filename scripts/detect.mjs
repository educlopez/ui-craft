#!/usr/bin/env node
// ui-craft anti-slop detector v0.2.0
// Scans CSS/JSX/TSX/Vue/Svelte/etc for common AI-generated UI anti-patterns.
// Zero dependencies. Node 18+. Rules mirror skills/ui-craft/SKILL.md "Anti-Slop Test".
//
// Usage:
//   node scripts/detect.mjs [path] [--json] [--sarif] [--fix] [--fix-dry-run]
// Exit codes:
//   0 clean (or only warnings), 1 errors present, 2 arg error / unreadable path

import { promises as fs } from "node:fs";
import path from "node:path";

const VERSION = "0.2.0";

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
