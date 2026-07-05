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
export const rules = [
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
    id: "perf/image-no-dimensions",
    severity: "major",
    description: "<img> without width/height or aspect-ratio",
    fix: "Images without explicit `width`+`height` or `aspect-ratio` cause CLS (Cumulative Layout Shift) while loading. Set both `width` and `height` (the browser calculates aspect ratio) or use CSS `aspect-ratio: 16 / 9`. Affects Core Web Vitals.",
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
      let count = 0;
      let firstLine = 0;
      let firstSnippet = "";
      for (const m of content.matchAll(/>([^<>{}]*—[^<>{}]*)</g)) {
        count += (m[1].match(/—/g) || []).length;
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

