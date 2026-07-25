#!/usr/bin/env node
/**
 * Mirror generator — the write half of `scripts/check-mirror-copies.mjs`.
 *
 * Canonical sources are `skills/` and `commands/`. Everything below is derived:
 *
 *   1. skills/<id>/**                 → cli/assets/<harness>/skills/<id>/**
 *                                     → <root-harness>/skills/<id>/**        (byte copy)
 *   2. commands/*.md                  → cli/assets/{claude,opencode}/commands/*.md  (byte copy)
 *   3. commands/<name>.md             → any harness skills/<name>/SKILL.md    (peer sub-skill:
 *                                       keeps the mirror's own frontmatter, HARNESS MIRROR
 *                                       header and Context paragraph, replaces the body)
 *
 * Steps 1 and 2 are what the drift guard enforces. Step 3 is not guarded but is generated
 * here anyway, so non-Claude harnesses do not silently serve stale command text.
 *
 * Existing mirrors are updated in place; this never creates a harness that isn't already
 * committed, so adding a harness stays a deliberate act.
 *
 * Node 18+. Zero dependencies.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs"
import { resolve, join, relative, dirname } from "node:path"
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

let written = 0
const skipped = []

function walkFiles(dir, base = dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) out.push(...walkFiles(abs, base))
    else out.push(relative(base, abs))
  }
  return out
}

function writeIfChanged(dst, content) {
  if (existsSync(dst) && readFileSync(dst, "utf8") === content) return false
  mkdirSync(dirname(dst), { recursive: true })
  writeFileSync(dst, content)
  written++
  return true
}

const MIRROR_HEADER_RE = /^<!-- HARNESS MIRROR .*-->$/m

/**
 * Some mirrors carry a "do not edit here" header the canonical file does not have. The
 * drift guard strips it before comparing, so it must survive a sync rather than be
 * flattened away.
 */
function preserveMirrorHeader(canonical, existing) {
  const header = existing?.match(MIRROR_HEADER_RE)?.[0]
  if (!header || canonical.includes(header)) return canonical
  const fm = canonical.match(/^---\n[\s\S]*?\n---\n/)
  if (!fm) return `${header}\n\n${canonical}`
  return `${fm[0]}\n${header}\n${canonical.slice(fm[0].length)}`
}

/** Byte-for-byte copy — used wherever the drift guard compares content. */
function copyTree(srcDir, dstDir) {
  if (!existsSync(srcDir) || !existsSync(dstDir)) return
  for (const rel of walkFiles(srcDir)) {
    const dst = join(dstDir, rel)
    const canonical = readFileSync(join(srcDir, rel), "utf8")
    const existing = existsSync(dst) ? readFileSync(dst, "utf8") : null
    writeIfChanged(dst, preserveMirrorHeader(canonical, existing))
  }
}

/** Strip a command file's YAML frontmatter, leaving the body the peer skill wraps. */
function commandBody(raw) {
  const m = raw.match(/^---\n[\s\S]*?\n---\n+/)
  return m ? raw.slice(m[0].length) : raw
}

/**
 * A peer sub-skill's preamble is its own frontmatter plus the harness-only header and
 * Context paragraph. Everything after that is the canonical command body.
 */
function peerPreamble(mirror) {
  const marker = "**Context:** this sub-skill"
  const at = mirror.indexOf(marker)
  if (at === -1) return null
  const end = mirror.indexOf("\n\n", at)
  if (end === -1) return null
  return mirror.slice(0, end + 2)
}

// --- 1. skill trees ---
for (const id of SKILL_IDS) {
  const src = join(ROOT, "skills", id)
  if (!existsSync(src)) continue
  for (const harness of CLI_HARNESSES) copyTree(src, join(ROOT, "cli/assets", harness, "skills", id))
  for (const harness of ROOT_HARNESSES) copyTree(src, join(ROOT, harness, "skills", id))
}

// --- 2 + 3. commands ---
const cmdDir = join(ROOT, "commands")
if (existsSync(cmdDir)) {
  const files = readdirSync(cmdDir).filter((f) => f.endsWith(".md"))

  for (const file of files) {
    const raw = readFileSync(join(cmdDir, file), "utf8")

    for (const harness of COMMAND_HARNESSES) {
      const dst = join(ROOT, "cli/assets", harness, "commands", file)
      if (existsSync(dst)) writeIfChanged(dst, raw)
    }

    // Peer sub-skills: same name as the command, one directory per harness.
    const name = file.replace(/\.md$/, "")
    const peerRoots = [
      ...CLI_HARNESSES.map((h) => join(ROOT, "cli/assets", h, "skills")),
      ...ROOT_HARNESSES.map((h) => join(ROOT, h, "skills")),
    ]
    for (const peerRoot of peerRoots) {
      const dst = join(peerRoot, name, "SKILL.md")
      if (!existsSync(dst)) continue
      const preamble = peerPreamble(readFileSync(dst, "utf8"))
      if (!preamble) {
        skipped.push(relative(ROOT, dst))
        continue
      }
      writeIfChanged(dst, preamble + commandBody(raw))
    }
  }
}

// --- report ---
console.log(`✓ sync-mirrors: ${written} file(s) written`)
if (skipped.length) {
  console.warn(
    `\n! ${skipped.length} peer sub-skill(s) had no recognizable preamble and were left alone:`,
  )
  for (const s of skipped) console.warn(`  • ${s}`)
}
