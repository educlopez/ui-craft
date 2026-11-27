import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parse, stringify } from 'yaml';

const NOTICE = `## MCP prototype delivery rules

These rules override delivery assumptions in the source below. This is an opt-in
local prototype, not the Claude Directory edition. Files are MCP resources, not
paths on the user's disk. Load linked skills only through the host's skill loader
and only after its required approval; a link is not permission to activate one.
Slash-command names describe workflows, not a promise the host registered commands.
Use tools actually exposed by this server for deterministic checks. Do not install
packages, run repository scripts, launch a browser or delegate to agents merely
because the source mentions them. Those need separately available capabilities
and explicit host/user authorization. Otherwise report the step as not verified.
Use the user's task as the workflow arguments, asking when the target is unclear.
Do not enable this catalog together with the installed ui-craft skills edition.

`;

export function deliveryGuide(name, body, entries, { release = false } = {}) {
  const byUri = new Map([...entries].map(entry => [entry.uri, entry]));
  const linked = new Map();
  for (const match of body.matchAll(/skill:\/\/[^\s)`\]"#]+/g)) {
    const entry = byUri.get(match[0]);
    if (!entry) throw new Error(`Unknown skill resource URI: ${match[0]}`);
    linked.set(entry.name, entry);
  }
  if (body.includes('`ui-craft` skill') && name !== 'ui-craft') {
    const main = byUri.get('skill://ui-craft/SKILL.md');
    if (main) linked.set(main.name, main);
  }
  const rows = [...linked.values()].sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => `| ${entry.name} | ${entry.uri} |`).join('\n');
  const notice = release ? NOTICE.replace('MCP prototype delivery rules', 'MCP delivery rules')
    .replace('local prototype, not the Claude Directory edition.', 'local MCP edition, not the Claude Directory skills-only edition.') : NOTICE;
  return `${notice}### Resource addresses are not skill invocation names

This entry's catalog name is \`${name}\`. Its resource address is
\`skill://${name}/SKILL.md\`. The address identifies content for MCP resource
reads and integrity checks. It is NOT an argument for the host's Skill tool.

To load a linked skill, choose its exact invocation name from the host's
advertised skills on the SAME server as this entry. Match the catalog name in
the table below. Claude namespaces invocation names as \`server:catalog-name\`:
reuse the actual server prefix of the current invocation, not a hard-coded
registration name. Pass that exact advertised name to \`Skill.skill\`.
Never pass a resource address, a local file path, or a server prefix joined to a URI to
\`Skill.skill\`. Do not guess a different server when names are ambiguous;
ask for clarification or report the dependency as not verified.

For example, if the host advertises \`design-review:ui-craft-ref-review\`, that
exact name is the Skill argument, NOT \`skill://ui-craft-ref-review/SKILL.md\`.
This is an illustration only: use the host's actual advertised prefix.
Loading another skill still requires the host's own permission/approval flow.

${rows ? `Linked catalog entries (left column is a catalog name, NOT a complete host invocation):

| Catalog name | Resource address, NOT a Skill argument |
| --- | --- |
${rows}
` : 'This entry has no linked catalog dependencies.\n'}
`;
}

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? { data: parse(match[1]), body: text.slice(match[0].length) }
    : { data: {}, body: text };
}

async function markdownFiles(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`Symlink forbidden: ${path}`);
    if (info.isDirectory()) result.push(...await markdownFiles(path));
    else if (info.isFile() && entry.name.endsWith('.md')) result.push(path);
    else throw new Error(`Unsupported catalog source: ${path}`);
  }
  return result.sort();
}

// Generate one separately approved skill per reference. This keeps every skill
// below Claude's scanned-file/skill budgets without truncating canonical text.
export async function buildCatalog(root, output, options = {}) {
  const sourceFiles = [
    ...await markdownFiles(join(root, 'skills')),
    ...(await readdir(join(root, 'commands'))).filter(n => n.endsWith('.md'))
      .map(n => join(root, 'commands', n)),
    join(root, 'examples/animation-storyboard.md'),
  ];
  const mapping = new Map();
  const names = new Set();
  for (const source of sourceFiles.sort()) {
    const rel = relative(root, source).replaceAll('\\', '/');
    const name = basename(source) === 'SKILL.md' ? basename(dirname(source))
      : rel.startsWith('commands/') ? basename(source, '.md')
        : `ui-craft-ref-${basename(source, '.md')}`;
    if (names.has(name)) throw new Error(`Duplicate skill: ${name}`);
    names.add(name);
    mapping.set(source, { name, uri: `skill://${name}/SKILL.md` });
  }
  await mkdir(output, { recursive: true });
  const report = [];
  for (const [source, { name, uri }] of mapping) {
    if (!(await lstat(source)).isFile()) throw new Error(`Not a regular source: ${source}`);
    const { data, body: original } = frontmatter(await readFile(source, 'utf8'));
    let body = original.replace(/\]\(([^)]+)\)/g, (match, target) => {
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) return match;
      const [path, anchor] = target.split('#');
      const entry = mapping.get(resolve(dirname(source), path));
      if (!entry) throw new Error(`Unmapped source link in ${source}: ${target}`);
      return `](${entry.uri}${anchor ? `#${anchor}` : ''})`;
    });
    // The canonical workflows also use bare/backticked reference paths.
    body = body.replace(/(?:\.\.\/ui-craft\/|skills\/ui-craft\/)?references\/([a-z0-9-]+\.md)/g,
      (match, file) => {
        const entry = mapping.get(join(root, 'skills/ui-craft/references', file));
        if (!entry) throw new Error(`Unknown reference: ${match}`);
        return entry.uri;
      });
    body = body.replace(/(?:\.\.\/ui-craft\/|skills\/ui-craft\/)SKILL\.md/g,
      'skill://ui-craft/SKILL.md');
    const description = data.description ?? `UI Craft reference: ${basename(source, '.md')}. Load when this topic is relevant to the user's UI task.`;
    const guide = deliveryGuide(name, body, mapping.values(), options);
    const text = `---\n${stringify({ name, description }, { lineWidth: 0 }).trimEnd()}\n---\n\n${guide}${body.trim()}\n`;
    const bytes = Buffer.byteLength(text);
    if (bytes > 100_000) throw new Error(`Skill exceeds text-file budget: ${name}`);
    await mkdir(join(output, name), { recursive: true });
    await writeFile(join(output, name, 'SKILL.md'), text);
    report.push({ name, uri, source: relative(root, source).replaceAll('\\', '/'), bytes });
  }
  await writeFile(join(dirname(output), 'catalog-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
