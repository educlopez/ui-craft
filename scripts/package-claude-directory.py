#!/usr/bin/env python3
"""Build/check a separate, instruction-only Claude Directory plugin; never publish."""

import argparse
import json
from pathlib import Path
import posixpath
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'plugins/claude-directory'
ZIP = ROOT / 'dist/ui-craft-claude-skills.zip'
NOTICE = '''**Claude Directory skills edition.** This package provides instructions only:
no bundled MCP server, command hook, executable helper, or review agent. Do not
install or launch UI Craft tools on its behalf. Use the supplied references for
manual reviews. Never invent detector results, a deterministic UICraftScore,
seeded draws, or browser measurements. State what was actually inspected and
mark unavailable checks as not verified. Use only capabilities already available
and authorized in the current session; otherwise request source or screenshots.
Write project files only with available, authorized tools; otherwise return the
proposed content as text and do not claim it was saved.
References named below live in the ui-craft skill's references/ directory.
'''
README = '''# UI Craft — skills edition for Claude Directory

29 design-engineering skills for building and reviewing interfaces: discovery,
briefs, design tokens, layout, typography, motion, accessibility, responsive
behavior, landing/dashboard/auth recipes and manual pre-ship checklists.

This is a separate instruction-only edition. It contains no MCP server, automatic
hooks, executable helpers, package installation steps or review agents. Reviews
and the UsabilityScore are judged, not deterministic. Detector output,
UICraftScore, seeded fold selection and automated browser metrics are unavailable.
Existing tools are optional and governed by the host application's permissions;
source and screenshots can be supplied instead. No UI Craft hosted backend or
account is required. Project writes require an available, authorized file tool;
without one, return proposed artifacts as text rather than claiming to save them.

Start with /ui-craft-skills:start. Namespacing depends on the Claude surface. For the
full separately installed Claude Code plugin, see the documentation; installing
this edition does not install, configure or launch that plugin or its tools.
Its plugin name is ui-craft-skills, separate from ui-craft. Enable only one edition
in a session to avoid duplicate, conflicting skill guidance.

- [Documentation](https://ui-craft.smoothui.dev/docs)
- [Support](https://github.com/educlopez/ui-craft/issues)
- [Privacy notice](PRIVACY.md)
- [Terms of use / MIT license](LICENSE)
'''
START = '''---
name: start
description: Orient the user in the UI Craft skills edition, inspect available project context, and recommend one focused next step without changing files.
---

# Start

Read the ui-craft skill. This skill only inspects and routes; do not build or edit.
Identify the framework, existing tokens, brief/spec, target surface and current
host capabilities from supplied context or authorized read tools. Ask for missing
source or screenshots instead of assuming filesystem or browser access.

Report the four rungs honestly:
- Ask: design guidance through the main skill.
- Direct: focused skills such as craft, critique, audit, polish and animate.
- Persist: brief, tokens and remember, only if authorized writing is available.
- Review: manual finalize checklist; no automated gates or deterministic score.

Recommend exactly one next step: brief if context is missing; tokens if the token
spine is absent; craft/sddesign for a new surface; critique/audit for an existing
one; finalize before shipping. Wait for the user before executing that step.
'''
FOLD_PICK = '''**Landing composition, manual selection.** Read
[fold-classes.md](references/fold-classes.md). Offer three classes not yet recorded in the
brief's spent list, prioritizing non-split classes. Select one against the brief
and state its sacrifice. This is a judged selection, not a seeded or random draw.'''
FOLD_CHECK = '''**Landing composition, manual verification.** Compare the built
surface or supplied screenshot with the declared class and its sacrifice.
If no rendered evidence is available, report visual geometry as not verified.
Do not report drift metrics or population scores; this edition cannot measure them.'''


def replace_paragraphs(text, needle, replacement):
    paragraphs = text.split('\n\n')
    return '\n\n'.join(replacement if needle in p else p for p in paragraphs)


def adapt(name, text):
    text = re.sub(r'<!-- HARNESS MIRROR.*?-->\s*', '', text, flags=re.S)
    text = text.replace('../skills/ui-craft/references/', '../ui-craft/references/')
    if name == 'skills/start/SKILL.md':
        text = START
    if name == 'skills/finalize/SKILL.md':
        text = text.replace('runs detector,', 'performs a manual review,')
        text = text.replace('## Step 2 — Detector', '## Step 2 — Manual anti-slop review')
        text = text.replace('detector + token', 'manual anti-slop + token').replace('detector source', 'manual evidence source')
        text = replace_paragraphs(text, 'Run `npx ui-craft-detect`',
            'Read the supplied source and screenshots against the ui-craft anti-slop rules. '
            'Record concrete evidence and severity; do not run or install a detector.')
        text = replace_paragraphs(text, 'Capture all output.',
            'Label findings as judged/manual. Missing source or rendering remains not verified. '
            'Never describe this checklist as a deterministic CI gate.')
    if name == 'skills/redesign/SKILL.md':
        text = text.replace('- Run the detector on the current source (`npx ui-craft-detect <path>`) or live page (`npx ui-craft-detect <url>`) and note findings.',
            '- Review supplied source and screenshots manually against the anti-slop rules; note evidence and gaps. Do not install or run a detector.')
        text = text.replace('detector finding', 'manual review finding').replace('detector findings', 'manual review findings').replace('detector before/after counts', 'judged before/after findings, with evidence')
    if name == 'skills/craft/SKILL.md':
        text = replace_paragraphs(text, '**Landing surfaces — draw the fold', FOLD_PICK)
        text = replace_paragraphs(text, 'If the MCP server is not wired', '')
        text = replace_paragraphs(text, '**Landing surfaces — check the fold', FOLD_CHECK)
        text = replace_paragraphs(text, 'Everything else it returns', '')
        # Links in sub-skills resolve relative to the sibling ui-craft skill.
        text = text.replace('(references/fold-classes.md)', '(../ui-craft/references/fold-classes.md)')
    if name == 'skills/harden/SKILL.md':
        text = re.sub(r'- \*\*MCP connected\*\*.*?\n- \*\*No MCP\*\*.*?\n',
            '- Read the matching archetype in `references/coverage.md`; report present, partial, missing, not-needed or unknown with evidence.\n', text)
    if name == 'skills/heuristic/SKILL.md':
        text = replace_paragraphs(text, '**Step 6 — Compute',
            '**Step 6 — Compute the judged UsabilityScore.** Use the formula in '
            '`references/heuristics.md`: round(((mean Nielsen score - 1) / 4) * 100), '
            'minus 5 per failed design law, clamped to 0–100. Label it judged and '
            'never use it as a deterministic CI gate. If requested, emit the rubric JSON. '
            'A deterministic UICraftScore is unavailable in this edition; do not invent one.')
        text = text.replace('(the judged companion to the deterministic UICraftScore)', '(judged, not a deterministic CI gate)')
    if name == 'skills/ui-craft/SKILL.md':
        text = replace_paragraphs(text, '**If the ui-craft MCP server is connected',
            'Use the intent table below to select references and focused skills manually. '
            'This edition has no automated task router.')
        text = text.replace('If the MCP server is connected, `route_task` names the recipe for you.', '')
        text = text.replace('Call `ux_coverage` (MCP) or read', 'Read')
        text = re.sub(r'^\| \*\*3 · Enforce\*\*.*$',
            '| **3 · Review** | prepare to ship | `/finalize`, `/audit`, `/critique` | judged findings with evidence, no CI gate or deterministic score | one manual pass |', text, flags=re.M)
        text = re.sub(r'^\| Parallel design.*$', '| Design and accessibility review | Use `/critique` and `/audit` as two manual lenses in the current session. No review agents are bundled. |', text, flags=re.M)
        text = re.sub(r'^\| \[agents.md\].*$', '| [agents.md](references/agents.md) | Manual design and accessibility review lenses for this skills edition. |', text, flags=re.M)
        text = text.replace('**Prefer the `ux_coverage` MCP tool** — it returns one archetype instead of all twelve. Generated from `mcp/src/coverage-data.mjs`; do not edit by hand.',
            'Read only the matching archetype and its reporting contract.')
    if name.endswith('/references/coverage.md'):
        text = replace_paragraphs(text, '**Generated from', 'Instruction-only snapshot of the UX coverage reference; review the matching archetype manually.')
        text = replace_paragraphs(text, 'If the MCP server is connected', 'Read the matching archetype in this file; no coverage server is bundled.')
        text = text.replace('`check_anti_slop`', 'the anti-slop checklist').replace('`score_ui` already has', 'hygiene scoring already has')
    if name.endswith('/references/agents.md'):
        text = '# Manual review lenses\n\nThis skills edition includes no agents or parallel delegation setup. Use the critique\nskill for hierarchy, typography, layout, color and craft; use audit for keyboard,\nsemantics, contrast, responsive behavior and performance evidence. Run the lenses\nin the current session. Label findings as judged and report anything not measured\nas not verified. Do not fabricate independent review or reviewer consensus.\n'
    if name.endswith('/references/heuristics.md'):
        text = replace_paragraphs(text, 'The scorecard above is qualitative.',
            'The scorecard is qualitative. UsabilityScore summarizes this judged review as a 0–100 number plus grade. It may vary between reviewers and is not a deterministic CI gate.')
        text = text.split('### Extended quality report (optional combine)')[0] + '''### Extended quality report

This edition computes only the judged UsabilityScore. Report a deterministic
UICraftScore as unavailable, not zero or passed. Keep manually judged usability
findings separate from any externally supplied measurements.
'''
    if name.endswith('/references/recipe-landing.md'):
        text = replace_paragraphs(text, 'Until 2026-08-13',
            'Composition examples must not become a default layout. Choose against the brief and record the sacrifice rather than copying a diagram.')
        text = replace_paragraphs(text, 'Call **`fold_candidates`**', FOLD_PICK.replace('**Landing composition, manual selection.** ', '').replace('(references/fold-classes.md)', '(fold-classes.md)'))
        text = replace_paragraphs(text, 'Render it and call **`check_fold`', FOLD_CHECK)
        text = replace_paragraphs(text, 'If it reports drift',
            'If the observed geometry differs from the intended class, correct it or record the deliberate change and its reason in the brief.')
    if name.endswith('/references/dataviz.md'):
        text = text.replace('When `ui-craft-detect` Flags `dataviz/*` Rules', 'Manual data-visualization checklist').replace('The detector rules map directly onto this file:', 'Use these rule labels as a manual checklist, not detector output:')
    if name.endswith('/references/loops.md'):
        text = text.replace('4. `npx playwright screenshot` — **OPT-IN ONLY.** Present as a choice; NEVER auto-run. If the user declines → rung 5.',
            '4. Ask the user for a screenshot. Do not install a renderer. If none is available, use rung 5.')
    # Preserve typographic punctuation, but do not introduce pictographs in this edition.
    text = re.sub('[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u25CF\u25CB]', '', text)
    if name.endswith('/SKILL.md'):
        end = text.find('\n---', 4) + 4
        text = text[:end] + '\n\n' + NOTICE + text[end:]
    return text


def entries():
    tracked = subprocess.check_output(['git', 'ls-files', '-z', '.codex/skills', 'examples'], cwd=ROOT).decode().split('\0')
    result = {}
    for source in filter(None, tracked):
        if not source.endswith('.md'):
            raise ValueError(f'Unexpected source type: {source}')
        path = ROOT / source
        if path.is_symlink() or not path.is_file():
            raise ValueError(f'Expected regular source file: {source}')
        dest = source.removeprefix('.codex/')
        result[dest] = adapt(dest, path.read_text()).encode()
    manifest = {
        'name': 'ui-craft-skills', 'version': '1.0.0',
        'description': '29 design-engineering skills for interfaces, accessibility, tokens, motion and manual quality reviews. Instruction-only edition; no local MCP or hooks.',
        'author': {'name': 'Eduardo Calvo', 'url': 'https://github.com/educlopez'},
        'homepage': 'https://ui-craft.smoothui.dev',
        'repository': 'https://github.com/educlopez/ui-craft', 'license': 'MIT',
        'keywords': ['design', 'ui', 'accessibility', 'skills'],
        'skills': [f'./skills/{Path(n).parent.name}' for n in sorted(result) if n.endswith('/SKILL.md')],
    }
    result['.claude-plugin/plugin.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    result['.claude-plugin/icon.png'] = (ROOT / 'scripts/claude-directory/icon.png').read_bytes()
    result['README.md'] = README.encode()
    result['LICENSE'] = (ROOT / 'LICENSE').read_bytes()
    result['PRIVACY.md'] = '''# Privacy — UI Craft skills edition

This package consists of instructions and references, plus its icon and license.
It has no scripts, automatic hooks, network client, MCP server, telemetry or
UI Craft backend. The host agent processes supplied content under its own
privacy policy. Optional tools already configured by the user have their own
data policies and permissions; this edition does not install or configure them.
Project artifacts remain where the user authorizes the host to write them.

[Support](https://github.com/educlopez/ui-craft/issues)
'''.encode()
    # Materialize source data as documentation, not an executable module.
    classes = subprocess.check_output(['node', '--input-type=module', '-e',
        'import {COMPOSITION_CLASSES as c} from "./scripts/fold/classes.mjs"; console.log(JSON.stringify(c))'], cwd=ROOT)
    doc = '# Fold composition classes — manual reference\n\nNo seeded draw or automated measurement is provided in this edition.\n'
    for c in json.loads(classes):
        doc += f'\n## {c["id"]} — {c["name"]}\n\nStructure: {c["structure"]}\n\nDemands: {c["demands"]}\n\nSacrifice: {c["sacrifices"]}\n'
    result['skills/ui-craft/references/fold-classes.md'] = doc.encode()
    validate(result)
    return result


def validate(files):
    manifest = json.loads(files['.claude-plugin/plugin.json'])
    if set(manifest) != {'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'skills'}:
        raise ValueError('Unexpected manifest capabilities or fields')
    skill_dirs = sorted(f'./{str(Path(n).parent)}' for n in files if n.endswith('/SKILL.md'))
    if sorted(manifest['skills']) != skill_dirs:
        raise ValueError('Manifest skill paths do not match packaged skills')
    if len(files) > 512:
        raise ValueError('Directory file limit exceeded')
    identities = set()
    for name, data in files.items():
        if not (name in {'README.md', 'LICENSE', 'PRIVACY.md', '.claude-plugin/plugin.json', '.claude-plugin/icon.png'} or name.startswith(('skills/', 'examples/')) and name.endswith('.md')):
            raise ValueError(f'Disallowed package path: {name}')
        if name.startswith('/') or '..' in Path(name).parts or '\\' in name:
            raise ValueError(f'Unsafe path: {name}')
        if name != '.claude-plugin/icon.png' and not (name.endswith(('.md', '.json')) or name == 'LICENSE'):
            raise ValueError(f'Disallowed file: {name}')
        if len(data) > 256 * 1024:
            raise ValueError(f'File exceeds scanner limit: {name}')
        if name.endswith('.png'):
            if data[:8] != b'\x89PNG\r\n\x1a\n' or int.from_bytes(data[16:20], 'big') != 1024 or int.from_bytes(data[20:24], 'big') != 1024:
                raise ValueError('Expected PNG icon')
            continue
        text = data.decode('utf-8')
        if '\0' in text or text.startswith('#!'):
            raise ValueError(f'Executable or binary text: {name}')
        if name.endswith('.md'):
            for forbidden in ('npx ', 'uvx ', 'node scripts/', 'scripts/fold/', '`route_task`', '`fold_candidates`', '`check_fold`', '`ux_coverage`', '`score_ui`'):
                if forbidden in text:
                    raise ValueError(f'Unadapted tool dependency in {name}: {forbidden}')
            for link in re.findall(r'\]\(([^\s)]+)\)', text):
                if '://' in link or link.startswith(('#', 'mailto:')):
                    continue
                dest = posixpath.normpath(posixpath.join(posixpath.dirname(name), link.split('#')[0]))
                if dest not in files:
                    raise ValueError(f'Broken package link: {name} -> {link}')
        if name.endswith('/SKILL.md'):
            match = re.search(r'^name: (.+)$', text, re.M)
            if not match or match[1] in identities:
                raise ValueError(f'Missing or duplicate skill name: {name}')
            identities.add(match[1])
    if len(identities) != 29:
        raise ValueError(f'Expected 29 unique skills, got {len(identities)}')


def build(check=False):
    files = entries()
    if check:
        actual = {p.relative_to(OUTPUT).as_posix(): p for p in OUTPUT.rglob('*') if p.is_file() or p.is_symlink()}
        if set(actual) != set(files) or any(p.is_symlink() or p.read_bytes() != files[n] for n, p in actual.items()):
            raise ValueError('Claude Directory edition is stale or contains unexpected files; regenerate it')
    else:
        # Never delete unknown files from an existing output directory.
        actual = {p.relative_to(OUTPUT).as_posix() for p in OUTPUT.rglob('*') if p.is_file() or p.is_symlink()}
        if actual - files.keys():
            raise ValueError(f'Unexpected output files; refusing to overwrite: {sorted(actual - files.keys())}')
        for name, data in files.items():
            path = OUTPUT / name
            if any(p.is_symlink() for p in (path, *path.parents)):
                raise ValueError(f'Refusing output symlink: {name}')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        ZIP.parent.mkdir(exist_ok=True)
        with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, data in sorted(files.items()):
                item = zipfile.ZipInfo(name, date_time=(2026, 11, 16, 0, 0, 0))
                item.external_attr = 0o100644 << 16
                archive.writestr(item, data, compress_type=zipfile.ZIP_DEFLATED)
        with zipfile.ZipFile(ZIP) as archive:
            if archive.testzip() is not None:
                raise ValueError('ZIP integrity check failed')
    print(f'Claude Directory skills edition: {len(files)} files, 29 unique skills; {"current" if check else OUTPUT}')
    print('Local validation only; no commit, upload or directory approval performed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
