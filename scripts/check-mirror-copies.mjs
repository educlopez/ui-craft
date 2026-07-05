#!/usr/bin/env node
/**
 * Drift guard: canonical skills/ + commands/ must match committed harness mirrors.
 *
 * Compares byte-for-byte (after existence check):
 *   - skills/ui-craft/ tree           ↔ cli/assets/<harness>/skills/ui-craft/
 *   - skills/ui-craft-variant/ tree  ↔ cli/assets/<harness>/skills/ui-craft-variant/
 *   - commands/*.md                    ↔ cli/assets/claude|opencode/commands/
 *   - skills/ui-craft/ tree           ↔ repo-root harness mirrors (.codex, etc.)
 *
 * Peer command skills (.codex/skills/craft/SKILL.md etc.) are derived from commands/
 * with harness-specific frontmatter — not checked here. Update via canonical commands/.
 *
 * Exit 0 = all match. Exit 1 = drift detected.
 *
 * Node 18+. Zero dependencies.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { resolve, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const ROOT = resolve(__dirname, "..")

const CLI_HARNESSES = ["claude", "codex", "cursor", "gemini", "opencode"]
const ROOT_HARNESSES = [".codex", ".agents", ".gemini", ".opencode"]
const SKILL_IDS = [
  "ui-craft",
  "ui-craft-minimal",
  "ui-craft-editorial",
  "ui-craft-dense-dashboard",
]
const COMMAND_HARNESSES = ["claude", "opencode"]

const failures = []

/** Strip harness-only headers so canonical ↔ mirror compares content, not packaging. */
function normalizeContent(buf) {
  return buf
    .toString()
    .replace(/\r\n/g, "\n")
    .replace(/<!-- HARNESS MIRROR[\s\S]*?-->\n?/g, "")
    .replace(/\n\*\*Context:\*\* this sub-skill[\s\S]*?\n\n/, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
}

function walkFiles(dir, base = dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) out.push(...walkFiles(abs, base))
    else out.push(relative(base, abs))
  }
  return out
}

function comparePair(label, src, dst) {
  if (!existsSync(src)) {
    failures.push(`${label}: source missing ${relative(ROOT, src)}`)
    return
  }
  if (!existsSync(dst)) {
    failures.push(`${label}: mirror missing ${relative(ROOT, dst)}`)
    return
  }
  const a = normalizeContent(readFileSync(src))
  const b = normalizeContent(readFileSync(dst))
  if (a !== b) {
    failures.push(`${label}: drift ${relative(ROOT, src)} ↔ ${relative(ROOT, dst)}`)
  }
}

function compareTree(label, srcDir, dstDir) {
  if (!existsSync(srcDir)) return
  for (const rel of walkFiles(srcDir)) {
    comparePair(label, join(srcDir, rel), join(dstDir, rel))
  }
}

// --- skills/ui-craft (+ variants) ↔ cli/assets ---
for (const harness of CLI_HARNESSES) {
  for (const id of SKILL_IDS) {
    const src = join(ROOT, "skills", id)
    const dst = join(ROOT, "cli/assets", harness, "skills", id)
    if (!existsSync(src)) continue
    compareTree(`cli/${harness}/${id}`, src, dst)
  }
}

// --- skills ↔ repo-root harness mirrors ---
for (const harness of ROOT_HARNESSES) {
  for (const id of SKILL_IDS) {
    const src = join(ROOT, "skills", id)
    const dst = join(ROOT, harness, "skills", id)
    if (!existsSync(src)) continue
    compareTree(`${harness}/${id}`, src, dst)
  }
}

// --- commands ↔ claude + opencode ---
const cmdDir = join(ROOT, "commands")
if (existsSync(cmdDir)) {
  for (const file of readdirSync(cmdDir).filter((f) => f.endsWith(".md"))) {
    const src = join(cmdDir, file)
    for (const harness of COMMAND_HARNESSES) {
      const dst = join(ROOT, "cli/assets", harness, "commands", file)
      comparePair(`commands→${harness}`, src, dst)
    }
  }
}

// --- report ---
if (failures.length === 0) {
  console.log("✓ check-mirror-copies: all canonical sources match harness mirrors")
  process.exit(0)
}

console.error("✗ check-mirror-copies FAILED — update mirrors after editing skills/ or commands/\n")
for (const f of failures) console.error(`  • ${f}`)
process.exit(1)
