#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import replace
from pathlib import Path

from build import RETRO_PALETTE_ROOT, animation_speed_for, bake_sheet
from build_arrow_projectiles import ARROW_VARIANTS, build_arrow_projectiles
from config import DEFAULT_OUTPUT_ROOT, DEFAULT_SOURCE_ROOT, PROJECT_ROOT, SHEETS

from equipment import DYNAMIC_EQUIPMENT, EQUIPMENT_LAYER_ORDER, active_layer_keys, has_animation_content
from image_pipeline import compose_frame, open_layer, source_frames
from PIL import Image
from retro_palette import find_hex_palette, load_hex_palette
from simple_darken_border import DARKEN_FACTOR, darken_border


SHEET_BY_KEY = {sheet.key: sheet for sheet in SHEETS}
SHEET_BY_ANIMATION = {sheet.source_animation: sheet for sheet in SHEETS}
OUTPUT_ROOT = DEFAULT_OUTPUT_ROOT.parent / "lpc-equipment"
PROJECTILE_OUTPUT_ROOT = PROJECT_ROOT / "public/assets/graphics/projectiles"
PROJECTILE_EQUIPMENT_KEYS = {f"arrow_{variant}" for variant in ARROW_VARIANTS}
ATLAS_MAX_WIDTH = 4096


def equipment_family_path(equipment_key: str) -> str:
    if equipment_key.startswith("armor_mail_"):
        return "armor/armor_mail"
    if equipment_key.startswith("armor_legion_"):
        return "armor/armor_legion"
    if equipment_key == "armor_leather":
        return "armor/armor_leather"
    if equipment_key.startswith("helmet_pointed_"):
        return "helmet/helmet_pointed"
    if equipment_key.startswith("helmet_barbuta_"):
        return "helmet/helmet_barbuta"
    if equipment_key.startswith("helmet_legion_"):
        return "helmet/helmet_legion"
    if equipment_key.startswith("helmet_nasal_"):
        return "helmet/helmet_nasal"
    if equipment_key.startswith("helmet_bascinet_round_"):
        return "helmet/helmet_bascinet_round"
    if equipment_key.startswith("helmet_norman_"):
        return "helmet/helmet_norman"
    if equipment_key.startswith("helmet_barbarian_nasal_"):
        return "helmet/helmet_barbarian_nasal"
    if equipment_key.startswith("helmet_barbarian_"):
        return "helmet/helmet_barbarian"
    if equipment_key.startswith("shoulder_legion_"):
        return "armor/shoulder_legion"
    if equipment_key.startswith("bracers_"):
        return "armor/bracers"
    if equipment_key.startswith("leg_armor_"):
        return "armor/leg_armor"
    if equipment_key.startswith("axe_"):
        return "weapon/axe"
    if equipment_key.startswith("pickaxe_"):
        return "tool/pickaxe"
    if equipment_key.startswith("hammer_"):
        return "tool/hammer"
    if equipment_key.startswith("scythe_"):
        return "tool/scythe"
    if equipment_key in {"bow", "bow_great", "bow_recurve"}:
        return "weapon/bow"
    if equipment_key.startswith("arrow_"):
        return "weapon/arrow"
    if equipment_key == "halberd":
        return "weapon/halberd"
    if equipment_key.startswith("sword_") or equipment_key == "longsword":
        return "weapon/sword"
    if equipment_key.startswith("round_shield_"):
        return "weapon/round_shield"
    if equipment_key in {"meat", "stone", "gold"}:
        return "resource/carried"
    if equipment_key == "cape_solid":
        return "accessory/cape"
    if equipment_key in {"crest", "centurion_crest", "centurion_plumage", "legion_plumage", "plumage"}:
        return "accessory/plumage"
    if equipment_key.startswith("upward_horns_"):
        return "accessory/upward_horns"
    if equipment_key == "helmet_wings":
        return "accessory/helmet_wings"
    if equipment_key == "sack_cloth_hood_leather":
        return "helmet/sack_cloth_hood"
    if equipment_key == "cane":
        return "weapon/cane"
    if equipment_key == "quiver":
        return "weapon/quiver"
    return f"misc/{equipment_key}"


def display_path(path: Path) -> Path:
    try:
        return path.relative_to(PROJECT_ROOT)
    except ValueError:
        return path


def merge_equipment_family_atlases(output_root: Path, output_dirs_by_equipment: dict[str, set[Path]]) -> None:
    family_dirs: dict[str, list[Path]] = {}
    for equipment_key, output_dirs in output_dirs_by_equipment.items():
        family = equipment_family_path(equipment_key)
        family_dirs.setdefault(family, []).extend(output_dirs)

    for family, output_dirs in sorted(family_dirs.items()):
        write_equipment_family_atlas(output_root / family, sorted(output_dirs))

    for equipment_key in output_dirs_by_equipment:
        shutil.rmtree(output_root / equipment_key, ignore_errors=True)


def write_equipment_family_atlas(output_dir: Path, source_dirs: list[Path]) -> None:
    frames: dict[str, dict] = {}
    placements: list[tuple[str, Image.Image, dict, int, int]] = []
    x = 0
    y = 0
    row_height = 0
    atlas_width = 0
    atlas_height = 0

    for source_dir in source_dirs:
        json_path = source_dir / "texture.json"
        png_path = source_dir / "texture.png"
        if not json_path.exists() or not png_path.exists():
            continue
        with json_path.open(encoding="utf8") as file:
            sheet = json.load(file)
        image = Image.open(png_path).convert("RGBA")
        for frame_name, frame_data in sorted(sheet.get("frames", {}).items()):
            frame = frame_data["frame"]
            frame_width = int(frame["w"])
            frame_height = int(frame["h"])
            if x and x + frame_width > ATLAS_MAX_WIDTH:
                x = 0
                y += row_height + 1
                row_height = 0
            crop = image.crop((int(frame["x"]), int(frame["y"]), int(frame["x"]) + frame_width, int(frame["y"]) + frame_height))
            placements.append((frame_name, crop, frame_data, x, y))
            atlas_width = max(atlas_width, x + frame_width)
            atlas_height = max(atlas_height, y + frame_height)
            row_height = max(row_height, frame_height)
            x += frame_width + 1

    if not placements:
        return

    atlas = Image.new("RGBA", (atlas_width, atlas_height), (0, 0, 0, 0))
    for frame_name, crop, frame_data, frame_x, frame_y in placements:
        atlas.alpha_composite(crop, (frame_x, frame_y))
        copied_frame_data = json.loads(json.dumps(frame_data))
        copied_frame_data["frame"]["x"] = frame_x
        copied_frame_data["frame"]["y"] = frame_y
        frames[frame_name] = copied_frame_data

    output_dir.mkdir(parents=True, exist_ok=True)
    atlas.save(output_dir / "texture.png", optimize=True)
    with (output_dir / "texture.json").open("w", encoding="utf8") as file:
        json.dump(
            {
                "frames": frames,
                "meta": {
                    "app": "build_equipment.py",
                    "version": "2.0.0",
                    "image": "texture.png",
                    "format": "RGBA8888",
                    "size": {"w": atlas_width, "h": atlas_height},
                    "scale": 1,
                },
            },
            file,
            indent=2,
        )
        file.write("\n")
    darken_border(output_dir / "texture.png", DARKEN_FACTOR)


def sheet_plan(equipment) -> dict[str, tuple[str, object]]:
    plan = {
        "walking": ("walk", SHEET_BY_KEY["walking"]),
        "action": (equipment.action_animation, SHEET_BY_ANIMATION[equipment.action_animation]),
    }
    if equipment.action_animation != "shoot" and has_animation_content(equipment, "shoot"):
        plan["shooting"] = ("shoot", SHEET_BY_ANIMATION["shoot"])
    if has_animation_content(equipment, "hurt"):
        plan["dying"] = ("hurt", SHEET_BY_KEY["dying"])
        plan["corpse"] = ("hurt", SHEET_BY_KEY["corpse"])
    return plan


def bake_equipment_sheets(equipment, source_root: Path, output_root: Path, retro_palette) -> tuple[int, set[Path]]:
    built = 0
    output_dirs: set[Path] = set()
    active_layers = active_layer_keys(equipment)
    variants = equipment.variants or (None,)
    for variant in variants:
        for output_sheet, (animation, source_sheet) in sheet_plan(equipment).items():
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
                    context_specs = [spec for spec in all_specs if spec not in specs]
                    if variant:
                        specs = [replace(spec, path=spec.path.format(variant=variant)) for spec in specs]
                        context_specs = [replace(spec, path=spec.path.format(variant=variant)) for spec in context_specs]
                    loaded_layers = [open_layer(source_root, spec) for spec in specs]
                    # The other layer's specs must still take part in fallback-group
                    # scans (see compose_frame): a weapon living in the other layer
                    # this frame is present, not missing.
                    context_layers = [open_layer(source_root, spec) for spec in context_specs]
                    frames.append(
                        compose_frame(loaded_layers, frame_index, source_sheet.columns, context_layers=context_layers)
                    )
                output_dir = output_root / equipment.key / layer_key / output_sheet
                if variant:
                    output_dir = output_dir / variant
                bake_sheet(output_dir, frames, animation_speed_for(output_sheet), retro_palette)
                output_dirs.add(output_dir)
                built += 1
    return built, output_dirs


def build_equipment(source_root: Path, output_root: Path, only: set[str] | None = None) -> None:
    retro_palette_hex = find_hex_palette(RETRO_PALETTE_ROOT / "_")
    if retro_palette_hex is None:
        raise RuntimeError(f"no .hex palette found in {RETRO_PALETTE_ROOT}")
    print(f"Retro palette: {retro_palette_hex.name} ({retro_palette_hex.relative_to(PROJECT_ROOT)})")
    retro_palette = load_hex_palette(retro_palette_hex)
    output_root.mkdir(parents=True, exist_ok=True)

    unknown_equipment = sorted((only or set()) - set(DYNAMIC_EQUIPMENT))
    if unknown_equipment:
        raise RuntimeError(f"unknown dynamic equipment(s): {', '.join(unknown_equipment)}")

    selected_equipment = [
        equipment for equipment in DYNAMIC_EQUIPMENT.values() if only is None or equipment.key in only
    ]
    print(f"Building {len(selected_equipment)} dynamic LPC equipment item(s)")

    selected_equipment_by_family = {}
    for equipment in selected_equipment:
        selected_equipment_by_family.setdefault(equipment_family_path(equipment.key), []).append(equipment)

    built = 0
    for family, family_equipment in selected_equipment_by_family.items():
        output_dirs_by_equipment: dict[str, set[Path]] = {}
        family_built = 0
        for equipment in family_equipment:
            equipment_built, output_dirs = bake_equipment_sheets(equipment, source_root, output_root, retro_palette)
            output_dirs_by_equipment[equipment.key] = output_dirs
            built += equipment_built
            family_built += equipment_built
            print(f"  baked {equipment.key} ({equipment_built} sheets, {built} total)")
        merge_equipment_family_atlases(output_root, output_dirs_by_equipment)
        print(f"  merged {family} ({family_built} sheets)")

    if only is None or PROJECTILE_EQUIPMENT_KEYS.intersection(only):
        build_arrow_projectiles(output_root=PROJECTILE_OUTPUT_ROOT)

    print(f"Generated {built} dynamic LPC equipment sheets into {display_path(output_root)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build dynamic LPC equipment overlay spritesheets.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT)
    parser.add_argument("--only", nargs="*", default=None, help="Build only the listed dynamic equipment keys.")
    args = parser.parse_args()
    build_equipment(args.source, args.out, set(args.only) if args.only is not None else None)


if __name__ == "__main__":
    main()
