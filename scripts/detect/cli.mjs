// CLI: arg parsing, help text, top-level command dispatch (scan / URL scan /
// init-hook / ci / hooks / hook-run), and output formatting (--json, --sarif,
// --markdown, --review-json, human-readable). Split out of the former
// monolithic scripts/detect.mjs — no behavior change.

import { promises as fs } from "node:fs";
import path from "node:path";

import { VERSION, SCAN_EXTENSIONS, red, yellow, dim, bold, SCOPE_VALUES, FAIL_ON_VALUES } from "./constants.mjs";
import { rules } from "./rules.mjs";
import { scan, scanFile, loadConfig, isIgnoredByConfig, walk, applyFix, makeDiff, toSarif } from "./engine.mjs";
import { scanUrl, URL_RE } from "./url.mjs";
import {
  resolveBaseRef,
  parseGitDiffHunks,
  filterFindingsByScope,
  renderReviewComments,
  renderMarkdownReport,
  tryGit,
} from "./git.mjs";
import { runInitHook, runCi } from "./ci.mjs";
import { runHooks, runHookRun } from "./hooks.mjs";

// --- Main ----------------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    json: false,
    sarif: false,
    markdown: false,
    reviewJson: false,
    fix: false,
    fixDryRun: false,
    version: false,
    help: false,
    scope: "full",
    base: null,
    failOn: "error",
    commitSha: null,
    engine: "auto",
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") flags.json = true;
    else if (a === "--review-json") flags.reviewJson = true;
    else if (a === "--commit-sha" || a.startsWith("--commit-sha=")) {
      flags.commitSha = a.startsWith("--commit-sha=")
        ? a.slice("--commit-sha=".length)
        : argv[++i];
    }
    else if (a === "--sarif") flags.sarif = true;
    else if (a === "--markdown") flags.markdown = true;
    else if (a === "--fix") flags.fix = true;
    else if (a === "--fix-dry-run") flags.fixDryRun = true;
    else if (a === "--version" || a === "-v") flags.version = true;
    else if (a === "--help" || a === "-h") flags.help = true;
    else if (a === "--scope" || a.startsWith("--scope=")) {
      const value = a.startsWith("--scope=") ? a.slice("--scope=".length) : argv[++i];
      if (!SCOPE_VALUES.has(value)) {
        process.stderr.write(`error: invalid --scope value "${value}"; expected full|files|changed\n`);
        process.exit(2);
      }
      flags.scope = value;
    } else if (a === "--base" || a.startsWith("--base=")) {
      const value = a.startsWith("--base=") ? a.slice("--base=".length) : argv[++i];
      flags.base = value ?? null;
    } else if (a === "--fail-on" || a.startsWith("--fail-on=")) {
      const value = a.startsWith("--fail-on=") ? a.slice("--fail-on=".length) : argv[++i];
      if (!FAIL_ON_VALUES.has(value)) {
        process.stderr.write(`error: invalid --fail-on value "${value}"; expected none|warning|error\n`);
        process.exit(2);
      }
      flags.failOn = value;
    } else if (a === "--engine" || a.startsWith("--engine=")) {
      const value = a.startsWith("--engine=") ? a.slice("--engine=".length) : argv[++i];
      if (!["auto", "puppeteer", "fetch"].includes(value)) {
        process.stderr.write(`error: invalid --engine value "${value}"; expected auto|puppeteer|fetch\n`);
        process.exit(2);
      }
      flags.engine = value;
    } else if (!a.startsWith("--")) positional.push(a);
  }
  return { flags, positional };
}

/**
 * Decides the process exit code for a scan based on the `--fail-on` policy,
 * evaluated strictly over POST-scope-filtered counts (never raw).
 * - "none": always 0 (advisory).
 * - "error": 1 iff errors (critical) > 0.
 * - "warning": 1 iff errors > 0 || warnings (major+warn) > 0.
 * @param {"none"|"warning"|"error"} failOn
 * @param {{errors: number, warnings: number}} counts
 * @returns {0|1}
 */
function failOnExit(failOn, { errors, warnings }) {
  if (failOn === "none") return 0;
  if (failOn === "warning") return errors > 0 || warnings > 0 ? 1 : 0;
  return errors > 0 ? 1 : 0;
}

function printHelp() {
  process.stdout.write(
    `ui-craft-detect v${VERSION} \u2014 static anti-slop detector for UI code\n\n` +
      `Usage:\n` +
      `  ui-craft-detect [path] [flags]              # scan a directory\n` +
      `  ui-craft-detect <https://url> [flags]       # scan a live page (puppeteer-rendered when installed, static fetch otherwise)\n` +
      `  ui-craft-detect ci install|config|upgrade   # manage the generated CI workflow\n` +
      `  ui-craft-detect hooks install|uninstall|status  # agent edit-time hooks (Claude Code, Cursor)\n` +
      `  ui-craft-detect init-hook [options]         # install pre-commit hooks or CI (deprecated; still supported — see \`ci install\`)\n\n` +
      `Scan flags:\n` +
      `  --json                     machine-readable output\n` +
      `  --sarif                    SARIF 2.1.0 (GitHub code scanning)\n` +
      `  --markdown                 branded markdown report (PR comments, CI summaries)\n` +
      `  --review-json              GitHub Reviews API payload (requires --scope changed)\n` +
      `  --commit-sha <sha>         commit_id for --review-json (default: HEAD)\n` +
      `  --fix                      auto-fix fixable rules (transition-all, animate-bounce)\n` +
      `  --fix-dry-run              print would-be diff without writing\n` +
      `  --scope full|files|changed scope findings to a git diff (default: full)\n` +
      `  --base <ref>               diff base ref (default: merge-base with default branch)\n` +
      `  --fail-on none|warning|error  exit-code severity gate (default: error)\n` +
      `  --engine auto|puppeteer|fetch  URL-scan engine (default: auto — puppeteer when installed)\n\n` +
      `hooks subcommands (run \`ui-craft-detect hooks --help\` for full options):\n` +
      `  hooks install    write agent edit-time hook manifests (.claude/settings.json, .cursor/hooks.json)\n` +
      `  hooks uninstall  remove the detector entries from those manifests\n` +
      `  hooks status     show which harnesses have the hook installed\n\n` +
      `init-hook options:\n` +
      `  (no flag)        auto-detect husky or native\n` +
      `  --husky          write .husky/pre-commit\n` +
      `  --native         write .githooks/pre-commit (+ chmod +x)\n` +
      `  --github-action  write .github/workflows/ui-craft-detect.yml\n` +
      `  --all            write all three\n` +
      `  --dry-run        show what would be written\n` +
      `  --yes            overwrite without prompting\n\n` +
      `ci subcommands (run \`ui-craft-detect ci --help\` for full options):\n` +
      `  ci install       write .github/workflows/ui-craft-detect.yml\n` +
      `  ci config        change settings on an already-installed workflow\n` +
      `  ci upgrade       regenerate the template body, preserving config\n\n` +
      `Global:\n` +
      `  --help, -h       this help\n` +
      `  --version, -v    print version\n\n` +
      `Config: looks for .uicraftrc.json upward from scan root.\n` +
      `Ignore comments: ui-craft-detect-ignore[-file|-next-line|-rule: <id>]\n`,
  );
}


export async function main() {
  const rawArgs = process.argv.slice(2);

  // Subcommand dispatch: `init-hook` is a sibling command, not a scan.
  // `init-hook` is kept working, unchanged, deprecated-but-supported — `ci
  // install/config/upgrade` (Slice D) is the new preferred surface.
  if (rawArgs[0] === "init-hook") {
    await runInitHook(rawArgs.slice(1));
    return;
  }
  if (rawArgs[0] === "ci") {
    await runCi(rawArgs.slice(1));
    return;
  }
  if (rawArgs[0] === "hooks") {
    await runHooks(rawArgs.slice(1));
    return;
  }
  if (rawArgs[0] === "hook-run") {
    await runHookRun(rawArgs.slice(1));
    return;
  }

  const { flags, positional } = parseArgs(rawArgs);

  if (flags.help) {
    printHelp();
    process.exit(0);
  }
  if (flags.version) {
    process.stdout.write(`ui-craft-detect v${VERSION}\n`);
    process.exit(0);
  }

  // ===== URL MODE =====
  // `ui-craft-detect https://…` scans a live page. Only --json / --fail-on /
  // --engine apply; file-oriented flags (fix, scope, sarif, review) need a
  // source tree and are rejected up front.
  if (positional[0] && URL_RE.test(positional[0])) {
    if (flags.fix || flags.fixDryRun || flags.sarif || flags.reviewJson || flags.scope !== "full") {
      process.stderr.write(`error: --fix/--sarif/--review-json/--scope are not supported for URL scans\n`);
      process.exit(2);
    }
    const url = positional[0];
    const result = await scanUrl(url, { engine: flags.engine });
    if (result.error) {
      process.stderr.write(`error: ${result.error}\n`);
      process.exit(2);
    }
    if (flags.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      process.exit(failOnExit(flags.failOn, result.summary));
    }
    const engineNote =
      result.engine === "puppeteer"
        ? "rendered DOM via puppeteer"
        : "static HTML via fetch — install puppeteer to scan the JS-rendered DOM";
    process.stdout.write(
      `${bold("ui-craft anti-slop detector")} ${dim("v" + VERSION)}\n` +
        `Scanned ${url} (${engineNote})\n\n`,
    );
    for (const f of result.findings) {
      const dot =
        f.severity === "critical" ? red("●") : f.severity === "major" ? yellow("●") : dim("●");
      process.stdout.write(`${url} — HTML line ${f.line}\n`);
      process.stdout.write(`  ${dot} ${f.description}  ${dim("— " + f.snippet)}\n`);
      process.stdout.write(`     ${dim("fix: " + f.fix)}\n\n`);
    }
    if (result.findings.length === 0) {
      process.stdout.write(dim("No anti-slop patterns found.\n"));
    }
    process.stdout.write(
      `1 page scanned (${result.summary.errors} errors, ${result.summary.warnings} warnings).\n`,
    );
    process.exit(failOnExit(flags.failOn, result.summary));
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
  // Delegate to the exported scan() function so programmatic callers get the same result.
  const scanResult = await scan(targetRaw, { config });

  const cwd = process.cwd();

  // Diff-scoped filtering: single filter point feeding ALL output paths
  // (SARIF, JSON, human) — never duplicated per-renderer. `full` (default)
  // is untouched below and remains byte-identical to prior behavior.
  let scopedFindings = scanResult.findings;
  if (flags.scope !== "full") {
    const baseRef = resolveBaseRef(flags.base, { cwd });
    if (baseRef === null) {
      const reason = flags.base
        ? `could not resolve base ref "${flags.base}"`
        : "not a git repository or no resolvable default branch";
      process.stderr.write(`warning: ${reason}; falling back to full scan\n`);
    } else {
      const hunks = parseGitDiffHunks(baseRef, { cwd });
      scopedFindings = filterFindingsByScope(scanResult.findings, flags.scope, hunks, { cwd });
    }
  }

  // Recompute summary counts over the scoped set so JSON/human/SARIF
  // summaries and the fail-on gate all reason over the same filtered data.
  const errorCount = scopedFindings.reduce((n, f) => n + (f.severity === "critical" ? 1 : 0), 0);
  const warningCount = scopedFindings.reduce(
    (n, f) => n + (f.severity === "major" || f.severity === "warn" ? 1 : 0),
    0,
  );
  const summary = {
    ...scanResult.summary,
    files_flagged: new Set(scopedFindings.map((f) => f.file)).size,
    errors: errorCount,
    warnings: warningCount,
  };

  if (flags.reviewJson) {
    if (flags.scope !== "changed") {
      process.stderr.write(
        `error: --review-json requires --scope changed (findings must be diff-scoped before building inline review comments)\n`,
      );
      process.exit(2);
    }
    // scopedFindings is already filtered to diff-visible lines by the
    // --scope changed branch above — renderReviewComments trusts this and
    // does not re-filter by hunk ranges itself.
    const commitSha =
      flags.commitSha ?? tryGit(["rev-parse", "HEAD"], { cwd }) ?? "HEAD";
    const review = renderReviewComments(scopedFindings, commitSha);
    process.stdout.write(JSON.stringify(review, null, 2) + "\n");
    process.exit(failOnExit(flags.failOn, { errors: errorCount, warnings: warningCount }));
  }

  // Derive absolute-path findings for SARIF/human by mapping scan() relative
  // paths back to absolute. scan() already ran once — no second disk read.
  const absFindings = scopedFindings.map((f) => ({
    ...f,
    file: path.resolve(cwd, f.file),
  }));

  if (flags.markdown) {
    process.stdout.write(renderMarkdownReport(absFindings, summary));
    process.exit(failOnExit(flags.failOn, { errors: errorCount, warnings: warningCount }));
  }

  if (flags.sarif) {
    const sarif = toSarif(absFindings, rules);
    process.stdout.write(JSON.stringify(sarif, null, 2) + "\n");
    process.exit(failOnExit(flags.failOn, { errors: errorCount, warnings: warningCount }));
  }

  if (flags.json) {
    const out = {
      version: scanResult.version,
      summary,
      config: configPath ? { path: configPath, overrides: overrideCount } : null,
      findings: scopedFindings,
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    process.exit(failOnExit(flags.failOn, { errors: errorCount, warnings: warningCount }));
  }

  // Human-readable output
  const displayPath = path.relative(process.cwd(), target) || ".";
  process.stdout.write(
    `${bold("ui-craft anti-slop detector")} ${dim("v" + VERSION)}\n` +
      `Scanned ${summary.files_scanned} files in ./${displayPath}` +
      ` (${summary.files_flagged} of them flagged)\n\n`,
  );

  const byFile = new Map();
  for (const f of absFindings) {
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

  if (absFindings.length === 0) {
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

  process.exit(failOnExit(flags.failOn, { errors: errorCount, warnings: warningCount }));
}
