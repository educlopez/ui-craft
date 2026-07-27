// Anti-slop rule definitions. Split out of the former monolithic
// scripts/detect.mjs — no behavior change, no rule reordering.
// Rule order is significant (affects finding output order) — preserved exactly.

// --- Rules ---------------------------------------------------------------

/**
 * @typedef {Object} Rule
 * @property {string} id            - slug identifier, also the machine key
 * @property {"critical"|"major"|"warn"} severity - default severity
 * @property {string} description   - short human label
 * @property {string} fix           - one-line suggestion
 * @property {"line"|"file"} [scope] - "line" (default) or "file"
 * @property {(line: string, ctx: Object) => false | true | { snippet: string }} [match]
 * @property {(content: string, lines: string[], ctx: Object) =>
 *            Array<{ line: number, snippet: string }>} [matchFile]
 * @property {(content: string) => { content: string, fixed: number }} [fix_apply]
 */

// Per-line rules are checked once per line. File-level rules return an array
// of findings (line is just the first occurrence for reporting).

/** @type {Rule[]} */
/**
 * True when a match is being *displayed* rather than applied.
 *
 * Docs pages, changelogs, config examples and before/after diffs all legitimately
 * contain the exact strings these rules hunt for. Flagging a line that shows what
 * was removed is worse than a false positive: it penalises the page for
 * documenting the fix.
 *
 * Deliberately conservative — it only skips when the enclosure is positively
 * identifiable on the same line.
 */
/**
 * Hue in degrees for a CSS colour literal, or null when it cannot be read.
 *
 * The class-name rules below only ever saw Tailwind (`from-purple-500`). The same
 * design decision written as `#a855f7` was invisible, which meant a page could be
 * built entirely of gradient tells and pass clean. Reading the value closes that.
 */
export function cssHue(value) {
  let v = value.trim().toLowerCase();

  const hsl = v.match(/^hsla?\(\s*([\d.]+)(deg)?/);
  if (hsl) return Number(hsl[1]) % 360;

  const oklch = v.match(/^oklch\(\s*[\d.%]+\s+[\d.]+\s+([\d.]+)/);
  if (oklch) return Number(oklch[1]) % 360;

  let r, g, b;
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  } else {
    const rgb = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
    if (!rgb) return null;
    [r, g, b] = rgb.slice(1, 4).map((n) => Number(n) / 255);
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  // Near-greys have no meaningful hue, and treating them as one produces noise.
  if (d < 0.12) return null;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return (h + 360) % 360;
}

/** Colour literals inside a CSS gradient function on this line. */
export function gradientStops(line) {
  const fn = line.match(/(?:linear|radial|conic)-gradient\(([^()]*(?:\([^()]*\)[^()]*)*)\)/i);
  if (!fn) return null;
  const stops = fn[1].match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/g);
  return stops ? { raw: fn[0], stops } : null;
}

/** Walk out to the enclosing CSS declaration block, so multi-line blocks are visible. */
export function enclosingBlock(ctx, maxLines = 40) {
  if (!ctx || !ctx.lines || typeof ctx.lineIdx !== "number") return "";
  const { lines, lineIdx } = ctx;
  let start = lineIdx;
  for (let i = lineIdx; i >= Math.max(0, lineIdx - maxLines); i--) {
    start = i;
    if (lines[i].includes("{")) break;
  }
  let end = lineIdx;
  for (let i = lineIdx; i < Math.min(lines.length, lineIdx + maxLines); i++) {
    end = i;
    if (lines[i].includes("}")) break;
  }
  return lines.slice(start, end + 1).join("\n");
}

/** A selector that names itself as the counter-example rather than the intent. */
const DEMO_SELECTOR = /(?:^|[\s.#[="'-])(?:slop|bad|before|dont|do-not|anti-?pattern|worse|naive|unstyled)(?:[\s.#\]="'-]|$)/i;

/**
 * Comment spans in a file, as `[lineIdx, startCol, endCol]`, computed once and cached
 * on ctx.
 *
 * A pattern inside a comment is being described, not shipped, and the rules kept
 * flagging their own documentation: a note explaining why we avoid `transition-all`
 * tripped the transition-all rule, and a comment saying an image needs width and
 * height tripped the image rule. Three separate rules fired on their own prose in one
 * afternoon.
 *
 * Handles the block forms that span lines — `/* … *\/` for CSS and JS, `{/* … *\/}`
 * for JSX, `<!-- … -->` for markup — and `//` to end of line.
 */
function commentSpans(ctx) {
  if (!ctx || !Array.isArray(ctx.lines)) return [];
  if (ctx.__commentSpans) return ctx.__commentSpans;

  const spans = [];
  let open = null; // "block" for /* … */, "html" for <!-- … -->

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    let j = 0;

    while (j <= line.length) {
      if (open) {
        const close = open === "html" ? "-->" : "*/";
        const at = line.indexOf(close, j);
        if (at === -1) {
          spans.push([i, j, line.length]);
          break;
        }
        spans.push([i, j, at + close.length]);
        j = at + close.length;
        open = null;
        continue;
      }

      const candidates = [
        [line.indexOf("/*", j), "block"],
        [line.indexOf("<!--", j), "html"],
        [lineCommentStart(line, j), "line"],
      ].filter(([pos]) => pos !== -1);
      if (!candidates.length) break;
      candidates.sort((a, b) => a[0] - b[0]);

      const [pos, kind] = candidates[0];
      if (kind === "line") {
        spans.push([i, pos, line.length]);
        break;
      }
      open = kind;
      j = pos;
    }
  }

  ctx.__commentSpans = spans;
  return spans;
}

/**
 * Where a `//` comment starts, or -1.
 *
 * Deliberately conservative: a `//` preceded by `:` is a URL scheme, and one inside a
 * quoted string is data. Suppressing a real finding is worse than missing a comment,
 * so anything ambiguous is treated as code.
 */
function lineCommentStart(line, from) {
  for (let i = from; i < line.length - 1; i++) {
    if (line[i] !== "/" || line[i + 1] !== "/") continue;
    if (i > 0 && line[i - 1] === ":") continue;
    const before = line.slice(0, i);
    const quotes = (before.match(/["'`]/g) || []).length;
    if (quotes % 2 === 1) continue; // inside a string
    return i;
  }
  return -1;
}

/** Whether a column on a line falls inside a comment. */
function insideComment(ctx, lineIdx, col) {
  for (const [i, start, end] of commentSpans(ctx)) {
    if (i === lineIdx && col >= start && col < end) return true;
  }
  return false;
}

/** Whether a line has nothing outside a comment on it. */
function lineIsAllComment(ctx, lineIdx) {
  const line = ctx.lines?.[lineIdx];
  if (typeof line !== "string" || line.trim() === "") return false;
  let covered = 0;
  for (const [i, start, end] of commentSpans(ctx)) {
    if (i === lineIdx) covered += end - start;
  }
  if (!covered) return false;
  // JSX wraps its comments in braces, which sit outside the span.
  const outside = line.length - covered;
  return outside <= (line.match(/^\s*/)?.[0].length ?? 0) + 2;
}

export function isDisplayedNotApplied(line, snippet, ctx) {
  // A pattern inside a comment is being described, not shipped.
  if (ctx && Array.isArray(ctx.lines) && typeof ctx.lineIdx === "number") {
    if (lineIsAllComment(ctx, ctx.lineIdx)) return true;
    if (snippet) {
      const at = line.indexOf(snippet);
      if (at !== -1 && insideComment(ctx, ctx.lineIdx, at)) return true;
    }
  }

  // A CSS rule whose selector names itself as the bad example is a demonstration.
  // Our own landing peels slop off pass by pass with `[data-q="slop"]`, and the
  // detector flagged the page for rendering what it exists to argue against —
  // the CSS analogue of flagging a diff for showing the line it removed.
  //
  // The declaration is usually not on the selector's line, so walk out to the
  // enclosing block and read the selector there. Checking only the handed line
  // caught `.x[data-q="slop"] { … }` on one line and missed every block whose
  // selector sat above the declaration.
  if (DEMO_SELECTOR.test(line.split("{")[0])) return true;
  const block = enclosingBlock(ctx);
  if (block) {
    const brace = block.indexOf("{");
    if (brace !== -1 && DEMO_SELECTOR.test(block.slice(0, brace))) return true;
  }

  // A line marked as deleted is showing what a diff took out.
  if (/<(?:del|s)\b/i.test(line)) return true;
  if (/class\s*=\s*["'][^"']*\b(?:rem|removed|deleted|diff-del|diff-rem|line-del)\b/i.test(line)) {
    return true;
  }

  if (!snippet) return false;
  const at = line.indexOf(snippet);
  if (at === -1) return false;

  // Inside <code>/<pre>/<kbd>/<samp>: the pattern is quoted, not in effect.
  const lower = line.toLowerCase();
  for (const tag of ["code", "pre", "kbd", "samp"]) {
    const open = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    let m;
    while ((m = open.exec(line))) {
      const start = m.index + m[0].length;
      const closeAt = lower.indexOf(`</${tag}>`, start);
      const end = closeAt === -1 ? line.length : closeAt;
      if (at >= start && at < end) return true;
    }
  }
  return false;
}

/**
 * Sticky header detection for ARIA tables.
 *
 * A grid-based table built with `role="table"` / `role="row"` /
 * `role="columnheader"` has no `<thead>` or `<th>` for the selector checks above
 * to find, so a compliant sticky header row read as missing. Resolve the header
 * row's own class instead, and look for a rule on it that pins the row.
 *
 * Both orders matter: `class` may sit either side of `role` on the same tag.
 */
/**
 * Every authored font size in a file, in px, with responsive restatements of the
 * same step removed.
 *
 * Declarations inside `@media` are a second spelling of a step that already
 * exists, not a new step, so they are dropped before counting — otherwise a
 * properly responsive file looks like it has twice the ladder it has.
 */
export function fontSizeLadder(content) {
  // Drop media/container query bodies. Non-greedy to the matching close is not
  // possible with a regex, so this walks braces.
  let stripped = "";
  let i = 0;
  while (i < content.length) {
    const at = content.slice(i).search(/@(?:media|container|supports)[^{]*\{/);
    if (at === -1) { stripped += content.slice(i); break; }
    stripped += content.slice(i, i + at);
    let j = i + at;
    while (j < content.length && content[j] !== "{") j++;
    let depth = 0;
    for (; j < content.length; j++) {
      if (content[j] === "{") depth++;
      else if (content[j] === "}") { depth--; if (depth === 0) { j++; break; } }
    }
    i = j;
  }

  const sizes = new Map();
  const decl = /font-size\s*:\s*([0-9.]+)(px|rem|em)\b/gi;
  let m;
  while ((m = decl.exec(stripped)) !== null) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    // rem/em against the 16px root the scenes and most resets use.
    const px = m[2].toLowerCase() === "px" ? n : n * 16;
    const key = Math.round(px * 10) / 10;
    sizes.set(key, (sizes.get(key) || 0) + 1);
  }
  return sizes;
}

function hasStickyAriaHeaderRow(content) {
  const headerCell = content.search(/role\s*=\s*["']columnheader["']/);
  if (headerCell === -1) return false;

  // Nearest opening tag before the first header cell that declares role="row".
  const before = content.slice(0, headerCell);
  const rows = [...before.matchAll(/<[a-zA-Z][^>]*role\s*=\s*["']row["'][^>]*>/g)];
  if (rows.length === 0) return false;
  const headerRow = rows[rows.length - 1][0];

  const classAttr = headerRow.match(/\bclass(?:Name)?\s*=\s*["']([^"']+)["']/);
  if (!classAttr) return false;

  // Tailwind spelling needs no CSS lookup.
  const tokens = classAttr[1].split(/\s+/).filter(Boolean);
  if (tokens.includes("sticky") && tokens.some((t) => /^top-0$/.test(t))) return true;

  return tokens.some((cls) => {
    const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // A rule whose selector mentions this class and whose body pins the element.
    return new RegExp(`\\.${escaped}(?![\\w-])[^{}]*\\{[^}]*position:\\s*sticky`).test(content);
  });
}

export const rules = [
  // ===== ORIGINAL 11 RULES (unchanged behavior) =====
  {
    id: "transition-all",
    severity: "critical",
    description: "transition: all",
    fix: "list specific properties (transform, opacity, background-color)",
    scope: "line",
    match(line) {
      // `no-transition-all` (the rule's own name) must not match as a substring:
      // any page that names the rule would otherwise be unclean.
      const re = /\btransition:\s*["']?all\b|(?<![\w-])transition-all\b/;
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

      // Same tell written as raw CSS. Mirrors the utility-class strictness above:
      // one stop in the purple/violet/indigo band AND one in the cyan/sky/blue band.
      const grad = gradientStops(line);
      if (grad) {
        const hues = grad.stops.map(cssHue).filter((h) => h !== null);
        const warm = hues.some((h) => h >= 255 && h <= 330);
        const cool = hues.some((h) => h >= 170 && h < 255);
        if (warm && cool) {
          return { snippet: grad.raw.slice(0, 90) };
        }
      }
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
        // Same exception in utility-class form: a small, tracked label.
        const small = /\btext-xs\b|\btext-\[1[0-3]px\]/.test(mJsx[0]);
        if (small && /\btracking-(?:wide|wider|widest|\[)/.test(mJsx[0])) return false;
        if (/\btext-xs\b/.test(mJsx[0])) return false;
        return { snippet: mJsx[0].slice(0, 80) };
      }
      const css = /h[1-4][^{]*\{[^}]*text-transform:\s*uppercase/;
      const mCss = line.match(css);
      if (mCss) {
        // SKILL.md, Quick Start rule 1: "Exception: 11-13px category labels with
        // wide tracking". A tracked 11px mono label is the documented exception,
        // not a shouting heading.
        const size = line.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
        const tracked = /letter-spacing:\s*[^;}]+/.test(line);
        if (size && Number(size[1]) <= 13 && tracked) return false;
        return { snippet: "text-transform: uppercase" };
      }
      return false;
    },
  },
  {
    id: "gradient-text-metric",
    severity: "major",
    description: "gradient text on large number",
    fix: "solid color for metrics — gradients fight legibility",
    scope: "line",
    match(line, ctx) {
      if (/\bbg-clip-text\b/.test(line) && /\btext-transparent\b/.test(line)) {
        const big = line.match(/\btext-(?:[4-9]xl|[5-9]\dxl|\[[5-9]\d+px\])\b/);
        if (big) return { snippet: `bg-clip-text text-transparent ${big[0]}` };
        return false;
      }

      // CSS form: clipping a gradient to the glyphs. The declarations are usually
      // spread over several lines, so judge the whole block rather than one line.
      if (!/background-clip:\s*text/i.test(line)) return false;
      const block = enclosingBlock(ctx) || line;
      const transparent =
        /(?:-webkit-)?text-fill-color:\s*transparent/i.test(block) ||
        /\bcolor:\s*transparent/i.test(block);
      const gradient = /(?:linear|radial|conic)-gradient\(/i.test(block);
      if (transparent && gradient) return { snippet: "background-clip: text + transparent fill" };
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
      if (m) return { snippet: m[0].slice(0, 60) };

      // An emoji that is the entire content of an element is being used as an icon,
      // whatever markup surrounds it. Emoji inside a sentence is left alone.
      // Only code points with default *emoji* presentation. `\u2713` (check mark),
      // arrows and the rest of the dingbat block are typographic glyphs, not emoji,
      // and flagging a status tick would be wrong.
      const asIcon = line.match(
        /<(\w+)[^>]*>\s*([\u{1F300}-\u{1FAFF}\u{2728}\u{26A1}\u{2705}\u{274C}\u{2B50}\u{2757}\u{2764}]{1,3})\s*<\/\1>/u,
      );
      if (asIcon) return { snippet: asIcon[0].slice(0, 60) };
      return false;
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
        // Read the whole element, not a fixed window. A pretty-printed multi-path
        // SVG runs well past two lines, so a two-line lookahead saw only the icon
        // and reported buttons whose visible label sat further down.
        let body = afterOpen;
        let closed = /<\/button>/.test(afterOpen);
        const MAX_ELEMENT_LINES = 60;
        for (let j = i + 1; !closed && j < Math.min(lines.length, i + MAX_ELEMENT_LINES); j++) {
          body += "\n" + lines[j];
          if (/<\/button>/.test(lines[j])) closed = true;
        }
        body = body.slice(0, body.indexOf("</button>") === -1 ? body.length : body.indexOf("</button>"));

        // A nested aria-label (on a wrapper inside the button) still names it.
        if (labelRe.test(body)) continue;

        // Any real text content anywhere inside the element is the accessible name.
        const stripped = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (stripped && /[A-Za-z0-9]{2,}/.test(stripped)) continue;

        // Otherwise it is genuinely icon-only. Report against the first inner node.
        const firstInner = (body.trim().split("\n")[0] || "").trim() || inner;
        if (!iconOnlyRe.test(firstInner)) continue;
        inner = firstInner;
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
        /<th\b[^>]*\bclassName\s*=\s*["'][^"']*\btop-0\b[^"']*\bsticky\b/.test(content) ||
        hasStickyAriaHeaderRow(content)
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

  // ===== NEW v0.5 RULES =====
  {
    id: "a11y/streaming-no-live-region",
    severity: "critical",
    description: "streaming content without aria-live region",
    fix: "Streaming content without an `aria-live` region is invisible to screen readers. Wrap the streaming output (or append updates to a parallel hidden region) with `<div aria-live='polite' aria-atomic='false' role='status'>`. See `references/ai-chat.md` and `references/accessibility.md`.",
    scope: "file",
    matchFile(content, lines) {
      // Streaming signals.
      const hasUseStream = /\buseStream\s*\(|\buseChat\s*\(/.test(content);
      const hasReadableStreamReader =
        /\bReadableStream\b/.test(content) &&
        /\.getReader\s*\(/.test(content) &&
        /set[A-Z]\w*\s*\(/.test(content);
      const hasEventSource = /\bnew\s+EventSource\s*\(/.test(content);
      const hasTokenAppend =
        /setMessages[\s\S]{0,200}?\[\s*\.\.\.\s*prev/.test(content) &&
        /(for\s+await|for\s*\([^)]*of\s+[^)]*(?:stream|reader)\b)/i.test(content);
      // State update inside `for await (const chunk of stream)` loop.
      let hasForAwaitStateUpdate = false;
      const forAwaitRe = /for\s+await\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+([^)]+)\)\s*\{([\s\S]*?)\}/g;
      let fm;
      while ((fm = forAwaitRe.exec(content)) !== null) {
        const iter = fm[1];
        const body = fm[2];
        if (!/stream|chunk|reader|response/i.test(iter)) continue;
        if (/set[A-Z]\w*\s*\(|\.update\s*\(|\.push\s*\(/.test(body)) {
          hasForAwaitStateUpdate = true;
          break;
        }
      }
      const hasStreaming =
        hasUseStream ||
        hasReadableStreamReader ||
        hasEventSource ||
        hasTokenAppend ||
        hasForAwaitStateUpdate;
      if (!hasStreaming) return [];

      // Live-region signals.
      const liveRegionRe =
        /aria-live\s*=|role\s*=\s*["'](?:status|alert)["']|aria-atomic\s*=|aria-relevant\s*=|<LiveRegion\b|<Announce\b|<AriaLive\b/;
      if (liveRegionRe.test(content)) return [];

      // Find the first streaming-signal line for reporting.
      let ln = 1;
      for (let i = 0; i < lines.length; i++) {
        if (
          /\buseStream\s*\(|\buseChat\s*\(|\bnew\s+EventSource\s*\(|\.getReader\s*\(|for\s+await\s*\(/.test(
            lines[i],
          )
        ) {
          ln = i + 1;
          break;
        }
      }
      return [
        {
          line: ln,
          snippet: "streaming output with no aria-live / role=status region in file",
        },
      ];
    },
  },
  {
    id: "forms/autocomplete-missing",
    severity: "major",
    description: "input without autocomplete attribute",
    fix: "Inputs for email / tel / password / address / credit card need an `autocomplete` attribute so browsers can autofill. Pick the right value from the standardized list (`email`, `tel`, `new-password`, `current-password`, `cc-number`, `given-name`, etc.). Improves mobile UX and a11y.",
    scope: "line",
    match(line, ctx) {
      // Skip if no <input on this line.
      if (!/<input\b/i.test(line)) return false;

      // Pull the first <input …> tag on the line.
      const tagMatch = line.match(/<input\b[^>]*\/?>?/i);
      if (!tagMatch) return false;
      const tag = tagMatch[0];

      // Skip input types that never want autocomplete.
      const typeMatch = tag.match(/\btype\s*=\s*["']([^"']+)["']/i);
      const type = typeMatch ? typeMatch[1].toLowerCase() : null;
      if (
        type &&
        ["hidden", "submit", "button", "checkbox", "radio", "file", "reset", "image"].includes(type)
      ) {
        return false;
      }

      // Triggers: type matches a well-known autocomplete type.
      const typeTriggers = ["email", "tel", "password", "url"];
      const typeHit = type && typeTriggers.includes(type);

      // Triggers: name hints at autocomplete.
      let nameHit = false;
      const nameMatch = tag.match(/\bname\s*=\s*["']([^"']+)["']/i);
      if (nameMatch) {
        const name = nameMatch[1];
        const nameRe =
          /^(?:email|tel|phone|password|first.?name|last.?name|address|city|zip|postal|country|cc.?(?:number|name|exp|cvc|csc)|card)$/i;
        if (nameRe.test(name)) nameHit = true;
      }

      if (!typeHit && !nameHit) return false;

      // Build a small window of the current + next 2 lines to handle wrapped attributes.
      let window = tag;
      const lines2 = ctx && ctx.lines;
      const idx = ctx && ctx.lineIdx;
      if (lines2 && typeof idx === "number") {
        // If the tag is not self-closed on this line, peek forward.
        if (!/>/.test(tag)) {
          for (let j = idx + 1; j < Math.min(lines2.length, idx + 3); j++) {
            window += "\n" + lines2[j];
            if (/>/.test(lines2[j])) break;
          }
        } else {
          // Still peek 2 lines forward for safety when attrs span lines.
          for (let j = idx + 1; j < Math.min(lines2.length, idx + 3); j++) {
            window += "\n" + lines2[j];
          }
        }
      }

      if (/\bautocomplete\s*=/i.test(window)) return false;

      return { snippet: tag.slice(0, 100) };
    },
  },
  {
    id: "a11y/heading-order-skip",
    severity: "major",
    description: "heading levels skip (e.g. h1 → h3)",
    fix: "Screen readers use heading hierarchy to build a document outline. A page's first heading is typically `<h1>`, then `<h2>` for sections, then `<h3>` for subsections — no skips.",
    scope: "file",
    matchFile(content, lines) {
      // Collect the sequence of heading opens with their line numbers.
      const seq = [];
      const headingRe = /<h([1-6])\b/g;
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
      while ((m = headingRe.exec(content)) !== null) {
        seq.push({ level: parseInt(m[1], 10), line: lineFor(m.index) });
      }
      if (seq.length < 2) return [];

      // Walk for first "going down" skip.
      for (let i = 1; i < seq.length; i++) {
        const prev = seq[i - 1].level;
        const cur = seq[i].level;
        // Skip happens when going deeper by more than one level.
        if (cur > prev + 1) {
          return [
            {
              line: seq[i].line,
              snippet: `h${prev} \u2192 h${cur} without h${prev + 1}`,
            },
          ];
        }
      }
      return [];
    },
  },
  {
    id: "layout/image-height-from-attribute",
    severity: "major",
    description: "image sized on one axis, so the height attribute decides the other",
    fix: "The `width`/`height` attributes are presentational hints, and an author who sets only `width` (or `aspect-ratio`) in CSS leaves the attribute's `height` in force — the image renders stretched. Add `height: auto` to the rule.",
    scope: "file",
    matchFile(content, lines, ctx) {
      if (![".html", ".astro", ".vue", ".svelte", ".css", ".tsx", ".jsx"].includes(ctx.ext)) return [];
      // Only worth checking when some image actually carries a height attribute.
      if (!/<img\b[^>]*\bheight\s*=/i.test(content)) return [];

      const findings = [];
      // A declaration block that targets an image and sizes it horizontally.
      const block = /([^{}]*(?:img|image|photo|shot|thumb|media|picture|figure)[^{}]*)\{([^}]*)\}/gi;
      let m;
      while ((m = block.exec(content)) !== null) {
        const [selector, body] = [m[1], m[2]];
        if (/^\s*@/.test(selector)) continue;
        const sizesWidth = /(?:^|;|\s)width\s*:/.test(body) || /(?:^|;|\s)aspect-ratio\s*:/.test(body);
        const setsHeight = /(?:^|;|\s)(?:height|max-height|min-height)\s*:/.test(body);
        if (!sizesWidth || setsHeight) continue;
        // `object-fit: cover` is the case most often missed, but any sizing counts.
        findings.push({
          line: content.slice(0, m.index).split("\n").length,
          snippet: `${selector.trim().slice(0, 60)} sets width but not height`,
        });
      }
      return findings;
    },
  },
  {
    id: "type/crowded-ladder",
    severity: "major",
    description: "too many distinct font sizes for one surface",
    fix: "A size nobody can tell from its neighbour is not a distinction, it is indecision — and a page with a dozen of them reads as a dashboard whatever it is. Four to six steps carry any surface: one label size, one body size, one intermediate, one section head, one display. Collapse the rest onto the nearest step, and cut half-pixel neighbours entirely.",
    scope: "file",
    matchFile(content, lines, ctx) {
      if (![".html", ".astro", ".vue", ".svelte", ".css", ".scss"].includes(ctx.ext)) return [];
      const sizes = fontSizeLadder(content);
      // Below this there is no ladder to judge.
      if (sizes.size < 8) return [];
      const list = [...sizes.keys()].sort((a, b) => a - b);
      return [{
        line: 1,
        snippet: `${sizes.size} distinct font sizes: ${list.join(" · ")}`,
      }];
    },
  },
  {
    id: "type/display-not-separated",
    severity: "minor",
    description: "the largest size is not separated from the ladder, so nothing reads as display",
    fix: "Display type is made by the gap, not the size. Measured across surfaces whose typography is the reason people copy them, the largest size sits 2.7 to 4 times the next size down, with nothing in between. A largest size only fractionally above its neighbour reads as slightly bigger text, never as a headline. Either raise it or remove the step below it.",
    scope: "file",
    matchFile(content, lines, ctx) {
      if (![".html", ".astro", ".vue", ".svelte", ".css", ".scss"].includes(ctx.ext)) return [];
      const sizes = fontSizeLadder(content);
      if (sizes.size < 4) return [];
      const list = [...sizes.keys()].sort((a, b) => b - a);
      const [largest, next] = list;
      // Only meaningful once something is trying to be display type at all.
      if (largest < 32) return [];
      const ratio = largest / next;
      if (ratio >= 2) return [];
      return [{
        line: 1,
        snippet: `largest ${largest}px is only ${ratio.toFixed(2)}x the next step (${next}px)`,
      }];
    },
  },
  {
    id: "type/bold-display",
    severity: "minor",
    description: "display type set bold",
    fix: "At display size the size is already the emphasis, and weight on top of it is what separates a landing page from a poster made in a hurry. The surfaces worth measuring set their largest type at 400 to 510, never 700. Drop the display weight to medium and let the scale do the work.",
    scope: "file",
    matchFile(content, lines, ctx) {
      if (![".html", ".astro", ".vue", ".svelte", ".css", ".scss"].includes(ctx.ext)) return [];
      const findings = [];
      const block = /([^{}]+)\{([^{}]*)\}/g;
      let m;
      while ((m = block.exec(content)) !== null) {
        const [selector, body] = [m[1], m[2]];
        if (/@(media|supports|keyframes|font-face|layer|container)/.test(selector)) continue;
        const size = /font-size\s*:\s*([0-9.]+)px/i.exec(body);
        const weight = /font-weight\s*:\s*([0-9]{3})\b/i.exec(body);
        if (!size || !weight) continue;
        if (Number(size[1]) < 40 || Number(weight[1]) < 700) continue;
        findings.push({
          line: content.slice(0, m.index).split("\n").length,
          snippet: `${selector.trim().split("\n").pop().trim().slice(0, 40)} sets ${size[1]}px at ${weight[1]}`,
        });
      }
      return findings;
    },
  },
  {
    id: "css/duplicate-declaration",
    severity: "major",
    description: "the same property declared twice in one block, so the later value wins silently",
    fix: "Two values for one property in one rule means one of them is dead. Delete the one you did not mean — usually the first, since the later declaration wins. This is how light-on-dark text ends up dark: a `color` kept from an earlier version sits below the intended one and quietly overrides it.",
    scope: "file",
    matchFile(content, lines, ctx) {
      if (![".html", ".astro", ".vue", ".svelte", ".css", ".scss"].includes(ctx.ext)) return [];

      const findings = [];
      const block = /([^{}]+)\{([^{}]*)\}/g;
      let m;
      while ((m = block.exec(content)) !== null) {
        const [selector, body] = [m[1], m[2]];
        // At-rules wrap other blocks; their body is not a declaration list.
        if (/@(media|supports|keyframes|font-face|layer|container)/.test(selector)) continue;

        const seen = new Map();
        for (const decl of body.split(";")) {
          const at = decl.indexOf(":");
          if (at === -1) continue;
          const prop = decl.slice(0, at).trim().toLowerCase();
          // Custom properties are legitimately redeclared, and a shorthand followed
          // by a longhand (`margin` then `margin-top`) is a normal narrowing.
          if (!prop || prop.startsWith("--") || /[^a-z-]/.test(prop)) continue;
          const value = decl.slice(at + 1).trim();
          if (!value) continue;
          const prev = seen.get(prop);
          if (prev !== undefined && prev !== value) {
            findings.push({
              line: content.slice(0, m.index).split("\n").length,
              snippet: `${selector.trim().split("\n").pop().trim().slice(0, 40)} sets ${prop} twice: ${prev} then ${value}`,
            });
          }
          seen.set(prop, value);
        }
      }
      return findings;
    },
  },
  {
    id: "perf/image-no-dimensions",
    severity: "major",
    description: "<img> without width/height or aspect-ratio",
    fix: "Images without explicit `width`+`height` or `aspect-ratio` cause CLS (Cumulative Layout Shift) while loading. Set both `width` and `height` — then pair them with `height: auto` in CSS, because the attributes are presentational hints and the `height` one wins over `aspect-ratio` and over an auto height, which stretches the image. Or use CSS `aspect-ratio` with `width` and `height: auto`. Affects Core Web Vitals.",
    scope: "line",
    match(line) {
      // Match each <img …> tag on the line (there may be more than one).
      const re = /<img\b[^>]*>/gi;
      let m;
      while ((m = re.exec(line)) !== null) {
        const tag = m[0];

        // Skip inline data-URI images (icons, sprites, negligible CLS).
        if (/\bsrc\s*=\s*["']data:/i.test(tag)) continue;

        // Skip decorative / aria-hidden images.
        if (/\baria-hidden\s*=\s*["']true["']/i.test(tag)) continue;
        if (/\brole\s*=\s*["']presentation["']/i.test(tag)) continue;
        if (/\balt\s*=\s*["']\s*["']/i.test(tag)) continue;

        // Passes: width AND height attributes.
        const hasWidth = /\bwidth\s*=/.test(tag);
        const hasHeight = /\bheight\s*=/.test(tag);
        if (hasWidth && hasHeight) continue;

        // Passes: inline style with aspect-ratio.
        if (/\bstyle\s*=\s*["'][^"']*aspect-ratio/i.test(tag)) continue;

        // Passes: Tailwind aspect-[…] / aspect-square / aspect-video / aspect-auto.
        if (/\b(?:class|className)\s*=\s*["'][^"']*\baspect-(?:\[|square|video|auto)/.test(tag)) {
          continue;
        }

        // Passes: explicit aspect-ratio attribute.
        if (/\baspect-ratio\s*=/.test(tag)) continue;

        return { snippet: tag.slice(0, 100) };
      }
      return false;
    },
  },
  {
    id: "copy/or-divider-caps",
    severity: "major",
    description: '"OR" divider shouting in caps',
    fix: 'Lowercase the divider — "or with email", "or continue with" — caps "OR" between auth options is the single most recognizable AI-generated form tell. See references/recipe-auth.md.',
    scope: "line",
    match(line, ctx) {
      // <option value="OR"> is Oregon; <abbr>OR</abbr> is legit markup.
      if (/<option\b|<abbr\b/i.test(line)) return false;
      // Only fire in auth-ish files: a password input or a sign-in/sign-up
      // signal somewhere in the file. Otherwise "OR" is legitimate text —
      // e.g. the Oregon abbreviation ("Portland, OR 97201").
      const fileText = ctx && Array.isArray(ctx.lines) ? ctx.lines.join("\n") : line;
      const isAuth =
        /type\s*=\s*["']password["']|type\s*=\s*\{[^}]*password[^}]*\}/i.test(fileText) ||
        /sign[-\s]?(?:in|up)/i.test(fileText);
      if (!isAuth) return false;
      // Bare uppercase OR as the only text content of an element:
      // <span>OR</span>, <div ...> OR </div>, >— OR —<
      const m = line.match(/>(\s*[—–-]*\s*)OR(\s*[—–-]*\s*)</);
      if (m) return { snippet: m[0].slice(0, 60) };
      return false;
    },
  },
  {
    id: "auth/brand-flood-panel",
    severity: "major",
    scope: "file",
    description: "full-bleed saturated brand panel on auth screen",
    fix: "A wall of pure accent color next to a sign-in form is the loudest AI tell on auth screens and blows the entire accent budget on decoration. Use a tinted neutral surface (gray-1 of the theme) with ONE proof asset. See references/recipe-auth.md.",
    matchFile(content, lines) {
      // Only fire on auth-ish files: a password input or auth autocomplete.
      const isAuth =
        /type\s*=\s*["']password["']/.test(content) ||
        /autocomplete\s*=\s*["'](?:current-password|new-password)["']/i.test(content);
      if (!isAuth) return [];

      // Full-height container painted with a saturated accent (Tailwind 500-700
      // range or a gradient) — the "brand flood" panel.
      const flood =
        /\b(?:min-h-screen|h-screen|h-full|inset-0)\b[^"']*\bbg-(?:indigo|purple|violet|blue|fuchsia|rose|pink|emerald|teal|cyan|sky|orange|red)-[5-7]00\b|\bbg-(?:indigo|purple|violet|blue|fuchsia|rose|pink|emerald|teal|cyan|sky|orange|red)-[5-7]00\b[^"']*\b(?:min-h-screen|h-screen|h-full|inset-0)\b|\b(?:min-h-screen|h-screen|h-full)\b[^"']*\bbg-gradient-to-/;

      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(flood);
        if (m) {
          return [{ line: i + 1, snippet: m[0].slice(0, 100) }];
        }
      }
      return [];
    },
  },
  {
    id: "layout/eyebrow-flood",
    severity: "major",
    scope: "file",
    description: "uppercase tracked eyebrow label above every section",
    fix: "Ration eyebrows to at most one per three sections — an uppercase wide-tracked micro-label above every heading is section grammar stamped from a template. Drop most of them; the headline alone is enough. See references/recipe-landing.md.",
    matchFile(content, lines) {
      // Count lines carrying the eyebrow CSS signature: `uppercase` combined
      // with wide tracking in the same class list. Table headers are a
      // legitimate use, so <th>/<thead> lines are skipped.
      const eyebrow =
        /\buppercase\b[^"'`]*\btracking-(?:wide|widest|\[)|\btracking-(?:wide|widest|\[[^\]]*\])[^"'`]*\buppercase\b/;
      const hits = [];
      for (let i = 0; i < lines.length; i++) {
        if (/<th\b|<thead\b/i.test(lines[i])) continue;
        const m = lines[i].match(eyebrow);
        if (m) hits.push({ line: i + 1, snippet: m[0].slice(0, 80) });
      }
      // One deliberate kicker is voice; four or more in one file is grammar.
      return hits.length >= 4 ? [hits[0]] : [];
    },
  },
  {
    id: "copy/scroll-cue",
    severity: "major",
    description: 'decorative scroll cue ("Scroll to explore")',
    fix: 'Delete it — the user is looking at the hero and knows what scrolling is. If content below the fold matters, make the fold composition imply continuation instead of labeling it. See references/recipe-landing.md.',
    scope: "line",
    match(line) {
      const m = line.match(/>([^<>{}]{1,40})</);
      if (!m) return false;
      const text = m[1].trim().toLowerCase();
      const cue =
        /^[↓⌄▼∨]?\s*scroll(?:\s+(?:down|to\s+\w+(?:\s+\w+)?))?\s*[↓⌄▼∨]?$/;
      if (cue.test(text)) return { snippet: m[0].slice(0, 60) };
      return false;
    },
  },
  {
    id: "copy/section-number-eyebrow",
    severity: "major",
    description: 'numbered section eyebrow ("01 · About")',
    fix: 'Name the section in plain language or drop the label — zero-padded section counters ("01 · About", "02 / Process") are decorative numbering, not information. Numbers earn their place only when the content is a real ordered sequence. See references/recipe-landing.md.',
    scope: "line",
    match(line) {
      // Table cells legitimately contain hyphenated codes/dates ("07-Eleven
      // Corp", "03-Jan Invoice") — same exemption as layout/eyebrow-flood.
      if (/<td\b|<th\b|<thead\b/i.test(line)) return false;
      // Zero-padded ordinal + a SPACED separator + a word: "01 · About",
      // "001 / Capabilities". Require whitespace around the separator so
      // tightly-hyphenated tokens ("07-Eleven", "03-Jan") don't match —
      // this rule targets padded counters, not compound words.
      const m = line.match(/>\s*0\d{1,2}\s+[·\/—–-]\s+[A-Za-z]/);
      if (m) return { snippet: m[0].slice(0, 60) };
      return false;
    },
  },
  {
    id: "copy/duplicate-cta-intent",
    severity: "major",
    scope: "file",
    description: "two CTA labels with the same intent on one page",
    fix: 'Pick ONE label per intent and reuse it everywhere on the page — "Get in touch" in the hero and "Let\'s talk" in the footer are the same action wearing two names, which dilutes the conversion path. See references/copy.md.',
    matchFile(content, lines) {
      const INTENT_SETS = [
        ["get in touch", "contact us", "let's talk", "lets talk", "let's chat",
         "reach out", "talk to us", "start a project", "start something"],
        ["get started", "get started free", "sign up", "sign up free",
         "try free", "try for free", "start free", "start for free",
         "start free trial", "create account", "start your free trial"],
        ["view work", "see work", "view selected work", "see selected work",
         "view projects", "browse projects", "see our work", "view portfolio"],
      ];
      // Collect visible text nodes and which line they appear on. Scan the
      // full content so multiline JSX (`<a\n  ...>\n  Get in touch\n</a>`)
      // still yields its text node.
      const seen = new Map(); // normalized label -> first line
      for (const m of content.matchAll(/>([^<>{}]{2,40})</g)) {
        const text = m[1].trim().toLowerCase().replace(/\s+/g, " ").replace(/[→›»]\s*$/, "").trim();
        if (text && !seen.has(text)) {
          const lineNo = content.slice(0, m.index).split("\n").length;
          seen.set(text, lineNo);
        }
      }
      for (const set of INTENT_SETS) {
        const found = set.filter((label) => seen.has(label));
        if (found.length >= 2) {
          return [{
            line: seen.get(found[1]),
            snippet: `"${found[0]}" + "${found[1]}" are the same intent`,
          }];
        }
      }
      return [];
    },
  },
  {
    id: "copy/em-dash-flood",
    severity: "major",
    scope: "file",
    description: "em-dash flood in UI copy (3+ in visible text)",
    fix: "Em dashes are prose grammar leaking into interface grammar — and a recognizable generated-copy tell. Restructure with a period, colon, or separate elements; keep at most one or two deliberate em dashes per surface. See references/copy.md.",
    matchFile(content, lines, ctx) {
      // Only markup-capable files: visible copy lives in text nodes there.
      // Plain .ts/.js/.css files use em dashes in comments too often to gate.
      if (![".tsx", ".jsx", ".vue", ".svelte", ".html", ".astro"].includes(ctx.ext)) return [];
      // Count em dashes inside visible text nodes only (>text<), so code
      // comments, string keys, and attribute values never contribute.
      //
      // Entity spellings count too: `&mdash;` and `&#8212;` render as the same
      // glyph, so a page could clear this rule by encoding every one of them.
      const DASH = /—|&mdash;|&#(?:8212|x2014);/gi;
      let count = 0;
      let firstLine = 0;
      let firstSnippet = "";
      for (const m of content.matchAll(/>([^<>{}]*(?:—|&mdash;|&#(?:8212|x2014);)[^<>{}]*)</gi)) {
        count += (m[1].match(DASH) || []).length;
        if (!firstLine) {
          firstLine = content.slice(0, m.index).split("\n").length;
          firstSnippet = m[1].trim().slice(0, 80);
        }
      }
      if (count < 3) return [];
      return [{ line: firstLine, snippet: `${count} em dashes in visible copy — first: "${firstSnippet}"` }];
    },
  },
];

