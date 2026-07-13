#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import warnings
from pathlib import Path

from config import CIVS, DEFAULT_OUTPUT_ROOT, DEFAULT_SOURCE_ROOT, LPC_ANIMATION_SPEED, PLAYER_SHORTS, PROJECT_ROOT, SHEETS, SKIN_TONES, Sheet, UNIT_LOOKS, VARIANT_KEY
from image_pipeline import compose_frame, layer_paths, open_layer, source_frames, write_sheet
from jobs import UNIT_JOBS

warnings.simplefilter("ignore", DeprecationWarning)

SHEET_BY_KEY = {sheet.key: sheet for sheet in SHEETS}
SHEET_BY_ANIMATION = {sheet.source_animation: sheet for sheet in SHEETS}
EQUIPPED_WALK_SOURCE_SHEET = Sheet("walking_equipped", "walk", 9, 4, frame_indices=(0, 2, 5, 8, 9, 11, 14, 17, 18, 20, 23, 26, 27, 29, 32, 35))


def animation_speed_for(output_sheet: str) -> float:
    return 0 if output_sheet == "corpse" else LPC_ANIMATION_SPEED


def build(source_root: Path, output_root: Path) -> None:
    if output_root.exists():
        shutil.rmtree(output_root)
    generated = []
    for civ_key, civ in CIVS.items():
        for unit, look in UNIT_LOOKS.items():
            player_colors = tuple(PLAYER_SHORTS.keys()) if unit == "villager" else ("neutral",)
            for player_color in player_colors:
                variant_key = f"{civ_key}_{VARIANT_KEY}"
                if unit == "villager":
                    variant_key = f"{variant_key}_{player_color}"
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
                    for output_sheet, (source_sheet, animation, equipment) in sheet_plan.items():
                        paths = layer_paths(look, animation, civ, player_color, equipment)
                        layers = [open_layer(source_root, layer) for layer in paths]
                        frames = [
                            compose_frame(layers, frame_index, source_sheet.columns)
                            for frame_index in source_frames(source_sheet)
                        ]
                        output_dir = output_root / unit / variant_key / job.key / output_sheet
                        write_sheet(output_dir, frames, animation_speed_for(output_sheet))
                        generated.append(f"{unit}/{variant_key}/{job.key}/{output_sheet}")

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
