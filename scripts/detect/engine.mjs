// Core scanning engine: config discovery, ignore-comment handling, file
// walking, per-file rule application, fix-mode, SARIF rendering, and the
// scan() programmatic API. Split out of the former monolithic
// scripts/detect.mjs — no behavior change.

import { promises as fs } from "node:fs";
import path from "node:path";

import { rules } from "./rules.mjs";
import { VERSION, SCAN_EXTENSIONS, SKIP_DIRS } from "./constants.mjs";

// --- Config loading ------------------------------------------------------

const CONFIG_FILENAME = ".uicraftrc.json";

/**
 * Walk up from startDir until we find .uicraftrc.json or hit a git root / fs root.
 * Returns { config, path } or { config: null, path: null }.
 */
export async function loadConfig(startDir) {
  let dir = path.resolve(startDir);
  // If we were given a file, start from its directory.
  try {
    const st = await fs.stat(dir);
    if (st.isFile()) dir = path.dirname(dir);
  } catch {
    return { config: null, path: null };
  }
  while (true) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    try {
      const raw = await fs.readFile(candidate, "utf8");
      try {
        const parsed = JSON.parse(raw);
        return { config: parsed, path: candidate };
      } catch (err) {
        process.stderr.write(
          `warning: ${candidate} has invalid JSON (${err.message}); using defaults\n`,
        );
        return { config: null, path: null };
      }
    } catch {
      // not here; check for .git as a stop boundary
      try {
        await fs.stat(path.join(dir, ".git"));
        return { config: null, path: null }; // hit git root, stop
      } catch {
        // not a git root — keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return { config: null, path: null };
    dir = parent;
  }
}

/**
 * Apply config to a finding: returns null if disabled ("off"), or a finding
 * with possibly remapped severity ("warn" / "error").
 */
function applyConfigToFinding(finding, config) {
  if (!config || !config.rules) return finding;
  const setting = config.rules[finding.rule];
  if (!setting) return finding;
  if (setting === "off") return null;
  if (setting === "warn") return { ...finding, severity: "warn" };
  if (setting === "error") return { ...finding, severity: "critical" };
  return finding;
}

/**
 * Convert a tiny glob (supports *, **, ?) to a RegExp.
 * Doesn't handle character classes or brace expansion — that's fine for our scope.
 */
function globToRegex(glob) {
  let re = "^";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        // ** matches across path separators
        re += ".*";
        i += 2;
        if (glob[i] === "/") i++; // consume trailing slash
      } else {
        re += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      re += "[^/]";
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      re += "\\" + ch;
      i++;
    } else {
      re += ch;
      i++;
    }
  }
  re += "$";
  return new RegExp(re);
}

export function isIgnoredByConfig(filePath, config, baseDir) {
  if (!config || !Array.isArray(config.ignore)) return false;
  // Use POSIX-style relative path for glob matching.
  const rel = path.relative(baseDir, filePath).split(path.sep).join("/");
  for (const pattern of config.ignore) {
    if (globToRegex(pattern).test(rel)) return true;
  }
  return false;
}

// --- Ignore comments -----------------------------------------------------

/**
 * Pre-scan a file's lines for ignore comments. Returns:
 *   { fileIgnored: boolean, skip: Map<lineNumber, Set<ruleId|"*">> }
 *
 * Supported markers (anywhere in the line, /*…*\/, //…, or <!--…-->):
 *   ui-craft-detect-ignore                     → skip current line
 *   ui-craft-detect-ignore-next-line           → skip next non-empty line
 *   ui-craft-detect-ignore-file                → skip entire file
 *   ui-craft-detect-ignore-rule: <rule-id>     → skip only that rule on current line
 */
function applyIgnoreComments(lines) {
  const skip = new Map();
  let fileIgnored = false;
  const add = (lineNum, ruleId) => {
    if (!skip.has(lineNum)) skip.set(lineNum, new Set());
    skip.get(lineNum).add(ruleId);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/ui-craft-detect-ignore-file\b/.test(line)) {
      fileIgnored = true;
      continue;
    }
    if (/ui-craft-detect-ignore-next-line\b/.test(line)) {
      // Find next non-empty line
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== "") {
          add(j + 1, "*");
          break;
        }
      }
      continue;
    }
    const ruleMatch = line.match(/ui-craft-detect-ignore-rule:\s*([a-zA-Z0-9_-]+)/);
    if (ruleMatch) {
      add(i + 1, ruleMatch[1]);
      continue;
    }
    // Plain ignore — must check AFTER the more specific patterns above.
    if (/ui-craft-detect-ignore\b(?!-)/.test(line)) {
      add(i + 1, "*");
    }
  }
  return { fileIgnored, skip };
}

function isFindingIgnored(finding, ignoreInfo) {
  if (!ignoreInfo) return false;
  const set = ignoreInfo.skip.get(finding.line);
  if (!set) return false;
  return set.has("*") || set.has(finding.rule);
}

// --- Scanning ------------------------------------------------------------

export async function walk(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".DS_Store")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.has(ext)) out.push(full);
    }
  }
  return out;
}

export function scanFile(filePath, content, config) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  const ext = path.extname(filePath);
  const ctx = { filePath, lines, ext };

  const ignoreInfo = applyIgnoreComments(lines);
  if (ignoreInfo.fileIgnored) return [];

  // Per-line rules
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    ctx.lineIdx = i;
    for (const rule of rules) {
      if (rule.scope === "file") continue;
      if (config && config.rules && config.rules[rule.id] === "off") continue;
      const res = rule.match(line, ctx);
      if (!res) continue;
      const finding = {
        file: filePath,
        line: i + 1,
        severity: rule.severity,
        rule: rule.id,
        description: rule.description,
        snippet: (typeof res === "object" && res.snippet ? res.snippet : line.trim()).slice(0, 160),
        fix: rule.fix,
      };
      if (isFindingIgnored(finding, ignoreInfo)) continue;
      const adjusted = applyConfigToFinding(finding, config);
      if (adjusted) findings.push(adjusted);
    }
  }

  // File-level rules from the rules array
  for (const rule of rules) {
    if (rule.scope !== "file" || typeof rule.matchFile !== "function") continue;
    if (config && config.rules && config.rules[rule.id] === "off") continue;
    const hits = rule.matchFile(content, lines, ctx);
    for (const hit of hits) {
      const finding = {
        file: filePath,
        line: hit.line,
        severity: rule.severity,
        rule: rule.id,
        description: rule.description,
        snippet: hit.snippet,
        fix: rule.fix,
      };
      if (isFindingIgnored(finding, ignoreInfo)) continue;
      const adjusted = applyConfigToFinding(finding, config);
      if (adjusted) findings.push(adjusted);
    }
  }

  // Legacy file-level rule: glassmorphism stack.
  if (!config || !config.rules || config.rules["glassmorphism-stack"] !== "off") {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasBlur = /\bbackdrop-blur(?:-\w+)?\b|backdrop-filter:\s*blur/.test(line);
      const hasBgWhite = /\bbg-white\/\d+\b|background(?:-color)?:\s*rgba\(\s*255\s*,\s*255\s*,\s*255/.test(line);
      const hasBorderWhite = /\bborder-white\/\d+\b|border(?:-color)?:\s*rgba\(\s*255\s*,\s*255\s*,\s*255/.test(line);
      if (hasBlur && hasBgWhite && hasBorderWhite) {
        const finding = {
          file: filePath,
          line: i + 1,
          severity: "critical",
          rule: "glassmorphism-stack",
          description: "glassmorphism stack",
          snippet: "backdrop-blur + bg-white/… + border-white/…",
          fix: "pick one — frosted panels age badly; solid fill or hairline border is cleaner",
        };
        if (isFindingIgnored(finding, ignoreInfo)) continue;
        const adjusted = applyConfigToFinding(finding, config);
        if (adjusted) findings.push(adjusted);
      }
    }
  }

  // Legacy file-level rule: uniform border-radius.
  if (!config || !config.rules || config.rules["uniform-border-radius"] !== "off") {
    const roundedCounts = new Map();
    const roundedFirstLine = new Map();
    const roundedRe = /\brounded-(?:none|xs|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\])\b/g;
    for (let i = 0; i < lines.length; i++) {
      const matches = lines[i].match(roundedRe);
      if (!matches) continue;
      for (const m of matches) {
        roundedCounts.set(m, (roundedCounts.get(m) || 0) + 1);
        if (!roundedFirstLine.has(m)) roundedFirstLine.set(m, i + 1);
      }
    }
    const totalVariants = roundedCounts.size;
    for (const [token, count] of roundedCounts) {
      if (count > 5 && totalVariants === 1) {
        const finding = {
          file: filePath,
          line: roundedFirstLine.get(token),
          severity: "major",
          rule: "uniform-border-radius",
          description: "uniform border-radius",
          snippet: `${token} used ${count}× with no variation`,
          fix: "vary radii by element role — cards, pills, inputs want different shapes",
        };
        if (!isFindingIgnored(finding, ignoreInfo)) {
          const adjusted = applyConfigToFinding(finding, config);
          if (adjusted) findings.push(adjusted);
        }
        break;
      }
    }
  }

  return findings;
}

// --- Fix mode ------------------------------------------------------------

/**
 * Apply auto-fixes to file content. Returns { content, fixedByRule: Map<ruleId, count> }.
 * Only rules with a `fix_apply` method on the rule definition are applied.
 */
export function applyFix(content) {
  let cur = content;
  const fixedByRule = new Map();
  for (const rule of rules) {
    if (typeof rule.fix_apply !== "function") continue;
    const before = cur;
    const { content: next, fixed } = rule.fix_apply(cur);
    if (fixed > 0 && next !== before) {
      cur = next;
      fixedByRule.set(rule.id, (fixedByRule.get(rule.id) || 0) + fixed);
    }
  }
  return { content: cur, fixedByRule };
}

/**
 * Minimal unified-style diff for --fix-dry-run. Not exact unified format, but
 * good enough to eyeball changes without a dependency.
 */
export function makeDiff(before, after) {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const out = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) out.push(`- ${a[i]}`);
    if (b[i] !== undefined) out.push(`+ ${b[i]}`);
  }
  return out.join("\n");
}

// --- SARIF output --------------------------------------------------------

export function toSarif(findings, ruleDefs) {
  const usedRules = [...new Set(findings.map((f) => f.rule))];
  const ruleIndex = new Map(usedRules.map((id, i) => [id, i]));
  const cwd = process.cwd();
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ui-craft-detect",
            version: VERSION,
            informationUri: "https://github.com/educlopez/ui-craft",
            rules: usedRules.map((id) => {
              const def = ruleDefs.find((r) => r.id === id);
              return {
                id,
                name: id,
                shortDescription: { text: def ? def.description : id },
                helpUri: "https://github.com/educlopez/ui-craft",
                defaultConfiguration: {
                  level: severityToSarifLevel(def ? def.severity : "warn"),
                },
              };
            }),
          },
        },
        results: findings.map((f) => ({
          ruleId: f.rule,
          ruleIndex: ruleIndex.get(f.rule),
          level: severityToSarifLevel(f.severity),
          message: { text: `${f.description} — ${f.snippet}. Fix: ${f.fix}` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: path.relative(cwd, f.file).split(path.sep).join("/"),
                },
                region: { startLine: f.line },
              },
            },
          ],
        })),
      },
    ],
  };
}

function severityToSarifLevel(sev) {
  if (sev === "critical") return "error";
  if (sev === "major") return "warning";
  if (sev === "warn") return "warning";
  return "note";
}

// --- Programmatic API ----------------------------------------------------

/**
 * Scan a target path and return findings.
 *
 * @param {string} target - Path to a file or directory to scan. Defaults to ".".
 * @param {{ config?: object }} [opts] - Optional options object.
 *   config: a parsed config object (same shape as .uicraftrc.json); overrides
 *           the on-disk config search when provided.
 * @returns {Promise<{ version: string, summary: object, findings: object[] }>}
 *   The same object that `--json` prints to stdout, with file paths relative to cwd.
 */
export async function scan(target = ".", { config: configOverride } = {}) {
  const resolved = path.resolve(target);

  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch (err) {
    // Path does not exist — return a structured error result with zero findings.
    return {
      version: VERSION,
      summary: { files_scanned: 0, files_flagged: 0, errors: 0, warnings: 0, auto_fixed: 0 },
      findings: [],
      error: `cannot read path "${target}": ${err.message}`,
    };
  }

  // Load config: use override if provided, else search disk.
  let config = configOverride ?? null;
  if (config === null) {
    const configStartDir = stat.isDirectory() ? resolved : path.dirname(resolved);
    ({ config } = await loadConfig(configStartDir));
  }

  let files = [];
  if (stat.isDirectory()) {
    files = await walk(resolved);
  } else if (stat.isFile()) {
    const ext = path.extname(resolved);
    if (SCAN_EXTENSIONS.has(ext)) files = [resolved];
  }

  // Apply config-level ignore globs.
  if (config && Array.isArray(config.ignore)) {
    const configStartDir = stat.isDirectory() ? resolved : path.dirname(resolved);
    files = files.filter((f) => !isIgnoredByConfig(f, config, configStartDir));
  }

  // Run scan.
  const allFindings = [];
  for (const f of files) {
    let content;
    try {
      content = await fs.readFile(f, "utf8");
    } catch {
      continue;
    }
    const fileFindings = scanFile(f, content, config);
    allFindings.push(...fileFindings);
  }

  const flaggedFiles = new Set(allFindings.map((f) => f.file));
  const errors = allFindings.filter((f) => f.severity === "critical").length;
  const majors = allFindings.filter((f) => f.severity === "major").length;
  const warnings = allFindings.filter((f) => f.severity === "warn").length;

  const summary = {
    files_scanned: files.length,
    files_flagged: flaggedFiles.size,
    errors,
    warnings: majors + warnings,
    auto_fixed: 0,
  };

  const cwd = process.cwd();
  return {
    version: VERSION,
    summary,
    findings: allFindings.map((f) => ({
      file: path.relative(cwd, f.file),
      line: f.line,
      severity: f.severity,
      rule: f.rule,
      description: f.description,
      snippet: f.snippet,
      fix: f.fix,
    })),
  };
}

