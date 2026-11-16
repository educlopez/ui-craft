#!/usr/bin/env python3
"""Build a review draft from an explicit allowlist; never upload or publish it."""

import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "dist" / "ui-craft-openai.zip"
FILES = {".codex-plugin/plugin.json", ".mcp.json", "README.md", "LICENSE"}
PREFIXES = (".codex/skills/", "skills/", "commands/", "agents/", "examples/")


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
    DEST.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(DEST, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(files):
            archive.write(ROOT / name, name)
    with zipfile.ZipFile(DEST) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == files
    print(f"Built {DEST}: {len(files)} files, {DEST.stat().st_size} bytes")
    print("REVIEW DRAFT: local MCP partner approval and portal validation required.")
    print("No upload, submission, publication or identity verification performed.")


if __name__ == "__main__":
    build()
