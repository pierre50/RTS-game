#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from build import RETRO_PALETTE_ROOT, animation_speed_for, bake_sheet
from config import DEFAULT_OUTPUT_ROOT, DEFAULT_SOURCE_ROOT, PROJECT_ROOT, SHEETS
from dynamic_equipment import DYNAMIC_EQUIPMENT, EQUIPMENT_LAYER_ORDER, active_layer_keys, has_animation_content
from image_pipeline import compose_frame, open_layer, source_frames
from retro_palette import find_hex_palette, load_hex_palette


SHEET_BY_KEY = {sheet.key: sheet for sheet in SHEETS}
SHEET_BY_ANIMATION = {sheet.source_animation: sheet for sheet in SHEETS}
OUTPUT_ROOT = DEFAULT_OUTPUT_ROOT.parent / "lpc-equipment"


def sheet_plan(action_animation: str) -> dict[str, tuple[str, object]]:
    return {
        "walking": ("walk", SHEET_BY_KEY["walking"]),
        "action": (action_animation, SHEET_BY_ANIMATION[action_animation]),
    }


def build_equipment(source_root: Path, output_root: Path) -> None:
    retro_palette_hex = find_hex_palette(RETRO_PALETTE_ROOT / "_")
    if retro_palette_hex is None:
        raise RuntimeError(f"no .hex palette found in {RETRO_PALETTE_ROOT}")
    retro_palette = load_hex_palette(retro_palette_hex)
    output_root.mkdir(parents=True, exist_ok=True)

    built = 0
    for equipment in DYNAMIC_EQUIPMENT.values():
        active_layers = active_layer_keys(equipment)
        for output_sheet, (animation, source_sheet) in sheet_plan(equipment.action_animation).items():
            if not has_animation_content(equipment, animation):
                continue
            layers_by_key = {layer.key: layer for layer in equipment.layers_by_animation.get(animation, ())}
            for layer_key, _z_index in EQUIPMENT_LAYER_ORDER:
                if layer_key not in active_layers:
                    continue
                other_key = "front" if layer_key == "back" else "back"
                own_layer = layers_by_key.get(layer_key)
                other_layer = layers_by_key.get(other_key)
                own_specs = own_layer.layers if own_layer else ()
                other_specs = other_layer.layers if other_layer else ()
                all_specs = (*own_specs, *other_specs)
                frames = []
                for frame_index in source_frames(source_sheet):
                    source_row = frame_index // source_sheet.columns
                    # A spec flagged behind_body_rows belongs to the *other* named
                    # layer on those rows (see LayerSpec.behind_body_rows): a carried
                    # item held in front everywhere except when facing away, where it
                    # must paste behind the body instead. There's no body layer in
                    # this standalone equipment bake to swap paste order against, so
                    # the swap happens here, at the back/front sheet level.
                    specs = [spec for spec in own_specs if source_row not in spec.behind_body_rows]
                    specs += [spec for spec in other_specs if source_row in spec.behind_body_rows]
                    loaded_layers = [open_layer(source_root, spec) for spec in specs]
                    # The other layer's specs must still take part in fallback-group
                    # scans (see compose_frame): a weapon living in the other layer
                    # this frame is present, not missing.
                    context_layers = [open_layer(source_root, spec) for spec in all_specs if spec not in specs]
                    frames.append(
                        compose_frame(loaded_layers, frame_index, source_sheet.columns, context_layers=context_layers)
                    )
                output_dir = output_root / equipment.key / layer_key / output_sheet
                bake_sheet(output_dir, frames, animation_speed_for(output_sheet), retro_palette)
                built += 1

    print(f"Generated {built} dynamic LPC equipment sheets into {output_root.relative_to(PROJECT_ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build dynamic LPC equipment overlay spritesheets.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT)
    args = parser.parse_args()
    build_equipment(args.source, args.out)


if __name__ == "__main__":
    main()
