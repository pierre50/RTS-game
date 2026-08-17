#!/usr/bin/env python3
"""
outline_style.py — experiment: soften/remove the dark outline LPC sprites carry
around their silhouette.

LPC source art traces every character's outer silhouette (and the anti-aliased
fringe right next to it) in near-black. That reads as a much harder "inked" edge
than the rest of the game's art (see scripts/retro_palette/texture.png), which has
no such traced line — edges there just fade to the material's own dark shade.

This is a deliberately simple first pass: it only touches the outer ring (within
OUTLINE_MAX_DEPTH pixels of full transparency), recoloring outline pixels toward
their nearest non-outline neighbor. Alpha and silhouette shape are never touched.

Controlled by OUTLINE_MODE below — flip it and re-run `python3 scripts/lpc/build.py`
to compare:
    "off"       - no-op (default; current baked look).
    "attenuate" - blends outline pixels partway toward their neighbor's color.
    "remove"    - fully recolors outline pixels to their neighbor's color.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

# The dial: flip this to bake with a softened/removed outline and compare against
# "off". Read by build.py, which calls apply_outline_style_to_atlas() with it.
OUTLINE_MODE = "off"  # "off" | "attenuate" | "remove"

# A pixel counts as "outline" only if its simple luminance is at or below this (out
# of 255) — tuned against aap-64.hex's darkest entries (its outline near-blacks/greys
# sit under ~40; the palette's actual material browns start around 70+).
OUTLINE_LUMINANCE_THRESHOLD = 60
# How many 8-connected steps into the sprite, from full transparency, still count as
# "outline" rather than interior shading — covers both the solid dark ring LPC art
# traces and the 1-2px semi-transparent AA falloff right next to it.
OUTLINE_MAX_DEPTH = 2
# "attenuate" only: how far to blend outline pixels toward their neighbor's color
# (0 = untouched, 1 = same result as "remove").
OUTLINE_ATTENUATE_STRENGTH = 0.5


def _luminance(rgb: np.ndarray) -> np.ndarray:
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def _dilate(mask: np.ndarray) -> np.ndarray:
    """One step of 8-connected binary dilation; does not wrap past the array edges."""
    padded = np.pad(mask, 1)
    grown = np.zeros_like(mask)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            grown |= padded[1 + dy : 1 + dy + mask.shape[0], 1 + dx : 1 + dx + mask.shape[1]]
    return grown


def _nearest_neighbor_fill(rgb: np.ndarray, known: np.ndarray, need: np.ndarray, max_iters: int = 8) -> np.ndarray:
    """Fills `need` pixels with the average color of their nearest `known` pixel(s),
    growing outward a ring at a time. A `need` pixel with no `known` pixel within
    `max_iters` steps keeps its original color."""
    filled = rgb.copy()
    have = known.copy()
    remaining = need & ~have
    height, width = have.shape
    for _ in range(max_iters):
        if not remaining.any():
            break
        acc = np.zeros((height, width, 3), dtype=np.float32)
        weight = np.zeros((height, width), dtype=np.float32)
        padded_have = np.pad(have, 1)
        padded_colors = np.pad(filled, ((1, 1), (1, 1), (0, 0)))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                shifted_have = padded_have[1 + dy : 1 + dy + height, 1 + dx : 1 + dx + width]
                shifted_colors = padded_colors[1 + dy : 1 + dy + height, 1 + dx : 1 + dx + width]
                contributes = remaining & shifted_have
                acc[contributes] += shifted_colors[contributes]
                weight[contributes] += 1
        gained = remaining & (weight > 0)
        filled[gained] = acc[gained] / weight[gained, None]
        have |= gained
        remaining = need & ~have
    return filled


def restyle_outline_frame(frame: Image.Image, mode: str) -> Image.Image:
    """Softens/removes the outer outline of a single already-composed frame. Alpha
    and silhouette shape are never touched — only the RGB of outline pixels moves
    toward their nearest non-outline neighbor's color."""
    if mode == "off":
        return frame

    rgba = np.array(frame.convert("RGBA"))
    alpha = rgba[..., 3]
    rgb = rgba[..., :3].astype(np.float32)
    opaque = alpha > 0
    if not opaque.any():
        return frame

    near_edge = ~opaque
    for _ in range(OUTLINE_MAX_DEPTH):
        near_edge = _dilate(near_edge)
    near_edge &= opaque

    outline_mask = near_edge & (_luminance(rgb) <= OUTLINE_LUMINANCE_THRESHOLD)
    if not outline_mask.any():
        return frame

    interior_known = opaque & ~outline_mask
    replacement = _nearest_neighbor_fill(rgb, interior_known, outline_mask)

    if mode == "remove":
        new_rgb = np.where(outline_mask[..., None], replacement, rgb)
    elif mode == "attenuate":
        blended = rgb * (1 - OUTLINE_ATTENUATE_STRENGTH) + replacement * OUTLINE_ATTENUATE_STRENGTH
        new_rgb = np.where(outline_mask[..., None], blended, rgb)
    else:
        raise ValueError(f"unknown outline mode: {mode!r}")

    result = np.dstack([new_rgb.round().astype(np.uint8), alpha])
    return Image.fromarray(result, "RGBA")


def apply_outline_style_to_atlas(output_dir: Path, mode: str) -> None:
    """Applies `restyle_outline_frame` to every frame of an already-baked
    texture.png, in place, using its texture.json for frame boundaries. Meant to
    run right after the retro-palette bake."""
    if mode == "off":
        return

    texture_path = output_dir / "texture.png"
    json_path = output_dir / "texture.json"
    atlas = Image.open(texture_path).convert("RGBA")
    with json_path.open(encoding="utf8") as file:
        data = json.load(file)

    for frame_info in data["frames"].values():
        rect = frame_info["frame"]
        box = (rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"])
        restyled = restyle_outline_frame(atlas.crop(box), mode)
        atlas.paste(restyled, box[:2])

    atlas.save(texture_path, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Standalone test of the outline restyle pass on a single baked texture.png."
    )
    parser.add_argument("image", type=Path, help="Path to a texture.png (baked LPC sheet)")
    parser.add_argument("--mode", choices=["attenuate", "remove"], default="attenuate")
    parser.add_argument(
        "--json", type=Path, default=None, help="texture.json for frame boundaries (defaults to texture.json next to the image)"
    )
    parser.add_argument("-o", "--output", type=Path, default=None)
    args = parser.parse_args()

    json_path = args.json or args.image.with_suffix(".json")
    output_path = args.output or args.image.with_name(f"{args.image.stem}_outline_{args.mode}.png")

    atlas = Image.open(args.image).convert("RGBA")
    if json_path.exists():
        with json_path.open(encoding="utf8") as file:
            data = json.load(file)
        for frame_info in data["frames"].values():
            rect = frame_info["frame"]
            box = (rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"])
            restyled = restyle_outline_frame(atlas.crop(box), args.mode)
            atlas.paste(restyled, box[:2])
    else:
        atlas = restyle_outline_frame(atlas, args.mode)

    atlas.save(output_path, "PNG")
    print(f"✓ {output_path}")


if __name__ == "__main__":
    main()
