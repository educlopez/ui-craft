// Shared constants: version, scan targets, color helpers, and CLI enum values.
// Split out of the former monolithic scripts/detect.mjs — no behavior change.

export const VERSION = "0.11.0";

export const SCAN_EXTENSIONS = new Set([
  ".css", ".scss", ".sass",
  ".tsx", ".jsx", ".ts", ".js",
  ".vue", ".svelte",
  ".html", ".astro",
]);

export const SKIP_DIRS = new Set([
  "node_modules", ".git",
  ".next", ".nuxt", ".svelte-kit", ".astro",
  "dist", "build", "out", "coverage", ".turbo",
  // our own harness mirrors — scanning them would double-flag against docs
  ".codex", ".cursor", ".gemini", ".opencode", ".agents",
]);

// ANSI colors — only used when stdout is a TTY.
export const tty = process.stdout.isTTY;
export const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
export const red = (s) => c("31", s);
export const yellow = (s) => c("33", s);
export const dim = (s) => c("2", s);
export const bold = (s) => c("1", s);

export const SCOPE_VALUES = new Set(["full", "files", "changed"]);
export const FAIL_ON_VALUES = new Set(["none", "warning", "error"]);
