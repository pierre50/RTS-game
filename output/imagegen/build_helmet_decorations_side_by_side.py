"""Compare the game's front-facing LPC helmet overlays with inventory icons."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/imagegen"
GRAPHICS = ROOT / "public/assets/graphics"
ICONS = ROOT / "public/assets/icons"
BACKGROUND = (21, 24, 47, 255)
GRID = (55, 62, 91, 255)
WHITE = (244, 239, 224, 255)
MUTED = (169, 177, 202, 255)
CELL_W = 288
CELL_H = 168
LABEL_W = 205
HEADER_H = 58
VIEW_SIZE = 128

DECORATIONS = (
    ("Cimier centurion", "centurion_crest"),
    ("Plumet légion", "legion_plumage"),
    ("Plumet simple", "plumage"),
    ("Ailes", "helmet_wings"),
    ("Grandes cornes", "upward_horns_white"),
    ("Cornes courtes", "horns_short"),
)
HELMETS = (
    ("Conique · cuir", "helmet_pointed_leather"),
    ("Barbare · cuir", "helmet_barbarian_leather"),
    ("Barbare nasal · cuir", "helmet_barbarian_nasal_leather"),
    ("Conique · bronze", "helmet_pointed_bronze"),
    ("Corinthien · bronze", "helmet_barbuta_bronze"),
    ("Légionnaire · bronze", "helmet_legion_bronze"),
    ("Nasal · bronze", "helmet_nasal_bronze"),
    ("Masqué · bronze", "helmet_bascinet_round_bronze"),
    ("Nasard · bronze", "helmet_norman_bronze"),
    ("Conique · fer", "helmet_pointed_iron"),
    ("Corinthien · fer", "helmet_barbuta_iron"),
    ("Légionnaire · fer", "helmet_legion_iron"),
    ("Nasal · fer", "helmet_nasal_iron"),
    ("Masqué · fer", "helmet_bascinet_round_iron"),
    ("Nasard · fer", "helmet_norman_iron"),
)
PAIR_INSET = {"helmet_wings": 10, "upward_horns_white": 14, "horns_short": 6}
BEHIND_ICON = {"centurion_crest", "upward_horns_white", "horns_short"}
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT = ImageFont.truetype(FONT_PATH, 16) if FONT_PATH.exists() else ImageFont.load_default()
SMALL_FONT = ImageFont.truetype(FONT_PATH, 12) if FONT_PATH.exists() else ImageFont.load_default()


@lru_cache(maxsize=None)
def atlas(stem: Path) -> tuple[Image.Image, dict]:
    return Image.open(stem / "texture.png").convert("RGBA"), json.loads(
        (stem / "texture.json").read_text()
    )["frames"]


def atlas_frame(stem: Path, group: str) -> Image.Image:
    image, frames = atlas(stem)
    if "equipments" in stem.parts:
        names = sorted(
            name for name in frames
            if name.split("_graphics_", 1)[-1] == f"equipments_{group}.png"
        )
    else:
        names = sorted(name for name in frames if name.endswith(f"_{group}.png"))
    if len(names) <= 18:
        raise ValueError(f"Missing front walking frame for {group} in {stem}")
    frame = frames[names[18]]["frame"]
    return image.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))


def helmet_family(helmet: str) -> str:
    return helmet.rsplit("_", 1)[0]


def lpc_accessory(decor: str, layer: str) -> Image.Image | None:
    if decor in {"helmet_wings", "upward_horns_white", "horns_short"}:
        family = {
            "helmet_wings": "helmet_wings",
            "upward_horns_white": "upward_horns",
            "horns_short": "horns_short",
        }[decor]
        return atlas_frame(GRAPHICS / "equipments/accessory" / family, f"{decor}_{layer}_walking")
    if layer == "back":
        return None
    return atlas_frame(GRAPHICS / "equipments/accessory/plumage", f"{decor}_front_walking")


HERO = atlas_frame(GRAPHICS / "units/hero/hellas/male", "body_walking")


def lpc_view(helmet: str, decor: str) -> Image.Image:
    sprite = Image.new("RGBA", (64, 64))
    back = lpc_accessory(decor, "back")
    if back:
        sprite.alpha_composite(back)
    sprite.alpha_composite(HERO)
    family = helmet_family(helmet)
    sprite.alpha_composite(
        atlas_frame(GRAPHICS / "equipments/helmet" / family, f"{helmet}_front_walking")
    )
    front = lpc_accessory(decor, "front")
    if front:
        sprite.alpha_composite(front)
    return sprite.crop((8, 0, 56, 48)).resize((VIEW_SIZE, VIEW_SIZE), Image.Resampling.NEAREST)


def inventory_icon(helmet: str, decor: str) -> Image.Image:
    helmet_image = Image.open(ICONS / "armor" / f"{helmet}.png").convert("RGBA")
    ornament = Image.open(ICONS / "helmet-decorations" / f"{decor}.png").convert("RGBA")
    if decor in PAIR_INSET:
        inset = PAIR_INSET[decor]
        offset_y = 4 if decor == "horns_short" else 0
        paired = Image.new("RGBA", (128, 128))
        paired.alpha_composite(ornament.crop((0, 0, 64, 128)), (inset, offset_y))
        paired.alpha_composite(ornament.crop((64, 0, 128, 128)), (64 - inset, offset_y))
        ornament = paired
    result = Image.new("RGBA", (128, 128))
    if decor in BEHIND_ICON:
        result.alpha_composite(ornament)
    result.alpha_composite(helmet_image.resize((82, 82), Image.Resampling.NEAREST), (23, 41))
    if decor not in BEHIND_ICON:
        result.alpha_composite(ornament)
    return result


def build_board(helmets: tuple[tuple[str, str], ...], title: str) -> Image.Image:
    board = Image.new("RGBA", (LABEL_W + CELL_W * len(DECORATIONS), HEADER_H + CELL_H * len(helmets)), BACKGROUND)
    draw = ImageDraw.Draw(board)
    draw.text((14, 15), title, font=FONT, fill=WHITE)
    draw.text((14, 36), "LPC à gauche · icône à droite", font=SMALL_FONT, fill=MUTED)
    for col, (label, _) in enumerate(DECORATIONS):
        x = LABEL_W + col * CELL_W
        draw.text((x + CELL_W // 2, 31), label, font=FONT, fill=WHITE, anchor="mm")
    for row, (label, helmet) in enumerate(helmets):
        y = HEADER_H + row * CELL_H
        draw.text((14, y + CELL_H // 2), label, font=FONT, fill=WHITE, anchor="lm")
        for col, (_, decor) in enumerate(DECORATIONS):
            x = LABEL_W + col * CELL_W
            draw.rectangle((x, y, x + CELL_W - 1, y + CELL_H - 1), outline=GRID)
            board.alpha_composite(lpc_view(helmet, decor), (x + 8, y + 24))
            board.alpha_composite(inventory_icon(helmet, decor), (x + 152, y + 24))
            draw.text((x + 72, y + 13), "LPC", font=SMALL_FONT, fill=MUTED, anchor="mm")
            draw.text((x + 216, y + 13), "ICÔNE", font=SMALL_FONT, fill=MUTED, anchor="mm")
    return board.convert("RGB")


def main() -> None:
    sheets = (
        ("cuir", HELMETS[:3]),
        ("bronze", HELMETS[3:9]),
        ("fer", HELMETS[9:]),
    )
    for material, helmets in sheets:
        destination = OUT / f"helmet-decorations-lpc-icon-{material}.png"
        build_board(helmets, f"Casques {material} — LPC / icône").save(destination, optimize=True)
        print(destination)
    destination = OUT / "helmet-decorations-lpc-icon-all-15x6.png"
    build_board(HELMETS, "Toutes les décorations sur tous les casques — LPC / icône").save(destination, optimize=True)
    print(destination)


if __name__ == "__main__":
    main()
