#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from build import RETRO_PALETTE_ROOT, bake_sheet
from config import DEFAULT_OUTPUT_ROOT, DEFAULT_SOURCE_ROOT, PROJECT_ROOT
from retro_palette import find_hex_palette, load_hex_palette


OUTPUT_ROOT = DEFAULT_OUTPUT_ROOT.parent / "animals"
ANIMAL_SOURCE_ROOT = DEFAULT_SOURCE_ROOT / "animals"
ANIMAL_ANIMATION_SPEED = 0.20


@dataclass(frozen=True)
class AnimalSheet:
    source: str
    output: str
    columns: int
    row_order: tuple[int, ...]
    frame_indices: tuple[int, ...] | None = None
    animation_speed: float = ANIMAL_ANIMATION_SPEED
    frame_width: int | None = None
    frame_height: int | None = None
    row_stride: int | None = None
    clear_top: int = 0
    clear_top_rows: tuple[int, ...] | None = None
    row_y_shift: dict[int, int] | None = None


# Source rows are 0=front(south/toward-camera), 1=back(north/away), 2=left,
# 3=right. Output order must be north/west/south (see THREE_DIRECTION_ORDER in
# app/lib/extra.ts), so row_order is (1, 2, 0). Row 3 (right) is dropped since
# the runtime mirrors the left frames for east-facing sprites. There's no
# standing sheet: with no standingSheet asset configured, the runtime falls
# back to the walking sheet's first frame (see setUnitTexture in
# app/lib/extra.ts). Dying/corpse keep only the front-facing row.
#
# The source art's feet baseline isn't consistent across rows: front/back rows
# sit a few pixels higher within the frame than the left/right rows. The baked
# anchor is a single fraction of frame height shared by every row (see ANCHOR
# in config.py), so a mismatched baseline makes the shadow miss the feet on
# whichever rows sit higher. row_y_shift nudges those rows down so every row's
# feet land on the same pixel row before baking.
DEER_SHEETS: tuple[AnimalSheet, ...] = (
    AnimalSheet("Deer_Walk-2x.png", "walking", 6, (1, 2, 0), row_y_shift={0: 2, 1: 2}),
    AnimalSheet("Deer_Run-2x.png", "running", 6, (1, 2, 0), row_y_shift={0: 4, 1: 4}),
    AnimalSheet("Deer_Death-2x.png", "dying", 7, (0,), row_y_shift={0: 2}),
    AnimalSheet(
        "Deer_Death-2x.png", "corpse", 7, (0,), frame_indices=(6,), animation_speed=0, row_y_shift={0: 2}
    ),
)


# Same source-row convention and row_y_shift purpose as DEER_SHEETS above.
HARE_SHEETS: tuple[AnimalSheet, ...] = (
    AnimalSheet("Hare_Walk-2x.png", "walking", 5, (1, 2, 0), row_y_shift={2: 2}),
    AnimalSheet("Hare_Run-2x.png", "running", 6, (1, 2, 0)),
    AnimalSheet("Hare_Death-2x.png", "dying", 6, (0,), row_y_shift={0: -2}),
    AnimalSheet(
        "Hare_Death-2x.png", "corpse", 6, (0,), frame_indices=(5,), animation_speed=0, row_y_shift={0: -2}
    ),
)


HORSE_SHEETS: tuple[AnimalSheet, ...] = (
    AnimalSheet(
        "horse.png",
        "standing",
        3,
        (7, 10, 6),
        frame_width=64,
        frame_height=128,
        row_stride=64,
        clear_top=18,
        clear_top_rows=(7,),
    ),
    AnimalSheet(
        "horse.png",
        "walking",
        6,
        (1, 4, 0),
        frame_width=64,
        frame_height=128,
        row_stride=64,
        clear_top=18,
        clear_top_rows=(1, 4),
    ),
    AnimalSheet(
        "horse.png",
        "dying",
        3,
        (10, 10, 10),
        frame_width=64,
        frame_height=128,
        row_stride=64,
        animation_speed=0.12,
    ),
    AnimalSheet(
        "horse.png",
        "corpse",
        3,
        (10, 10, 10),
        frame_indices=(2,),
        frame_width=64,
        frame_height=128,
        row_stride=64,
        animation_speed=0,
    ),
)


ANIMALS = {
    "deer": {
        "source_dir": "Deer",
        "output_dir": "gazelle",
        "sheets": DEER_SHEETS,
    },
    "hare": {
        "source_dir": "Hare",
        "output_dir": "hare",
        "sheets": HARE_SHEETS,
    },
    "horse": {
        "source_dir": ".",
        "output_dir": "horse",
        "sheets": HORSE_SHEETS,
    },
}


def crop_frames(source: Image.Image, sheet: AnimalSheet) -> list[Image.Image]:
    frame_width = sheet.frame_width or source.width // sheet.columns
    frame_height = sheet.frame_height or frame_width
    row_stride = sheet.row_stride or frame_height
    if frame_width <= 0 or frame_height <= 0:
        raise ValueError(f"invalid animal sheet size {source.size} for {sheet.source}")

    for row in sheet.row_order:
        if row * row_stride + frame_height > source.height:
            raise ValueError(f"row {row} does not exist in {sheet.source}")

    frame_indices = sheet.frame_indices or tuple(range(sheet.columns))
    frames: list[Image.Image] = []
    for row in sheet.row_order:
        for column in frame_indices:
            if column >= sheet.columns:
                raise ValueError(f"column {column} does not exist in {sheet.source}")
            frame = source.crop(
                (
                    column * frame_width,
                    row * row_stride,
                    column * frame_width + frame_width,
                    row * row_stride + frame_height,
                )
            )
            row_shift = sheet.row_y_shift.get(row, 0) if sheet.row_y_shift else 0
            if row_shift:
                shifted = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
                shifted.paste(frame, (0, row_shift))
                frame = shifted
            if sheet.clear_top and (sheet.clear_top_rows is None or row in sheet.clear_top_rows):
                frame = frame.copy()
                frame.paste((0, 0, 0, 0), (0, 0, frame_width, sheet.clear_top))
            frames.append(frame)
    return frames


def build_animals(source_root: Path, output_root: Path, animal_keys: set[str] | None = None) -> None:
    retro_palette_hex = find_hex_palette(RETRO_PALETTE_ROOT / "_")
    if retro_palette_hex is None:
        raise RuntimeError(f"no .hex palette found in {RETRO_PALETTE_ROOT}")
    retro_palette = load_hex_palette(retro_palette_hex)

    selected_animals = ANIMALS if animal_keys is None else {key: value for key, value in ANIMALS.items() if key in animal_keys}
    unknown_animals = sorted((animal_keys or set()) - set(ANIMALS))
    if unknown_animals:
        raise ValueError(f"unknown animal(s): {', '.join(unknown_animals)}")

    built = 0
    for animal in selected_animals.values():
        source_dir = source_root / animal["source_dir"]
        output_dir = output_root / animal["output_dir"]
        for sheet in animal["sheets"]:
            source = Image.open(source_dir / sheet.source).convert("RGBA")
            frames = crop_frames(source, sheet)
            bake_sheet(output_dir / sheet.output, frames, sheet.animation_speed, retro_palette)
            built += 1

    print(f"Generated {built} LPC animal sheets into {output_root.relative_to(PROJECT_ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build LPC animal spritesheets.")
    parser.add_argument("--source", type=Path, default=ANIMAL_SOURCE_ROOT)
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT)
    parser.add_argument("--animal", action="append", help="Build only one animal key. Can be passed multiple times.")
    args = parser.parse_args()
    build_animals(args.source, args.out, set(args.animal) if args.animal else None)


if __name__ == "__main__":
    main()
