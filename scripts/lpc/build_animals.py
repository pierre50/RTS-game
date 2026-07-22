#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from build import RETRO_PALETTE_ROOT, bake_sheet
from config import DEFAULT_OUTPUT_ROOT, DEFAULT_SOURCE_ROOT, PROJECT_ROOT
from retro_palette import find_hex_palette, load_hex_palette

sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
from darken_border import DARKEN_FACTOR, apply_darken_border_to_atlas


OUTPUT_ROOT = DEFAULT_OUTPUT_ROOT.parent / "animals"
ANIMAL_SOURCE_ROOT = DEFAULT_SOURCE_ROOT / "animals"
ANIMAL_ANIMATION_SPEED = 0.20

# Every source sheet is a universal 4-direction template (front/back/left/right,
# see the row convention note below), even sheets like dying/corpse that only ever
# extract row 0. Frames are packed tight with no blank row between directions, and
# each direction's content isn't a fixed fraction of the canvas height (a rearing
# front pose needs more headroom than a side view), so row boundaries are detected
# per sheet (see detect_row_bounds) rather than assumed to be an even split.
SOURCE_ROW_COUNT = 4


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
    darken_border_factor: float | None = None


# Source rows are 0=front(south/toward-camera), 1=back(north/away), 2=left,
# 3=right. Output order must be north/west/south (see THREE_DIRECTION_ORDER in
# app/lib/extra.ts), so row_order is (1, 2, 0). Row 3 (right) is dropped since
# the runtime mirrors the left frames for east-facing sprites. Dying/corpse
# keep only the front-facing row.
#
# row_y_shift exists for source art whose feet baseline isn't consistent across
# rows (some rows sitting a few pixels higher within the frame than others,
# which throws off the shared per-frame anchor fraction — see ANCHOR in
# config.py). The current sprite sheets don't need it: their baseline is
# already aligned across rows.
DEER_SHEETS: tuple[AnimalSheet, ...] = (
    AnimalSheet("Deer_Idle-2x.png", "standing", 4, (1, 2, 0), animation_speed=0.04),
    AnimalSheet("Deer_Walk-2x.png", "walking", 6, (1, 2, 0)),
    AnimalSheet("Deer_Run-2x.png", "running", 6, (1, 2, 0)),
    AnimalSheet("Deer_Death-2x.png", "dying", 5, (0,)),
    AnimalSheet("Deer_Death-2x.png", "corpse", 5, (0,), frame_indices=(4,), animation_speed=0),
)


# Same source-row convention as DEER_SHEETS above.
HARE_SHEETS: tuple[AnimalSheet, ...] = (
    AnimalSheet("Hare_Idle-2x.png", "standing", 4, (1, 2, 0), animation_speed=0.04),
    AnimalSheet("Hare_Walk-2x.png", "walking", 5, (1, 2, 0)),
    AnimalSheet("Hare_Run-2x.png", "running", 6, (1, 2, 0)),
    AnimalSheet("Hare_Death-2x.png", "dying", 4, (0,)),
    AnimalSheet("Hare_Death-2x.png", "corpse", 4, (0,), frame_indices=(3,), animation_speed=0),
)


# Same source-row convention as DEER_SHEETS above. This one is "attack"
# strategy, not "runaway" — it has an action (attack) sheet instead of
# fleeing, and charges at spotted villagers using its running sheet (see
# AnimalCombat.affectNewDest in the runtime).
BOAR_SHEETS: tuple[AnimalSheet, ...] = (
    AnimalSheet("Boar_Idle-2x.png", "standing", 4, (1, 2, 0), animation_speed=0.04),
    AnimalSheet("Boar_Walk-2x.png", "walking", 6, (1, 2, 0)),
    AnimalSheet("Boar_Run-2x.png", "running", 5, (1, 2, 0)),
    AnimalSheet("Boar_Attack-2x.png", "action", 5, (1, 2, 0)),
    AnimalSheet("Boar_Death-2x.png", "dying", 4, (0,)),
    AnimalSheet("Boar_Death-2x.png", "corpse", 4, (0,), frame_indices=(3,), animation_speed=0),
)


# Same source-row convention as DEER_SHEETS above. This one has no "running"
# sheet — it flees by flight instead, so "flying" stands in for the running
# slot (see SHEET_TYPES.flying / Animal.setAltitude in the runtime, which
# renders it above its shadow instead of on the ground).
BLACK_GROUSE_SHEETS: tuple[AnimalSheet, ...] = (
    AnimalSheet("Black_grouse_Idle-2x.png", "standing", 4, (1, 2, 0), animation_speed=0.04),
    AnimalSheet("Black_grouse_Walk-2x.png", "walking", 6, (1, 2, 0)),
    AnimalSheet("Black_grouse_Flight-2x.png", "flying", 6, (1, 2, 0)),
    AnimalSheet("Black_grouse_Death-2x.png", "dying", 4, (0,)),
    AnimalSheet("Black_grouse_Death-2x.png", "corpse", 4, (0,), frame_indices=(3,), animation_speed=0),
)


# This source swaps the horizontal convention: row 2 faces right and row 3
# faces left, so use row 3 for west and let the runtime mirror it for
# east-facing sprites.
FOX_SHEETS: tuple[AnimalSheet, ...] = (
    AnimalSheet("Fox_Idle.png", "standing", 4, (1, 2, 0), animation_speed=0.04),
    AnimalSheet("Fox_walk.png", "walking", 6, (1, 2, 0)),
    AnimalSheet("Fox_Run.png", "running", 6, (1, 3, 0)),
    AnimalSheet("Fox_Death.png", "dying", 4, (0,), darken_border_factor=DARKEN_FACTOR),
    AnimalSheet(
        "Fox_Death.png",
        "corpse",
        4,
        (0,),
        frame_indices=(3,),
        animation_speed=0,
    ),
)

HORSE_SHEETS: tuple[AnimalSheet, ...] = (
    AnimalSheet("Horse_Idle-2x.png", "standing", 4, (1, 3, 0), animation_speed=0.04),
    AnimalSheet("Horse_Walk-2x.png", "walking", 6, (1, 3, 0)),
)



ANIMALS = {
    "deer": {
        "source_dir": "Deer",
        "output_dir": "deer",
        "sheets": DEER_SHEETS,
    },
    "hare": {
        "source_dir": "Hare",
        "output_dir": "hare",
        "sheets": HARE_SHEETS,
    },
    "black_grouse": {
        "source_dir": "Black_grouse",
        "output_dir": "black-grouse",
        "sheets": BLACK_GROUSE_SHEETS,
    },
    "boar": {
        "source_dir": "Boar",
        "output_dir": "boar",
        "sheets": BOAR_SHEETS,
    },
    "fox": {
        "source_dir": "Fox",
        "output_dir": "fox",
        "sheets": FOX_SHEETS,
    },
    "horse": {
        "source_dir": "Horse",
        "output_dir": "horse",
        "sheets": HORSE_SHEETS,
    },
}


def keep_largest_alpha_island(frame: Image.Image) -> Image.Image:
    """Some source frames have a stray fragment of the neighboring row's ear or
    tail (a few disconnected pixels) surviving right at the row boundary, left
    over from the sheet's tight, gapless packing. A cropped animal frame is
    always one connected silhouette, so drop every opaque blob except the
    largest — those fragments are never part of it.
    """
    arr = np.array(frame)
    alpha = arr[:, :, 3]
    mask = alpha > 10
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    best_component: list[tuple[int, int]] | None = None
    best_size = 0
    for start_y in range(height):
        for start_x in range(width):
            if not mask[start_y, start_x] or visited[start_y, start_x]:
                continue
            stack = [(start_y, start_x)]
            visited[start_y, start_x] = True
            component = []
            while stack:
                y, x = stack.pop()
                component.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not visited[ny, nx]:
                            visited[ny, nx] = True
                            stack.append((ny, nx))
            if len(component) > best_size:
                best_size = len(component)
                best_component = component
    if best_component is None or best_size == int(mask.sum()):
        return frame

    keep = np.zeros_like(mask, dtype=bool)
    for y, x in best_component:
        keep[y, x] = True
    arr[:, :, 3] = np.where(keep, alpha, 0)
    return Image.fromarray(arr, "RGBA")


def detect_row_bounds(source: Image.Image, num_rows: int) -> tuple[int, ...]:
    """Find the num_rows+1 row boundaries in a tightly-packed source sheet.

    Frames are packed with no blank row between directions and each direction's
    content isn't an even fraction of the canvas (a rearing front pose needs more
    headroom than a side view lying down), so an even split cuts through content
    on some rows. Instead, search a window around each expected even-split point
    for the row with the fewest opaque pixels — the seam between two directions.
    """
    alpha = np.asarray(source.getchannel("A"))
    height = alpha.shape[0]
    opaque_count = (alpha > 0).sum(axis=1)
    step = height / num_rows
    window = max(3, round(step * 0.3))
    bounds = [0]
    for i in range(1, num_rows):
        expected = round(step * i)
        lo = max(bounds[-1] + 1, expected - window)
        hi = min(height - 1, expected + window)
        bounds.append(min(range(lo, hi + 1), key=lambda y: opaque_count[y]))
    bounds.append(height)
    return tuple(bounds)


def crop_frames(source: Image.Image, sheet: AnimalSheet) -> list[Image.Image]:
    frame_width = sheet.frame_width or source.width // sheet.columns
    if frame_width <= 0:
        raise ValueError(f"invalid animal sheet size {source.size} for {sheet.source}")

    if sheet.frame_height is not None:
        frame_height = sheet.frame_height
        row_stride = sheet.row_stride or frame_height
        row_top = {row: row * row_stride for row in range(SOURCE_ROW_COUNT)}
        row_bottom = {row: row * row_stride + frame_height for row in range(SOURCE_ROW_COUNT)}
    else:
        row_bounds = detect_row_bounds(source, SOURCE_ROW_COUNT)
        frame_height = max(row_bounds[row + 1] - row_bounds[row] for row in sheet.row_order)
        row_top = {row: row_bounds[row] for row in range(SOURCE_ROW_COUNT)}
        row_bottom = {row: row_bounds[row + 1] for row in range(SOURCE_ROW_COUNT)}

    for row in sheet.row_order:
        if row_bottom[row] > source.height:
            raise ValueError(f"row {row} does not exist in {sheet.source}")

    frame_indices = sheet.frame_indices or tuple(range(sheet.columns))
    frames: list[Image.Image] = []
    for row in sheet.row_order:
        # Bottom-anchored: every row's crop ends exactly at that direction's
        # detected content boundary, so feet land on the same pixel row across
        # directions regardless of how much headroom each pose needs above. A
        # row shorter than the sheet's tallest row (e.g. a side view under a
        # rearing front pose) gets blank padding at the top instead of pulling
        # in the row above.
        top = max(row_top[row], row_bottom[row] - frame_height)
        pad_top = frame_height - (row_bottom[row] - top)
        for column in frame_indices:
            if column >= sheet.columns:
                raise ValueError(f"column {column} does not exist in {sheet.source}")
            cropped = source.crop(
                (
                    column * frame_width,
                    top,
                    column * frame_width + frame_width,
                    row_bottom[row],
                )
            )
            if pad_top:
                frame = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
                frame.paste(cropped, (0, pad_top))
            else:
                frame = cropped
            row_shift = sheet.row_y_shift.get(row, 0) if sheet.row_y_shift else 0
            if row_shift:
                shifted = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
                shifted.paste(frame, (0, row_shift))
                frame = shifted
            if sheet.clear_top and (sheet.clear_top_rows is None or row in sheet.clear_top_rows):
                frame = frame.copy()
                frame.paste((0, 0, 0, 0), (0, 0, frame_width, sheet.clear_top))
            frame = keep_largest_alpha_island(frame)
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
            sheet_output_dir = output_dir / sheet.output
            bake_sheet(sheet_output_dir, frames, sheet.animation_speed, retro_palette)
            if sheet.darken_border_factor is not None:
                apply_darken_border_to_atlas(sheet_output_dir, sheet.darken_border_factor)
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
