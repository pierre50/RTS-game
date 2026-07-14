#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import sys
import warnings
from pathlib import Path

from config import CIVS, DEFAULT_OUTPUT_ROOT, DEFAULT_SOURCE_ROOT, LPC_ANIMATION_SPEED, PROJECT_ROOT, SHEETS, SKIN_TONES, Sheet, UNIT_LOOKS, VARIANT_KEY
from image_pipeline import apply_shadow_to_atlas, compose_frame, layer_paths, open_layer, source_frames, write_sheet
from jobs import UNIT_JOBS

RETRO_PALETTE_ROOT = PROJECT_ROOT / "scripts" / "retro_palette"
sys.path.insert(0, str(RETRO_PALETTE_ROOT))
from retro_palette import bake_retro_style, find_hex_palette, load_hex_palette

warnings.simplefilter("ignore", DeprecationWarning)

# Prioritizes matching lightness over hue when snapping to the palette: this palette has
# gaps in some hues (e.g. no dark brown), so a pure Lab nearest-neighbor match snaps those
# pixels to a same-hue-but-wrong-lightness color, causing a speckled look on outlines/edges.
RETRO_LIGHTNESS_WEIGHT = 4.0

# Fixed "sun" direction: light from the upper-left, so the ground shadow ellipse
# sits slightly down-right of the anchor (feet) point instead of directly under it.
SHADOW_OFFSET = (1, 5)
SHADOW_ALPHA = 0.35
SHADOW_RADIUS = (0.24, 0.09)

SHEET_BY_KEY = {sheet.key: sheet for sheet in SHEETS}
SHEET_BY_ANIMATION = {sheet.source_animation: sheet for sheet in SHEETS}
EQUIPPED_WALK_SOURCE_SHEET = Sheet(
    "walking_equipped",
    "walk",
    9,
    4,
    frame_indices=(0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26),
)


def animation_speed_for(output_sheet: str) -> float:
    return 0 if output_sheet == "corpse" else LPC_ANIMATION_SPEED


def build(source_root: Path, output_root: Path) -> None:
    retro_palette_hex = find_hex_palette(RETRO_PALETTE_ROOT / "_")
    if retro_palette_hex is None:
        print(f"Error: no .hex palette found in {RETRO_PALETTE_ROOT}", file=sys.stderr)
        sys.exit(1)
    print(f"Retro palette: {retro_palette_hex.name} ({retro_palette_hex.relative_to(PROJECT_ROOT)})")
    retro_palette = load_hex_palette(retro_palette_hex)

    if output_root.exists():
        shutil.rmtree(output_root)
    generated = []
    for civ_key, civ in CIVS.items():
        for unit, look in UNIT_LOOKS.items():
            variant_key = f"{civ_key}_{VARIANT_KEY}"
            for job in UNIT_JOBS[unit]:
                walking_source_sheet = SHEET_BY_KEY["walking"]
                if job.walking_equipment:
                    walking_source_sheet = EQUIPPED_WALK_SOURCE_SHEET
                sheet_plan = {
                    "walking": (walking_source_sheet, "walk", job.walking_equipment),
                    "action": (SHEET_BY_ANIMATION[job.action_animation], job.action_animation, job.action_equipment),
                    "dying": (SHEET_BY_KEY["dying"], "hurt", job.hurt_equipment),
                    "corpse": (SHEET_BY_KEY["corpse"], "hurt", job.hurt_equipment),
                }
                if job.loaded_equipment:
                    sheet_plan["loaded"] = (EQUIPPED_WALK_SOURCE_SHEET, "walk", job.loaded_equipment)
                for output_sheet, (source_sheet, animation, equipment) in sheet_plan.items():
                    # "neutral" isn't a real player color, so this always resolves to the
                    # "blue" team-color convention (image_pipeline.layer_paths) — every
                    # recolorable piece, whether pixel-recolored or picked by filename, is
                    # baked in the same blue palette that changeSpriteColor's SOURCE_COLORS
                    # matches at runtime, so one bake per civ covers every player color.
                    paths = layer_paths(look, animation, civ, "neutral", equipment)
                    layers = [open_layer(source_root, layer) for layer in paths]
                    frames = [
                        compose_frame(layers, frame_index, source_sheet.columns)
                        for frame_index in source_frames(source_sheet)
                    ]
                    output_dir = output_root / unit / variant_key / job.key / output_sheet
                    write_sheet(output_dir, frames, animation_speed_for(output_sheet))
                    generated.append(f"{unit}/{variant_key}/{job.key}/{output_sheet}")
            print(f"  composed {unit}/{variant_key} ({len(generated)} sheets so far)")
    print(f"Composed {len(generated)} sheets")

    print(f"Applying retro palette ({retro_palette_hex.name})...")
    for index, relative_path in enumerate(generated, start=1):
        bake_retro_style(output_root / relative_path / "texture.png", retro_palette,
                         lightness_weight=RETRO_LIGHTNESS_WEIGHT)
        if index % 50 == 0 or index == len(generated):
            print(f"  retro-styled {index}/{len(generated)}")

    print("Baking unit shadows...")
    for index, relative_path in enumerate(generated, start=1):
        apply_shadow_to_atlas(output_root / relative_path, SHADOW_OFFSET, SHADOW_ALPHA, SHADOW_RADIUS)
        if index % 50 == 0 or index == len(generated):
            print(f"  shadowed {index}/{len(generated)}")

    with (output_root / "manifest.json").open("w", encoding="utf8") as file:
        json.dump({"skinTones": SKIN_TONES, "civilizations": CIVS, "assets": generated}, file, indent=2)
        file.write("\n")
    print(f"Generated {len(generated)} baked LPC sheets into {output_root.relative_to(PROJECT_ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build optimized baked LPC unit spritesheets.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args()
    build(args.source, args.out)


if __name__ == "__main__":
    main()
