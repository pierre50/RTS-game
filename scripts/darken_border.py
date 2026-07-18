#!/usr/bin/env python3
"""
darken_border.py — darkens the outermost ring of opaque pixels on a sprite's
silhouette (pixels directly touching transparency), to strengthen the edge
against the terrain.

Processes each frame independently using its texture.json boundaries (like
scripts/lpc/outline_style.py) so silhouettes from neighboring frames in the
same atlas never bleed into each other's border detection.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

DARKEN_FACTOR = 0.60  # keep 60% of the border pixels' brightness (-40%)


def darken_border_frame(frame: Image.Image, factor: float = DARKEN_FACTOR) -> Image.Image:
    rgba = np.array(frame.convert("RGBA"), dtype=np.float32)
    alpha = rgba[..., 3]
    opaque = alpha > 0
    if not opaque.any():
        return frame

    shifted_up = np.roll(opaque, -1, axis=0)
    shifted_up[-1, :] = True
    shifted_down = np.roll(opaque, 1, axis=0)
    shifted_down[0, :] = True
    shifted_left = np.roll(opaque, -1, axis=1)
    shifted_left[:, -1] = True
    shifted_right = np.roll(opaque, 1, axis=1)
    shifted_right[:, 0] = True

    has_transparent_neighbor = (~shifted_up) | (~shifted_down) | (~shifted_left) | (~shifted_right)
    border_mask = opaque & has_transparent_neighbor

    result = rgba.copy()
    for c in range(3):
        channel = result[:, :, c]
        channel[border_mask] = np.clip(channel[border_mask] * factor, 0, 255)
        result[:, :, c] = channel

    return Image.fromarray(result.astype(np.uint8), "RGBA")


def apply_darken_border_to_atlas(output_dir: Path, factor: float = DARKEN_FACTOR) -> int:
    texture_path = output_dir / "texture.png"
    json_path = output_dir / "texture.json"
    atlas = Image.open(texture_path).convert("RGBA")
    with json_path.open(encoding="utf8") as file:
        data = json.load(file)

    for frame_info in data["frames"].values():
        rect = frame_info["frame"]
        box = (rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"])
        darkened = darken_border_frame(atlas.crop(box), factor)
        atlas.paste(darkened, box[:2])

    atlas.save(texture_path, optimize=True)
    return len(data["frames"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Darken the outer border pixels of baked spritesheets, in place.")
    parser.add_argument("dirs", nargs="+", type=Path, help="Baked sheet directories (each with texture.png + texture.json)")
    parser.add_argument("--factor", type=float, default=DARKEN_FACTOR, help="Brightness kept on border pixels (default 0.60)")
    args = parser.parse_args()
    for output_dir in args.dirs:
        frame_count = apply_darken_border_to_atlas(output_dir, args.factor)
        print(f"✓ {output_dir} ({frame_count} frames)")


if __name__ == "__main__":
    main()
