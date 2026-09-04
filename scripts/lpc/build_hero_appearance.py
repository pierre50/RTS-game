#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from build import RETRO_PALETTE_ROOT, animation_speed_for, bake_sheet, prune_empty_dirs, write_variant_atlas
from config import DEFAULT_SOURCE_ROOT, PROJECT_ROOT, SHEETS
from equipment import LayerSpec
from image_pipeline import compose_frame, open_layer, source_frames
from retro_palette import find_hex_palette, load_hex_palette


SHEET_BY_KEY = {sheet.key: sheet for sheet in SHEETS}
SHEET_BY_ANIMATION = {sheet.source_animation: sheet for sheet in SHEETS}
OUTPUT_ROOT = PROJECT_ROOT / "public/assets/graphics/hero"
SOURCE_HAIR_PALETTE = "brown_hair"

HERO_HAIR_TASKS = [
    ("front/walking", SHEET_BY_KEY["walking"], "walk"),
    ("front/dying", SHEET_BY_KEY["dying"], "hurt"),
    ("front/corpse", SHEET_BY_KEY["corpse"], "hurt"),
    ("front/action/slash", SHEET_BY_ANIMATION["slash"], "slash"),
    ("front/action/shoot", SHEET_BY_ANIMATION["shoot"], "shoot"),
]

ANIMATION_FALLBACKS = {
    "shoot": ("slash", "walk"),
    "slash": ("walk",),
    "spellcast": ("walk",),
}

PUBLIC_BODY_KEYS = {
    "adult": "male",
    "female": "female",
}

MIN_VISIBLE_ALPHA = 128


def display_path(path: Path) -> Path:
    try:
        return path.relative_to(PROJECT_ROOT)
    except ValueError:
        return path


def fallback_path(path: str, animation: str, fallback: str) -> str:
    return path.replace(f"/{animation}/", f"/{fallback}/").replace(f"/{animation}.png", f"/{fallback}.png")


def resolve_existing_path(source_root: Path, path: str, animation: str) -> str | None:
    if (source_root / path).exists():
        return path
    for fallback in ANIMATION_FALLBACKS.get(animation, ()):
        candidate = fallback_path(path, animation, fallback)
        if candidate != path and (source_root / candidate).exists():
            return candidate
    return None


def hair_layer_specs(source_root: Path, style: str, body: str, animation: str) -> dict[str, LayerSpec]:
    split_specs: dict[str, LayerSpec] = {}
    for layer in ("back", "front"):
        source_layer = "bg" if layer == "back" else "fg"
        path = resolve_existing_path(source_root, f"hair/{style}/{body}/{source_layer}/{animation}.png", animation)
        if path:
            split_specs[layer] = LayerSpec(path, SOURCE_HAIR_PALETTE)
    if split_specs:
        return split_specs

    path = resolve_existing_path(source_root, f"hair/{style}/{body}/{animation}.png", animation)
    return {"front": LayerSpec(path, SOURCE_HAIR_PALETTE)} if path else {}


def discover_hair_styles(source_root: Path) -> dict[str, set[str]]:
    styles: dict[str, set[str]] = {}
    hair_root = source_root / "hair"
    for body in PUBLIC_BODY_KEYS:
        for path in hair_root.glob(f"*/{body}/walk.png"):
            styles.setdefault(path.parts[-3], set()).add(body)
        for path in hair_root.glob(f"*/{body}/fg/walk.png"):
            styles.setdefault(path.parts[-4], set()).add(body)
    return styles


def remove_translucent_source_pixels(frame):
    pixels = frame.convert("RGBA")
    data = [
        (0, 0, 0, 0) if alpha <= MIN_VISIBLE_ALPHA else (red, green, blue, 255)
        for red, green, blue, alpha in pixels.getdata()
    ]
    pixels.putdata(data)
    return pixels


def build_hair_style(source_root: Path, output_root: Path, style: str, body: str, retro_palette) -> int:
    public_body = PUBLIC_BODY_KEYS[body]
    variant_root = output_root / "hair" / style / public_body
    temp_dirs: list[Path] = []
    built = 0

    for relative_suffix, source_sheet, animation in HERO_HAIR_TASKS:
        specs_by_layer = hair_layer_specs(source_root, style, body, animation)
        if not specs_by_layer:
            continue

        output_sheet = relative_suffix.rsplit("/", 1)[-1]
        for layer, spec in specs_by_layer.items():
            layer_suffix = relative_suffix.replace("front/", f"{layer}/", 1)
            frames = [
                remove_translucent_source_pixels(
                    compose_frame([open_layer(source_root, spec)], frame_index, source_sheet.columns)
                )
                for frame_index in source_frames(source_sheet)
            ]
            output_dir = variant_root / layer_suffix
            bake_sheet(output_dir, frames, animation_speed_for(output_sheet), retro_palette)
            temp_dirs.append(output_dir)
            built += 1

    if temp_dirs:
        write_variant_atlas(variant_root, temp_dirs)
        for temp_dir in temp_dirs:
            shutil.rmtree(temp_dir, ignore_errors=True)
        prune_empty_dirs(variant_root)
    return built


def build_hero_appearance(
    source_root: Path,
    output_root: Path,
    *,
    styles: set[str] | None = None,
    bodies: set[str] | None = None,
) -> None:
    retro_palette_hex = find_hex_palette(RETRO_PALETTE_ROOT / "_")
    if retro_palette_hex is None:
        raise RuntimeError(f"no .hex palette found in {RETRO_PALETTE_ROOT}")
    print(f"Retro palette: {retro_palette_hex.name} ({retro_palette_hex.relative_to(PROJECT_ROOT)})")
    retro_palette = load_hex_palette(retro_palette_hex)

    discovered = discover_hair_styles(source_root)
    unknown_styles = sorted((styles or set()) - set(discovered))
    if unknown_styles:
        raise RuntimeError(f"unknown hero hair style(s): {', '.join(unknown_styles)}")

    selected_bodies = bodies or set(PUBLIC_BODY_KEYS)
    unknown_bodies = sorted(selected_bodies - set(PUBLIC_BODY_KEYS))
    if unknown_bodies:
        raise RuntimeError(f"unknown hero hair body type(s): {', '.join(unknown_bodies)}")

    selected_styles = sorted(styles or set(discovered))
    output_root.mkdir(parents=True, exist_ok=True)
    built = 0
    assets: list[str] = []
    for style in selected_styles:
        for body in sorted(discovered[style] & selected_bodies):
            count = build_hair_style(source_root, output_root, style, body, retro_palette)
            if not count:
                continue
            public_body = PUBLIC_BODY_KEYS[body]
            assets.append(f"hair/{style}/{public_body}")
            built += count
            print(f"  baked hair/{style}/{public_body} ({count} sheets, {built} total)")

    with (output_root / "manifest.json").open("w", encoding="utf8") as file:
        json.dump(
            {
                "sourceHairPalette": SOURCE_HAIR_PALETTE,
                "assets": assets,
            },
            file,
            indent=2,
        )
        file.write("\n")
    print(f"Generated {built} hero appearance sheets into {display_path(output_root)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build custom hero LPC appearance overlay spritesheets.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT)
    parser.add_argument("--style", action="append", help="Build only one hair style. Can be passed multiple times.")
    parser.add_argument("--body", action="append", choices=sorted(PUBLIC_BODY_KEYS), help="Build only one LPC hair body folder.")
    args = parser.parse_args()
    build_hero_appearance(
        args.source,
        args.out,
        styles=set(args.style) if args.style else None,
        bodies=set(args.body) if args.body else None,
    )


if __name__ == "__main__":
    main()
