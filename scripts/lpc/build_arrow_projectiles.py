#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

from config import PALETTES, PROJECT_ROOT, SCRIPT_ROOT


SOURCE_ARROW = SCRIPT_ROOT / "spritesheets/weapon/ranged/bow/arrow/shoot/arrow.png"
OUTPUT_ROOT = PROJECT_ROOT / "public/assets/graphics/projectiles"
FRAME_SIZE = 64
SOURCE_COLUMNS = 13
PROJECTILE_BASE_ROW = 3
PROJECTILE_BASE_COLUMN = 12
METAL_SOURCE_COLORS = (
    (46, 37, 51),
    (75, 68, 76),
    (114, 107, 126),
    (126, 112, 104),
    (134, 126, 127),
    (116, 141, 164),
    (169, 201, 202),
)
ARROW_VARIANTS = ("ceramic", "copper", "bronze", "iron")


def rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.removeprefix("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def luminance(color: tuple[int, int, int]) -> float:
    r, g, b = color
    return 0.299 * r + 0.587 * g + 0.114 * b


def metal_replacements(palette: str) -> dict[tuple[int, int, int], tuple[int, int, int]]:
    target = sorted((rgb(color) for color in PALETTES[palette]), key=luminance)
    source = sorted(METAL_SOURCE_COLORS, key=luminance)
    return {
        color: target[min(index * len(target) // len(source), len(target) - 1)]
        for index, color in enumerate(source)
    }


def recolor_arrow(frame: Image.Image, palette: str) -> Image.Image:
    replacements = metal_replacements(palette)
    image = frame.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            replacement = replacements.get((r, g, b))
            if replacement:
                pixels[x, y] = (*replacement, a)
    return image


def close_small_horizontal_gaps(frame: Image.Image, max_gap: int = 6) -> Image.Image:
    image = frame.copy()
    pixels = image.load()
    for y in range(image.height):
        x = 0
        while x < image.width:
            while x < image.width and pixels[x, y][3] == 0:
                x += 1
            if x >= image.width:
                break
            while x < image.width and pixels[x, y][3] != 0:
                x += 1
            gap_start = x
            while x < image.width and pixels[x, y][3] == 0:
                x += 1
            gap_end = x
            gap_width = gap_end - gap_start
            if 0 < gap_width <= max_gap and gap_start > 0 and gap_end < image.width and pixels[gap_end, y][3] != 0:
                left = pixels[gap_start - 1, y]
                right = pixels[gap_end, y]
                fill = left if left[3] >= right[3] else right
                for fill_x in range(gap_start, gap_end):
                    pixels[fill_x, y] = fill
    return image


def crop_source_frame(source: Image.Image, row: int, column: int) -> Image.Image:
    return source.crop(
        (
            column * FRAME_SIZE,
            row * FRAME_SIZE,
            column * FRAME_SIZE + FRAME_SIZE,
            row * FRAME_SIZE + FRAME_SIZE,
        )
    ).convert("RGBA")


def trim_frame(frame: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    bbox = frame.getbbox()
    if not bbox:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0)), (0, 0, 1, 1)
    return frame.crop(bbox), bbox


def write_projectile_sheet(output_dir: Path, variant: str, frames: list[Image.Image]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    trimmed_frames = [trim_frame(frame) for frame in frames]
    width = sum(frame.width for frame, _bbox in trimmed_frames) + max(0, len(trimmed_frames) - 1)
    height = max(frame.height for frame, _bbox in trimmed_frames)
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    frame_data = {}
    x = 0
    for index, (frame, bbox) in enumerate(trimmed_frames):
        left, top, right, bottom = bbox
        atlas.alpha_composite(frame, (x, 0))
        frame_width, frame_height = frame.size
        name = f"{index:03d}_graphics_projectiles_arrow_{variant}.png"
        frame_data[name] = {
            "frame": {"x": x, "y": 0, "w": frame_width, "h": frame_height},
            "rotated": False,
            "trimmed": True,
            "spriteSourceSize": {"x": left, "y": top, "w": frame_width, "h": frame_height},
            "sourceSize": {"w": FRAME_SIZE, "h": FRAME_SIZE},
            "anchor": {"x": 0.5, "y": 0.5},
        }
        x += frame_width + 1

    atlas.save(output_dir / "texture.png")
    metadata = {
        "frames": frame_data,
        "meta": {
            "app": "build_arrow_projectiles.py",
            "version": "1.0.0",
            "image": "texture.png",
            "format": "RGBA8888",
            "size": {"w": width, "h": height},
            "scale": 1,
        },
    }
    (output_dir / "texture.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf8")


def build_arrow_projectiles(source_path: Path, output_root: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    base_frame = crop_source_frame(source, PROJECTILE_BASE_ROW, PROJECTILE_BASE_COLUMN)
    for variant in ARROW_VARIANTS:
        frames = [close_small_horizontal_gaps(recolor_arrow(base_frame, variant))]
        write_projectile_sheet(output_root / f"arrow_{variant}", variant, frames)
    print(f"Generated {len(ARROW_VARIANTS)} LPC arrow projectile sheets into {output_root.relative_to(PROJECT_ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build metal-colored LPC arrow projectile spritesheets.")
    parser.add_argument("--source", type=Path, default=SOURCE_ARROW)
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT)
    args = parser.parse_args()
    build_arrow_projectiles(args.source, args.out)


if __name__ == "__main__":
    main()
