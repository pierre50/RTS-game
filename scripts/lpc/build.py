#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import asdict, replace
import hashlib
import json
import shutil
import sys
import warnings
from pathlib import Path

from config import (
    CIVS,
    DEFAULT_OUTPUT_ROOT,
    DEFAULT_SOURCE_ROOT,
    LPC_ANIMATION_SPEED,
    PROJECT_ROOT,
    SHEETS,
    SKIN_TONES,
    Sheet,
    UNIT_LOOKS,
    civs_for_unit,
    variant_look_for_civ,
    variants_for_unit,
)
from jobs import Job, UNIT_JOBS
from image_pipeline import compose_frame, layer_paths, open_layer, source_frames, write_sheet
from PIL import Image

RETRO_PALETTE_ROOT = PROJECT_ROOT / "scripts" / "retro_palette"
SCRIPTS_ROOT = PROJECT_ROOT / "scripts"
sys.path.insert(0, str(RETRO_PALETTE_ROOT))
sys.path.insert(0, str(SCRIPTS_ROOT))
from retro_palette import bake_retro_style, find_hex_palette, load_hex_palette
from outline_style import OUTLINE_MODE, apply_outline_style_to_atlas
from simple_darken_border import DARKEN_FACTOR, darken_border

warnings.simplefilter("ignore", DeprecationWarning)

# Prioritizes matching lightness over hue when snapping to the palette: this palette has
# gaps in some hues (e.g. no dark brown), so a pure Lab nearest-neighbor match snaps those
# pixels to a same-hue-but-wrong-lightness color, causing a speckled look on outlines/edges.
RETRO_LIGHTNESS_WEIGHT = 4.0

# Directional lighting pass disabled to avoid post-recolor blue-ish border/shadow artifacts
# in runtime team-color remapping.
APPLY_SPRITE_LIGHTING = False
LIGHTING_TOP = 1.16
LIGHTING_BOTTOM = 0.74
LIGHTING_LEFT = 1.05
LIGHTING_RIGHT = 0.95
LIGHTING_CONTRAST = 1.08

SHEET_BY_KEY = {sheet.key: sheet for sheet in SHEETS}
SHEET_BY_ANIMATION = {sheet.source_animation: sheet for sheet in SHEETS}
CACHE_FILENAME = ".build-cache.json"
SheetPlan = dict[str, tuple[Sheet, str, str | None]]
BuildTask = tuple[str, Sheet, str]

ANIMATION_FALLBACKS = {
    "shoot": ("slash", "walk"),
    "slash": ("walk",),
    "spellcast": ("walk",),
}


def animation_speed_for(output_sheet: str) -> float:
    return 0 if output_sheet == "corpse" else LPC_ANIMATION_SPEED


def file_fingerprint(path: Path) -> dict[str, int | str]:
    stat = path.stat()
    return {"path": str(path), "mtime_ns": stat.st_mtime_ns, "size": stat.st_size}


def cache_file(output_root: Path) -> Path:
    return output_root / CACHE_FILENAME


def read_cache(output_root: Path) -> dict[str, str]:
    path = cache_file(output_root)
    if not path.exists():
        return {}
    try:
        with path.open(encoding="utf8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}
    entries = data.get("entries")
    return entries if isinstance(entries, dict) else {}


def write_cache(output_root: Path, entries: dict[str, str]) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    with cache_file(output_root).open("w", encoding="utf8") as file:
        json.dump({"entries": entries}, file, indent=2, sort_keys=True)
        file.write("\n")


def read_manifest_assets(output_root: Path) -> set[str]:
    manifest_path = output_root / "manifest.json"
    if not manifest_path.exists():
        return set()
    try:
        with manifest_path.open(encoding="utf8") as file:
            return set(json.load(file).get("assets", []))
    except (OSError, json.JSONDecodeError):
        return set()


def script_dependencies(retro_palette_hex: Path) -> list[dict[str, int | str]]:
    paths = [
        Path(__file__),
        PROJECT_ROOT / "scripts/lpc/config.py",
        PROJECT_ROOT / "scripts/lpc/equipment.py",
        PROJECT_ROOT / "scripts/lpc/image_pipeline.py",
        PROJECT_ROOT / "scripts/lpc/jobs.py",
        PROJECT_ROOT / "scripts/lpc/outline_style.py",
        PROJECT_ROOT / "scripts/simple_darken_border.py",
        RETRO_PALETTE_ROOT / "retro_palette.py",
        retro_palette_hex,
    ]
    return [file_fingerprint(path) for path in paths]


def sheet_signature(
    *,
    source_root: Path,
    relative_path: str,
    source_sheet: Sheet,
    animation: str,
    equipment: str | None,
    paths: list,
    animation_speed: float,
    dependencies: list[dict[str, int | str]],
) -> str:
    payload = {
        "version": 2,
        "relativePath": relative_path,
        "sourceSheet": asdict(source_sheet),
        "animation": animation,
        "equipment": equipment,
        "animationSpeed": animation_speed,
        "layers": [asdict(layer) for layer in paths],
        "layerFiles": [file_fingerprint(source_root / layer.path) for layer in paths],
        "pipeline": {
            "retroLightnessWeight": RETRO_LIGHTNESS_WEIGHT,
            "lightingTop": LIGHTING_TOP,
            "lightingBottom": LIGHTING_BOTTOM,
            "lightingLeft": LIGHTING_LEFT,
            "lightingRight": LIGHTING_RIGHT,
            "lightingContrast": LIGHTING_CONTRAST,
            "outlineMode": OUTLINE_MODE,
            "finalDarkBorderFactor": DARKEN_FACTOR,
        },
        "dependencies": dependencies,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf8")
    return hashlib.sha256(encoded).hexdigest()


def variant_atlas_outputs_exist(output_root: Path, relative_path: str) -> bool:
    output_dir = output_root / relative_path
    return (output_dir / "texture.png").exists() and (output_dir / "texture.json").exists()


def variant_cache_key(relative_path: str) -> str:
    return f"atlas:{relative_path}"


def bake_sheet(output_dir: Path, frames: list, animation_speed: float, retro_palette, anchor_override: dict[str, float] | None = None) -> None:
    write_sheet(output_dir, frames, animation_speed, anchor_override)
    bake_retro_style(output_dir / "texture.png", retro_palette, lightness_weight=RETRO_LIGHTNESS_WEIGHT)
    apply_outline_style_to_atlas(output_dir, OUTLINE_MODE)


def fallback_layer_path(path: str, animation: str, fallback: str) -> str:
    return path.replace(f"/{animation}/", f"/{fallback}/").replace(f"/{animation}.png", f"/{fallback}.png")


def resolve_layer_paths(source_root: Path, paths: list, animation: str) -> list:
    resolved = []
    for layer in paths:
        if (source_root / layer.path).exists():
            resolved.append(layer)
            continue
        fallback = next(
            (
                fallback_path
                for fallback_animation in ANIMATION_FALLBACKS.get(animation, ())
                for fallback_path in [fallback_layer_path(layer.path, animation, fallback_animation)]
                if fallback_path != layer.path and (source_root / fallback_path).exists()
            ),
            None,
        )
        resolved.append(replace(layer, path=fallback) if fallback else layer)
    return resolved


def prune_stale_outputs(output_root: Path, previous_assets: set[str], current_assets: set[str]) -> None:
    for relative_path in sorted(previous_assets - current_assets):
        shutil.rmtree(output_root / relative_path, ignore_errors=True)


def prune_empty_dirs(root: Path) -> None:
    if not root.exists():
        return
    for path in sorted((candidate for candidate in root.rglob("*") if candidate.is_dir()), reverse=True):
        try:
            path.rmdir()
        except OSError:
            pass


def write_variant_atlas(output_dir: Path, source_dirs: list[Path], postprocess=None) -> None:
    frames = {}
    placements = []
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
            if x and x + frame_width > 4096:
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
                    "app": "build.py",
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
    if postprocess:
        postprocess(output_dir / "texture.png")


def build_sheet_plan(unit: str, job: Job) -> SheetPlan:
    plan = {
        "walking": (SHEET_BY_KEY["walking"], "walk", job.walking_equipment),
        "action": (SHEET_BY_ANIMATION[job.action_animation], job.action_animation, job.action_equipment),
    }
    if unit != "villager" or job.key == "default":
        plan["dying"] = (SHEET_BY_KEY["dying"], "hurt", job.hurt_equipment)
        plan["corpse"] = (SHEET_BY_KEY["corpse"], "hurt", job.hurt_equipment)
    if job.loaded_equipment:
        plan["loaded"] = (SHEET_BY_KEY["walking"], "walk", job.loaded_equipment)
    return plan


def villager_build_tasks() -> list[BuildTask]:
    return [
        ("body/walking", SHEET_BY_KEY["walking"], "walk"),
        ("body/dying", SHEET_BY_KEY["dying"], "hurt"),
        ("body/corpse", SHEET_BY_KEY["corpse"], "hurt"),
        ("action/slash", SHEET_BY_ANIMATION["slash"], "slash"),
        ("action/shoot", SHEET_BY_ANIMATION["shoot"], "shoot"),
    ]


# Same body-pose layout as the villager, plus the action poses the hero can still use.
def hero_build_tasks() -> list[BuildTask]:
    return [
        ("body/walking", SHEET_BY_KEY["walking"], "walk"),
        ("body/dying", SHEET_BY_KEY["dying"], "hurt"),
        ("body/corpse", SHEET_BY_KEY["corpse"], "hurt"),
        ("action/slash", SHEET_BY_ANIMATION["slash"], "slash"),
        ("action/shoot", SHEET_BY_ANIMATION["shoot"], "shoot"),
    ]


def unit_build_tasks(unit: str) -> list[BuildTask]:
    tasks = [
        (output_sheet, source_sheet, animation)
        for output_sheet, (source_sheet, animation, _equipment) in build_sheet_plan(unit, UNIT_JOBS[unit][0]).items()
    ]
    if unit in {"infantry", "infantry_nohair"}:
        tasks.append(("action/shoot", SHEET_BY_ANIMATION["shoot"], "shoot"))
    return tasks


def build(
    source_root: Path,
    output_root: Path,
    *,
    clean: bool = False,
    civ_keys: set[str] | None = None,
    unit_keys: set[str] | None = None,
) -> None:
    retro_palette_hex = find_hex_palette(RETRO_PALETTE_ROOT / "_")
    if retro_palette_hex is None:
        print(f"Error: no .hex palette found in {RETRO_PALETTE_ROOT}", file=sys.stderr)
        sys.exit(1)
    print(f"Retro palette: {retro_palette_hex.name} ({retro_palette_hex.relative_to(PROJECT_ROOT)})")
    retro_palette = load_hex_palette(retro_palette_hex)
    dependencies = script_dependencies(retro_palette_hex)

    if clean and output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    previous_manifest_assets = read_manifest_assets(output_root)
    previous_cache = read_cache(output_root)
    selected_civs = CIVS if civ_keys is None else {key: civ for key, civ in CIVS.items() if key in civ_keys}
    if civ_keys is not None:
        unknown_civs = sorted(civ_keys - set(CIVS))
        if unknown_civs:
            print(f"Error: unknown civilization(s): {', '.join(unknown_civs)}", file=sys.stderr)
            sys.exit(1)
        if not selected_civs:
            print("Error: no civilizations selected", file=sys.stderr)
            sys.exit(1)
    selected_units = UNIT_LOOKS if unit_keys is None else {key: look for key, look in UNIT_LOOKS.items() if key in unit_keys}
    if unit_keys is not None:
        unknown_units = sorted(unit_keys - set(UNIT_LOOKS))
        if unknown_units:
            print(f"Error: unknown unit(s): {', '.join(unknown_units)}", file=sys.stderr)
            sys.exit(1)
        if not selected_units:
            print("Error: no units selected", file=sys.stderr)
            sys.exit(1)

    partial_build = civ_keys is not None or unit_keys is not None
    next_cache: dict[str, str] = dict(previous_cache) if partial_build else {}
    generated = sorted(previous_manifest_assets) if partial_build else []
    generated_set = set(generated)
    skipped = 0
    rebuilt = 0
    for unit in selected_units:
        for civ_key, civ in civs_for_unit(unit, selected_civs).items():
            for variant in variants_for_unit(unit):
                look = variant_look_for_civ(unit, civ_key, variant)
                variant_key = f"{civ_key}/{variant.key}" if civ_key else variant.key
                if unit == "villager":
                    tasks = villager_build_tasks()
                elif unit == "hero":
                    tasks = hero_build_tasks()
                else:
                    tasks = unit_build_tasks(unit)
                variant_asset_path = f"{unit}/{variant_key}"
                if variant_asset_path not in generated_set:
                    generated.append(variant_asset_path)
                    generated_set.add(variant_asset_path)
                variant_task_data = []
                for relative_suffix, source_sheet, animation in tasks:
                    # "neutral" isn't a real player color, so this always resolves to the
                    # "blue" team-color convention (image_pipeline.layer_paths) — every
                    # recolorable piece, whether pixel-recolored or picked by filename, is
                    # baked in the same blue palette that changeSpriteColor's SOURCE_COLORS
                    # matches at runtime, so one bake per civ covers every player color.
                    paths = resolve_layer_paths(source_root, layer_paths(look, animation, civ, "neutral"), animation)
                    relative_path = f"{unit}/{variant_key}/{relative_suffix}"
                    output_sheet = relative_suffix.rsplit("/", 1)[-1]
                    animation_speed = animation_speed_for(output_sheet)
                    signature = sheet_signature(
                        source_root=source_root,
                        relative_path=relative_path,
                        source_sheet=source_sheet,
                        animation=animation,
                        equipment=None,
                        paths=paths,
                        animation_speed=animation_speed,
                        dependencies=dependencies,
                    )
                    next_cache[relative_path] = signature
                    variant_task_data.append(
                        {
                            "relative_suffix": relative_suffix,
                            "relative_path": relative_path,
                            "source_sheet": source_sheet,
                            "paths": paths,
                            "animation_speed": animation_speed,
                            "signature": signature,
                        }
                    )

                atlas_signature = hashlib.sha256(
                    json.dumps(
                        [task["signature"] for task in variant_task_data],
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf8")
                ).hexdigest()
                next_cache[variant_cache_key(variant_asset_path)] = atlas_signature
                if (
                    previous_cache.get(variant_cache_key(variant_asset_path)) == atlas_signature
                    and variant_atlas_outputs_exist(output_root, variant_asset_path)
                ):
                    prune_empty_dirs(output_root / variant_asset_path)
                    skipped += len(variant_task_data)
                    print(f"  baked {unit}/{variant_key} ({rebuilt} rebuilt, {skipped} cached)")
                    continue

                variant_output_dirs = []
                for task in variant_task_data:
                    layers = [open_layer(source_root, layer) for layer in task["paths"]]
                    frames = [
                        compose_frame(layers, frame_index, task["source_sheet"].columns)
                        for frame_index in source_frames(task["source_sheet"])
                    ]
                    output_dir = output_root / task["relative_path"]
                    bake_sheet(output_dir, frames, task["animation_speed"], retro_palette)
                    variant_output_dirs.append(output_dir)
                    rebuilt += 1
                write_variant_atlas(
                    output_root / variant_asset_path,
                    variant_output_dirs,
                    postprocess=lambda path: darken_border(path, DARKEN_FACTOR),
                )
                for task in variant_task_data:
                    shutil.rmtree(output_root / task["relative_path"], ignore_errors=True)
                prune_empty_dirs(output_root / variant_asset_path)
                print(f"  baked {unit}/{variant_key} ({rebuilt} rebuilt, {skipped} cached)")
    print(f"Baked {len(generated)} sheets ({rebuilt} rebuilt, {skipped} cached)")

    with (output_root / "manifest.json").open("w", encoding="utf8") as file:
        json.dump({"skinTones": SKIN_TONES, "civilizations": CIVS, "assets": generated}, file, indent=2)
        file.write("\n")
    write_cache(output_root, next_cache)
    if not partial_build:
        prune_stale_outputs(output_root, previous_manifest_assets, set(generated))
    print(f"Generated {len(generated)} baked LPC sheets into {output_root.relative_to(PROJECT_ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build optimized baked LPC unit spritesheets.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--clean", action="store_true", help="Delete the output folder before baking.")
    parser.add_argument("--civ", action="append", help="Bake only one civilization key. Can be passed multiple times.")
    parser.add_argument("--unit", action="append", help="Bake only one LPC unit key. Can be passed multiple times.")
    args = parser.parse_args()
    build(
        args.source,
        args.out,
        clean=args.clean,
        civ_keys=set(args.civ) if args.civ else None,
        unit_keys=set(args.unit) if args.unit else None,
    )


if __name__ == "__main__":
    main()
