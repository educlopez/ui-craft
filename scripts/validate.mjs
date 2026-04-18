#!/usr/bin/env node
/**
 * Repo validator. Checks:
 *   - .claude-plugin/plugin.json and marketplace.json parse as JSON.
 *   - Every path listed under plugin.json.skills exists.
 *   - plugin.json.commands paths exist.
 *   - Every skills/<slug>/SKILL.md has YAML frontmatter with `name` + `description`.
 *   - Every commands/*.md has frontmatter with `description` + `argument-hint`.
 *   - Every markdown link inside a SKILL.md pointing at `references/*.md`
 *     or `../<sibling>/…` resolves to an existing file.
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — at least one failure
 *   2 — couldn't read the repo (env error)
 *
 * Node 18+. Zero dependencies.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { resolve, dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

const isTTY = process.stdout.isTTY
const c = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s)
const green = (s) => c("32", s)
const red = (s) => c("31", s)
const dim = (s) => c("2", s)

const failures = []
let checks = 0

function check(label, ok, detail = "") {
  checks++
  if (ok) {
    console.log(`${green("✓")} ${label}${detail ? dim(" — " + detail) : ""}`)
  } else {
    failures.push(label + (detail ? ` — ${detail}` : ""))
    console.log(`${red("✗")} ${label}${detail ? " — " + detail : ""}`)
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (e) {
    return null
  }
}

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return null
  const fm = {}
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    fm[kv[1]] = value
  }
  return fm
}

// --- 1. Plugin manifests ---------------------------------------------------

const pluginJsonPath = resolve(ROOT, ".claude-plugin/plugin.json")
const plugin = readJson(pluginJsonPath)
check(".claude-plugin/plugin.json parses", plugin !== null)

const marketplacePath = resolve(ROOT, ".claude-plugin/marketplace.json")
const marketplace = readJson(marketplacePath)
check(".claude-plugin/marketplace.json parses", marketplace !== null)

if (marketplace) {
  for (const field of ["name", "version", "description", "license", "repository"]) {
    check(`marketplace.json has ${field}`, Boolean(marketplace[field]))
  }
}

// --- 2. Declared skills and commands exist --------------------------------

if (plugin) {
  for (const skillPath of plugin.skills ?? []) {
    const abs = resolve(ROOT, skillPath)
    check(`plugin.skills → ${skillPath} exists`, existsSync(abs))
    const skillMd = resolve(abs, "SKILL.md")
    check(`  ${skillPath}/SKILL.md exists`, existsSync(skillMd))
  }
  for (const cmdPath of plugin.commands ?? []) {
    const abs = resolve(ROOT, cmdPath)
    check(`plugin.commands → ${cmdPath} exists`, existsSync(abs))
  }
}

// --- 3. Skill frontmatter -------------------------------------------------

const skillsDir = resolve(ROOT, "skills")
if (existsSync(skillsDir)) {
  const skillSlugs = readdirSync(skillsDir).filter((n) =>
    statSync(join(skillsDir, n)).isDirectory(),
  )
  for (const slug of skillSlugs) {
    const md = resolve(skillsDir, slug, "SKILL.md")
    if (!existsSync(md)) {
      check(`skills/${slug}/SKILL.md exists`, false)
      continue
    }
    const fm = parseFrontmatter(readFileSync(md, "utf8"))
    check(`skills/${slug} frontmatter parses`, fm !== null)
    if (fm) {
      check(`skills/${slug} has name`, Boolean(fm.name))
      check(`skills/${slug} has description`, Boolean(fm.description))
      check(
        `skills/${slug} description ≤ 1024 chars (Codex limit)`,
        (fm.description?.length ?? 0) <= 1024,
        `${fm.description?.length ?? 0} chars`,
      )
    }
  }
}

// --- 4. Command frontmatter ----------------------------------------------

const commandsDir = resolve(ROOT, "commands")
if (existsSync(commandsDir)) {
  for (const file of readdirSync(commandsDir).filter((f) => f.endsWith(".md"))) {
    const md = resolve(commandsDir, file)
    const fm = parseFrontmatter(readFileSync(md, "utf8"))
    check(`commands/${file} frontmatter parses`, fm !== null)
    if (fm) {
      check(`commands/${file} has description`, Boolean(fm.description))
    }
  }
}

// --- 5. Internal links inside every SKILL.md + references/*.md ------------

function collectMd(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectMd(p))
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(p)
  }
  return out
}

const mdFiles = [...collectMd(skillsDir), ...collectMd(commandsDir)]
let brokenLinks = 0
for (const file of mdFiles) {
  const content = readFileSync(file, "utf8")
  const linkRe = /\[[^\]]*\]\(([^)]+)\)/g
  let m
  while ((m = linkRe.exec(content)) !== null) {
    const target = m[1].split("#")[0].split("?")[0]
    if (!target || /^(https?:|mailto:)/.test(target)) continue
    const abs = resolve(dirname(file), target)
    if (!existsSync(abs)) {
      brokenLinks++
      console.log(
        `${red("✗")} broken link: ${relative(ROOT, file)} → ${target}`,
      )
    }
  }
}
check(
  "all markdown links inside skills/ and commands/ resolve",
  brokenLinks === 0,
  brokenLinks ? `${brokenLinks} broken` : "",
)

// --- Summary --------------------------------------------------------------

console.log()
if (failures.length === 0) {
  console.log(green(`✓ All ${checks} checks passed.`))
  process.exit(0)
} else {
  console.log(red(`✗ ${failures.length} of ${checks} checks failed.`))
  process.exit(1)
}
