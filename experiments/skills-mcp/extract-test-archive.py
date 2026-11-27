#!/usr/bin/env python3
"""Extract local test artifacts safely on Python 3.9+, without tarfile filters."""
from pathlib import Path, PurePosixPath
import stat
import sys
import tarfile
import zipfile


def extract(source, destination):
    root = Path(destination).resolve()
    if not root.is_dir() or any(root.iterdir()):
        raise ValueError('Extraction requires an existing empty directory')
    entries = []
    if str(source).endswith('.zip'):
        with zipfile.ZipFile(source) as archive:
            for item in archive.infolist():
                if stat.S_ISLNK(item.external_attr >> 16) or item.is_dir():
                    raise ValueError('Only regular archive files are accepted')
                entries.append((item.filename, archive.read(item), item.external_attr >> 16))
    else:
        with tarfile.open(source) as archive:
            for item in archive.getmembers():
                if not item.isfile():
                    raise ValueError('Only regular archive files are accepted')
                entries.append((item.name, archive.extractfile(item).read(), item.mode))
    seen = set()
    for name, data, mode in entries:
        path = PurePosixPath(name)
        if not name or path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name:
            raise ValueError('Unsafe archive path')
        target = root.joinpath(*path.parts)
        if not target.resolve().is_relative_to(root) or target in seen:
            raise ValueError('Unsafe or duplicate archive path')
        seen.add(target)
    # Validate the entire archive before writing anything. Never restore archive
    # ownership, special files or symlinks, and never overwrite existing files.
    for name, data, mode in entries:
        target = root.joinpath(*PurePosixPath(name).parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as handle:
            handle.write(data)
        target.chmod(0o755 if mode & 0o111 else 0o644)


if __name__ == '__main__':
    extract(*sys.argv[1:])
