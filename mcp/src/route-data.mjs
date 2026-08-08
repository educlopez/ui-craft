/**
 * route-data.mjs
 * Retrieval index for the `route_task` tool: the corpus of references, commands and MCP
 * tools, plus the stopword list and synonym map that make a natural-language prompt reach
 * the right entry even when the words do not line up with our filenames.
 *
 * ESM module (not JSON) so it inlines cleanly into the published bundle and loads from
 * source on every Node version without import attributes. Edit here; this is the source
 * of truth for routing.
 *
 * WHY this file and not frontmatter in the 33 reference files: the published MCP ships
 * `files: ["dist"]` and cannot read `skills/` at a user's install, so the index has to be
 * bundled either way. Keeping keywords in one place instead of 33 frontmatters means there
 * is nothing to drift.
 *
 * English only. ui-craft ships worldwide, so picking one additional language would be
 * arbitrary — whichever it was, it would turn a hand-maintained index into an N-locale
 * maintenance surface for the benefit of one audience. Accents are still stripped on input,
 * so a word typed with diacritics matches its plain form here.
 *
 * Regen-on-edit: this is hand-maintained (v1 — no generator). When a reference or command
 * is added, renamed or removed, add it here in the same commit. `route-task.test.mjs`
 * asserts the corpus covers every entry the skill routes to, so a missing one fails CI.
 *
 * Boundary: this file holds POINTERS and vocabulary only — never a design rule. Every
 * subjective rule lives in SKILL.md and the references it points at.
 */

// ─── Stopwords ───────────────────────────────────────────────────────────────
// Grammar plus the task filler that carries no routing signal. Without the filler half,
// "build"/"make"/"need" become concepts that every candidate in the corpus matches
// equally, which flattens the ranking instead of sharpening it.

export const STOPWORDS = new Set([
  // Grammar
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these',
  'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'to', 'of', 'in', 'on',
  'at', 'by', 'for', 'with', 'without', 'from', 'into', 'onto', 'about', 'as', 'it',
  'its', 'my', 'me', 'our', 'ours', 'your', 'yours', 'you', 'i', 'we', 'they', 'them',
  'their', 'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must',
  'do', 'does', 'did', 'done', 'have', 'has', 'had', 'not', 'no', 'nor', 'so', 'up',
  'out', 'over', 'under', 'more', 'most', 'less', 'some', 'any', 'each', 'one', 'two',
  'also', 'very', 'just', 'like', 'there', 'here', 'when', 'while', 'where', 'how',
  'what', 'which', 'who', 'why', 'all', 'both', 'either', 'other', 'another', 'same',
  // Task filler
  'build', 'building', 'make', 'making', 'create', 'creating', 'add', 'adding', 'need',
  'needs', 'want', 'wants', 'help', 'please', 'give', 'get', 'let', 'lets', 'work',
  'working', 'use', 'using', 'new', 'good', 'nice', 'quick', 'quickly', 'thing',
  'things', 'stuff', 'something', 'anything', 'everything', 'now', 'again', 'maybe',
  'probably', 'basically', 'really', 'actually', 'kinda', 'sorta', 'whatnot', 'etc',
  'plus', 'okay', 'ok', 'yeah', 'thanks',
]);

// ─── Synonym map ─────────────────────────────────────────────────────────────
// concept → the words that should reach it. This is the whole reason the tool exists:
// "analytics" must find recipe-dashboard.md even though nothing in that filename says
// analytics. Expansion is one hop only — no transitive chains, so adding an alias can
// never quietly re-route an unrelated concept.

export const SYNONYMS = {
  dashboard: ['analytics', 'kpi', 'kpis', 'metrics', 'metric', 'panel', 'panels',
    'admin', 'reporting', 'reports', 'report', 'stats', 'statistics', 'overview',
    'console', 'backoffice', 'back-office', 'monitoring', 'observability', 'insights'],
  landing: ['marketing', 'homepage', 'home', 'hero', 'fold', 'above-the-fold', 'promo',
    'saas', 'website', 'site', 'pricing', 'testimonials', 'testimonial', 'features',
    'cta', 'waitlist', 'launch-page', 'logos', 'faq'],
  auth: ['login', 'log-in', 'signin', 'sign-in', 'signup', 'sign-up', 'register',
    'registration', 'session', 'password', 'passwords', 'passkey', 'otp', 'magic-link',
    'oauth', 'sso', 'authentication', 'onboarding', 'verification'],
  forms: ['form', 'input', 'inputs', 'field', 'fields', 'validation', 'validate',
    'validating', 'invalid', 'checkout', 'wizard', 'stepper', 'multi-step', 'autosave',
    'select', 'checkbox', 'radio', 'textarea', 'submit', 'fieldset'],
  tokens: ['token', 'variables', 'variable', 'design-system', 'scale', 'scales',
    'primitives', 'primitive', 'semantic', 'palette', 'ramp', 'custom-properties'],
  color: ['colour', 'colours', 'colors', 'accent', 'hue', 'oklch', 'hsl', 'lch',
    'contrast', 'dark', 'darkmode', 'dark-mode', 'light', 'lightmode', 'apca',
    'saturation', 'chroma', 'gamut', 'p3', 'tint', 'shade'],
  typography: ['type', 'typeface', 'typefaces', 'font', 'fonts', 'tracking', 'leading',
    'kerning', 'letterspacing', 'letter-spacing', 'text', 'heading', 'headings',
    'headline', 'serif', 'sans', 'monospace', 'weight', 'weights', 'lineheight',
    'line-height', 'readability', 'measure'],
  motion: ['animation', 'animations', 'animate', 'animated', 'transition', 'transitions',
    'easing', 'ease', 'spring', 'springs', 'stagger', 'keyframes', 'choreography',
    'micro-interaction', 'microinteraction', 'hover', 'gesture', 'gestures', 'scroll',
    'parallax', 'reveal', 'entrance', 'exit'],
  layout: ['spacing', 'grid', 'grids', 'composition', 'rhythm', 'alignment', 'align',
    'hierarchy', 'gestalt', 'whitespace', 'margins', 'margin', 'padding', 'gutter',
    'columns', 'stack', 'flexbox', 'asymmetry', 'balance'],
  accessibility: ['a11y', 'aria', 'wcag', 'keyboard', 'screenreader', 'screen-reader',
    'focus', 'focus-visible', 'contrast', 'tabindex', 'semantics', 'semantic-html',
    'inclusive', 'landmark', 'alt-text', 'skip-link'],
  responsive: ['mobile', 'tablet', 'desktop', 'breakpoint', 'breakpoints', 'adaptive',
    'fluid', 'viewport', 'touch', 'thumb', 'container-query', 'container-queries',
    'small-screen', 'narrow', 'zoom'],
  dataviz: ['chart', 'charts', 'graph', 'graphs', 'plot', 'visualization',
    'visualisation', 'sparkline', 'sparklines', 'axis', 'axes', 'legend', 'series',
    'tufte', 'heatmap', 'histogram', 'scatter', 'bar-chart', 'line-chart'],
  tables: ['table', 'tables', 'rows', 'row', 'columns', 'datagrid', 'data-grid',
    'sorting', 'sortable', 'pagination', 'paginated', 'virtualization', 'virtualized',
    'spreadsheet'],
  components: ['component', 'components', 'button', 'buttons', 'modal', 'modals',
    'dialog', 'menu', 'menus', 'dropdown', 'card', 'cards', 'nav', 'navbar',
    'navigation', 'sidebar', 'tooltip', 'toast', 'badge', 'tabs', 'popover', 'search',
    'accordion', 'avatar', 'chip'],
  copy: ['copywriting', 'microcopy', 'wording', 'voice', 'tone', 'label', 'labels',
    'message', 'messages', 'messaging', 'placeholder', 'helper-text', 'terminology'],
  states: ['state', 'loading', 'skeleton', 'spinner', 'empty', 'empty-state', 'offline',
    'partial', 'conflict', 'edge-case', 'edge-cases', 'unhappy', 'pending', 'stale',
    'retry', 'timeout'],
  review: ['critique', 'audit', 'auditing', 'assess', 'assessment', 'evaluate',
    'feedback', 'findings', 'inspect', 'check', 'checking', 'second-opinion',
    'code-review', 'walkthrough'],
  polish: ['refine', 'refinement', 'detail', 'details', 'finish', 'finishing', 'craft',
    'quality', 'nitpick', 'micro', 'last-mile', 'fit-and-finish'],
  performance: ['perf', 'fps', 'janky', 'jank', 'lag', 'laggy', 'slow', 'sluggish',
    'frames', 'framerate', 'compositor', 'gpu', 'reflow', 'repaint', 'layout-thrash',
    'optimize', 'optimise', 'stutter', 'dropped-frames'],
  brief: ['identity', 'positioning', 'audience', 'principles', 'principle', 'intent',
    'constraints', 'constraint', 'memory', 'context', 'product-context', 'brand'],
  spec: ['specification', 'wireframe', 'wireframes', 'blueprint', 'plan', 'structure',
    'inventory', 'content-inventory', 'lo-fi', 'mockup'],
  metadata: ['meta', 'seo', 'title', 'titles', 'description', 'canonical', 'og',
    'opengraph', 'open-graph', 'favicon', 'favicons', 'social-card', 'sharing',
    'structured-data', 'schema-org', 'sitemap', 'noindex'],
  sound: ['audio', 'sfx', 'sound-effects', 'haptics', 'haptic', 'vibration', 'webaudio',
    'web-audio', 'chime', 'mute'],
  stack: ['gsap', 'threejs', 'three', 'webgl', 'shader', 'shaders', 'framer',
    'framer-motion', 'r3f', 'canvas', 'lottie', 'rive', 'scrolltrigger', 'webgpu'],
  ai: ['chat', 'llm', 'streaming', 'stream', 'agent', 'agentic', 'assistant', 'prompt',
    'citations', 'tool-call', 'tool-calls', 'generative', 'copilot', 'completion'],
  theme: ['themes', 'preset', 'presets', 'skin', 'reskin', 'branding', 'whitelabel',
    'white-label', 'multi-tenant', 'tenant'],
  redesign: ['rebuild', 'modernize', 'modernise', 'refresh', 'revamp', 'migrate',
    'migration', 'legacy', 'facelift', 'overhaul'],
  simplify: ['distill', 'reduce', 'simplify', 'cut', 'trim', 'declutter', 'noise',
    'bloat', 'overbuilt', 'busy', 'cluttered', 'minimalise'],
  extract: ['refactor', 'refactoring', 'dedupe', 'deduplicate', 'duplication',
    'duplicated', 'repeated', 'componentize', 'abstract', 'reuse', 'reusable', 'dry'],
  variance: ['bolder', 'bold', 'personality', 'expressive', 'signature', 'distinctive',
    'generic', 'samey', 'boring', 'bland', 'slop', 'template-y', 'cookie-cutter',
    'ai-looking', 'forgettable'],
  quieter: ['calm', 'calmer', 'restrained', 'subtle', 'understated', 'tone-down',
    'quiet', 'minimal', 'minimalist', 'noisy', 'loud', 'shouty'],
  ship: ['finalize', 'finalise', 'merge', 'merging', 'pr', 'pull-request', 'preship',
    'pre-ship', 'gate', 'release', 'production', 'deploy', 'deployment', 'launch'],
  harden: ['hardening', 'robust', 'robustness', 'i18n', 'l10n', 'rtl', 'localization',
    'localisation', 'resilience', 'resilient', 'production-ready', 'battle-tested'],
  heuristic: ['nielsen', 'usability', 'score', 'scoring', 'rubric', 'grade', 'graded',
    'persona', 'personas', 'benchmark-score'],
  css: ['modern-css', 'view-transitions', 'view-transition', 'anchor-positioning',
    'popover', 'container-queries', 'starting-style', 'clip-path', 'mask', 'mask-image',
    'nesting', 'has-selector', 'subgrid'],
  inspiration: ['reference', 'references', 'examples', 'example', 'archetype',
    'archetypes', 'patterns', 'pattern', 'mature', 'benchmark', 'competitor', 'prior-art'],
};

// ─── Repair intent ───────────────────────────────────────────────────────────
// Words that mean "something already exists and is wrong". Their job is to rule a move
// OUT: you do not build a new surface to fix an existing one, so a constructive first
// move (/craft, /sddesign, /shape) is suppressed when one is present, and a pass is
// preferred over a reference's build-time default.
//
// Matched against the raw prompt, not the concepts, because several of these are
// stopwords by the time ranking runs. Overlap with SYNONYMS is expected and correct —
// "slow" both names the performance concept and says something is broken. The two
// mechanisms read different inputs, so an overlapping word contributes to both.

export const REPAIR_MARKERS = [
  'fix', 'fixes', 'fixing', 'broken', 'break', 'breaks', 'breaking', 'bug', 'bugs',
  'buggy', 'wrong', 'issue', 'issues', 'problem', 'problems', 'slow', 'sluggish',
  'janky', 'jank', 'laggy', 'ugly', 'off', 'weird', 'awkward', 'improve', 'improves',
  'improving', 'better', 'review', 'audit', 'critique', 'regression', 'regressions',
  'fails', 'failing', 'failed', 'jumps', 'jumping', 'shifts', 'shifting', 'flickers',
  'flickering', 'stutters', 'stuttering', 'unreadable', 'inconsistent', 'messy',
  'cluttered', 'confusing', 'hurts', 'wrongly', 'misaligned',
];

// ─── Corpus ──────────────────────────────────────────────────────────────────
// `keywords` are what someone might actually type. `contains` is the constituents
// trick: an entry carries the names of the parts it is built from, so a recipe
// surfaces on "pricing block" or "KPI grid" even though its title says neither.
// `tier` mirrors SKILL.md's reference tiers; `first_move` is the command to run
// when this entry wins, which is what turns a result list into a recommendation.

export const CORPUS = [
  // ── Entry points ──────────────────────────────────────────────────────────
  {
    id: 'start', kind: 'command', name: 'start', path: 'commands/start.md',
    summary: 'Front door — reads the project (framework, tokens, brief, spec, harness) and routes to the right next step.',
    // Not 'onboard': it stems into the auth concept's 'onboarding' alias, which routed
    // every signup prompt to the CLI front door. User onboarding is a surface; /start is
    // a front door. Same word, unrelated senses.
    keywords: ['start', 'begin', 'front-door', 'setup', 'unsure', 'orient'],
    contains: [], first_move: '/start',
  },
  {
    id: 'sddesign', kind: 'command', name: 'sddesign', path: 'commands/sddesign.md',
    summary: 'Full spec-driven pipeline: brief → tokens → shape → craft → converge → ship.',
    keywords: ['sddesign', 'pipeline', 'end-to-end', 'spec-driven', 'full-pipeline'],
    contains: ['brief', 'tokens', 'shape', 'craft', 'finalize'], first_move: '/sddesign',
  },
  {
    id: 'craft', kind: 'command', name: 'craft', path: 'commands/craft.md',
    summary: 'One-shot build of a complete surface from an outcome recipe.',
    keywords: ['craft', 'surface', 'page', 'screen', 'one-shot', 'oneshot'],
    contains: ['dashboard', 'landing', 'auth', 'hero', 'pricing', 'metric-cards'], first_move: '/craft <surface>',
  },

  // ── Pre-build ─────────────────────────────────────────────────────────────
  {
    id: 'brief', kind: 'command', name: 'brief', path: 'commands/brief.md',
    summary: "Write or update the project's durable design brief at .ui-craft/brief.md.",
    keywords: ['brief'], contains: ['principles', 'audience', 'voice', 'constraints'], first_move: '/brief',
  },
  {
    id: 'tokens-cmd', kind: 'command', name: 'tokens', path: 'commands/tokens.md',
    summary: "Audit or establish the project's 3-layer token spine.",
    keywords: ['tokens'], contains: ['primitive', 'semantic', 'component-tokens', 'radius', 'shadows'], first_move: '/tokens',
  },
  {
    id: 'shape', kind: 'command', name: 'shape', path: 'commands/shape.md',
    summary: 'Wireframe-first pass — ASCII layout + state list + content inventory before code.',
    keywords: ['shape', 'wireframe', 'ascii', 'sketch', 'lo-fi'],
    contains: ['spec', 'state-lattice', 'content-inventory'], first_move: '/shape',
  },
  {
    id: 'remember', kind: 'command', name: 'remember', path: 'commands/remember.md',
    summary: 'Record a learned design constraint from a correction into the project brief.',
    keywords: ['remember', 'learned', 'constraint', 'correction', 'preference', 'never-again'],
    contains: [], first_move: '/remember',
  },

  // ── Focused passes ────────────────────────────────────────────────────────
  {
    id: 'animate', kind: 'command', name: 'animate', path: 'commands/animate.md',
    summary: 'Motion pass — adds purposeful animation or removes excess, honoring MOTION_INTENSITY.',
    keywords: ['animate', 'motion'], contains: ['easing', 'duration', 'stagger', 'reduced-motion'], first_move: '/animate',
  },
  {
    id: 'delight', kind: 'command', name: 'delight', path: 'commands/delight.md',
    summary: 'Adds one or two memorable micro-interactions.',
    keywords: ['delight', 'memorable', 'micro-interaction', 'playful', 'charm', 'easter-egg'],
    contains: ['hover', 'copy-specificity'], first_move: '/delight',
  },
  {
    id: 'typeset', kind: 'command', name: 'typeset', path: 'commands/typeset.md',
    summary: 'Typography pass — font choice, modular scale, tracking, leading, weight hierarchy.',
    keywords: ['typeset', 'typography'], contains: ['scale', 'tracking', 'leading'], first_move: '/typeset',
  },
  {
    id: 'colorize', kind: 'command', name: 'colorize', path: 'commands/colorize.md',
    summary: 'Color pass — one accent at 3-5 intentional placements, or reduces an overloaded palette.',
    keywords: ['colorize', 'colorise', 'color'], contains: ['accent-budget', 'palette', 'dark-mode'], first_move: '/colorize',
  },
  {
    id: 'adapt', kind: 'command', name: 'adapt', path: 'commands/adapt.md',
    summary: 'Responsive pass — breakpoints, touch targets, safe areas, fluid type.',
    keywords: ['adapt', 'responsive'], contains: ['breakpoints', 'touch-targets', 'safe-areas'], first_move: '/adapt',
  },
  {
    id: 'clarify', kind: 'command', name: 'clarify', path: 'commands/clarify.md',
    summary: 'UX copy review across buttons, errors, empty states, form hints.',
    keywords: ['clarify', 'copy'], contains: ['errors', 'empty-states', 'ctas', 'voice'], first_move: '/clarify',
  },
  {
    id: 'extract-cmd', kind: 'command', name: 'extract', path: 'commands/extract.md',
    summary: 'Refactor pass — extracts repeated class combos and markup into components and tokens.',
    keywords: ['extract'], contains: ['components', 'tokens'], first_move: '/extract',
  },
  {
    id: 'distill', kind: 'command', name: 'distill', path: 'commands/distill.md',
    summary: "Reduction pass — cuts content, structure, visuals and dead code that doesn't answer a user question.",
    keywords: ['distill', 'simplify'], contains: [], first_move: '/distill',
  },
  {
    id: 'bolder', kind: 'command', name: 'bolder', path: 'commands/bolder.md',
    summary: 'Amplify personality — raises layout variance and motion, strengthens type and one signature detail.',
    keywords: ['bolder', 'variance'], contains: ['design-variance', 'signature-detail'], first_move: '/bolder',
  },
  {
    id: 'quieter', kind: 'command', name: 'quieter', path: 'commands/quieter.md',
    summary: 'Tone down visual noise — lowers variance and motion, simplifies layout and color weight.',
    keywords: ['quieter'], contains: [], first_move: '/quieter',
  },
  {
    id: 'polish', kind: 'command', name: 'polish', path: 'commands/polish.md',
    summary: 'Final craft pass applying compound polish details — micro-typography, states, optical fixes.',
    keywords: ['polish'], contains: ['tabular-nums', 'curly-quotes', 'optical-alignment'], first_move: '/polish',
  },
  {
    id: 'redesign', kind: 'command', name: 'redesign', path: 'commands/redesign.md',
    summary: 'Redesign an existing site without losing brand, IA or SEO — audit, preserve list, scope.',
    keywords: ['redesign'], contains: ['audit', 'preserve-list'], first_move: '/redesign',
  },

  // ── Review / gates ────────────────────────────────────────────────────────
  {
    id: 'critique', kind: 'command', name: 'critique', path: 'commands/critique.md',
    summary: 'Design lens critique — visual hierarchy, clarity, anti-slop. No code changes.',
    keywords: ['critique', 'review'], contains: ['hierarchy', 'anti-slop'], first_move: '/critique',
  },
  {
    id: 'audit', kind: 'command', name: 'audit', path: 'commands/audit.md',
    summary: 'Technical UI audit — a11y, performance, responsive. Prioritized findings table.',
    keywords: ['audit', 'accessibility', 'performance'], contains: ['a11y', 'perf', 'responsive'], first_move: '/audit',
  },
  {
    id: 'heuristic', kind: 'command', name: 'heuristic', path: 'commands/heuristic.md',
    summary: "Scored heuristic critique — Nielsen's 10 + 6 design laws + optional persona walkthrough.",
    keywords: ['heuristic'], contains: ['nielsen', 'personas', 'rubric'], first_move: '/heuristic',
  },
  {
    id: 'harden', kind: 'command', name: 'harden', path: 'commands/harden.md',
    summary: 'Production-readiness pass — the full non-happy-path matrix plus i18n and edge cases.',
    keywords: ['harden'], contains: ['loading', 'error', 'offline', 'i18n'], first_move: '/harden',
  },
  {
    id: 'unhappy', kind: 'command', name: 'unhappy', path: 'commands/unhappy.md',
    summary: 'State-first pass — inventories and implements every non-happy state.',
    keywords: ['unhappy', 'states'], contains: ['state-lattice'], first_move: '/unhappy',
  },
  {
    id: 'finalize', kind: 'command', name: 'finalize', path: 'commands/finalize.md',
    summary: 'Pre-ship gate — detector, brief and token verification, 10-pass finish bar.',
    keywords: ['finalize', 'ship'], contains: ['finish-bar', 'detector'], first_move: '/finalize',
  },

  // ── References — Tier 1 ───────────────────────────────────────────────────
  {
    id: 'ref-brief', kind: 'reference', name: 'brief', path: 'references/brief.md', tier: 1,
    summary: 'Design brief format — product identity, intent, audience, voice, constraints, learned constraints.',
    keywords: ['brief'], contains: ['principles', 'self-correction'], first_move: '/brief',
  },
  {
    id: 'ref-craft-intent', kind: 'reference', name: 'craft-intent', path: 'references/craft-intent.md', tier: 1,
    summary: 'Craft Read, DESIGN_VARIANCE, signature bets, product vs marketing build patterns.',
    keywords: ['variance', 'craft', 'intent', 'signature', 'craft-read'], contains: ['design-variance', 'signature-bet'], first_move: '/craft',
  },
  {
    id: 'ref-tokens', kind: 'reference', name: 'tokens', path: 'references/tokens.md', tier: 1,
    summary: '3-layer token spine — primitive → semantic → component, both modes intentional.',
    keywords: ['tokens'], contains: ['radius-scale', 'spacing-scale', 'z-index', 'shadows'], first_move: '/tokens',
  },
  {
    id: 'ref-inspiration', kind: 'reference', name: 'inspiration', path: 'references/inspiration.md', tier: 1,
    summary: 'Pattern archetypes from mature SaaS, signature details, what mature interfaces never do.',
    keywords: ['inspiration'], contains: ['archetypes', 'reference-values'], first_move: null,
  },
  {
    id: 'ref-accessibility', kind: 'reference', name: 'accessibility', path: 'references/accessibility.md', tier: 1,
    summary: 'WCAG, keyboard, focus, forms, ARIA, touch targets, checklist.',
    keywords: ['accessibility'], contains: ['focus-visible', 'aria', 'keyboard', 'touch-targets'], first_move: '/audit',
  },
  {
    id: 'ref-color', kind: 'reference', name: 'color', path: 'references/color.md', tier: 1,
    summary: 'Color strategy, palettes, dark mode, accent budget, OKLCH scales, APCA.',
    keywords: ['color'], contains: ['accent-budget', 'oklch', 'apca', 'dark-mode'], first_move: '/colorize',
  },
  {
    id: 'ref-layout', kind: 'reference', name: 'layout', path: 'references/layout.md', tier: 1,
    summary: 'Gestalt grouping, spacing rhythm, hierarchy ratios, composition strategies, optical center.',
    keywords: ['layout'], contains: ['gestalt', 'spacing-rhythm', 'optical-center', 'nested-radii'], first_move: null,
  },

  // ── References — Tier 2 (surface-specific) ────────────────────────────────
  {
    id: 'ref-spec', kind: 'reference', name: 'spec', path: 'references/spec.md', tier: 2,
    summary: 'Durable composition spec at .ui-craft/spec.md — the "what", written by /shape.',
    keywords: ['spec'], contains: [], first_move: '/shape',
  },
  {
    id: 'ref-recipe-dashboard', kind: 'reference', name: 'recipe-dashboard', path: 'references/recipe-dashboard.md', tier: 2,
    summary: 'Outcome recipe: 3 named dashboard compositions, shell spec, build order, acceptance bar.',
    keywords: ['dashboard', 'recipe'],
    contains: ['metric-cards', 'kpi-grid', 'sidebar', 'charts', 'data-tables', 'filters', 'toolbar', 'sparklines'],
    first_move: '/craft dashboard',
  },
  {
    id: 'ref-recipe-landing', kind: 'reference', name: 'recipe-landing', path: 'references/recipe-landing.md', tier: 2,
    summary: 'Outcome recipe: product-forward / message-forward / proof-forward compositions, section grammar, pricing rules.',
    keywords: ['landing', 'recipe'],
    contains: ['hero', 'pricing-table', 'testimonials', 'logo-wall', 'feature-rows', 'faq', 'footer', 'social-proof', 'eyebrow'],
    first_move: '/craft landing',
  },
  {
    id: 'ref-recipe-auth', kind: 'reference', name: 'recipe-auth', path: 'references/recipe-auth.md', tier: 2,
    summary: 'Outcome recipe: split-panel / centered-card auth compositions, form contract, sign-up deltas.',
    keywords: ['auth', 'recipe'],
    contains: ['sign-in-form', 'oauth-buttons', 'password-field', 'magic-link'],
    first_move: '/craft auth',
  },
  {
    id: 'ref-themes', kind: 'reference', name: 'themes', path: 'references/themes.md', tier: 2,
    summary: '4 named production token presets — Graphite, Porcelain, Carbon, Signal.',
    keywords: ['theme'], contains: ['graphite', 'porcelain', 'carbon', 'signal'], first_move: '/tokens',
  },
  {
    id: 'ref-dashboard', kind: 'reference', name: 'dashboard', path: 'references/dashboard.md', tier: 2,
    summary: 'Dashboard patterns — metric cards, charts, tables, sidebar, filters, density, signal-to-noise tiers.',
    keywords: ['dashboard', 'tables'],
    contains: ['metric-cards', 'status-dots', 'proportion-bars', 'virtualization', 'scrollbar-gutter',
      'density', 'overflow-x', 'sticky-header'],
    first_move: '/craft dashboard',
  },
  {
    id: 'ref-forms', kind: 'reference', name: 'forms', path: 'references/forms.md', tier: 2,
    summary: 'Validation timing, progressive disclosure, multi-step wizards, autosave, optimistic submit.',
    keywords: ['forms'], contains: ['validation-timing', 'wizard', 'autosave'], first_move: null,
  },
  {
    id: 'ref-components', kind: 'reference', name: 'components', path: 'references/components.md', tier: 2,
    summary: 'Component anatomy contracts — buttons, menus, modals, search, cards, nav bar.',
    keywords: ['components'], contains: ['button', 'menu', 'modal', 'search', 'card', 'navbar'], first_move: null,
  },
  {
    id: 'ref-ai-chat', kind: 'reference', name: 'ai-chat', path: 'references/ai-chat.md', tier: 2,
    summary: 'Streaming contract, 7-state affordance model for AI surfaces, tool traces, citations, generative UI.',
    keywords: ['ai'], contains: ['streaming', 'tool-traces', 'citations', 'feedback'], first_move: null,
  },
  {
    id: 'ref-review', kind: 'reference', name: 'review', path: 'references/review.md', tier: 2,
    summary: 'Critique methodology, Polish Pass, common issues, component craft, Craft Report format.',
    keywords: ['review', 'polish'], contains: ['polish-pass', 'craft-report'], first_move: '/critique',
  },
  {
    id: 'ref-finish-bar', kind: 'reference', name: 'finish-bar', path: 'references/finish-bar.md', tier: 2,
    summary: '10-pass finishing protocol before merge.',
    keywords: ['ship', 'polish'], contains: ['ten-passes'], first_move: '/finalize',
  },
  {
    id: 'ref-loops', kind: 'reference', name: 'loops', path: 'references/loops.md', tier: 2,
    summary: 'Loop engine — read→evaluate→fix-one→re-evaluate→stop, plus 3 presets. Converge instead of one-shot.',
    keywords: ['loops', 'loop', 'converge', 'convergence', 'iterate', 'iteration'], contains: [], first_move: null,
  },
  {
    id: 'ref-principles', kind: 'reference', name: 'principles-catalog', path: 'references/principles-catalog.md', tier: 2,
    summary: '42 example design principles across 8 product categories — conversation seed for /brief.',
    keywords: ['brief'], contains: ['principles'], first_move: '/brief',
  },

  // ── References — Tier 3 (foundations) ─────────────────────────────────────
  {
    id: 'ref-typography', kind: 'reference', name: 'typography', path: 'references/typography.md', tier: 3,
    summary: 'Type scale, font choice, readability, weight — scoped per script and role.',
    keywords: ['typography'], contains: ['modular-scale', 'font-loading', 'optical-sizing'], first_move: '/typeset',
  },
  {
    id: 'ref-motion', kind: 'reference', name: 'motion', path: 'references/motion.md', tier: 3,
    summary: 'Decision ladder, duration + easing scales, interaction rules, choreography, motion-gap audit, rendering performance.',
    keywords: ['motion', 'performance'], contains: ['easing-scale', 'duration-scale', 'flip', 'reduced-motion', 'motion-budget'], first_move: '/animate',
  },
  {
    id: 'ref-modern-css', kind: 'reference', name: 'modern-css', path: 'references/modern-css.md', tier: 3,
    summary: 'View Transitions, scroll timelines, container queries, @starting-style, anchor positioning, mask-image fades.',
    keywords: ['css'], contains: ['view-transitions', 'container-queries', 'popover', 'anchor-positioning', 'mask-image', 'scrollbar-gutter'], first_move: null,
  },
  {
    id: 'ref-responsive', kind: 'reference', name: 'responsive', path: 'references/responsive.md', tier: 3,
    summary: 'Mobile/tablet/desktop, breakpoints, touch zones, thumb-first design.',
    keywords: ['responsive'], contains: ['breakpoints', 'thumb-zone', 'safe-areas'], first_move: '/adapt',
  },
  {
    id: 'ref-metadata', kind: 'reference', name: 'metadata', path: 'references/metadata.md', tier: 3,
    summary: 'Title/description/canonical consistency, social cards, noindex on staging, structured data honesty, favicons.',
    keywords: ['metadata'], contains: ['open-graph', 'canonical', 'favicons'], first_move: null,
  },
  {
    id: 'ref-copy', kind: 'reference', name: 'copy', path: 'references/copy.md', tier: 3,
    summary: 'Voice/tone matrix, reading level, terminology, inclusive language, errors, empty states, CTAs.',
    keywords: ['copy'], contains: ['voice-matrix', 'error-messages', 'empty-states', 'ctas'], first_move: '/clarify',
  },
  {
    id: 'ref-sound', kind: 'reference', name: 'sound', path: 'references/sound.md', tier: 3,
    summary: 'Web Audio, UI sound, appropriateness matrix. Rare — only when explicitly building audio feedback.',
    keywords: ['sound'], contains: ['web-audio'], first_move: null,
  },

  // ── References — Tier 4 (opt-in) ──────────────────────────────────────────
  {
    id: 'ref-stack', kind: 'reference', name: 'stack', path: 'references/stack.md', tier: 4,
    summary: 'Three.js / GSAP / Motion. OPT-IN ONLY — do not load unless the user chose one in Discovery.',
    keywords: ['stack'], contains: ['gsap', 'threejs', 'framer-motion', 'scrolltrigger'], first_move: null,
  },
  {
    id: 'ref-heuristics', kind: 'reference', name: 'heuristics', path: 'references/heuristics.md', tier: 4,
    summary: "Nielsen's 10 + 6 design laws (Fitts, Hick, Doherty, Cleveland-McGill, Miller, Tesler) + 1-5 rubric.",
    keywords: ['heuristic'], contains: ['nielsen', 'fitts', 'hicks'], first_move: '/heuristic',
  },
  {
    id: 'ref-personas', kind: 'reference', name: 'personas', path: 'references/personas.md', tier: 4,
    summary: '5 persona walkthroughs — first-timer, power, low-bandwidth, screen-reader, one-thumb.',
    keywords: ['heuristic'], contains: ['walkthroughs'], first_move: '/heuristic --persona=<name>',
  },
  {
    id: 'ref-state-design', kind: 'reference', name: 'state-design', path: 'references/state-design.md', tier: 4,
    summary: 'State lattice — idle / loading / empty / error / partial / conflict / offline.',
    keywords: ['states'], contains: ['state-lattice'], first_move: '/unhappy',
  },
  {
    id: 'ref-dataviz', kind: 'reference', name: 'dataviz', path: 'references/dataviz.md', tier: 4,
    summary: 'Cleveland-McGill perceptual hierarchy, chart selection matrix, ColorBrewer/Okabe-Ito palettes, Tufte, direct labeling.',
    keywords: ['dataviz'], contains: ['chart-selection', 'cleveland-mcgill', 'okabe-ito'], first_move: null,
  },
  {
    id: 'ref-agents', kind: 'reference', name: 'agents', path: 'references/agents.md', tier: 4,
    summary: 'Agent pack — design-reviewer + a11y-auditor roles, agent-vs-command guidance, parallel verify team.',
    keywords: ['review', 'agents', 'agent', 'subagent', 'delegate', 'parallel'],
    contains: ['design-reviewer', 'a11y-auditor'], first_move: null,
  },

  // ── MCP tools ─────────────────────────────────────────────────────────────
  {
    id: 'mcp-check-anti-slop', kind: 'mcp_tool', name: 'check_anti_slop', path: 'mcp:check_anti_slop',
    summary: 'Scans source for anti-slop violations — 43 deterministic rules, no taste.',
    keywords: ['variance', 'review'], contains: ['detector', 'lint'], first_move: 'check_anti_slop',
  },
  {
    id: 'mcp-tokens-lint', kind: 'mcp_tool', name: 'tokens_lint', path: 'mcp:tokens_lint',
    summary: 'Flags off-system token values — raw hex, off-scale radius/spacing, magic z-index.',
    keywords: ['tokens'], contains: ['hex', 'z-index'], first_move: 'tokens_lint',
  },
  {
    id: 'mcp-acceptance-bar', kind: 'mcp_tool', name: 'acceptance_bar', path: 'mcp:acceptance_bar',
    summary: 'Returns the deterministic acceptance checklist for a surface (dashboard, landing, auth, generic).',
    keywords: ['ship', 'review'], contains: ['checklist'], first_move: 'acceptance_bar',
  },
  {
    id: 'mcp-score-ui', kind: 'mcp_tool', name: 'score_ui', path: 'mcp:score_ui',
    summary: 'Composite UICraftScore 0-100 + grade across anti-slop, token discipline and static a11y.',
    keywords: ['heuristic', 'review'], contains: ['score', 'grade'], first_move: 'score_ui',
  },
  {
    id: 'mcp-fold-candidates', kind: 'mcp_tool', name: 'fold_candidates', path: 'mcp:fold_candidates',
    summary: 'Draws landing-fold composition classes, preferring ones this project has not spent. Variety cannot be requested in prose.',
    keywords: ['landing', 'variance'], contains: ['composition-class', 'fold'], first_move: 'fold_candidates',
  },
  {
    id: 'mcp-check-fold', kind: 'mcp_tool', name: 'check_fold', path: 'mcp:check_fold',
    summary: 'Renders a URL and reports what its fold actually is — screenshot, class, drift, invariants.',
    keywords: ['landing', 'review'], contains: ['screenshot', 'fold', 'invariants'], first_move: 'check_fold',
  },
];

/**
 * Surface classes the recipes do not help with.
 *
 * Reported alongside normal routing, never instead of it. A brief that mentions one of
 * these is rarely only that — "landing page for our iOS app" is our work, and the native
 * screens are not — so treating a match as a hard stop would refuse real jobs. The routing
 * still runs; this only adds the sentence the skill would otherwise leave unsaid.
 *
 * Without it the failure is confident rather than silent: "react native mobile screen"
 * routed to responsive.md and accessibility.md, which is web guidance for a native brief.
 * Triggers are phrases, not single words, for the same reason — "mobile" alone is ordinary
 * responsive vocabulary.
 */
export const OUT_OF_SCOPE = [
  {
    id: 'native-mobile',
    label: 'Native mobile screens',
    triggers: ['react native', 'swiftui', 'swift ui', 'uikit', 'jetpack compose', 'native screen', 'native app screen'],
    use: 'Apple HIG or Material directly — UI Craft covers web surfaces.',
  },
  {
    id: 'code-editor',
    label: 'Code-editor surfaces (syntax, gutters, diff views)',
    triggers: ['code editor', 'syntax highlight', 'syntax highlighting', 'monaco', 'codemirror', 'diff viewer', 'editor gutter'],
    use: 'Monaco or CodeMirror with their own theming API.',
  },
  {
    id: 'html-email',
    label: 'HTML email',
    // Deliberately no 'email client': a web email client is a web surface and squarely our
    // work. The trigger has to name the artefact being produced, not the subject matter.
    triggers: ['html email', 'email template', 'newsletter template', 'mjml', 'transactional email'],
    use: 'MJML or a dedicated email framework — the CSS rules here are void in mail clients.',
  },
  {
    id: 'realtime-collab',
    label: 'Realtime collaboration UI (presence, live cursors, conflict states)',
    triggers: ['live cursor', 'live cursors', 'presence indicator', 'collaborative editing', 'operational transform', 'multiplayer cursor'],
    use: 'A different problem class — the recipes assume a single actor.',
  },
];

export default { STOPWORDS, SYNONYMS, CORPUS, REPAIR_MARKERS, OUT_OF_SCOPE };
