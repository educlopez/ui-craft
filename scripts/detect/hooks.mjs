// Agent edit-time hooks: writes/removes Claude Code and Cursor hook
// manifests, and the hook-run implementation those manifests invoke after
// each agent file edit. Split out of the former monolithic
// scripts/detect.mjs — no behavior change.

import { promises as fs } from "node:fs";
import path from "node:path";

import { dim, bold, c, SCAN_EXTENSIONS } from "./constants.mjs";
import { scan } from "./engine.mjs";
import { fileExists } from "./ci.mjs";

// --- agent edit-time hooks ---------------------------------------------------
// `hooks install` writes harness-native hook manifests so the detector runs
// automatically after every agent file edit — feedback lands while the agent
// is still working, not at commit or CI time:
//
//   Claude Code — .claude/settings.json → hooks.PostToolUse
//     matcher "Edit|Write|MultiEdit"; the event JSON arrives on stdin; exit
//     code 2 feeds stderr back to the model as actionable feedback.
//   Cursor — .cursor/hooks.json → hooks.afterFileEdit (schema version 1)
//     informational hook; findings appear in Cursor's Hooks output channel.
//
// Both manifests invoke `hook-run`, which parses the event JSON, scans only
// the edited file, and exits 2 with a compact findings summary when critical
// or major findings exist. It fails open (exit 0) on any internal error so a
// broken hook never blocks the agent loop.

const HOOK_RUN_MARKER = "ui-craft-detect hook-run";
const DEFAULT_HOOK_RUN_COMMAND = "npx --yes ui-craft-detect hook-run";
const CLAUDE_SETTINGS_PATH = path.join(".claude", "settings.json");
const CURSOR_HOOKS_PATH = path.join(".cursor", "hooks.json");
const HOOK_HARNESSES = new Set(["claude", "cursor", "all"]);

function printHooksHelp() {
  process.stdout.write(
    `ui-craft-detect hooks — agent edit-time hooks (scan on every agent file edit)\n\n` +
      `Usage:\n` +
      `  ui-craft-detect hooks install [options]     # write harness hook manifests\n` +
      `  ui-craft-detect hooks uninstall [options]   # remove the detector entries\n` +
      `  ui-craft-detect hooks status                # show which harnesses have the hook\n\n` +
      `Options:\n` +
      `  --harness claude|cursor|all  which manifests to touch (default: all)\n` +
      `  --command <cmd>              override the hook command (default: "${DEFAULT_HOOK_RUN_COMMAND}")\n` +
      `  --dry-run                    print resulting manifests without writing\n\n` +
      `Manifests:\n` +
      `  Claude Code  ${CLAUDE_SETTINGS_PATH}  (hooks.PostToolUse, matcher Edit|Write|MultiEdit)\n` +
      `  Cursor       ${CURSOR_HOOKS_PATH}     (hooks.afterFileEdit, schema version 1)\n\n` +
      `The hook runs \`hook-run\`: it reads the event JSON from stdin, scans only the\n` +
      `edited file, and exits 2 with a findings summary when critical/major findings\n` +
      `exist. Claude Code feeds that summary back to the model; Cursor logs it in the\n` +
      `Hooks output channel. Existing manifest entries are always preserved.\n`,
  );
}

function parseHooksArgs(argv) {
  const opts = { harness: "all", command: DEFAULT_HOOK_RUN_COMMAND, dryRun: false, help: false, unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--harness" || a.startsWith("--harness=")) {
      const value = a.startsWith("--harness=") ? a.slice("--harness=".length) : argv[++i];
      if (!HOOK_HARNESSES.has(value)) {
        process.stderr.write(`error: invalid --harness value "${value}"; expected claude|cursor|all\n`);
        process.exit(2);
      }
      opts.harness = value;
    } else if (a === "--command" || a.startsWith("--command=")) {
      opts.command = a.startsWith("--command=") ? a.slice("--command=".length) : argv[++i];
    } else opts.unknown.push(a);
  }
  return opts;
}

async function readJsonManifest(fullPath) {
  if (!(await fileExists(fullPath))) return { data: null, existed: false };
  const raw = await fs.readFile(fullPath, "utf8");
  try {
    return { data: JSON.parse(raw), existed: true };
  } catch (err) {
    process.stderr.write(
      `error: ${fullPath} exists but is not valid JSON (${err.message}); fix it manually first\n`,
    );
    process.exit(2);
  }
}

function hookEntryInstalled(entries, extract) {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => extract(entry).some((cmd) => typeof cmd === "string" && cmd.includes(HOOK_RUN_MARKER)));
}

// Claude Code entry commands live at entry.hooks[].command; Cursor at entry.command.
const claudeEntryCommands = (entry) =>
  Array.isArray(entry?.hooks) ? entry.hooks.map((h) => h?.command) : [];
const cursorEntryCommands = (entry) => [entry?.command];

/**
 * Build the next Claude Code settings object with the detector hook installed
 * (or removed). Pure — takes the parsed current settings (or null) and returns
 * { next, changed }. Everything the user already has is preserved.
 */
export function buildClaudeHookSettings(current, { command = DEFAULT_HOOK_RUN_COMMAND, remove = false } = {}) {
  const next = current ? structuredClone(current) : {};
  next.hooks = next.hooks && typeof next.hooks === "object" ? next.hooks : {};
  const entries = Array.isArray(next.hooks.PostToolUse) ? next.hooks.PostToolUse : [];

  if (remove) {
    const kept = entries.filter((entry) => !claudeEntryCommands(entry).some((c2) => typeof c2 === "string" && c2.includes(HOOK_RUN_MARKER)));
    const changed = kept.length !== entries.length;
    if (kept.length > 0) next.hooks.PostToolUse = kept;
    else delete next.hooks.PostToolUse;
    if (Object.keys(next.hooks).length === 0) delete next.hooks;
    return { next, changed };
  }

  if (hookEntryInstalled(entries, claudeEntryCommands)) return { next, changed: false };
  next.hooks.PostToolUse = [
    ...entries,
    { matcher: "Edit|Write|MultiEdit", hooks: [{ type: "command", command }] },
  ];
  return { next, changed: true };
}

/**
 * Build the next Cursor hooks.json object with the detector hook installed
 * (or removed). Pure — same contract as buildClaudeHookSettings.
 */
export function buildCursorHookSettings(current, { command = DEFAULT_HOOK_RUN_COMMAND, remove = false } = {}) {
  const next = current ? structuredClone(current) : { version: 1, hooks: {} };
  if (typeof next.version !== "number") next.version = 1;
  next.hooks = next.hooks && typeof next.hooks === "object" ? next.hooks : {};
  const entries = Array.isArray(next.hooks.afterFileEdit) ? next.hooks.afterFileEdit : [];

  if (remove) {
    const kept = entries.filter((entry) => !cursorEntryCommands(entry).some((c2) => typeof c2 === "string" && c2.includes(HOOK_RUN_MARKER)));
    const changed = kept.length !== entries.length;
    if (kept.length > 0) next.hooks.afterFileEdit = kept;
    else delete next.hooks.afterFileEdit;
    return { next, changed };
  }

  if (hookEntryInstalled(entries, cursorEntryCommands)) return { next, changed: false };
  next.hooks.afterFileEdit = [...entries, { command }];
  return { next, changed: true };
}

async function applyHookManifest(cwd, relPath, builder, { command, remove, dryRun }) {
  const fullPath = path.join(cwd, relPath);
  const { data } = await readJsonManifest(fullPath);
  const { next, changed } = builder(data, { command, remove });

  if (!changed) {
    process.stdout.write(dim(`${relPath}: ${remove ? "no detector hook found" : "already installed"}\n`));
    return;
  }

  const text = JSON.stringify(next, null, 2) + "\n";
  if (dryRun) {
    process.stdout.write(`\n${bold("--- " + relPath)}\n${text}`);
    return;
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, text, "utf8");
  process.stdout.write(`${c("32", remove ? "removed from" : "wrote")} ${relPath}\n`);
}

export async function runHooks(argv) {
  const sub = argv[0];
  const opts = parseHooksArgs(argv.slice(1));

  if (opts.help || sub === "--help" || sub === "-h") {
    printHooksHelp();
    process.exit(0);
  }
  if (sub === undefined || !["install", "uninstall", "status"].includes(sub)) {
    if (sub !== undefined) process.stderr.write(`error: unknown hooks subcommand "${sub}"\n\n`);
    printHooksHelp();
    process.exit(2);
  }
  if (opts.unknown.length > 0) {
    process.stderr.write(`error: unknown flag(s): ${opts.unknown.join(" ")}\n\n`);
    printHooksHelp();
    process.exit(2);
  }

  const cwd = process.cwd();
  const doClaude = opts.harness === "claude" || opts.harness === "all";
  const doCursor = opts.harness === "cursor" || opts.harness === "all";

  if (sub === "status") {
    const claudeManifest = await readJsonManifest(path.join(cwd, CLAUDE_SETTINGS_PATH));
    const cursorManifest = await readJsonManifest(path.join(cwd, CURSOR_HOOKS_PATH));
    const claudeOn = hookEntryInstalled(claudeManifest.data?.hooks?.PostToolUse, claudeEntryCommands);
    const cursorOn = hookEntryInstalled(cursorManifest.data?.hooks?.afterFileEdit, cursorEntryCommands);
    process.stdout.write(`claude  ${claudeOn ? c("32", "installed") : dim("not installed")}  (${CLAUDE_SETTINGS_PATH})\n`);
    process.stdout.write(`cursor  ${cursorOn ? c("32", "installed") : dim("not installed")}  (${CURSOR_HOOKS_PATH})\n`);
    process.exit(0);
  }

  const remove = sub === "uninstall";
  if (doClaude) {
    await applyHookManifest(cwd, CLAUDE_SETTINGS_PATH, buildClaudeHookSettings, {
      command: opts.command,
      remove,
      dryRun: opts.dryRun,
    });
  }
  if (doCursor) {
    await applyHookManifest(cwd, CURSOR_HOOKS_PATH, buildCursorHookSettings, {
      command: opts.command,
      remove,
      dryRun: opts.dryRun,
    });
  }
  if (!remove && !opts.dryRun) {
    process.stdout.write(
      dim(`next: the detector now runs after every agent file edit; findings surface as agent feedback.\n`),
    );
  }
  process.exit(0);
}

function readStdinText(timeoutMs = 5000) {
  return new Promise((resolve) => {
    // No piped stdin (manual invocation) — resolve empty rather than hanging.
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    const timer = setTimeout(() => resolve(data), timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Hook runner — the command the installed manifests execute after each agent
 * file edit. Reads the harness event JSON from stdin (Claude Code PostToolUse
 * puts the path at .tool_input.file_path; Cursor afterFileEdit at .file_path),
 * scans just that file, and exits 2 with a compact stderr summary when
 * critical/major findings exist. Warn-level findings never interrupt.
 * Fails open (exit 0) on internal errors so a broken hook can't stall agents.
 */
export async function runHookRun(argv) {
  try {
    let filePath = argv.find((a) => !a.startsWith("--")) ?? null;
    if (!filePath) {
      const raw = await readStdinText();
      if (!raw.trim()) process.exit(0);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        process.exit(0);
      }
      filePath =
        payload?.tool_input?.file_path ?? payload?.file_path ?? payload?.inputs?.file_path ?? null;
    }
    if (!filePath || typeof filePath !== "string") process.exit(0);

    const resolved = path.resolve(filePath);
    if (!SCAN_EXTENSIONS.has(path.extname(resolved))) process.exit(0);
    if (!(await fileExists(resolved))) process.exit(0);

    const result = await scan(resolved);
    const blocking = result.findings.filter(
      (f) => f.severity === "critical" || f.severity === "major",
    );
    if (blocking.length === 0) process.exit(0);

    const rel = path.relative(process.cwd(), resolved);
    const shown = blocking.slice(0, 10);
    let msg = `ui-craft-detect: ${blocking.length} design finding(s) in ${rel} — fix before finishing:\n`;
    for (const f of shown) {
      msg += `  - L${f.line} [${f.severity}] ${f.description} — fix: ${f.fix}\n`;
    }
    if (blocking.length > shown.length) {
      msg += `  …and ${blocking.length - shown.length} more (run \`npx ui-craft-detect ${rel}\` for the full list)\n`;
    }
    msg += `False positive? Suppress with a  // ui-craft-detect-ignore-rule: <rule-id>  comment on the flagged line.\n`;
    process.stderr.write(msg);
    process.exit(2);
  } catch (err) {
    process.stderr.write(`ui-craft-detect hook-run: internal error (${err.message}); skipping\n`);
    process.exit(0);
  }
}

