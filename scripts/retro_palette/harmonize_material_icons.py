#!/usr/bin/env python3
"""Harmonize inventory icon materials with the LPC avatar material ramps.

Reads the pre-harmonization sources kept under output/icon-source-backups,
so re-running the script does not accumulate color changes. The normal icon
builder then snaps the results to duel.hex without changing their alpha.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/lpc"))
from config import PALETTES  # noqa: E402

ICONS = ROOT / "assets/icon-sources/icons"
BACKUP = ROOT / "output/icon-source-backups/material-harmonization"
SHEET = ROOT / "output/imagegen/shoulders-bracers-leg-armor-pixel-art-sheet-v11-avatar-palette.png"
BRONZE_SHEET = ROOT / "output/imagegen/shoulders-bracers-leg-armor-pixel-art-sheet-v10-avatar-palette.png"

ARMOR_NAMES = [
    "shoulder_legion", "bracers", "leg_armor",
]
TOOL_NAMES = ["axe", "pickaxe", "hammer", "scythe"]
MELEE_NAMES = ["dagger", "spear", "mace", "sword", "sword_curved"]


def backup_source(path: Path) -> Path:
    original = BACKUP / path.relative_to(ICONS)
    if not original.exists():
        original.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, original)
    return original


def ramp_rgb(material: str) -> np.ndarray:
    return np.array([[int(color[i:i + 2], 16) for i in (1, 3, 5)] for color in PALETTES[material]], dtype=float)


def recolor(path: Path, material: str, region: str) -> None:
    original = backup_source(path)
    image = Image.open(original).convert("RGBA")
    rgba = np.asarray(image).copy()
    rgb = rgba[:, :, :3].astype(float)
    alpha = rgba[:, :, 3]
    h, w = alpha.shape
    yy, xx = np.mgrid[:h, :w]
    x, y = xx / w, yy / h
    brightness = rgb @ np.array([0.2126, 0.7152, 0.0722])
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = (maximum - minimum) / np.maximum(maximum, 1)
    warm = (rgb[:, :, 0] > rgb[:, :, 2] * 1.20) & (rgb[:, :, 0] > rgb[:, :, 1] * 1.08)
    gray = (saturation < 0.34) & (rgb[:, :, 2] > rgb[:, :, 0] * 0.78)

    if region == "tool":
        area = (y < 0.54) & (x > 0.24)
    elif region == "melee":
        area = (y < 0.71) & (x > 0.35)
    elif region == "spear":
        area = (y < 0.45) & (x > 0.57)
    elif region == "arrow":
        area = (y < 0.42) & (x > 0.54)
    elif region == "shield":
        radius = np.sqrt(((x - 0.5) / 0.48) ** 2 + ((y - 0.5) / 0.48) ** 2)
        area = (radius > 0.73) | (radius < 0.29)
    elif region == "ranged_leather":
        # The grip/pouch is leather; wooden bow limbs and slingshot forks stay wood.
        area = (0.31 < x) & (x < 0.73) & (0.26 < y) & (y < 0.79)
    elif region == "all":
        area = np.ones_like(alpha, dtype=bool)
    else:
        raise ValueError(region)

    if material == "iron":
        select = area & gray
    elif material == "bronze":
        # The brighter ochre/orange facets are metal; dark wooden shafts stay put.
        select = area & warm & (brightness > 58) & (rgb[:, :, 1] / np.maximum(rgb[:, :, 0], 1) > 0.55)
        if region == "shield":
            select &= brightness > 105
    else:
        select = area & warm
    select &= (alpha > 0) & (brightness > 24)

    if material == "bronze":
        position = np.clip((brightness - 28) / 235, 0, 1)
    elif material == "iron":
        position = np.clip((brightness - 20) / 245, 0, 1)
    else:
        # Dark LPC leather stops can snap to purple-black in duel.hex at icon
        # scale. The icon's existing outline carries those shadows instead.
        position = np.clip((brightness + 36) / 155, 0.46, 1)
    ramp = ramp_rgb(material)
    p = position * (len(ramp) - 1)
    lo = np.floor(p).astype(int)
    hi = np.minimum(lo + 1, len(ramp) - 1)
    target = ramp[lo] * (1 - (p - lo))[..., None] + ramp[hi] * (p - lo)[..., None]
    rgba[:, :, :3][select] = np.clip(target[select], 0, 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(path)


def replace_armor() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    bronze_sheet = Image.open(BRONZE_SHEET).convert("RGBA")
    row_limits = ((0, 340), (340, 640), (640, sheet.height))
    for row, base in enumerate(ARMOR_NAMES):
        for col, material in enumerate(("leather", "bronze", "iron")):
            path = ICONS / "armor" / f"{base}_{material}.png"
            backup_source(path)
            source_sheet = bronze_sheet if material == "bronze" else sheet
            left = col * source_sheet.width // 3
            top, bottom = row_limits[row]
            right = (col + 1) * source_sheet.width // 3
            cell = source_sheet.crop((left, top, right, bottom))
            bbox = cell.getbbox()
            if bbox is None:
                raise ValueError(f"Missing armor icon: {path}")
            icon = cell.crop(bbox)
            icon.thumbnail((112, 112), Image.Resampling.NEAREST)
            canvas = Image.new("RGBA", (128, 128))
            canvas.alpha_composite(icon, ((128 - icon.width) // 2, (128 - icon.height) // 2))
            canvas.save(path)


def remove_detached_arrow_artifact(path: Path) -> None:
    rgba = np.asarray(Image.open(path).convert("RGBA")).copy()
    components, count = label(rgba[:, :, 3] >= 128, np.ones((3, 3), dtype=int))
    if count <= 1:
        return
    sizes = np.bincount(components.ravel())
    main_component = np.argmax(sizes[1:]) + 1
    rgba[(components != main_component) & (components != 0)] = 0
    Image.fromarray(rgba, "RGBA").save(path)


def main() -> None:
    replace_armor()
    for base in TOOL_NAMES:
        for material in ("bronze", "iron"):
            recolor(ICONS / "tools" / f"{base}_{material}.png", material, "tool")
    for base in MELEE_NAMES:
        for material in ("bronze", "iron"):
            region = "spear" if base == "spear" else "melee"
            recolor(ICONS / "melee-weapons" / f"{base}_{material}.png", material, region)
    for material in ("bronze", "iron"):
        recolor(ICONS / "shields" / f"round_shield_{material}_slash.png", material, "shield")
        recolor(ICONS / "ammunition" / f"arrow_{material}.png", material, "arrow")
        recolor(ICONS / "resources/pixel" / f"{material}Ingot.png", material, "all")
    remove_detached_arrow_artifact(ICONS / "ammunition/arrow_bronze.png")
    recolor(ICONS / "shields/round_shield_wood_slash.png", "leather", "shield")
    recolor(ICONS / "resources/pixel/leather.png", "leather", "all")
    for base in ("bow", "bow_great", "bow_recurve", "slingshot"):
        recolor(ICONS / "ranged-weapons" / f"{base}.png", "leather", "ranged_leather")
    print("Harmonized armor, tools, weapons, shields, ammunition, leather and ingots with LPC material colors.")


if __name__ == "__main__":
    main()
