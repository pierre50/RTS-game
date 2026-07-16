#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import asdict
import hashlib
import json
import shutil
import sys
import warnings
from pathlib import Path

from config import CIVS, DEFAULT_OUTPUT_ROOT, DEFAULT_SOURCE_ROOT, LPC_ANIMATION_SPEED, PROJECT_ROOT, SHEETS, SKIN_TONES, Sheet, UNIT_LOOKS, VARIANT_KEY
from jobs import Job, UNIT_JOBS
from image_pipeline import compose_frame, layer_paths, open_layer, source_frames, write_sheet

RETRO_PALETTE_ROOT = PROJECT_ROOT / "scripts" / "retro_palette"
SPRITE_LIGHTING_ROOT = PROJECT_ROOT / "scripts" / "add_sprite_lighting"
sys.path.insert(0, str(RETRO_PALETTE_ROOT))
sys.path.insert(0, str(SPRITE_LIGHTING_ROOT))
from retro_palette import bake_retro_style, find_hex_palette, load_hex_palette
from add_sprite_lighting import process_sprite_file
from outline_style import OUTLINE_MODE, apply_outline_style_to_atlas

warnings.simplefilter("ignore", DeprecationWarning)

# Prioritizes matching lightness over hue when snapping to the palette: this palette has
# gaps in some hues (e.g. no dark brown), so a pure Lab nearest-neighbor match snaps those
# pixels to a same-hue-but-wrong-lightness color, causing a speckled look on outlines/edges.
RETRO_LIGHTNESS_WEIGHT = 4.0

# Directional lighting pass applied before the retro palette snap. Tuned to add
# contrast without washing out the smaller LPC details too aggressively.
LIGHTING_TOP = 1.30
LIGHTING_BOTTOM = 0.55
LIGHTING_LEFT = 1.10
LIGHTING_RIGHT = 0.88
LIGHTING_CONTRAST = 1.20

SHEET_BY_KEY = {sheet.key: sheet for sheet in SHEETS}
SHEET_BY_ANIMATION = {sheet.source_animation: sheet for sheet in SHEETS}
CACHE_FILENAME = ".build-cache.json"
SheetPlan = dict[str, tuple[Sheet, str, str | None]]


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
        RETRO_PALETTE_ROOT / "retro_palette.py",
        SPRITE_LIGHTING_ROOT / "add_sprite_lighting.py",
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
        },
        "dependencies": dependencies,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf8")
    return hashlib.sha256(encoded).hexdigest()


def sheet_outputs_exist(output_root: Path, relative_path: str) -> bool:
    output_dir = output_root / relative_path
    return (output_dir / "texture.png").exists() and (output_dir / "texture.json").exists()


def bake_sheet(output_dir: Path, frames: list, animation_speed: float, retro_palette) -> None:
    write_sheet(output_dir, frames, animation_speed)
    process_sprite_file(
        output_dir / "texture.png",
        output_dir / "texture.png",
        output_dir / "texture.json",
        top=LIGHTING_TOP,
        bottom=LIGHTING_BOTTOM,
        left=LIGHTING_LEFT,
        right=LIGHTING_RIGHT,
        contrast=LIGHTING_CONTRAST,
    )
    bake_retro_style(output_dir / "texture.png", retro_palette, lightness_weight=RETRO_LIGHTNESS_WEIGHT)
    apply_outline_style_to_atlas(output_dir, OUTLINE_MODE)


def prune_stale_outputs(output_root: Path, previous_assets: set[str], current_assets: set[str]) -> None:
    for relative_path in sorted(previous_assets - current_assets):
        shutil.rmtree(output_root / relative_path, ignore_errors=True)


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


def build(source_root: Path, output_root: Path, *, clean: bool = False, civ_keys: set[str] | None = None) -> None:
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

    next_cache: dict[str, str] = dict(previous_cache) if civ_keys is not None else {}
    generated = sorted(previous_manifest_assets) if civ_keys is not None else []
    generated_set = set(generated)
    skipped = 0
    rebuilt = 0
    for civ_key, civ in selected_civs.items():
        for unit, look in UNIT_LOOKS.items():
            variant_key = f"{civ_key}_{VARIANT_KEY}"
            for job in UNIT_JOBS[unit]:
                for output_sheet, (source_sheet, animation, equipment) in build_sheet_plan(unit, job).items():
                    # "neutral" isn't a real player color, so this always resolves to the
                    # "blue" team-color convention (image_pipeline.layer_paths) — every
                    # recolorable piece, whether pixel-recolored or picked by filename, is
                    # baked in the same blue palette that changeSpriteColor's SOURCE_COLORS
                    # matches at runtime, so one bake per civ covers every player color.
                    paths = layer_paths(look, animation, civ, "neutral", equipment)
                    relative_path = f"{unit}/{variant_key}/{job.key}/{output_sheet}"
                    animation_speed = animation_speed_for(output_sheet)
                    signature = sheet_signature(
                        source_root=source_root,
                        relative_path=relative_path,
                        source_sheet=source_sheet,
                        animation=animation,
                        equipment=equipment,
                        paths=paths,
                        animation_speed=animation_speed,
                        dependencies=dependencies,
                    )
                    if relative_path not in generated_set:
                        generated.append(relative_path)
                        generated_set.add(relative_path)
                    next_cache[relative_path] = signature
                    if previous_cache.get(relative_path) == signature and sheet_outputs_exist(output_root, relative_path):
                        skipped += 1
                        continue

                    layers = [open_layer(source_root, layer) for layer in paths]
                    frames = [
                        compose_frame(layers, frame_index, source_sheet.columns)
                        for frame_index in source_frames(source_sheet)
                    ]
                    bake_sheet(output_root / relative_path, frames, animation_speed, retro_palette)
                    rebuilt += 1
            print(f"  baked {unit}/{variant_key} ({rebuilt} rebuilt, {skipped} cached)")
    print(f"Baked {len(generated)} sheets ({rebuilt} rebuilt, {skipped} cached)")

    with (output_root / "manifest.json").open("w", encoding="utf8") as file:
        json.dump({"skinTones": SKIN_TONES, "civilizations": CIVS, "assets": generated}, file, indent=2)
        file.write("\n")
    write_cache(output_root, next_cache)
    if civ_keys is None:
        prune_stale_outputs(output_root, previous_manifest_assets, set(generated))
    print(f"Generated {len(generated)} baked LPC sheets into {output_root.relative_to(PROJECT_ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build optimized baked LPC unit spritesheets.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--clean", action="store_true", help="Delete the output folder before baking.")
    parser.add_argument("--civ", action="append", help="Bake only one civilization key. Can be passed multiple times.")
    args = parser.parse_args()
    build(args.source, args.out, clean=args.clean, civ_keys=set(args.civ) if args.civ else None)


if __name__ == "__main__":
    main()
