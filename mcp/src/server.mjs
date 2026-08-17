#!/usr/bin/env node
/**
 * ui-craft MCP server
 * Deterministic design-quality gate: 4 tools, stdio transport.
 *
 * SDK: @modelcontextprotocol/sdk v1.30.0
 * API: McpServer.registerTool() + StdioServerTransport
 *
 * Tools:
 *   route_task       — routes a natural-language prompt to the references/commands that cover it
 *   check_anti_slop  — flags anti-slop patterns via scripts/detect.mjs scan()
 *   tokens_lint      — flags off-system token values (color, radius, spacing, z-index)
 *   acceptance_bar   — returns acceptance checklist for a UI surface (distinction axis)
 *   ux_coverage      — returns the parts a screen archetype needs to be complete (completeness axis)
 *                      Separate axis from acceptance_bar and score_ui by design; report-only, never gates.
 *   score_ui         — composite UICraftScore (anti-slop + tokens + a11y) via evals/quality/score.mjs
 *                      Note: score_ui imports from ../../../evals/quality/ — consistent with
 *                      check_anti_slop importing ../../../scripts/ (same cross-package pattern).
 *                      mcp files:["src"] does NOT include evals/; available in repo-local server.
 *
 * Boundary: NO taste or judgment rules in this server.
 * All subjective/aesthetic rules live exclusively in SKILL.md.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkAntiSlop } from './tools/check-anti-slop.mjs';
import { tokensLint } from './tools/tokens-lint.mjs';
import { acceptanceBar } from './tools/acceptance-bar.mjs';
import { uxCoverage, KNOWN_ARCHETYPES } from './tools/ux-coverage.mjs';
import { scoreUiTool } from './tools/score-ui.mjs';
import { checkFold, foldCandidates } from './tools/fold.mjs';
import { routeTask } from './tools/route-task.mjs';
import { MCP_VERSION } from './version.mjs';

const server = new McpServer(
  {
    name: 'ui-craft',
    version: MCP_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Shared output schemas ───────────────────────────────────────────────────
// Every tool declares an outputSchema so hosts receive `structuredContent`
// alongside the JSON text block. Scanner plumbing (coverage, scan_policy) stays
// loose on purpose: those shapes belong to the scanners and must stay free to
// grow without breaking output validation.

const findingSchema = z.object({
  severity: z.string().optional(),
  rule: z.string().optional(),
  file: z.string().optional(),
  line: z.number().nullable().optional(),
  message: z.string().optional(),
});

const summarySchema = z.object({
  total: z.number(),
  errors: z.number(),
  warnings: z.number(),
  files_scanned: z.number().optional(),
  files_omitted: z.number().optional(),
});

// check_anti_slop and tokens_lint return the same envelope.
const scanOutputSchema = {
  version: z.string().optional(),
  findings: z.array(findingSchema),
  summary: summarySchema,
  coverage: z.unknown().optional(),
  scan_errors: z.array(z.unknown()).optional(),
  scan_policy: z.unknown().optional(),
  error: z.string().optional(),
};

const dimensionSchema = z.object({
  score: z.number(),
  findings: z.array(z.unknown()),
});

// ─── Tool: route_task ────────────────────────────────────────────────────────

const routeHitSchema = z.object({
  name: z.string(),
  kind: z.string(),
  path: z.string(),
  summary: z.string(),
  score: z.number(),
  matched: z.array(z.string()),
  tier: z.number().optional(),
});

server.registerTool(
  'route_task',
  {
    title: 'Route Task',
    description:
      'Call this FIRST on any UI request, before reading reference files. Takes the task in natural ' +
      'language and returns the references, commands and MCP tools that cover it, ranked, plus the ' +
      'single first move to make. Deterministic lexical ranking over a synonym map, so a prompt ' +
      'reaches the right entry even when its words do not match our filenames — "analytics panel" ' +
      'finds recipe-dashboard.md, which never says analytics. Recipes are also indexed by what they ' +
      'contain, so "pricing block" finds recipe-landing.md. ' +
      'Returns POINTERS only: every design rule stays in the files it points at. ' +
      'An unmatched prompt is reported as unmatched, not routed to a guess.',
    inputSchema: {
      prompt: z
        .string()
        .describe('The task in natural language — e.g. "analytics panel with KPIs"'),
      limit: z.number().int().optional().describe('Max hits per kind (default 5, clamped to 12)'),
    },
    outputSchema: {
      prompt: z.string().nullable(),
      concepts: z.array(z.string()),
      first_move: z.string().nullable(),
      intent: z.enum(['build', 'repair']).optional(),
      results: z.object({
        commands: z.array(routeHitSchema),
        references: z.array(routeHitSchema),
        mcp_tools: z.array(routeHitSchema),
      }),
      instruction: z.string().optional(),
      error: z.string().optional(),
    },
  },
  (args) => {
    let result;
    try {
      result = routeTask(args);
    } catch (e) {
      result = {
        error: `Unexpected error: ${e?.message ?? String(e)}`,
        prompt: args?.prompt ?? null,
        concepts: [],
        first_move: null,
        results: { commands: [], references: [], mcp_tools: [] },
      };
    }
    const isError = Boolean(result.error);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      ...(isError ? {} : { structuredContent: result }),
      isError,
    };
  }
);

// ─── Tool: check_anti_slop ───────────────────────────────────────────────────

server.registerTool(
  'check_anti_slop',
  {
    title: 'Check Anti-Slop',
    description:
      'Scans source code for anti-slop violations using the deterministic rules from ui-craft-detect. ' +
      'Accepts either a `code` string (inline source) or a `path` string (file or directory). ' +
      'Returns findings with severity, rule ID, file, line, and message. ' +
      'These are the 43 deterministic rules only — no taste or aesthetic judgment.',
    inputSchema: {
      code: z.string().optional().describe('Inline source code to scan (alternative to path)'),
      path: z.string().optional().describe('File or directory path to scan (alternative to code)'),
    },
    outputSchema: scanOutputSchema,
  },
  async (args) => {
    let result;
    try {
      result = await checkAntiSlop(args);
    } catch (e) {
      result = {
        error: `Unexpected error: ${e.message}`,
        findings: [],
        summary: { total: 0, errors: 0, warnings: 0 },
      };
    }
    const isError = Boolean(result.error);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      ...(isError ? {} : { structuredContent: result }),
      isError,
    };
  }
);

// ─── Tool: tokens_lint ───────────────────────────────────────────────────────

server.registerTool(
  'tokens_lint',
  {
    title: 'Tokens Lint',
    description:
      'Static analysis for off-system token values: raw hex colors, non-scale border-radius px values, ' +
      'non-8pt spacing values, and magic z-index integers. ' +
      'Token scale source of truth: references/tokens.md. ' +
      'Accepts `code` string or `path`. Returns structured findings + summary.',
    inputSchema: {
      code: z.string().optional().describe('Inline source code to lint (alternative to path)'),
      path: z.string().optional().describe('File or directory path to lint (alternative to code)'),
    },
    outputSchema: scanOutputSchema,
  },
  async (args) => {
    let result;
    try {
      result = await tokensLint(args);
    } catch (e) {
      result = {
        error: `Unexpected error: ${e.message}`,
        findings: [],
        summary: { total: 0, errors: 0, warnings: 0 },
      };
    }
    const isError = Boolean(result.error);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      ...(isError ? {} : { structuredContent: result }),
      isError,
    };
  }
);

// ─── Tool: acceptance_bar ────────────────────────────────────────────────────

server.registerTool(
  'acceptance_bar',
  {
    title: 'Acceptance Bar',
    description:
      'Returns the deterministic acceptance checklist for a UI surface. ' +
      'Data is bundled from recipe-dashboard.md, recipe-landing.md, recipe-auth.md, and finish-bar.md. ' +
      'Surfaces: dashboard, landing, auth, generic. ' +
      'Returns DATA only — no scoring or judgment. Scoring uses check_anti_slop + tokens_lint results.',
    inputSchema: {
      surface: z
        .enum(['dashboard', 'landing', 'auth', 'generic'])
        .describe('The UI surface to retrieve the acceptance bar for'),
    },
    outputSchema: {
      surface: z.string().nullable(),
      items: z.array(
        z.object({
          id: z.string().optional(),
          description: z.string().optional(),
          category: z.string().optional(),
        })
      ),
      error: z.string().optional(),
    },
  },
  (args) => {
    let result;
    try {
      result = acceptanceBar(args);
    } catch (e) {
      result = {
        error: `Unexpected error: ${e.message}`,
        surface: args.surface ?? null,
        items: [],
      };
    }
    const isError = Boolean(result.error);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      ...(isError ? {} : { structuredContent: result }),
      isError,
    };
  }
);

// ─── Tool: ux_coverage ───────────────────────────────────────────────────────

server.registerTool(
  'ux_coverage',
  {
    title: 'UX Coverage',
    description:
      'Returns the parts a screen of a given kind needs in order to be complete, and the contract for reporting them. ' +
      'This is the COMPLETENESS axis — "does this screen have the parts screens of its kind need". ' +
      'It is not the distinction axis: acceptance_bar and score_ui answer "is this designed". ' +
      'Report the two side by side; never fold coverage into a score, a count or a percentage. ' +
      'Report-only — coverage never gates and never fails a build. ' +
      `Archetypes: ${KNOWN_ARCHETYPES.join(', ')}. ` +
      'Call with no archetype to get the catalogue. dashboard, landing and auth are served by acceptance_bar instead. ' +
      'Returns DATA only — no scoring or judgment.',
    inputSchema: {
      archetype: z
        .string()
        .optional()
        .describe(
          'Screen archetype to retrieve coverage parts for. Accepts the key, the label, or a synonym ' +
            '("table", "plans", "are you sure"). Omit to list the catalogue.'
        ),
    },
    outputSchema: {
      archetype: z.string().nullable(),
      label: z.string().optional(),
      family: z.string().optional(),
      states: z.array(z.string()).optional(),
      items: z.array(
        z.object({
          id: z.string().optional(),
          part: z.string().optional(),
          exists: z.string().optional(),
          craft: z.string().optional(),
          cost: z.string().optional(),
          category: z.string().optional(),
        })
      ),
      reporting: z
        .object({
          markers: z.array(z.object({ marker: z.string(), meaning: z.string() })),
          rules: z.array(z.string()),
        })
        .optional(),
      catalogue: z
        .array(
          z.object({
            archetype: z.string(),
            label: z.string(),
            family: z.string(),
            also: z.array(z.string()).optional(),
          })
        )
        .optional(),
      note: z.string().optional(),
      error: z.string().optional(),
    },
  },
  (args) => {
    let result;
    try {
      result = uxCoverage(args);
    } catch (e) {
      result = {
        error: `Unexpected error: ${e.message}`,
        archetype: args?.archetype ?? null,
        items: [],
      };
    }
    const isError = Boolean(result.error);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      ...(isError ? {} : { structuredContent: result }),
      isError,
    };
  }
);

// ─── Tool: score_ui ──────────────────────────────────────────────────────────

server.registerTool(
  'score_ui',
  {
    title: 'Score UI',
    description:
      'Composite design-quality scorer (UICraftScore). Combines three deterministic dimensions into ' +
      'a single 0-100 score + letter grade (A/B/C/D/F) + per-dimension subscores and findings. ' +
      'Dimensions: anti-slop (38 rules via ui-craft-detect), token-discipline (raw hex / off-scale values), ' +
      'and static a11y (5 checks: img-no-alt, non-semantic-interactive, positive-tabindex, ' +
      'aria-invalid-no-describedby, no-reduced-motion). ' +
      'Accepts either a `code` string (inline source) or a `path` string (file). ' +
      'Formula: score = 100 − (antiSlop_crit×8) − (antiSlop_major×4) − (antiSlop_warn×1) ' +
      '− (token_findings×2) − (a11y_crit×8) − (a11y_major×4), clamped [0,100]. ' +
      'Returns { overall: {score, grade}, dimensions: {anti_slop, token_discipline, a11y}, version }.',
    inputSchema: {
      code: z.string().optional().describe('Inline source code to score (alternative to path)'),
      path: z.string().optional().describe('File path to score (alternative to code)'),
    },
    outputSchema: {
      overall: z.object({
        score: z.number(),
        grade: z.string(),
      }),
      dimensions: z.object({
        anti_slop: dimensionSchema,
        token_discipline: dimensionSchema,
        a11y: dimensionSchema,
      }),
      version: z.string().optional(),
      coverage: z.unknown().optional(),
      scan_errors: z.array(z.unknown()).optional(),
      scan_policy: z.unknown().optional(),
      error: z.string().optional(),
    },
  },
  async (args) => {
    let result;
    try {
      result = await scoreUiTool(args);
    } catch (e) {
      result = {
        error: `Unexpected error: ${e?.message ?? String(e)}`,
      };
    }
    const isError = Boolean(result.error);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      ...(isError ? {} : { structuredContent: result }),
      isError,
    };
  }
);

// ─── Tool: fold_candidates ───────────────────────────────────────────────────

const compositionClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  structure: z.string(),
  demands: z.string(),
  sacrifices: z.string(),
  spent: z.boolean(),
});

server.registerTool(
  'fold_candidates',
  {
    title: 'Fold Candidates',
    description:
      'Draws composition classes for a landing fold, preferring ones this project has not spent yet. ' +
      'Variety cannot be requested in prose — asking a model to "be different" returns its default every time — ' +
      'so the class is drawn instead — ordered by a per-project seed, then by what this project has already spent. ' +
      'Pass the classes already used in this project as `used`. ' +
      'Classes: type-only, full-bleed-overlay, split, stacked, product-dominant, band. ' +
      '`split` is drawn last on purpose: it is the fold every generator reaches for unprompted. ' +
      'Returns each class with what it demands and what it sacrifices — the sacrifice is what makes a composition distinct.',
    inputSchema: {
      used: z
        .array(z.string())
        .optional()
        .describe('Composition class ids already used in this project (deprioritised in the draw)'),
      count: z.number().int().min(1).max(6).optional().describe('How many candidates to draw (default 3)'),
      seed: z
        .string()
        .optional()
        .describe('Overrides the per-project seed. Defaults to the working directory, which is what makes two projects draw differently while one project stays stable across runs.'),
    },
    outputSchema: {
      candidates: z.array(compositionClassSchema),
      used: z.array(z.string()).optional(),
      seeded_by: z
        .enum(['project'])
        .nullable()
        .optional()
        .describe("What the order was seeded by, so a caller knows it will repeat. Deliberately not a value derived from the seed: a digest of a guessable path is not redaction."),
      instruction: z.string().optional(),
      error: z.string().optional(),
    },
  },
  (args) => {
    let result;
    try {
      result = foldCandidates(args);
    } catch (e) {
      result = { error: `Unexpected error: ${e?.message ?? String(e)}`, candidates: [] };
    }
    const isError = Boolean(result.error);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      ...(isError ? {} : { structuredContent: result }),
      isError,
    };
  }
);

// ─── Tool: check_fold ────────────────────────────────────────────────────────

server.registerTool(
  'check_fold',
  {
    title: 'Check Fold',
    description:
      'Renders a URL and reports what its fold actually is: a screenshot, the composition class it belongs to, ' +
      'drift from the class you set out to build, three judged invariants, and four measurements reported ' +
      'WITHOUT a verdict. The unjudged four (identification, single dominance, asymmetry, restraint budget) are ' +
      'measured but not scored: calibration against reference landing pages showed those thresholds do not yet ' +
      'discriminate, so they are yours to interpret. Treat the screenshot as the primary output — look at it. ' +
      'Invariant 7 (a costly detail) is unmeasurable by construction: pass what you committed to as ' +
      '`costly_detail`, or it fails. Needs a browser: install puppeteer, or set UI_CRAFT_CHROME to an existing ' +
      'Chrome to skip the download.',
    inputSchema: {
      url: z.string().describe('URL of the rendered page — a local dev server URL is fine'),
      costly_detail: z
        .string()
        .optional()
        .describe('The one element of this fold that could not have come from a template, and what it cost'),
      expected_class: z
        .string()
        .optional()
        .describe('The composition class you set out to build, to detect drift'),
      width: z.number().int().optional().describe('Viewport width (default 1440)'),
      height: z.number().int().optional().describe('Viewport height (default 900)'),
    },
    outputSchema: {
      url: z.string().optional(),
      composition: z.object({ id: z.string(), confidence: z.string(), why: z.string() }).optional(),
      drift_status: z
        .enum(['matched', 'drifted', 'not-compared'])
        .optional()
        .describe("Whether the built class was compared against an intended one at all. 'not-compared' means no expected_class was passed — an absent drift field is not evidence of none."),
      drift_note: z.string().optional().describe('Why nothing was compared, when that is the case'),
      expected_class: z.string().nullable().optional(),
      drift: z.string().nullable().optional(),
      checks: z.array(
        z.object({ id: z.number(), name: z.string(), pass: z.boolean(), detail: z.string() })
      ),
      observations: z
        .array(z.object({ id: z.number(), name: z.string(), value: z.string(), note: z.string() }))
        .optional(),
      summary: z.object({ passed: z.number(), total: z.number(), ok: z.boolean() }).optional(),
      measured: z.unknown().optional(),
      error: z.string().optional(),
    },
  },
  async (args) => {
    let result;
    try {
      result = await checkFold(args);
    } catch (e) {
      result = { error: `Unexpected error: ${e?.message ?? String(e)}`, checks: [] };
    }
    const isError = Boolean(result.error);
    // The screenshot rides in the content blocks, never in structuredContent —
    // base64 of a viewport would swamp the structured payload.
    const { screenshot, ...structured } = result;
    return {
      content: [
        { type: 'text', text: JSON.stringify(structured, null, 2) },
        ...(screenshot ? [{ type: 'image', data: screenshot, mimeType: 'image/png' }] : []),
      ],
      ...(isError ? {} : { structuredContent: structured }),
      isError,
    };
  }
);

// ─── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
