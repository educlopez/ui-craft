#!/usr/bin/env node
// ui-craft anti-slop detector
// Scans CSS/JSX/TSX/Vue/Svelte/etc for common AI-generated UI anti-patterns.
// Zero dependencies. Node 18+. Rules mirror skills/ui-craft/SKILL.md "Anti-Slop Test".
//
// Usage:
//   node scripts/detect.mjs [path] [--json]
// Exit codes:
//   0 clean, 1 findings present, 2 arg error / unreadable path

import { promises as fs } from "node:fs";
import path from "node:path";

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
// Each rule:
//   id           slug identifier (also the machine key)
//   severity     "critical" | "major"
//   description  short human label
//   fix          one-line suggestion
//   match(line, ctx) → false | true | { snippet }
//     ctx: { filePath, lineIdx, lines, ext }
//
// Rules operate line-by-line. For rules that need co-occurrence across a
// file (glassmorphism, uniform rounded-), see the file-level pass below.
// --------------------------------------------------------------------------

const rules = [
  {
    id: "transition-all",
    severity: "critical",
    description: "transition: all",
    fix: "list specific properties (transform, opacity, background-color)",
    match(line) {
      // CSS `transition: all` or Tailwind `transition-all`
      // CSS-in-JS often quotes the value: `transition: "all 300ms"` — allow a stray quote.
      const re = /\btransition:\s*["']?all\b|\btransition-all\b/;
      const m = line.match(re);
      return m ? { snippet: m[0] } : false;
    },
  },
  {
    id: "bounce-elastic-easing",
    severity: "critical",
    description: "bounce/elastic easing",
    fix: "use ease-out or cubic-bezier(0.22, 1, 0.36, 1)",
    match(line) {
      // easing keyword "bounce" / "elastic", easeInOutBounce, elastic cubic-bezier
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
      // "bounce" or "elastic" keyword inside a transition/animation line
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
    match(line) {
      const m = line.match(/\banimate-bounce\b/);
      return m ? { snippet: m[0] } : false;
    },
  },
  {
    id: "purple-cyan-gradient",
    severity: "critical",
    description: "purple/cyan gradient",
    fix: "single brand accent, no gradients",
    match(line) {
      // Tailwind: bg-gradient-to-* from-{purple|violet|fuchsia|indigo}-N (via-?) to-{cyan|sky|blue|teal}-N
      const tw = /bg-gradient-to-[rlbt]{1,2}\s+from-(?:purple|violet|fuchsia|indigo)-\d+(?:\s+via-\S+)?\s+to-(?:cyan|sky|blue|teal)-\d+/;
      let m = line.match(tw);
      if (m) return { snippet: m[0] };
      // CSS linear-gradient with purple→cyan-ish hexes is hard to detect reliably — skip.
      return false;
    },
  },
  {
    id: "uppercase-heading",
    severity: "critical",
    description: "ALL CAPS heading",
    fix: "use sentence case; reserve uppercase for small labels (≤13px) with wide tracking",
    match(line) {
      // JSX: <h1..h4 ... class="... uppercase ...">
      const jsx = /<h[1-4]\b[^>]*\b(?:class|className)\s*=\s*["'][^"']*\buppercase\b[^"']*["']/;
      const mJsx = line.match(jsx);
      if (mJsx) {
        // exempt if text-xs also present on same element (small label usage is OK)
        if (/\btext-xs\b/.test(mJsx[0])) return false;
        return { snippet: mJsx[0].slice(0, 80) };
      }
      // CSS: h1..h4 { text-transform: uppercase } — approx on same line
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
    match(line) {
      // bg-clip-text + text-transparent + a large text-* on same line
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
    match(line) {
      // Emoji in Unicode range U+1F300..U+1FAFF, followed by a heading/semibold paragraph
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
    match(line) {
      // CSS color declarations — body/paragraph-ish. Heuristic: only flag
      // when on a `color:` line (not background, not border).
      if (/\bcolor:\s*(#000\b|#000000\b|black\b)/i.test(line)) {
        return { snippet: line.match(/\bcolor:\s*\S+/i)[0] };
      }
      // Tailwind: `text-black` class (not inside a comment)
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
    match(line) {
      // JSX text child of <button> or <a>: exact match on known generic labels.
      // "Get started free" is OK (has qualifier); "Get started" alone is generic.
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
];

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

function scanFile(filePath, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  const ext = path.extname(filePath);
  const ctx = { filePath, lines, ext };

  // Per-line rules
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    ctx.lineIdx = i;
    for (const rule of rules) {
      const res = rule.match(line, ctx);
      if (!res) continue;
      findings.push({
        file: filePath,
        line: i + 1,
        severity: rule.severity,
        rule: rule.id,
        description: rule.description,
        snippet: (typeof res === "object" && res.snippet ? res.snippet : line.trim()).slice(0, 160),
        fix: rule.fix,
      });
    }
  }

  // File-level rule: glassmorphism stack (co-occurrence on same line/element).
  // We scan per-line for the three markers within 0 chars of each other: JSX element
  // or CSS rule block on one line. Simple but effective.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasBlur = /\bbackdrop-blur(?:-\w+)?\b|backdrop-filter:\s*blur/.test(line);
    const hasBgWhite = /\bbg-white\/\d+\b|background(?:-color)?:\s*rgba\(\s*255\s*,\s*255\s*,\s*255/.test(line);
    const hasBorderWhite = /\bborder-white\/\d+\b|border(?:-color)?:\s*rgba\(\s*255\s*,\s*255\s*,\s*255/.test(line);
    if (hasBlur && hasBgWhite && hasBorderWhite) {
      findings.push({
        file: filePath,
        line: i + 1,
        severity: "critical",
        rule: "glassmorphism-stack",
        description: "glassmorphism stack",
        snippet: "backdrop-blur + bg-white/… + border-white/…",
        fix: "pick one — frosted panels age badly; solid fill or hairline border is cleaner",
      });
    }
  }

  // File-level rule: uniform border-radius (>5 identical rounded-* usages, no variation).
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
      findings.push({
        file: filePath,
        line: roundedFirstLine.get(token),
        severity: "major",
        rule: "uniform-border-radius",
        description: "uniform border-radius",
        snippet: `${token} used ${count}× with no variation`,
        fix: "vary radii by element role — cards, pills, inputs want different shapes",
      });
      break; // one finding per file is enough
    }
  }

  return findings;
}

// --- Main ----------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  const targetRaw = positional[0] || ".";
  const target = path.resolve(targetRaw);

  let stat;
  try {
    stat = await fs.stat(target);
  } catch (err) {
    process.stderr.write(`error: cannot read path "${targetRaw}": ${err.message}\n`);
    process.exit(2);
  }

  let files = [];
  if (stat.isDirectory()) {
    files = await walk(target);
  } else if (stat.isFile()) {
    const ext = path.extname(target);
    if (SCAN_EXTENSIONS.has(ext)) files = [target];
  }

  const findings = [];
  for (const f of files) {
    let content;
    try {
      content = await fs.readFile(f, "utf8");
    } catch {
      continue;
    }
    const fileFindings = scanFile(f, content);
    findings.push(...fileFindings);
  }

  const flaggedFiles = new Set(findings.map((f) => f.file));
  const critical = findings.filter((f) => f.severity === "critical").length;
  const major = findings.filter((f) => f.severity === "major").length;

  const summary = {
    files_scanned: files.length,
    files_flagged: flaggedFiles.size,
    critical,
    major,
  };

  if (jsonFlag) {
    const out = {
      summary,
      findings: findings.map((f) => ({
        file: path.relative(process.cwd(), f.file),
        line: f.line,
        severity: f.severity,
        rule: f.rule,
        snippet: f.snippet,
        fix: f.fix,
      })),
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } else {
    const displayPath = path.relative(process.cwd(), target) || ".";
    process.stdout.write(
      `${bold("ui-craft anti-slop detector")}\n` +
        `Scanned ${summary.files_scanned} files in ./${displayPath}` +
        ` (${summary.files_flagged} of them flagged)\n\n`,
    );
    // Group findings by file
    const byFile = new Map();
    for (const f of findings) {
      if (!byFile.has(f.file)) byFile.set(f.file, []);
      byFile.get(f.file).push(f);
    }
    for (const [file, fs_] of byFile) {
      const rel = path.relative(process.cwd(), file);
      for (const f of fs_) {
        const dot = f.severity === "critical" ? red("●") : yellow("●");
        process.stdout.write(`${rel}:${f.line}\n`);
        process.stdout.write(`  ${dot} ${f.description}  ${dim("— " + f.snippet)}\n`);
        process.stdout.write(`     ${dim("fix: " + f.fix)}\n\n`);
      }
    }
    if (findings.length === 0) {
      process.stdout.write(dim("No anti-slop patterns found. \n"));
    } else {
      process.stdout.write(
        `${summary.files_flagged} files flagged. ${critical} critical, ${major} major.\n`,
      );
    }
  }

  process.exit(findings.length > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`error: ${err.stack || err.message}\n`);
  process.exit(2);
});
