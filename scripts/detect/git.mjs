// Diff-scoped scanning: git plumbing, unified-diff parsing, finding-scope
// filtering, and CI-surface renderers (GitHub review comments, markdown
// report). Split out of the former monolithic scripts/detect.mjs — no
// behavior change.

import { execFileSync } from "node:child_process";
import path from "node:path";

// --- Diff-scoped scanning -------------------------------------------------
// Pure post-filter module: scopes findings from scan() to what a branch
// actually changed vs a resolved base ref. scan()/scanFile() stay untouched;
// full scope remains the default and is byte-identical to prior behavior.
// See: sdd/detect-ci-integration design (obs #869).

/**
 * Runs a git subcommand and returns trimmed stdout, or null on any failure
 * (git absent, non-zero exit, not a git repo, etc). Never throws.
 * @param {string[]} args
 * @param {{cwd?: string}} [opts]
 * @returns {string|null}
 */
export function tryGit(args, { cwd } = {}) {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim();
  } catch {
    return null;
  }
}

/**
 * Resolves the base ref to diff against.
 * - If `explicitBase` is provided, verifies it resolves to a commit; returns
 *   it unchanged on success, else null (caller falls back to full scan).
 * - Otherwise, requires we're inside a git work tree, then tries a chain of
 *   merge-base probes against likely default-branch refs in order.
 * @param {string|null} explicitBase
 * @param {{cwd?: string}} [opts]
 * @returns {string|null}
 */
export function resolveBaseRef(explicitBase, { cwd } = {}) {
  if (explicitBase) {
    const verified = tryGit(["rev-parse", "--verify", `${explicitBase}^{commit}`], { cwd });
    return verified ? explicitBase : null;
  }

  const insideWorkTree = tryGit(["rev-parse", "--is-inside-work-tree"], { cwd });
  if (insideWorkTree !== "true") return null;

  const candidates = ["origin/HEAD", "origin/main", "main"];
  for (const ref of candidates) {
    const sha = tryGit(["merge-base", "HEAD", ref], { cwd });
    if (sha) return sha;
  }
  return null;
}

/**
 * Parses raw `git diff --unified=0` text into a map of repo-relative
 * (posix-separated) file path -> array of [start, end] 1-based inclusive
 * line ranges on the NEW (post-change) side, or an empty array when the
 * file has no textual hunks (pure rename, mode-only change, or binary).
 *
 * Only the `@@ -a,b +c,d @@` hunk header is trusted for ranges — the `-a,b`
 * (old-side) is ignored entirely since findings are reported against
 * post-change line numbers.
 * @param {string} diffText
 * @returns {Map<string, Array<[number, number]>>}
 */
export function parseUnifiedDiff(diffText) {
  /** @type {Map<string, Array<[number, number]>>} */
  const hunks = new Map();
  if (!diffText) return hunks;

  let currentPath = null;
  let skipFile = false; // true for binary/deleted blocks — no hunk parsing.

  const lines = diffText.split("\n");
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      // New file block begins. Provisional path from "b/<path>" side.
      const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      currentPath = m ? m[2] : null;
      skipFile = false;
      if (currentPath && !hunks.has(currentPath)) hunks.set(currentPath, []);
      continue;
    }

    if (line.startsWith("rename to ")) {
      currentPath = line.slice("rename to ".length).trim();
      if (currentPath && !hunks.has(currentPath)) hunks.set(currentPath, []);
      continue;
    }

    if (line.startsWith("Binary files ") && line.endsWith("differ")) {
      // Binary file — no hunk lines will follow for this block. Record with
      // no ranges (files scope still lists it; changed scope reports nothing
      // because no [start,end] range will ever match a finding's line).
      skipFile = true;
      if (currentPath && !hunks.has(currentPath)) hunks.set(currentPath, []);
      continue;
    }

    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim();
      if (target === "/dev/null") {
        // Deletion — defensive; --diff-filter=d already excludes these.
        skipFile = true;
      } else {
        currentPath = target.startsWith("b/") ? target.slice(2) : target;
        if (!hunks.has(currentPath)) hunks.set(currentPath, []);
      }
      continue;
    }

    if (line.startsWith("--- ")) {
      // "--- /dev/null" marks a new file; nothing to do here — the "+++"
      // line sets the authoritative path, and the following "@@" hunks
      // naturally cover the whole new file's content.
      continue;
    }

    if (line.startsWith("@@")) {
      if (skipFile || !currentPath) continue;
      const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (!m) continue;
      const start = Number.parseInt(m[1], 10);
      const count = m[2] === undefined ? 1 : Number.parseInt(m[2], 10);
      if (count === 0) continue; // pure-deletion hunk — no new lines to report.
      const end = start + count - 1;
      const ranges = hunks.get(currentPath) ?? [];
      ranges.push([start, end]);
      hunks.set(currentPath, ranges);
      continue;
    }
  }

  return hunks;
}

/**
 * Runs `git diff --unified=0 --no-color --diff-filter=d <baseRef>` (base ref
 * vs working tree, capturing committed+staged+unstaged changes) and parses
 * the result into a hunk map. Returns an empty Map on any git failure.
 * @param {string} baseRef
 * @param {{cwd?: string}} [opts]
 * @returns {Map<string, Array<[number, number]>>}
 */
export function parseGitDiffHunks(baseRef, { cwd } = {}) {
  const diffText = tryGit(
    ["diff", "--unified=0", "--no-color", "--diff-filter=d", baseRef],
    { cwd },
  );
  if (diffText === null) return new Map();
  return parseUnifiedDiff(diffText);
}

/**
 * Normalizes a scan() finding's `file` field (cwd-relative) to a
 * repo-relative posix path, matching the keys produced by
 * parseGitDiffHunks/parseUnifiedDiff (which come from `git diff`'s
 * repo-relative, posix-separated paths).
 * @param {string} file
 * @param {{cwd: string, repoToplevel: string}} ctx
 * @returns {string}
 */
function toRepoRelativePosix(file, { cwd, repoToplevel }) {
  const abs = path.resolve(cwd, file);
  const rel = path.relative(repoToplevel, abs);
  return rel.split(path.sep).join("/");
}

/**
 * Filters a findings array by diff scope.
 * - "full": identity — returns the same array reference (guarantees
 *   byte-identical default output).
 * - "files": keeps findings whose file is a key in `hunks` (i.e. the file
 *   was touched vs the base ref), regardless of which line the finding is on.
 * - "changed": keeps findings whose file is in `hunks` AND whose line falls
 *   inside at least one of that file's changed-line ranges.
 * @param {Array<{file: string, line: number}>} findings
 * @param {"full"|"files"|"changed"} scope
 * @param {Map<string, Array<[number, number]>>} hunks
 * @param {{cwd?: string, repoToplevel?: string}} [opts]
 * @returns {Array<object>}
 */
export function filterFindingsByScope(findings, scope, hunks, { cwd, repoToplevel } = {}) {
  if (scope === "full") return findings;

  const resolvedCwd = cwd ?? process.cwd();
  const resolvedToplevel = repoToplevel ?? tryGit(["rev-parse", "--show-toplevel"], { cwd: resolvedCwd }) ?? resolvedCwd;

  return findings.filter((finding) => {
    const repoRelPath = toRepoRelativePosix(finding.file, {
      cwd: resolvedCwd,
      repoToplevel: resolvedToplevel,
    });
    if (!hunks.has(repoRelPath)) return false;
    if (scope === "files") return true;
    // scope === "changed"
    const ranges = hunks.get(repoRelPath);
    if (!ranges || ranges.length === 0) return false;
    return ranges.some(([start, end]) => finding.line >= start && finding.line <= end);
  });
}

/**
 * Builds the GitHub Reviews API JSON payload for
 * `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews` — a single review
 * with `event: "COMMENT"` and one comment entry per finding.
 *
 * Callers MUST feed already scope-filtered findings (i.e. the result of
 * `filterFindingsByScope(findings, "changed", hunks, opts)`), not raw
 * findings — a finding surviving "changed" scope filtering is by definition
 * on a diff-visible line, so this function does not re-filter by hunk
 * ranges itself; it trusts its input. This mirrors how the CLI wires it:
 * scan --scope changed → filterFindingsByScope → renderReviewComments.
 *
 * Uses the current Reviews API's `line` + `side` fields (not the deprecated
 * `position` field) — `side` is always `"RIGHT"` since the hunk map (Slice A)
 * only carries new-side (post-change) line ranges; there is no old-side
 * mapping to compute.
 *
 * Returns `null` when `findings` is empty — an empty review with zero
 * comments is pointless (and the Reviews API may reject `comments: []` with
 * `event: "COMMENT"` and no `body`), so callers must skip posting entirely
 * in that case rather than submit a no-op review.
 *
 * @param {Array<{file: string, line: number, description: string, fix: string}>} findings
 *   Pre-filtered findings (already scope-filtered to diff-visible lines).
 * @param {string} commitSha
 * @returns {{commit_id: string, event: "COMMENT", comments: Array<{path: string, line: number, side: "RIGHT", body: string}>} | null}
 */
export function renderReviewComments(findings, commitSha) {
  if (!findings || findings.length === 0) return null;

  const comments = findings.map((f) => ({
    path: f.file,
    line: f.line,
    side: "RIGHT",
    body: `**${f.description}**\n\nFix: ${f.fix}`,
  }));

  return {
    commit_id: commitSha,
    event: "COMMENT",
    comments,
  };
}

const MARKDOWN_REPORT_ICON =
  '<img src="https://raw.githubusercontent.com/educlopez/ui-craft/main/assets/icon.svg" width="40">';

// Escapes table-breaking characters in a markdown table cell: `|` would
// otherwise terminate the cell early (findings' `fix`/`file` text can
// plausibly contain a literal pipe, e.g. Tailwind arbitrary values or JS
// bitwise-or), and embedded newlines would break out of the row entirely.
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/**
 * Renders findings as a branded markdown report for CI surfaces (sticky PR
 * comment body, $GITHUB_STEP_SUMMARY). Pure function — no I/O, no network.
 *
 * Mirrors `renderReviewComments`'s contract: callers are responsible for any
 * scope filtering before calling this — findings are rendered exactly as
 * given, with no internal re-filtering.
 *
 * Unlike `renderReviewComments`, this ALWAYS returns a non-empty string —
 * an empty/null/undefined `findings` array renders a positive "no issues"
 * state rather than `null`, since CI surfaces should never render blank.
 *
 * @param {Array<{rule: string, severity: "critical"|"major"|"warn", file: string, line: number, fix: string}>} findings
 * @param {{files_scanned: number, files_flagged: number, errors: number, warnings: number}} summary
 * @returns {string}
 */
export function renderMarkdownReport(findings, summary) {
  const header = `${MARKDOWN_REPORT_ICON}\n\n### ui-craft-detect\n\n`;

  if (!findings || findings.length === 0) {
    return `${header}✅ No issues found\n`;
  }

  const errs = findings.filter((f) => f.severity === "critical");
  const warns = findings.filter((f) => f.severity === "major" || f.severity === "warn");

  const table = (rows) =>
    `| rule | file:line | severity | fix |\n|---|---|---|---|\n` +
    rows
      .map(
        (f) =>
          `| ${cell(f.rule)} | ${cell(path.relative(process.cwd(), f.file))}:${f.line} | ${cell(f.severity)} | ${cell(f.fix)} |`,
      )
      .join("\n") +
    "\n";

  const section = (rows, open, label) =>
    rows.length
      ? `<details${open ? " open" : ""}>\n<summary>${rows.length} ${label}</summary>\n\n${table(rows)}\n</details>\n\n`
      : "";

  const summaryLine =
    `${summary?.files_scanned ?? 0} files scanned, ${findings.length} findings ` +
    `(${summary?.errors ?? errs.length} errors, ${summary?.warnings ?? warns.length} warnings)\n\n`;

  return header + summaryLine + section(errs, true, "errors") + section(warns, false, "warnings");
}

