#!/usr/bin/env python3
"""
simple_darken_border.py — assombrit les pixels de bordure (qui touchent la transparence)
sur des sprites PNG. Traite tous les .png d'un dossier et ses sous-dossiers, en place.

Usage:
    python3 simple_darken_border.py chemin/vers/dossier/
    python3 simple_darken_border.py chemin/vers/dossier/ --factor 0.5
    python3 simple_darken_border.py public/assets/border/dirt-relief --relief-exterior --flip-exterior --factor 0.45
"""

import argparse
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

DARKEN_FACTOR = 0.60
RELIEF_DIRECTIONS = ("west", "north", "south", "east")
OPPOSITE_DIRECTION = {
    "west": "east",
    "east": "west",
    "north": "south",
    "south": "north",
}


def frame_index(name: str) -> int:
    match = re.match(r"(\d+)", name)
    if not match:
        raise ValueError(f"Impossible de lire l'index de frame depuis {name!r}")
    return int(match.group(1))


def shifted_masks(opaque: np.ndarray) -> dict[str, np.ndarray]:
    up = np.ones_like(opaque, dtype=bool)
    up[1:, :] = opaque[:-1, :]
    down = np.ones_like(opaque, dtype=bool)
    down[:-1, :] = opaque[1:, :]
    left = np.ones_like(opaque, dtype=bool)
    left[:, 1:] = opaque[:, :-1]
    right = np.ones_like(opaque, dtype=bool)
    right[:, :-1] = opaque[:, 1:]
    return {"up": up, "down": down, "left": left, "right": right}


def border_mask(rgba: np.ndarray, direction: str | None = None) -> np.ndarray:
    alpha = rgba[..., 3]
    opaque = alpha > 0

    if not opaque.any():
        return opaque

    neighbors = shifted_masks(opaque)
    transparent = {key: ~value for key, value in neighbors.items()}

    if direction == "west":
        return opaque & (transparent["up"] | transparent["left"])
    if direction == "north":
        return opaque & (transparent["up"] | transparent["right"])
    if direction == "south":
        return opaque & (transparent["down"] | transparent["left"])
    if direction == "east":
        return opaque & (transparent["down"] | transparent["right"])

    return opaque & (transparent["up"] | transparent["down"] | transparent["left"] | transparent["right"])


def darken_frame(
    frame: Image.Image,
    factor: float = DARKEN_FACTOR,
    direction: str | None = None,
    clear_other_edges: bool = False,
) -> tuple[Image.Image, int]:
    rgba = np.array(frame.convert("RGBA"), dtype=np.float32)
    target_mask = border_mask(rgba, direction)

    result = rgba.copy()
    for c in range(3):
        ch = result[:, :, c]
        ch[target_mask] = np.clip(ch[target_mask] * factor, 0, 255)
        result[:, :, c] = ch

    return Image.fromarray(result.astype(np.uint8), "RGBA"), int(target_mask.sum())


def darken_border(img_path: Path, factor: float = DARKEN_FACTOR) -> None:
    img = Image.open(img_path).convert("RGBA")
    result, changed = darken_frame(img, factor)
    if changed == 0:
        print(f"  skip {img_path} (image vide)")
        return

    result.save(img_path, optimize=True)
    print(f"  ✓ {img_path} ({changed} pixels)")


def darken_relief_exterior(atlas_dir: Path, factor: float = DARKEN_FACTOR, flip: bool = False) -> None:
    texture_path = atlas_dir / "texture.png" if atlas_dir.is_dir() else atlas_dir
    json_path = texture_path.with_suffix(".json")
    atlas = Image.open(texture_path).convert("RGBA")
    with json_path.open(encoding="utf8") as file:
        metadata = json.load(file)

    total_darkened = 0
    for name, frame_info in metadata["frames"].items():
        index = frame_index(name)
        direction = RELIEF_DIRECTIONS[index % len(RELIEF_DIRECTIONS)]
        if flip:
            direction = OPPOSITE_DIRECTION[direction]

        frame = frame_info["frame"]
        box = (frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"])
        result, darkened = darken_frame(atlas.crop(box), factor, direction)
        atlas.paste(result, box[:2])
        total_darkened += darkened

    atlas.save(texture_path, optimize=True)
    print(f"  ✓ {texture_path} ({total_darkened} pixels exterieurs assombris)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Assombrit les bordures de sprites PNG.")
    parser.add_argument("folder", type=Path, help="Dossier racine (cherche récursivement)")
    parser.add_argument("--factor", type=float, default=DARKEN_FACTOR,
                        help="Luminosité conservée sur la bordure (défaut: 0.60)")
    parser.add_argument("--relief-exterior", action="store_true",
                        help="Traite un atlas border/*-relief frame par frame et garde un seul cote du contour")
    parser.add_argument("--flip-exterior", action="store_true",
                        help="Inverse le cote garde pour les frames relief")
    args = parser.parse_args()

    if args.relief_exterior:
        darken_relief_exterior(args.folder, args.factor, args.flip_exterior)
        return

    pngs = sorted(args.folder.rglob("*.png"))
    if not pngs:
        print("Aucun .png trouvé.")
        return

    print(f"{len(pngs)} fichier(s) trouvé(s)\n")
    for png in pngs:
        darken_border(png, args.factor)


if __name__ == "__main__":
    main()
