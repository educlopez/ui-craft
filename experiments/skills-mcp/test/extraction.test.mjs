import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const python = process.env.UI_CRAFT_TEST_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const helper = fileURLToPath(new URL('../extract-test-archive.py', import.meta.url));
for (const kind of ['valid', 'traversal', 'absolute', 'symlink', 'duplicate']) {
  test(`artifact extraction ${kind === 'valid' ? 'accepts regular Unicode paths' : `rejects ${kind}`}`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'ui craft archive '));
    t.after(() => rm(root, { recursive: true, force: true }));
    const destination = join(root, 'out'); await mkdir(destination);
    const archive = join(root, 'test.tar.gz');
    execFileSync(python, ['-c', `import tarfile,sys,io
p,kind=sys.argv[1:]
with tarfile.open(p,'w:gz') as t:
 n={'valid':'package/niño.txt','traversal':'../escape.txt','absolute':'C:/escape.txt','symlink':'package/link','duplicate':'package/file'}[kind]
 i=tarfile.TarInfo(n)
 if kind=='symlink':i.type=tarfile.SYMTYPE;i.linkname='/outside';t.addfile(i)
 else:
  i.size=2;t.addfile(i,io.BytesIO(b'ok'))
  if kind=='duplicate':t.addfile(i,io.BytesIO(b'ok'))
`, archive, kind], { timeout: 15000 });
    const result = spawnSync(python, [helper, archive, destination], { encoding: 'utf8', timeout: 15000 });
    if (kind === 'valid') {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(await readFile(join(destination, 'package/niño.txt'), 'utf8'), 'ok');
    } else {
      assert.notEqual(result.status, 0);
      assert.deepEqual(await readdir(destination), []);
    }
  });
}
