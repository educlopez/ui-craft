#!/usr/bin/env node
/**
 * Sync the ui-craft skill to every supported agent harness.
 *
 * Source of truth:
 *   - skills/ui-craft/         → the main skill + references
 *   - commands/*.md            → 7 slash commands (Claude-Code-specific)
 *
 * Generates:
 *   - .{harness}/skills/ui-craft/                → main skill mirror
 *   - .{harness}/skills/{command-name}/SKILL.md  → each command as a peer sub-skill
 *
 * Rationale: only Claude Code supports slash commands. Codex / Cursor / Gemini /
 * OpenCode / generic agents only understand skills. To expose our command lenses
 * in those agents, we materialize each command as a standalone skill that
 * delegates into the main ui-craft skill.
 *
 * Run: `node scripts/sync-harnesses.mjs`  (or `npm run sync`)
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  existsSync,
  cpSync,
} from "node:fs"
import { resolve, dirname, basename } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

// Harnesses that support the agent-skills spec. Claude Code reads from
// `skills/ui-craft/` + `commands/` directly via `.claude-plugin/plugin.json`,
// so we don't mirror to `.claude/` — it would just be duplication.
const HARNESSES = [".codex", ".cursor", ".gemini", ".opencode", ".agents"]

const SOURCE_SKILL_DIR = resolve(ROOT, "skills/ui-craft")
const SOURCE_COMMANDS_DIR = resolve(ROOT, "commands")

const BANNER = `<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with \`node scripts/sync-harnesses.mjs\`. -->\n`

function insertBannerAfterFrontmatter(md) {
  const fmClose = md.indexOf("\n---\n", 3)
  if (fmClose === -1) return BANNER + md
  const cut = fmClose + 5
  return md.slice(0, cut) + "\n" + BANNER + md.slice(cut)
}

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)/)
  if (!m) return { frontmatter: {}, body: md }
  const frontmatter = {}
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    frontmatter[kv[1]] = value
  }
  return { frontmatter, body: m[2] }
}

function commandToSkill(commandName, commandContent) {
  const { frontmatter, body } = parseFrontmatter(commandContent)
  const description =
    frontmatter.description ||
    `UI Craft ${commandName} — applies the ${commandName} lens.`

  // Skills use `name` + `description`. `argument-hint` is a Claude-Code slash-command
  // convention and doesn't apply to skills.
  const skillFm = [
    "---",
    `name: ${commandName}`,
    `description: "${description} Invoke when the user asks for ${commandName} on their UI, or mentions '${commandName}' alongside design / UI / frontend work."`,
    "---",
  ].join("\n")

  // In commands, `$ARGUMENTS` is a Claude-Code slash-command placeholder. In a skill,
  // the target is whatever the user described — rewrite the reference.
  const rewrittenBody = body
    .replace(/`\$ARGUMENTS`/g, "the target the user described")
    .replace(/\$ARGUMENTS/g, "the target the user described")
    .trim()

  const contextNote =
    "**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.\n"

  return `${skillFm}\n\n${BANNER}\n${contextNote}\n${rewrittenBody}\n`
}

// ---------- run ----------

if (!existsSync(SOURCE_SKILL_DIR)) {
  console.error(`❌ Source skill not found: ${SOURCE_SKILL_DIR}`)
  process.exit(1)
}
if (!existsSync(SOURCE_COMMANDS_DIR)) {
  console.error(`❌ Source commands not found: ${SOURCE_COMMANDS_DIR}`)
  process.exit(1)
}

const commandFiles = readdirSync(SOURCE_COMMANDS_DIR).filter((f) =>
  f.endsWith(".md"),
)

let totalDirs = 0

for (const harness of HARNESSES) {
  const harnessSkillsDir = resolve(ROOT, harness, "skills")

  // Wipe the harness's skills dir so removed sources don't linger.
  if (existsSync(harnessSkillsDir)) {
    rmSync(harnessSkillsDir, { recursive: true, force: true })
  }
  mkdirSync(harnessSkillsDir, { recursive: true })

  // 1. Main skill mirror
  const mainDest = resolve(harnessSkillsDir, "ui-craft")
  cpSync(SOURCE_SKILL_DIR, mainDest, { recursive: true })
  const mainSkillMd = resolve(mainDest, "SKILL.md")
  writeFileSync(
    mainSkillMd,
    insertBannerAfterFrontmatter(readFileSync(mainSkillMd, "utf8")),
  )
  totalDirs++

  // 2. Each command → peer sub-skill
  for (const file of commandFiles) {
    const name = basename(file, ".md")
    const content = readFileSync(resolve(SOURCE_COMMANDS_DIR, file), "utf8")
    const subSkillDir = resolve(harnessSkillsDir, name)
    mkdirSync(subSkillDir, { recursive: true })
    writeFileSync(resolve(subSkillDir, "SKILL.md"), commandToSkill(name, content))
    totalDirs++
  }
}

console.log(`✅ Sync complete`)
console.log(`   Harnesses: ${HARNESSES.join(", ")}`)
console.log(`   Commands materialized as sub-skills: ${commandFiles.length}`)
console.log(`   Total dirs written: ${totalDirs}`)
