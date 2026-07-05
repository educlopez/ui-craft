#!/usr/bin/env node
// ui-craft anti-slop detector
// Scans CSS/JSX/TSX/Vue/Svelte/etc for common AI-generated UI anti-patterns.
// Zero dependencies. Node 18+. Rules mirror skills/ui-craft/SKILL.md "Anti-Slop Test".
//
// Usage:
//   node scripts/detect.mjs [path] [--json] [--sarif] [--fix] [--fix-dry-run]
//   node scripts/detect.mjs <https://url> [--json] [--engine auto|puppeteer|fetch]
//   node scripts/detect.mjs ci install|config|upgrade [options]
//   node scripts/detect.mjs hooks install|uninstall|status [options]
//   node scripts/detect.mjs hook-run   (invoked by installed agent hooks; reads event JSON from stdin)
//   node scripts/detect.mjs init-hook [--husky|--native|--github-action|--all] [--dry-run] [--yes]  (deprecated alias)
// Exit codes:
//   0 clean (or only warnings), 1 errors present, 2 arg error / unreadable path

export { rules } from "./detect/rules.mjs";
export { scanFile, scan } from "./detect/engine.mjs";
export { scanUrl } from "./detect/url.mjs";
export {
  resolveBaseRef,
  parseUnifiedDiff,
  parseGitDiffHunks,
  filterFindingsByScope,
  renderReviewComments,
  renderMarkdownReport,
} from "./detect/git.mjs";
export {
  DEFAULT_GHA_CONFIG,
  renderGHAWorkflow,
  parseWorkflowConfig,
  replaceMarkers,
} from "./detect/ci.mjs";
export { buildClaudeHookSettings, buildCursorHookSettings } from "./detect/hooks.mjs";

import * as fsSync from "node:fs";
import { pathToFileURL } from "node:url";
import { main } from "./detect/cli.mjs";

// CLI entry guard. `UI_CRAFT_BUNDLE` is replaced with "1" at esbuild build time
// (see mcp/esbuild.config.mjs `define`) so this whole block is dead-code-eliminated
// in the bundled MCP server — otherwise, once detect.mjs is inlined into
// dist/server.mjs, its import.meta.url would equal the server entry and this CLI
// main() would run (and process.exit) the server. Undefined everywhere else
// (repo CLI, published ui-craft-detect), so the real CLI is unaffected.
//
// npx/npm invoke the published `ui-craft-detect` bin through a symlink
// (node_modules/.bin/ui-craft-detect -> ../ui-craft-detect/scripts/detect.mjs).
// import.meta.url resolves through that symlink to the real file, but
// process.argv[1] is the symlink path as invoked — a direct URL comparison
// never matches in that case, so main() silently never ran. Fall back to a
// realpath-resolved comparison to cover the symlinked-bin invocation too.
function isCliEntry() {
  if (!process.argv[1]) return false;
  if (import.meta.url === pathToFileURL(process.argv[1]).href) return true;
  try {
    return import.meta.url === pathToFileURL(fsSync.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (process.env.UI_CRAFT_BUNDLE !== "1" && isCliEntry()) {
  main().catch((err) => {
    process.stderr.write(`error: ${err.stack || err.message}\n`);
    process.exit(2);
  });
}

