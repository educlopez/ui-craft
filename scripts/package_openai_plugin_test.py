"""Regression tests for the submitted OpenAI archive, without publishing it."""

from contextlib import redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

SOURCE = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True


class PackageTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location(
            "packager", SOURCE / "scripts/package-openai-plugin.py"
        )
        self.packager = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.packager)
        self.temp = tempfile.TemporaryDirectory(prefix="ui-craft-package-test-")
        self.addCleanup(self.temp.cleanup)
        self.packager.DEST = Path(self.temp.name) / "output.zip"

    def fixture(self, skills):
        root = Path(self.temp.name) / "repo"
        root.mkdir()
        for name in self.packager.FILES | {"assets/icon.svg"}:
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SOURCE / name, target)
        for name, contents in skills.items():
            target = root / ".codex/skills" / name / "SKILL.md"
            target.parent.mkdir(parents=True)
            target.write_text(contents)
        for command in (["git", "init", "--quiet"], ["git", "add", "--force", "."]):
            subprocess.run(command, cwd=root, check=True, capture_output=True, timeout=10)
        self.packager.ROOT = root
        return root

    def build(self):
        with redirect_stdout(io.StringIO()):
            self.packager.build()

    def test_real_archive_has_one_relocated_skill_tree(self):
        self.build()
        with zipfile.ZipFile(self.packager.DEST) as archive:
            names = archive.namelist()
            self.assertFalse(any(name.startswith(".codex/skills/") for name in names))
            skills = [name for name in names if name.endswith("/SKILL.md")]
            source_skills = subprocess.check_output(
                ["git", "ls-files", ".codex/skills/*/SKILL.md"], cwd=SOURCE
            ).decode().splitlines()
            self.assertEqual(len(skills), len(source_skills))
            identities = [re.search(r"^name: (.+)$", archive.read(name).decode(), re.M)[1]
                          for name in skills]
            self.assertEqual(len(identities), len(set(identities)))
            manifest = json.loads(archive.read(".codex-plugin/plugin.json"))
            self.assertEqual(manifest["skills"], "./skills/")
            self.assertIn("examples/animation-storyboard.md", names)
            shape = archive.read("skills/shape/SKILL.md").decode()
            self.assertNotIn("../skills/ui-craft/references/", shape)

    def test_duplicate_skill_names_fail_before_upload(self):
        self.fixture({"one": "---\nname: repeated\n---\n", "two": "---\nname: repeated\n---\n"})
        with self.assertRaisesRegex(ValueError, "Duplicate skill repeated"):
            self.build()

    def test_unresolved_skill_links_fail_before_upload(self):
        self.fixture({"one": "---\nname: one\n---\n[Missing](missing.md)\n"})
        with self.assertRaisesRegex(ValueError, "Unresolved bundled skill link"):
            self.build()

    def test_untracked_personal_skills_are_not_packaged(self):
        root = self.fixture({"one": "---\nname: one\n---\n"})
        private = root / ".codex/skills/private/SKILL.md"
        private.parent.mkdir()
        private.write_text("---\nname: private\n---\n")
        self.build()
        with zipfile.ZipFile(self.packager.DEST) as archive:
            self.assertNotIn("skills/private/SKILL.md", archive.namelist())


if __name__ == "__main__":
    unittest.main()
