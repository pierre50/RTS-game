#!/usr/bin/env python3
"""
normalize_team_blue.py — Snap the "team blue" placeholder pixels in a building
sprite onto the exact 7-shade palette the game's recolor filter matches against
(SOURCE_COLORS in app/lib/graphics/colors.ts), so MultiColorReplaceFilter's
tight-tolerance exact match actually catches them for non-blue players.

Only pixels that are clearly blue-dominant get touched; every other color
(wood, stone, roof, etc.) is left untouched. Each qualifying pixel is remapped
to whichever of the 7 reference shades is closest (Euclidean RGB distance).

Usage:
    python scripts/normalize_team_blue.py <file-or-dir> [file-or-dir ...]

Processes texture.png files in place (directories are scanned recursively for
texture.png; texture_shadow.png/texture_old.png are skipped since shadows have
no color and _old files are historical originals).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

# Keep in sync with SOURCE_COLORS in app/lib/graphics/colors.ts.
SOURCE_COLORS: list[tuple[int, int, int]] = [
    (0xBA, 0xC7, 0xDB),
    (0x86, 0x90, 0xB2),
    (0x6C, 0x82, 0xC4),
    (0x56, 0x50, 0x6F),
    (0x14, 0x76, 0xC0),
    (0x03, 0x31, 0x5F),
    (0x00, 0x1B, 0x40),
]


def is_team_blue(r: int, g: int, b: int) -> bool:
    return b > r + 20 and b > g + 10


def nearest_source_color(r: int, g: int, b: int) -> tuple[int, int, int]:
    return min(SOURCE_COLORS, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)


def process_file(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    changed = 0

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if is_team_blue(r, g, b):
                new_color = nearest_source_color(r, g, b)
                if new_color != (r, g, b):
                    pixels[x, y] = (*new_color, a)
                    changed += 1

    if changed:
        image.save(path)
        print(f"{path}: {changed} pixel(s) snapped to SOURCE_COLORS")
    else:
        print(f"{path}: no team-blue pixels found")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    targets: list[Path] = []
    for arg in sys.argv[1:]:
        path = Path(arg)
        if path.is_dir():
            targets.extend(sorted(path.rglob("texture.png")))
        elif path.is_file():
            targets.append(path)
        else:
            print(f"Chemin introuvable : {path}")

    if not targets:
        print("Aucun fichier à traiter.")
        return

    for target in targets:
        process_file(target)


if __name__ == "__main__":
    main()
