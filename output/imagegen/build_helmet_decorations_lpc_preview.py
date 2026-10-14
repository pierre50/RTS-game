"""Preview all helmet/decor combinations on the game's front-facing LPC hero."""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "imagegen"
sys.path.insert(0, str(ROOT / "scripts" / "retro_palette"))
from retro_palette import load_hex_palette, snap_to_palette  # noqa: E402

PALETTE = load_hex_palette(ROOT / "scripts" / "retro_palette" / "duel.hex")
ASSETS = ROOT / "public" / "assets" / "graphics"
BG = (21, 24, 47, 255)
GRID = (48, 54, 80, 255)
HELMETS = (
    ("Conique", "helmet_pointed"),
    ("Corinthien", "helmet_barbuta"),
    ("Légionnaire", "helmet_legion"),
    ("Nasal", "helmet_nasal"),
    ("Masqué", "helmet_bascinet_round"),
    ("Nasard", "helmet_norman"),
)
DECORATIONS = (
    ("Cimier centurion", "centurion_crest"),
    ("Plumet légion", "legion_plumage"),
    ("Plumet simple", "plumage"),
    ("Ailes", "helmet_wings"),
    ("Grandes cornes", "upward_horns_white"),
    ("Cornes courtes", "horns_short"),
)


def atlas_frame(stem: Path, group: str, index: int = 18) -> Image.Image:
    image = Image.open(stem.with_name("texture.png")).convert("RGBA")
    frames = json.loads(stem.with_name("texture.json").read_text())["frames"]
    if "equipments" in stem.parts:
        keys = sorted(k for k in frames if k.split("_graphics_", 1)[-1] == f"equipments_{group}.png")
    else:
        keys = sorted(k for k in frames if k.endswith("_" + group + ".png"))
    if len(keys) <= index:
        raise ValueError(f"Missing frame {index} of {group} in {stem}")
    rect = frames[keys[index]]["frame"]
    return image.crop((rect["x"], rect["y"], rect["x"] + 64, rect["y"] + 64))


def short_horn_frame(layer: str) -> Image.Image:
    source = Image.open(OUT / "lpc-references" / f"horns-short-{layer}-walk.png").convert("RGBA")
    frame = source.crop((0, 128, 64, 192))
    snapped = snap_to_palette(frame.convert("RGB"), PALETTE)
    snapped.putalpha(frame.getchannel("A"))
    return snapped


def whiten_lpc_plume(frame: Image.Image) -> Image.Image:
    """Preview the planned fixed ivory color without changing the LPC files."""
    rgba = np.array(frame.convert("RGBA"))
    rgb = rgba[:, :, :3].astype("float32")
    light = rgb[:, :, 0] * .2126 + rgb[:, :, 1] * .7152 + rgb[:, :, 2] * .0722
    white = np.interp(light, [0, 25, 55, 85, 120, 170, 255], [10, 28, 110, 185, 238, 252, 255])
    rgba[:, :, 0] = white
    rgba[:, :, 1] = white * .97
    rgba[:, :, 2] = white * .91
    result = Image.fromarray(rgba, "RGBA")
    snapped = snap_to_palette(result.convert("RGB"), PALETTE)
    snapped.putalpha(result.getchannel("A"))
    return snapped


def accessory_frame(name: str, layer: str, white_plumes: bool) -> Image.Image | None:
    if name == "horns_short":
        return short_horn_frame("bg" if layer == "back" else "fg")
    if name in {"helmet_wings", "upward_horns_white"}:
        stem = ASSETS / "equipments" / "accessory" / ("helmet_wings" if name == "helmet_wings" else "upward_horns") / "texture.png"
        return atlas_frame(stem, f"{name}_{layer}_walking")
    if layer == "back":
        return None
    stem = ASSETS / "equipments" / "accessory" / "plumage" / "texture.png"
    frame = atlas_frame(stem, f"{name}_front_walking")
    return whiten_lpc_plume(frame) if white_plumes else frame


hero = atlas_frame(ASSETS / "units" / "hero" / "hellas" / "male" / "texture.png", "body_walking")
helmet_frames = {
    model: atlas_frame(ASSETS / "equipments" / "helmet" / model / "texture.png", f"{model}_bronze_front_walking")
    for _, model in HELMETS
}


def composite(model: str, decoration: str, white_plumes: bool) -> Image.Image:
    sprite = Image.new("RGBA", (64, 64))
    back = accessory_frame(decoration, "back", white_plumes)
    if back:
        sprite.alpha_composite(back)
    sprite.alpha_composite(hero)
    sprite.alpha_composite(helmet_frames[model])
    front = accessory_frame(decoration, "front", white_plumes)
    if front:
        sprite.alpha_composite(front)
    return sprite


def composite_icon_layers(model: str, decoration: str, white_plumes: bool) -> Image.Image:
    """Only the LPC equipment layers, with no character behind them."""
    sprite = Image.new("RGBA", (64, 64))
    back = accessory_frame(decoration, "back", white_plumes)
    if back:
        sprite.alpha_composite(back)
    front = accessory_frame(decoration, "front", white_plumes)
    # The centurion horsehair crest belongs behind the helmet rim in the icon.
    if decoration == "centurion_crest" and front:
        sprite.alpha_composite(front)
    sprite.alpha_composite(helmet_frames[model])
    if decoration != "centurion_crest" and front:
        sprite.alpha_composite(front)
    return sprite


CELL_W, CELL_H, LEFT, TOP, SCALE = 220, 235, 150, 42, 3
font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
font = ImageFont.truetype(font_path, 13) if Path(font_path).exists() else ImageFont.load_default()


def build_board(white_plumes: bool) -> Image.Image:
    board = Image.new("RGBA", (LEFT + CELL_W * 6, TOP + CELL_H * 6), BG)
    draw = ImageDraw.Draw(board)
    for col, (label, _) in enumerate(HELMETS):
        x = LEFT + col * CELL_W
        draw.text((x + CELL_W // 2, 18), label, font=font, fill="white", anchor="mm")
    for row, (label, _) in enumerate(DECORATIONS):
        y = TOP + row * CELL_H
        draw.text((8, y + CELL_H // 2), label, font=font, fill="white", anchor="lm")
        for col, (_, model) in enumerate(HELMETS):
            x = LEFT + col * CELL_W
            draw.rectangle((x, y, x + CELL_W, y + CELL_H), outline=GRID, width=1)
            sprite = composite(model, DECORATIONS[row][1], white_plumes)
            scaled = sprite.resize((64 * SCALE, 64 * SCALE), Image.Resampling.NEAREST)
            board.alpha_composite(scaled, (x + (CELL_W - 64 * SCALE) // 2, y + 20))
    return board


for white_plumes, filename in (
    (False, "helmet-decorations-lpc-avatars-current-6x6.png"),
    (True, "helmet-decorations-lpc-avatars-white-preview-6x6.png"),
):
    destination = OUT / filename
    build_board(white_plumes).convert("RGB").save(destination)
    print(destination)


def build_icon_board() -> Image.Image:
    cell_w, cell_h, left, top, scale = 210, 205, 150, 42, 4
    board = Image.new("RGBA", (left + cell_w * 6, top + cell_h * 6), BG)
    draw = ImageDraw.Draw(board)
    for col, (label, _) in enumerate(HELMETS):
        x = left + col * cell_w
        draw.text((x + cell_w // 2, 18), label, font=font, fill="white", anchor="mm")
    for row, (label, decoration) in enumerate(DECORATIONS):
        y = top + row * cell_h
        draw.text((8, y + cell_h // 2), label, font=font, fill="white", anchor="lm")
        for col, (_, model) in enumerate(HELMETS):
            x = left + col * cell_w
            draw.rectangle((x, y, x + cell_w, y + cell_h), outline=GRID, width=1)
            sprite = composite_icon_layers(model, decoration, white_plumes=True)
            crop = sprite.crop((8, 0, 56, 42))
            scaled = crop.resize((48 * scale, 42 * scale), Image.Resampling.NEAREST)
            board.alpha_composite(scaled, (x + (cell_w - scaled.width) // 2, y + 18))
    return board


destination = OUT / "helmet-decorations-lpc-layers-only-6x6.png"
build_icon_board().convert("RGB").save(destination)
print(destination)
