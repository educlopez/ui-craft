#!/usr/bin/env python3
"""Read-only validation of staged packages. No installation or network access."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import posixpath
import re
import stat
import tarfile
import zipfile
from importlib.util import spec_from_file_location, module_from_spec

HERE = Path(__file__).resolve().parent
spec = spec_from_file_location('packager', HERE / 'package-release.py')
package = module_from_spec(spec)
spec.loader.exec_module(package)
OUT = package.OUT
ROOT = package.ROOT


def verify():
    expected = json.loads((OUT / 'preserved-sources.json').read_text(encoding='utf-8'))
    assert expected == package.protected(), 'Existing sources, pins or Claude candidate changed'
    sums = json.loads((OUT / 'SHA256SUMS.json').read_text(encoding='utf-8'))
    assert len(sums) == 5
    for name, digest in sums.items():
        p = OUT / name
        assert hashlib.sha256(p.read_bytes()).hexdigest() == digest, name
        if p.suffix == '.zip':
            with zipfile.ZipFile(p) as z:
                assert z.testzip() is None
                names = z.namelist()
                assert len(names) == len(set(names)), 'Duplicate archive paths'
                for entry in z.infolist():
                    path = PurePosixPath(entry.filename)
                    assert not path.is_absolute() and '..' not in path.parts
                    assert not stat.S_ISLNK(entry.external_attr >> 16)
                    assert not any(part in path.parts for part in ['node_modules', '.git', '.agents', '.env', '.DS_Store'])
                assert 'server/dist/server.mjs' in names and 'server/dist/windows-job.cs' in names
                assert 'server/dist/THIRD_PARTY_NOTICES.txt' in names
                assert 'assets/icon.svg' in names
        else:
            with tarfile.open(p) as tar:
                for entry in tar.getmembers():
                    path = PurePosixPath(entry.name)
                    assert path.parts[0] == 'package' and '..' not in path.parts and not path.is_absolute()
                    assert entry.isfile(), entry.name
    base = OUT / 'openai'
    manifest = json.loads((base / 'plugin.json').read_text(encoding='utf-8'))
    assert manifest['extensions']['com.openai']['requires_local_executor'] is True
    assert not (base / 'hooks').exists() and not (base / '.codex').exists()
    names = []
    for skill in (base / 'skills').glob('*/SKILL.md'):
        text = skill.read_text(encoding='utf-8')
        names.append(re.search(r'^name:\s*(.+)$', text, re.M)[1].strip())
        for link in re.findall(r'\]\(([^\s)]+)\)', text):
            if '://' in link or link.startswith(('#', 'mailto:')):
                continue
            target = posixpath.normpath(posixpath.join(skill.parent.relative_to(base).as_posix(), link.split('#')[0]))
            assert not target.startswith('../') and (base / target).is_file(), (skill, link)
    assert len(names) == len(set(names)) == 29
    for channel, config, variable in [('claude-code', '.mcp.json', '${CLAUDE_PLUGIN_ROOT}'),
                                     ('cursor', 'mcp.json', '${CURSOR_PLUGIN_ROOT}'),
                                     ('openai', 'mcp.json', '${PLUGIN_ROOT}')]:
        server = json.loads((OUT / channel / config).read_text(encoding='utf-8'))['mcpServers']['ui-craft-mcp']
        assert server['command'] == 'node'
        assert server['args'] == [variable + '/server/dist/server.mjs']
        assert server['env'] == {'UI_CRAFT_MCP_SKILLS': '0'}
        assert 'npx' not in json.dumps(server)
    registry = json.loads((OUT / 'registry/server.json').read_text(encoding='utf-8'))
    assert registry['name'] == 'io.github.educlopez/ui-craft'
    assert registry['version'] == registry['packages'][0]['version'] == package.MCP_VERSION
    future = json.loads((OUT / 'promotion/.mcp.json').read_text(encoding='utf-8'))
    assert all('ui-craft-mcp@' + package.STABLE_VERSION in server['args']
               for server in future['mcpServers'].values())
    assert all(server['env']['UI_CRAFT_MCP_SKILLS'] == '0' for server in future['mcpServers'].values())
    print(f'Validated five archives, 29 native skills, launchers, licenses, icons and {len(expected)} preserved source hashes.')


if __name__ == '__main__':
    verify()
