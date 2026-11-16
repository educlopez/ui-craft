#!/usr/bin/env python3
"""Build a review draft from an explicit allowlist; never upload or publish it."""

import json
import posixpath
import re
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "dist" / "ui-craft-openai.zip"
FILES = {".codex-plugin/plugin.json", ".mcp.json", "README.md", "LICENSE", "PRIVACY.md"}
# The Codex mirror already includes the four base skills and each command as a
# skill. Shipping the canonical skills/ tree as well gives the same names twice.
PREFIXES = (".codex/skills/", "agents/", "examples/")
PACKAGED_README = """# UI Craft

Design engineering for AI coding agents: build interfaces, establish design
tokens, review accessibility, and refine typography, layout, motion and
responsive behavior. This package contains 29 unique skills and a local MCP
server for deterministic design-quality checks.

Requires local execution and Node.js 20 or newer. The MCP launcher obtains the
pinned ui-craft-mcp package from npm on first use. No UI Craft account or hosted
UI Craft backend is required. Local artifacts remain in your project; the
agent application's own data policies and permissions still apply.

Optional browsing and integrations are performed by your configured agent,
not a UI Craft backend. They may send queries or supplied content to the
relevant third-party provider under that provider's policies.

- [Documentation](https://ui-craft.smoothui.dev/docs)
- [Support](https://github.com/educlopez/ui-craft/issues)
- [Privacy notice](PRIVACY.md)
- [MIT license](LICENSE)
"""


def build():
    # Never include untracked personal skills, local config, node_modules or tokens.
    tracked = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=ROOT
    ).decode().split("\0")
    files = FILES | {
        name for name in tracked
        if name.startswith(PREFIXES) or name == "assets/icon.svg"
    }
    manifest = json.loads((ROOT / ".codex-plugin/plugin.json").read_text())
    assert manifest["requires_local_executor"] is True
    for key in ("logo", "composerIcon"):
        assert manifest["interface"][key].removeprefix("./") in files
    assert len(manifest["interface"]["shortDescription"]) <= 30
    for name in files:
        path = ROOT / name
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Expected a regular package file: {name}")
    skill_names = {}
    for name in sorted(files):
        if not name.endswith("/SKILL.md"):
            continue
        frontmatter = re.match(r"\A---\r?\n(.*?)\r?\n---", (ROOT / name).read_text(), re.S)
        field = re.search(r"^name:[ \t]*(.+)$", frontmatter[1], re.M) if frontmatter else None
        if not field:
            raise ValueError(f"Missing skill name: {name}")
        skill_name = field[1].strip().strip('\"\'')
        if skill_name in skill_names:
            raise ValueError(f"Duplicate skill {skill_name}: {skill_names[skill_name]} and {name}")
        skill_names[skill_name] = name
    entries = {}
    for name in sorted(files):
        # Put one installed skill tree at the conventional root. Keeping the
        # extra .codex/ directory breaks links to root-level examples/.
        packed = name.removeprefix(".codex/") if name.startswith(".codex/skills/") else name
        data = (ROOT / name).read_bytes()
        if name.startswith(".codex/skills/") and name.endswith(".md"):
            # Command links were originally relative to commands/<name>.md,
            # not to their materialized skills/<name>/SKILL.md location.
            data = data.replace(b"../skills/ui-craft/references/", b"../ui-craft/references/")
        if packed in entries:
            raise ValueError(f"Duplicate archive path: {packed}")
        entries[packed] = data
    entries["README.md"] = PACKAGED_README.encode()
    for name, data in entries.items():
        if not name.startswith("skills/") or not name.endswith(".md"):
            continue
        for link in re.findall(r"\]\(([^\s)]+)\)", data.decode()):
            if "://" in link or link.startswith(("#", "mailto:")):
                continue
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), link.split("#")[0]))
            if target not in entries:
                raise ValueError(f"Unresolved bundled skill link: {name} -> {link}")
    DEST.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(DEST, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(entries.items()):
            archive.writestr(name, data)
    with zipfile.ZipFile(DEST) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(entries)
    print(f"Built {DEST}: {len(files)} files, {DEST.stat().st_size} bytes")
    print(f"Unique skill names: {len(skill_names)}")
    print("REVIEW DRAFT: local MCP partner approval and portal validation required.")
    print("No upload, submission, publication or identity verification performed.")


if __name__ == "__main__":
    build()
