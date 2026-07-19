#!/usr/bin/env python3
"""
simple_darken_border.py — assombrit les pixels de bordure (qui touchent la transparence)
sur des sprites PNG. Traite tous les .png d'un dossier et ses sous-dossiers, en place.

Usage:
    python3 simple_darken_border.py chemin/vers/dossier/
    python3 simple_darken_border.py chemin/vers/dossier/ --factor 0.5
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

DARKEN_FACTOR = 0.60


def darken_border(img_path: Path, factor: float = DARKEN_FACTOR) -> None:
    img = Image.open(img_path).convert("RGBA")
    rgba = np.array(img, dtype=np.float32)
    alpha = rgba[..., 3]
    opaque = alpha > 0

    if not opaque.any():
        print(f"  skip {img_path} (image vide)")
        return

    shifted_up    = np.roll(opaque, -1, axis=0); shifted_up[-1, :]   = True
    shifted_down  = np.roll(opaque,  1, axis=0); shifted_down[0, :]  = True
    shifted_left  = np.roll(opaque, -1, axis=1); shifted_left[:, -1] = True
    shifted_right = np.roll(opaque,  1, axis=1); shifted_right[:, 0] = True

    border_mask = opaque & ((~shifted_up) | (~shifted_down) | (~shifted_left) | (~shifted_right))

    result = rgba.copy()
    for c in range(3):
        ch = result[:, :, c]
        ch[border_mask] = np.clip(ch[border_mask] * factor, 0, 255)
        result[:, :, c] = ch

    Image.fromarray(result.astype(np.uint8), "RGBA").save(img_path, optimize=True)
    print(f"  ✓ {img_path} ({border_mask.sum()} pixels)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Assombrit les bordures de sprites PNG.")
    parser.add_argument("folder", type=Path, help="Dossier racine (cherche récursivement)")
    parser.add_argument("--factor", type=float, default=DARKEN_FACTOR,
                        help="Luminosité conservée sur la bordure (défaut: 0.60)")
    args = parser.parse_args()

    pngs = sorted(args.folder.rglob("*.png"))
    if not pngs:
        print("Aucun .png trouvé.")
        return

    print(f"{len(pngs)} fichier(s) trouvé(s)\n")
    for png in pngs:
        darken_border(png, args.factor)


if __name__ == "__main__":
    main()