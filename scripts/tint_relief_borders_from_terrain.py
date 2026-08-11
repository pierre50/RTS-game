#!/usr/bin/env python3
"""Transfer terrain relief colors onto relief border atlas frames.

The game chooses relief border frames through the same tile-index table below.
This script keeps each border frame's alpha/silhouette and copies RGB colors
from the matching terrain frame so slope variants inherit their light/dark
relief shading.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image


RELIEF_BORDER_VARIANTS_BY_TILE_INDEX = {
    0: [0, 1, 2, 3],
    1: [0, 1, 2, 3],
    2: [0, 1, 2, 3],
    3: [0, 1, 2, 3],
    4: [0, 1, 2, 3],
    5: [0, 1, 2, 3],
    6: [0, 1, 2, 3],
    7: [0, 1, 2, 3],
    8: [0, 1, 2, 3],
    9: [4, 5, 6, 7],
    10: [8, 9, 10, 11],
    11: [12, 13, 14, 15],
    12: [16, 17, 18, 19],
    13: [20, 21, 22, 23],
    14: [24, 25, 26, 27],
    15: [28, 29, 30, 31],
    16: [32, 33, 34, 35],
    17: [36, 37, 38, 39],
    18: [40, 41, 42, 43],
    19: [44, 45, 46, 47],
    20: [48, 49, 50, 51],
    21: [52, 53, 54, 55],
    22: [56, 57, 58, 59],
    23: [60, 61, 62, 63],
    24: [64, 65, 66, 67],
}


def frame_index(name: str) -> int:
    match = re.match(r"(\d+)", name)
    if not match:
        raise ValueError(f"Cannot read frame index from {name!r}")
    return int(match.group(1))


def load_indexed_frames(directory: Path) -> tuple[Image.Image, dict[int, dict]]:
    atlas = Image.open(directory / "texture.png").convert("RGBA")
    with (directory / "texture.json").open() as file:
        metadata = json.load(file)
    frames = {frame_index(name): info for name, info in metadata["frames"].items()}
    return atlas, frames


def crop_frame(atlas: Image.Image, frame_info: dict) -> Image.Image:
    frame = frame_info["frame"]
    return atlas.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))


def nearest_opaque_rgb(source: Image.Image, x: int, y: int, max_radius: int = 6) -> tuple[int, int, int] | None:
    width, height = source.size
    if 0 <= x < width and 0 <= y < height:
        r, g, b, a = source.getpixel((x, y))
        if a:
            return r, g, b

    for radius in range(1, max_radius + 1):
        best: tuple[int, int, int] | None = None
        best_distance = max_radius * max_radius + 1
        for yy in range(max(0, y - radius), min(height, y + radius + 1)):
            for xx in range(max(0, x - radius), min(width, x + radius + 1)):
                if abs(xx - x) != radius and abs(yy - y) != radius:
                    continue
                r, g, b, a = source.getpixel((xx, yy))
                if not a:
                    continue
                distance = (xx - x) * (xx - x) + (yy - y) * (yy - y)
                if distance < best_distance:
                    best = (r, g, b)
                    best_distance = distance
        if best:
            return best
    return None


def tint_border_frame(border: Image.Image, terrain: Image.Image) -> tuple[Image.Image, int, int]:
    result = border.copy()
    changed = 0
    skipped = 0

    for y in range(border.height):
        for x in range(border.width):
            r, g, b, a = border.getpixel((x, y))
            if not a:
                continue
            rgb = nearest_opaque_rgb(terrain, x, y)
            if rgb is None:
                skipped += 1
                continue
            if (r, g, b) != rgb:
                changed += 1
            result.putpixel((x, y), (*rgb, a))

    return result, changed, skipped


def tint_relief_borders(terrain_dir: Path, border_dir: Path, output: Path | None = None) -> None:
    terrain_atlas, terrain_frames = load_indexed_frames(terrain_dir)
    border_atlas, border_frames = load_indexed_frames(border_dir)
    border_to_terrain = {
        border_index: terrain_index
        for terrain_index, variants in RELIEF_BORDER_VARIANTS_BY_TILE_INDEX.items()
        for border_index in variants
    }

    output_atlas = border_atlas.copy()
    total_changed = 0
    total_skipped = 0

    for border_index, border_info in sorted(border_frames.items()):
        terrain_index = border_to_terrain.get(border_index)
        if terrain_index is None:
            raise ValueError(f"No terrain frame mapping for border frame {border_index:03d}")
        terrain_info = terrain_frames.get(terrain_index)
        if terrain_info is None:
            raise ValueError(f"Missing terrain frame {terrain_index:03d}")

        border_frame = crop_frame(border_atlas, border_info)
        terrain_frame = crop_frame(terrain_atlas, terrain_info)
        tinted, changed, skipped = tint_border_frame(border_frame, terrain_frame)
        frame = border_info["frame"]
        output_atlas.paste(tinted, (frame["x"], frame["y"]))
        total_changed += changed
        total_skipped += skipped

    target = output or border_dir / "texture.png"
    output_atlas.save(target, optimize=True)
    print(f"{target}: tinted {len(border_frames)} frames, changed {total_changed} pixels, skipped {total_skipped}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--terrain-dir", type=Path, required=True, help="Directory containing terrain texture.png/json")
    parser.add_argument("--border-dir", type=Path, required=True, help="Directory containing relief border texture.png/json")
    parser.add_argument("--output", type=Path, help="Optional output texture path; defaults to overwriting border texture.png")
    args = parser.parse_args()

    tint_relief_borders(args.terrain_dir, args.border_dir, args.output)


if __name__ == "__main__":
    main()
