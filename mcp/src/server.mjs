#!/usr/bin/env node
/**
 * ui-craft MCP server
 * Deterministic design-quality gate: 3 tools, stdio transport.
 *
 * SDK: @modelcontextprotocol/sdk v1.29.0
 * API: McpServer.registerTool() + StdioServerTransport
 *
 * Tools:
 *   check_anti_slop  — flags anti-slop patterns via scripts/detect.mjs scan()
 *   tokens_lint      — flags off-system token values (color, radius, spacing, z-index)
 *   acceptance_bar   — returns acceptance checklist for a UI surface
 *
 * Boundary: NO taste or judgment rules in this server.
 * All subjective/aesthetic rules live exclusively in SKILL.md.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { checkAntiSlop } from './tools/check-anti-slop.mjs';
import { tokensLint } from './tools/tokens-lint.mjs';
import { acceptanceBar } from './tools/acceptance-bar.mjs';

const server = new McpServer(
  {
    name: 'ui-craft',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
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
      'These are the 33 deterministic rules only — no taste or aesthetic judgment.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Inline source code to scan (alternative to path)',
        },
        path: {
          type: 'string',
          description: 'File or directory path to scan (alternative to code)',
        },
      },
    },
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
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Inline source code to lint (alternative to path)',
        },
        path: {
          type: 'string',
          description: 'File or directory path to lint (alternative to code)',
        },
      },
    },
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
      type: 'object',
      properties: {
        surface: {
          type: 'string',
          enum: ['dashboard', 'landing', 'auth', 'generic'],
          description: 'The UI surface to retrieve the acceptance bar for',
        },
      },
      required: ['surface'],
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
      isError,
    };
  }
);

// ─── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
