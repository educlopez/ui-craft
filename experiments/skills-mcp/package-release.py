#!/usr/bin/env python3
"""Stage local candidates only. Never edit live manifests, install or publish."""
import hashlib
import gzip
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / 'dist/marketplace-v2'
CONFIG = (HERE / 'release-config.mjs').read_text(encoding='utf-8')
MCP_VERSION = re.search(r"MCP_CANDIDATE_VERSION = '([^']+)'", CONFIG)[1]
PLUGIN_VERSION = re.search(r"PLUGIN_CANDIDATE_VERSION = '([^']+)'", CONFIG)[1]
STABLE_VERSION = re.search(r"STABLE_TARGET_VERSION = '([^']+)'", CONFIG)[1]
STABLE = '--stable' in sys.argv or os.environ.get('UI_CRAFT_RELEASE_STABLE') == '1'
if STABLE:
    MCP_VERSION = STABLE_VERSION
    PLUGIN_VERSION = PLUGIN_VERSION.split('-')[0]
TRACKED = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def protected():
    paths = ['.mcp.json', '.claude-plugin', '.cursor-plugin', '.codex-plugin',
             'plugins/claude-directory', 'mcp', 'skills-lock.json']
    return {str(p.relative_to(ROOT)): digest(p) for name in paths
            for p in ([ROOT / name] if (ROOT / name).is_file() else (ROOT / name).rglob('*'))
            if p.is_file() and 'node_modules' not in p.parts and 'dist' not in p.parts}


def put(base, name, data):
    p = base / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data if isinstance(data, bytes) else (json.dumps(data, indent=2) + '\n').encode())


def copy_tracked(base, names=(), prefixes=()):
    for name in sorted(set(names) | {n for n in TRACKED if n.startswith(prefixes)}):
        p = ROOT / name
        if p.is_symlink() or not p.is_file():
            raise ValueError(f'Expected regular tracked file: {name}')
        if name not in TRACKED:
            raise ValueError(f'Untracked source refused: {name}')
        put(base, name, p.read_bytes())


def runtime(base):
    shutil.copytree(OUT / 'runtime', base / 'server/dist')


def privacy(base):
    text = (ROOT / 'PRIVACY.md').read_text(encoding='utf-8')
    old = ('Installing the local MCP server through the declared `npx` launcher contacts\n'
           'the npm registry to obtain the pinned package and its dependencies.')
    assert old in text, 'Review privacy adaptation after canonical notice changes'
    text = text.replace('Effective date: 2026-11-16', 'Effective date: 2026-11-26')
    text = text.replace(old, 'This candidate bundles its local MCP server and runtime dependencies. Its\n'
        'declared Node launcher does not download packages from npm at first use.\n'
        'Installing a separately published npm edition would contact that registry.')
    text = text.replace('## Support and contact', 'The check_fold tool launches an installed Chrome-family browser with a temporary\n'
        'profile and navigates to the user-supplied URL. That destination and its\n'
        'subresources receive normal browser requests. Temporary worker files and\n'
        'profiles are deleted after verified cleanup; failed cleanup retains them\n'
        'for inspection rather than claiming they were removed.\n\n## Support and contact')
    put(base, 'PRIVACY.md', text.encode())


def launch(variable, skills='0'):
    return {'type': 'stdio', 'command': 'node',
            'args': [variable + '/server/dist/server.mjs'],
            'env': {'UI_CRAFT_MCP_SKILLS': skills}}


def registry_descriptor(version=MCP_VERSION):
    registry = json.loads((ROOT / 'mcp/server.json').read_text(encoding='utf-8'))
    registry['version'] = version
    registry['packages'][0]['version'] = version
    registry['websiteUrl'] = 'https://ui-craft.smoothui.dev'
    registry['icons'] = [{'src': 'https://raw.githubusercontent.com/educlopez/ui-craft/main/assets/icon.svg',
                          'mimeType': 'image/svg+xml', 'sizes': ['any']}]
    registry['packages'][0]['environmentVariables'] = [{
        'name': 'UI_CRAFT_MCP_SKILLS', 'description': 'Set 1 only when the host supports Skills over MCP and native UI Craft skills are not installed; otherwise keep 0.',
        'default': '0', 'choices': ['0', '1'], 'isRequired': False, 'isSecret': False}]
    return registry


def zip_tree(base, filename):
    with zipfile.ZipFile(OUT / filename, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(base.rglob('*')):
            if not p.is_file():
                continue
            if p.is_symlink():
                raise ValueError(f'Symlink refused: {p}')
            item = zipfile.ZipInfo(p.relative_to(base).as_posix(), (2026, 1, 1, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            item.create_system = 3
            item.external_attr = (stat.S_IFREG | (0o755 if p.name == 'server.mjs' else 0o644)) << 16
            z.writestr(item, p.read_bytes())


def build():
    before = protected()
    # Build writes runtime/ only; packaging owns these isolated output folders.
    subprocess.run(['node', str(HERE / 'build.mjs'), '--release'] + (['--stable'] if STABLE else []), cwd=HERE, check=True, timeout=120)
    for name in ['npm', 'claude-code', 'cursor', 'openai', 'mcp-only', 'registry', 'promotion']:
        shutil.rmtree(OUT / name, ignore_errors=True)
        (OUT / name).mkdir(parents=True)
    common = ('README.md', 'LICENSE', 'PRIVACY.md', 'assets/icon.svg')
    for channel in ['claude-code', 'cursor']:
        base = OUT / channel
        copy_tracked(base, common + ('scripts/detect.mjs',),
                     ('skills/', 'commands/', 'agents/', 'rules/', 'examples/', 'scripts/detect/'))
        runtime(base)
        put(base, 'README.md', (f'# UI Craft — {channel} release candidate\n\n'
            f'Local preparation only: MCP {MCP_VERSION}, plugin {PLUGIN_VERSION}. Not published or submitted.\n'
            'Native skills and commands are retained. Skills over MCP is disabled to avoid duplicate guidance.\n'
            'Node 20+ for static tools; Node 22+ and an installed Chrome-family browser for check_fold.\n'
            'Existing detector hooks are declared separately and remain subject to host permissions.\n'
            'Building this package does not install or run them. Existing installations are unchanged.\n').encode())
    claude = json.loads((ROOT / '.claude-plugin/plugin.json').read_text(encoding='utf-8'))
    put(OUT / 'claude-code', '.claude-plugin/plugin.json', claude)
    copy_tracked(OUT / 'claude-code', ('hooks/hooks.json',))
    put(OUT / 'claude-code', '.mcp.json', {'mcpServers': {'ui-craft-mcp': launch('${CLAUDE_PLUGIN_ROOT}')}})
    cursor = json.loads((ROOT / '.cursor-plugin/plugin.json').read_text(encoding='utf-8'))
    cursor.update(version=PLUGIN_VERSION, description='Design-engineering skills, commands, review agents, rules and local MCP quality checks.')
    copy_tracked(OUT / 'cursor', ('hooks/cursor.json',))
    cursor_hooks = json.loads((ROOT / 'hooks/cursor.json').read_text(encoding='utf-8'))
    cursor_hooks['hooks']['preToolUse'][0]['command'] = 'node "${CURSOR_PLUGIN_ROOT}/scripts/detect.mjs" hook-run'
    put(OUT / 'cursor', 'hooks/cursor.json', cursor_hooks)
    cursor['mcpServers'] = 'mcp.json'
    put(OUT / 'cursor', '.cursor-plugin/plugin.json', cursor)
    put(OUT / 'cursor', 'mcp.json', {'mcpServers': {'ui-craft-mcp': launch('${CURSOR_PLUGIN_ROOT}')}})
    # Shared ChatGPT/Codex portable package: exactly one native skill tree.
    base = OUT / 'openai'
    copy_tracked(base, ('LICENSE', 'PRIVACY.md', 'assets/icon.svg'), ('agents/', 'examples/'))
    for name in TRACKED:
        if name.startswith('.codex/skills/'):
            data = (ROOT / name).read_bytes()
            if name.endswith('.md'):
                data = data.replace(b'../skills/ui-craft/references/', b'../ui-craft/references/')
            put(base, name.removeprefix('.codex/'), data)
    runtime(base)
    old = json.loads((ROOT / '.codex-plugin/plugin.json').read_text(encoding='utf-8'))
    interface = old['interface']
    interface['longDescription'] = ('Design-engineering skills and bundled local MCP quality checks. '
        'Requires local desktop execution and Node.js; no npm download or hosted UI Craft account is needed.')
    portable = {k: old[k] for k in ['name', 'description', 'author', 'homepage', 'repository', 'license']}
    portable.update({'$schema': 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
        'version': PLUGIN_VERSION, 'extensions': {'com.openai': {'requires_local_executor': True, 'interface': interface}}})
    put(base, 'plugin.json', portable)
    put(base, 'mcp.json', {'$schema': 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
        'mcpServers': {'ui-craft-mcp': launch('${PLUGIN_ROOT}')}})
    put(base, 'README.md', ('# UI Craft — desktop release candidate\n\n'
        '29 unique native skills plus eight local MCP tools. MCP skills stay disabled to avoid duplicates.\n'
        'Bundled server and dependencies; no first-run npm installation. No lifecycle hooks.\n'
        'Node 20+; browser rendering requires Node 22+ and an installed Chrome-family browser.\n'
        'Local MCP submission requires OpenAI organization allowlisting. Not verified or submitted.\n'
        'This is not a remote HTTPS connector.\n').encode())
    # MCP-only edition enables the catalog, for hosts without native UI Craft skills.
    base = OUT / 'mcp-only'
    runtime(base)
    copy_tracked(base, ('LICENSE', 'PRIVACY.md', 'assets/icon.svg'))
    put(base, 'mcp.example.json', {'mcpServers': {'ui-craft-mcp': launch('/ABSOLUTE/PATH/TO/UNPACKED/PLUGIN', '1')}})
    put(base, 'README.md', ('# MCP-only candidate\n\nEight tools plus 64 opt-in catalog skills.\n'
        'Replace the absolute path in mcp.example.json; never install it beside native UI Craft skills.\n'
        'This file is an example only: no host configuration has been written.\n').encode())
    # npm candidate is self-contained and deliberately unpublishable until approved.
    base = OUT / 'npm'
    shutil.copytree(OUT / 'runtime', base / 'dist')
    package = json.loads((ROOT / 'mcp/package.json').read_text(encoding='utf-8'))
    package.update(version=MCP_VERSION, private=True, dependencies={}, devDependencies={},
        description='Local design-quality tools with optional Skills over MCP.',
        scripts={'start': 'node dist/server.mjs', 'prepublishOnly': 'node -e "throw new Error(\'Local candidate: publication requires explicit promotion\')"'})
    package.pop('overrides', None)
    if STABLE:
        package['private'] = False
        package['scripts'] = {'start': 'node dist/server.mjs'}
    put(base, 'package.json', package)
    copy_tracked(base, ('LICENSE', 'PRIVACY.md'))
    release_note = ('Self-contained local stdio distribution. Marketplace acceptance is a separate process.\n'
                    if STABLE else 'Local release candidate; not published.\n')
    put(base, 'README.md', (f'# ui-craft-mcp {MCP_VERSION}\n\n' + release_note +
        'Eight tools by default. Opt in to 64 catalog skills with UI_CRAFT_MCP_SKILLS=1 only when native skills are absent.\n'
        'Node 20+; Node 22+ and an installed Chrome-family browser for check_fold.\n'
        'Windows 10+ requires Windows PowerShell with Add-Type permitted. Unsupported policies fail closed.\n'
        'Native static/worker ownership tests pass on Windows/Linux Node 20/22/24; Windows browser and desktop GUI behavior are not certified.\n').encode())
    for channel in ['npm', 'claude-code', 'cursor', 'openai', 'mcp-only']:
        privacy(OUT / channel)
    with (OUT / f'ui-craft-mcp-{MCP_VERSION}.tgz').open('wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as gz, tarfile.open(fileobj=gz, mode='w') as archive:
        for p in sorted(base.rglob('*')):
            if p.is_file():
                info = tarfile.TarInfo('package/' + p.relative_to(base).as_posix())
                data = p.read_bytes()
                info.size = len(data)
                info.mode = 0o755 if p.name == 'server.mjs' else 0o644
                archive.addfile(info, io.BytesIO(data))
    registry = registry_descriptor()
    put(OUT / 'registry', 'server.json', registry)
    # Git-backed Claude/Cursor installs cannot reference ignored build outputs.
    # Prepare inactive source overlays using the future published npm version;
    # self-contained ZIPs above are separate local-install/desktop artifacts.
    future = json.loads((ROOT / '.mcp.json').read_text(encoding='utf-8'))
    for server in future['mcpServers'].values():
        server['args'] = [re.sub(r'ui-craft-mcp@[^ ]+', 'ui-craft-mcp@' + STABLE_VERSION, arg) for arg in server.get('args', [])]
        server.setdefault('env', {})['UI_CRAFT_MCP_SKILLS'] = '0'
    put(OUT / 'promotion', '.mcp.json', future)
    future_cursor = json.loads((ROOT / '.cursor-plugin/plugin.json').read_text(encoding='utf-8'))
    future_cursor['version'] = '1.1.0'
    for server in future_cursor['mcpServers'].values():
        server['args'] = [re.sub(r'ui-craft-mcp@[^ ]+', 'ui-craft-mcp@' + STABLE_VERSION, arg) for arg in server.get('args', [])]
        server.setdefault('env', {})['UI_CRAFT_MCP_SKILLS'] = '0'
    put(OUT / 'promotion', '.cursor-plugin/plugin.json', future_cursor)
    future_registry = json.loads(json.dumps(registry))
    future_registry['version'] = future_registry['packages'][0]['version'] = STABLE_VERSION
    put(OUT / 'promotion', 'mcp/server.json', future_registry)
    for channel in ['claude-code', 'cursor', 'openai', 'mcp-only']:
        zip_tree(OUT / channel, f'ui-craft-{channel}-{PLUGIN_VERSION if channel != "mcp-only" else MCP_VERSION}.zip')
    after = protected()
    if before != after:
        raise RuntimeError('Protected source/config/candidate changed during packaging')
    put(OUT, 'preserved-sources.json', before)
    archive_names = [f'ui-craft-mcp-{MCP_VERSION}.tgz'] + [
        f'ui-craft-{channel}-{MCP_VERSION if channel == "mcp-only" else PLUGIN_VERSION}.zip'
        for channel in ['claude-code', 'cursor', 'openai', 'mcp-only']]
    artifacts = {name: digest(OUT / name) for name in sorted(archive_names)}
    put(OUT, 'SHA256SUMS.json', artifacts)
    for name in ['RELEASE-PREPARATION.md', 'SUBMISSION-DRAFTS.md', 'CROSS-HOST-TRIAL.md']:
        shutil.copyfile(HERE / name, OUT / name)
    print(json.dumps({'output': str(OUT), 'artifacts': artifacts, 'protected_files': len(before),
        'published': False, 'submitted': False}, indent=2))


if __name__ == '__main__':
    build()
