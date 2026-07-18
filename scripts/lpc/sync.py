#!/usr/bin/env python3
from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen
from zipfile import ZipFile

from config import DEFAULT_SOURCE_ROOT, PROJECT_ROOT
from sources import required_source_paths


SOURCE_BASE_URL = (
    "https://raw.githubusercontent.com/"
    "LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets"
)
HAND_TOOLS_URL = "https://opengameart.org/sites/default/files/lpc-hand-tools.zip"
HAND_TOOLS_SOURCES = {
    "tools/fishing/rod-bg.png": "lpc-hand-tools/tools/fishing/rod-bg.png",
    "tools/fishing/rod-fg.png": "lpc-hand-tools/tools/fishing/rod-fg.png",
}


def download_from_zip(url: str, archive_path: str, destination: Path) -> None:
    with urlopen(url) as response:
        archive = ZipFile(BytesIO(response.read()))
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(archive.read(archive_path))


def download(path: str, destination_root: Path, force: bool) -> str:
    destination = destination_root / path
    if destination.exists() and destination.stat().st_size > 0 and not force:
        return "skipped"

    destination.parent.mkdir(parents=True, exist_ok=True)
    if path in HAND_TOOLS_SOURCES:
        download_from_zip(HAND_TOOLS_URL, HAND_TOOLS_SOURCES[path], destination)
        return "downloaded"

    try:
        with urlopen(f"{SOURCE_BASE_URL}/{path}") as response:
            destination.write_bytes(response.read())
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code} for {path}") from error
    return "downloaded"


def prune(destination_root: Path, required_paths: set[str], dry_run: bool) -> int:
    if not destination_root.exists():
        return 0

    removed = 0
    for file_path in sorted(destination_root.rglob("*"), reverse=True):
        if file_path.is_dir():
            try:
                file_path.rmdir()
            except OSError:
                pass
            continue
        relative_path = file_path.relative_to(destination_root).as_posix()
        if relative_path in required_paths:
            continue
        removed += 1
        if dry_run:
            print(f"remove {relative_path}")
        else:
            file_path.unlink()
    return removed


def sync(destination_root: Path, force: bool = False, dry_run: bool = False, no_prune: bool = False) -> None:
    paths = required_source_paths()
    required_paths = set(paths)
    print(f"Syncing {len(paths)} LPC source images into {destination_root.relative_to(PROJECT_ROOT)}")
    if dry_run:
        for path in paths:
            print(path)
        if not no_prune:
            removed = prune(destination_root, required_paths, dry_run=True)
            print(f"Would remove {removed} stale LPC source images")
        return

    downloaded = 0
    skipped = 0
    for path in paths:
        status = download(path, destination_root, force)
        downloaded += status == "downloaded"
        skipped += status == "skipped"
    removed = 0 if no_prune else prune(destination_root, required_paths, dry_run=False)
    print(f"Downloaded {downloaded}, skipped {skipped}, removed {removed}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync only the LPC source images required by scripts/lpc/build.py.")
    parser.add_argument("--out", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-prune", action="store_true")
    args = parser.parse_args()
    sync(args.out, args.force, args.dry_run, args.no_prune)


if __name__ == "__main__":
    main()
