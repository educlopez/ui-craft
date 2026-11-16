"""Regression tests for the instruction-only Claude Directory edition."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from contextlib import redirect_stdout
import io

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]


class ClaudeDirectoryTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('claude_directory', ROOT / 'scripts/package-claude-directory.py')
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.temp = tempfile.TemporaryDirectory(prefix='ui-craft-claude-directory-')
        self.addCleanup(self.temp.cleanup)
        self.module.OUTPUT = Path(self.temp.name).resolve() / 'plugin'
        self.module.ZIP = Path(self.temp.name) / 'plugin.zip'

    def quiet_build(self, check=False):
        with redirect_stdout(io.StringIO()):
            self.module.build(check)

    def test_generated_checkout_is_current(self):
        self.module.OUTPUT = ROOT / 'plugins/claude-directory'
        self.quiet_build(check=True)

    def test_archive_is_reproducible_and_has_only_skills(self):
        self.quiet_build()
        first = self.module.ZIP.read_bytes()
        self.quiet_build()
        self.assertEqual(first, self.module.ZIP.read_bytes())
        with zipfile.ZipFile(self.module.ZIP) as z:
            self.assertIsNone(z.testzip())
            self.assertEqual(len([n for n in z.namelist() if n.endswith('/SKILL.md')]), 29)
            self.assertFalse(any(n.startswith(('agents/', 'hooks/', 'scripts/', '.claude/', '.codex/')) for n in z.namelist()))
            self.assertNotIn('.mcp.json', z.namelist())
            self.assertIn('.claude-plugin/icon.png', z.namelist())
            manifest = json.loads(z.read('.claude-plugin/plugin.json'))
            self.assertIn(manifest['icon'].removeprefix('./'), z.namelist())
            self.assertTrue(manifest['privacyPolicyUrl'].endswith('/plugins/claude-directory/PRIVACY.md'))
            self.assertTrue(manifest['termsOfServiceUrl'].endswith('/plugins/claude-directory/LICENSE'))
            self.assertTrue(all((x.external_attr >> 16) & 0o111 == 0 for x in z.infolist()))

    def test_complete_plugin_inputs_are_unchanged(self):
        paths = subprocess.check_output(['git', 'ls-files', '-z', 'skills', 'commands', 'agents', 'hooks', '.claude-plugin', '.cursor-plugin', '.codex-plugin', '.codex/skills', '.mcp.json', 'scripts/fold/classes.mjs'], cwd=ROOT).decode().split('\0')
        before = {n: hashlib.sha256((ROOT / n).read_bytes()).digest() for n in paths if n}
        self.quiet_build()
        after = {n: hashlib.sha256((ROOT / n).read_bytes()).digest() for n in before}
        self.assertEqual(before, after)

    def test_manual_fallbacks_preserve_routing_and_no_fake_measurements(self):
        files = self.module.entries()
        main = files['skills/ui-craft/SKILL.md'].decode()
        for rung in ['0 · Ask', '1 · Direct', '2 · Persist', '3 · Review']:
            self.assertIn(rung, main)
        self.assertNotIn('Delegate `ui-craft:', main)
        self.assertIn('Manual anti-slop review', files['skills/finalize/SKILL.md'].decode())
        self.assertIn('judged selection', files['skills/craft/SKILL.md'].decode())
        self.assertIn('matching archetype', files['skills/harden/SKILL.md'].decode())
        for name, data in files.items():
            if name.endswith('/SKILL.md'):
                self.assertIn('Do not\ninstall or launch UI Craft tools', data.decode())

    def test_tool_dependency_and_broken_link_fail_closed(self):
        for added, message in [('Call `score_ui` now.', 'Unadapted tool'), ('[missing](missing.md)', 'Broken package link')]:
            with self.subTest(added=added):
                files = self.module.entries()
                files['skills/craft/SKILL.md'] += ('\n' + added).encode()
                with self.assertRaisesRegex(ValueError, message):
                    self.module.validate(files)

    def test_executables_and_mcp_config_are_rejected(self):
        for name, data in [('scripts/run.mjs', b'alert(1)'), ('.mcp.json', b'{}'), ('skills/ui-craft/run.md', b'#!/bin/sh\n')]:
            with self.subTest(name=name):
                files = self.module.entries()
                files[name] = data
                with self.assertRaises(ValueError):
                    self.module.validate(files)
        files = self.module.entries()
        manifest = json.loads(files['.claude-plugin/plugin.json'])
        manifest['hooks'] = './hooks/hooks.json'
        files['.claude-plugin/plugin.json'] = json.dumps(manifest).encode()
        with self.assertRaisesRegex(ValueError, 'manifest capabilities'):
            self.module.validate(files)

    def test_duplicate_skills_and_scanner_limits_are_rejected(self):
        for mutation in ['duplicate', 'large', 'many']:
            with self.subTest(mutation=mutation):
                files = self.module.entries()
                if mutation == 'duplicate':
                    files['skills/craft/SKILL.md'] = files['skills/start/SKILL.md']
                elif mutation == 'large':
                    files['README.md'] = b'a' * (256 * 1024 + 1)
                else:
                    files.update({f'examples/{i}.md': b'text' for i in range(513)})
                with self.assertRaises(ValueError):
                    self.module.validate(files)

    def test_unknown_output_and_symlink_are_not_overwritten(self):
        self.quiet_build()
        sentinel = self.module.OUTPUT / 'personal.md'
        sentinel.write_text('keep me')
        with self.assertRaisesRegex(ValueError, 'Unexpected output'):
            self.quiet_build()
        self.assertEqual(sentinel.read_text(), 'keep me')
        sentinel.unlink()
        skill = self.module.OUTPUT / 'README.md'
        skill.unlink()
        target = Path(self.temp.name) / 'private.md'
        target.write_text('private')
        skill.symlink_to(target)
        with self.assertRaisesRegex(ValueError, 'output symlink'):
            self.quiet_build()
        self.assertEqual(target.read_text(), 'private')

    def test_untracked_personal_skills_never_enter_edition(self):
        fixture = Path(self.temp.name) / 'repo'
        tracked = subprocess.check_output(['git', 'ls-files', '-z', '.codex/skills', 'examples'], cwd=ROOT).decode().split('\0')
        inputs = [n for n in tracked if n] + ['LICENSE', 'scripts/claude-directory/icon.png', 'scripts/fold/classes.mjs']
        for name in inputs:
            dest = fixture / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, dest)
        for args in [['git', 'init', '--quiet'], ['git', 'add', '--force', '.']]:
            subprocess.run(args, cwd=fixture, check=True, capture_output=True, timeout=10)
        private = fixture / '.codex/skills/personal/SKILL.md'
        private.parent.mkdir(parents=True)
        private.write_text('---\nname: personal\n---\nprivate\n')
        self.module.ROOT = fixture
        files = self.module.entries()
        self.assertNotIn('skills/personal/SKILL.md', files)
        canonical = fixture / '.codex/skills/craft/SKILL.md'
        canonical.unlink()
        canonical.symlink_to(private)
        with self.assertRaisesRegex(ValueError, 'regular source'):
            self.module.entries()


if __name__ == '__main__':
    unittest.main()
