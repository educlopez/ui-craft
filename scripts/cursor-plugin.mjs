#!/usr/bin/env node
/**
 * Cursor plugin helpers for this repository.
 *
 * Validates `.cursor-plugin/plugin.json` against the documented Cursor Plugin
 * manifest schema (https://cursor.com/docs/reference/plugins and
 * https://cursor.com/schemas/cursor-plugin/plugin.json) and discovers the
 * components that schema says Cursor will load.
 *
 * Usage:
 *   node scripts/cursor-plugin.mjs validate [pluginRoot]
 *   node scripts/cursor-plugin.mjs inspect  [pluginRoot]
 *
 * Exit 0 on success, 1 on validation / discovery failure, 2 on I/O error.
 * Node 18+. Zero dependencies.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, "..")

const NAME_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/
const URI_PATTERN = /^https?:\/\/\S+$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MANIFEST_FIELDS = new Set([
  "name",
  "displayName",
  "description",
  "version",
  "minClientVersions",
  "author",
  "publisher",
  "homepage",
  "repository",
  "license",
  "logo",
  "keywords",
  "category",
  "tags",
  "commands",
  "agents",
  "skills",
  "rules",
  "hooks",
  "variables",
  "mcpServers",
])

const RULE_EXTS = new Set([".md", ".mdc", ".markdown"])
const COMMAND_EXTS = new Set([".md", ".mdc", ".markdown", ".txt"])
const AGENT_EXTS = new Set([".md", ".mdc", ".markdown"])

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function valueType(value) {
  if (Array.isArray(value)) return "array"
  if (value === null) return "null"
  return typeof value
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0
}

function stringOrStringArray(value) {
  if (typeof value === "string") return true
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function mcpServersShape(value) {
  if (typeof value === "string" || (value !== null && typeof value === "object" && !Array.isArray(value))) {
    return true
  }
  return Array.isArray(value) && value.every((item) => typeof item === "string" || (item !== null && typeof item === "object"))
}

/**
 * Validate a Cursor plugin manifest against the documented schema.
 * Returns an array of human-readable failures (empty = valid).
 */
export function validateCursorPluginManifest(manifest) {
  const failures = []
  if (valueType(manifest) !== "object") {
    return ["$: expected object, got " + valueType(manifest)]
  }
  if (!Object.hasOwn(manifest, "name")) {
    failures.push("$: missing required property name")
  }
  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_FIELDS.has(key)) failures.push(`$: unexpected property ${key}`)
  }

  if (Object.hasOwn(manifest, "name")) {
    if (!isNonEmptyString(manifest.name)) failures.push("$.name: expected non-empty string")
    else if (!NAME_PATTERN.test(manifest.name)) {
      failures.push("$.name: must be lowercase kebab-case (alphanumerics, hyphens, periods)")
    }
  }
  for (const field of ["displayName", "description", "version", "publisher", "license", "logo", "category"]) {
    if (Object.hasOwn(manifest, field) && typeof manifest[field] !== "string") {
      failures.push(`$.${field}: expected string`)
    }
  }
  for (const field of ["homepage", "repository"]) {
    if (!Object.hasOwn(manifest, field)) continue
    if (typeof manifest[field] !== "string") failures.push(`$.${field}: expected string`)
    else if (!URI_PATTERN.test(manifest[field])) failures.push(`$.${field}: expected URI`)
  }
  if (Object.hasOwn(manifest, "author")) {
    const author = manifest.author
    if (valueType(author) !== "object") {
      failures.push("$.author: expected object")
    } else {
      if (!isNonEmptyString(author.name)) failures.push("$.author.name: expected non-empty string")
      for (const key of Object.keys(author)) {
        if (key !== "name" && key !== "email") failures.push(`$.author: unexpected property ${key}`)
      }
      if (Object.hasOwn(author, "email") && (typeof author.email !== "string" || !EMAIL_PATTERN.test(author.email))) {
        failures.push("$.author.email: expected email")
      }
    }
  }
  for (const field of ["keywords", "tags"]) {
    if (Object.hasOwn(manifest, field) && (!Array.isArray(manifest[field]) || !manifest[field].every((item) => typeof item === "string"))) {
      failures.push(`$.${field}: expected array of strings`)
    }
  }
  for (const field of ["commands", "agents", "skills", "rules"]) {
    if (Object.hasOwn(manifest, field) && !stringOrStringArray(manifest[field])) {
      failures.push(`$.${field}: expected string or array of strings`)
    }
  }
  if (Object.hasOwn(manifest, "hooks")) {
    const hooks = manifest.hooks
    if (typeof hooks !== "string" && (hooks === null || typeof hooks !== "object" || Array.isArray(hooks))) {
      failures.push("$.hooks: expected string or object")
    }
  }
  if (Object.hasOwn(manifest, "mcpServers") && !mcpServersShape(manifest.mcpServers)) {
    failures.push("$.mcpServers: expected string, object, or array of either")
  }
  if (Object.hasOwn(manifest, "variables")) {
    const variables = manifest.variables
    if (valueType(variables) !== "object" || variables.type !== "object") {
      failures.push("$.variables: expected { type: \"object\", properties: … }")
    }
  }
  return failures
}

function asPathList(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function assertRelativePath(pathValue, label, failures) {
  if (pathValue.startsWith("/") || pathValue.includes("..")) {
    failures.push(`${label}: path must be relative and must not contain .. (${pathValue})`)
    return false
  }
  return true
}

function listFiles(dir, exts) {
  if (!existsSync(dir)) return []
  const out = []
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const abs = join(current, name)
      let st
      try {
        st = statSync(abs)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(abs)
      else if (exts.has(name.slice(name.lastIndexOf(".")))) out.push(abs)
    }
  }
  walk(dir)
  return out.sort()
}

function resolveComponentPaths(root, spec, { files = false, exts = new Set(), skillDirs = false } = {}) {
  const found = []
  for (const entry of asPathList(spec)) {
    const abs = resolve(root, entry)
    if (!existsSync(abs)) continue
    const st = statSync(abs)
    if (skillDirs) {
      if (st.isDirectory()) {
        const skillMd = join(abs, "SKILL.md")
        if (existsSync(skillMd)) found.push(abs)
        else {
          for (const name of readdirSync(abs)) {
            const child = join(abs, name)
            if (statSync(child).isDirectory() && existsSync(join(child, "SKILL.md"))) found.push(child)
          }
        }
      }
      continue
    }
    if (files) {
      if (st.isFile()) found.push(abs)
      else if (st.isDirectory()) found.push(...listFiles(abs, exts))
    }
  }
  return found
}

function loadHooksConfig(root, spec) {
  if (spec && typeof spec === "object") return spec
  const pathValue = typeof spec === "string" ? spec : "hooks/hooks.json"
  const abs = resolve(root, pathValue)
  if (!existsSync(abs)) return null
  return readJson(abs)
}

function loadMcpServers(root, spec) {
  if (spec && typeof spec === "object" && !Array.isArray(spec)) {
    if (spec.mcpServers && typeof spec.mcpServers === "object") return spec.mcpServers
    return spec
  }
  if (typeof spec === "string") {
    const abs = resolve(root, spec)
    if (!existsSync(abs)) return {}
    const parsed = readJson(abs)
    return parsed.mcpServers ?? parsed
  }
  if (Array.isArray(spec)) {
    return Object.assign({}, ...spec.map((item) => loadMcpServers(root, item)))
  }
  const defaultPath = resolve(root, "mcp.json")
  if (!existsSync(defaultPath)) return {}
  return readJson(defaultPath).mcpServers ?? {}
}

export function discoverCursorPlugin(root) {
  const manifestPath = resolve(root, ".cursor-plugin/plugin.json")
  const manifest = readJson(manifestPath)
  const failures = validateCursorPluginManifest(manifest)

  for (const field of ["skills", "commands", "agents", "rules"]) {
    for (const entry of asPathList(manifest[field])) {
      if (!assertRelativePath(entry, field, failures)) continue
      if (!existsSync(resolve(root, entry))) failures.push(`${field}: missing path ${entry}`)
    }
  }
  if (typeof manifest.hooks === "string") {
    if (assertRelativePath(manifest.hooks, "hooks", failures) && !existsSync(resolve(root, manifest.hooks))) {
      failures.push(`hooks: missing path ${manifest.hooks}`)
    }
  }
  if (typeof manifest.logo === "string" && !/^https?:\/\//.test(manifest.logo)) {
    if (assertRelativePath(manifest.logo, "logo", failures) && !existsSync(resolve(root, manifest.logo))) {
      failures.push(`logo: missing path ${manifest.logo}`)
    }
  }

  const skills = resolveComponentPaths(root, manifest.skills ?? "skills", { skillDirs: true })
  const commands = resolveComponentPaths(root, manifest.commands ?? "commands", { files: true, exts: COMMAND_EXTS })
  const agents = resolveComponentPaths(root, manifest.agents ?? "agents", { files: true, exts: AGENT_EXTS })
  const rules = resolveComponentPaths(root, manifest.rules ?? "rules", { files: true, exts: RULE_EXTS })
  const hooksConfig = loadHooksConfig(root, manifest.hooks)
  const mcpServers = loadMcpServers(root, manifest.mcpServers)

  const hookEvents = []
  const hooksRoot = hooksConfig?.hooks && typeof hooksConfig.hooks === "object" ? hooksConfig.hooks : hooksConfig
  if (hooksRoot && typeof hooksRoot === "object") {
    for (const [event, entries] of Object.entries(hooksRoot)) {
      if (!Array.isArray(entries)) continue
      for (const entry of entries) {
        hookEvents.push({
          event,
          command: entry?.command ?? "",
          matcher: entry?.matcher ?? "",
        })
      }
    }
  }

  return {
    root,
    manifest,
    failures,
    skills: skills.map((abs) => relative(root, abs)).sort(),
    commands: commands.map((abs) => relative(root, abs)).sort(),
    agents: agents.map((abs) => relative(root, abs)).sort(),
    rules: rules.map((abs) => relative(root, abs)).sort(),
    hookEvents,
    mcpServers,
  }
}

export function formatInspect(discovery) {
  const lines = []
  lines.push(`plugin: ${discovery.manifest.name} (${discovery.manifest.version ?? "unversioned"})`)
  lines.push(`root:   ${discovery.root}`)
  lines.push(`skills (${discovery.skills.length}):`)
  for (const skill of discovery.skills) lines.push(`  - ${skill}`)
  lines.push(`commands (${discovery.commands.length}):`)
  for (const command of discovery.commands) lines.push(`  - ${command}`)
  lines.push(`agents (${discovery.agents.length}):`)
  for (const agent of discovery.agents) lines.push(`  - ${agent}`)
  lines.push(`rules (${discovery.rules.length}):`)
  for (const rule of discovery.rules) lines.push(`  - ${rule}`)
  const serverNames = Object.keys(discovery.mcpServers)
  lines.push(`mcpServers (${serverNames.length}):`)
  for (const name of serverNames) {
    const cfg = discovery.mcpServers[name]
    const launch = cfg?.command
      ? [cfg.command, ...(cfg.args ?? [])].join(" ")
      : cfg?.url ?? "(no command or url)"
    lines.push(`  - ${name}: ${launch}`)
  }
  lines.push(`hooks (${discovery.hookEvents.length}):`)
  for (const hook of discovery.hookEvents) {
    const matcher = hook.matcher ? ` matcher=${hook.matcher}` : ""
    lines.push(`  - ${hook.event}${matcher}: ${hook.command}`)
  }
  if (discovery.failures.length) {
    lines.push(`failures (${discovery.failures.length}):`)
    for (const failure of discovery.failures) lines.push(`  - ${failure}`)
  }
  return lines.join("\n")
}

function main() {
  const [, , cmd = "validate", rootArg] = process.argv
  const root = resolve(rootArg ?? REPO_ROOT)
  const manifestPath = resolve(root, ".cursor-plugin/plugin.json")
  if (!existsSync(manifestPath)) {
    process.stderr.write(`cursor-plugin: missing ${relative(process.cwd(), manifestPath)}\n`)
    process.exitCode = 2
    return
  }

  let discovery
  try {
    discovery = discoverCursorPlugin(root)
  } catch (error) {
    process.stderr.write(`cursor-plugin: ${error.message}\n`)
    process.exitCode = 2
    return
  }

  if (cmd === "inspect") {
    process.stdout.write(formatInspect(discovery) + "\n")
    process.exitCode = discovery.failures.length === 0 ? 0 : 1
    return
  }

  if (cmd !== "validate") {
    process.stderr.write(`cursor-plugin: unknown command "${cmd}" (expected validate|inspect)\n`)
    process.exitCode = 2
    return
  }

  if (discovery.failures.length === 0) {
    process.stdout.write(
      `cursor-plugin: ${discovery.manifest.name} matches the documented Cursor plugin schema\n`,
    )
    return
  }
  process.stderr.write(`cursor-plugin: ${discovery.failures.length} schema/path failure(s)\n`)
  for (const failure of discovery.failures) process.stderr.write(`  - ${failure}\n`)
  process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
