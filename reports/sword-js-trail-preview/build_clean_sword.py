"""Create a local test sheet with the LPC arming sword's baked slash removed.

The source hilt/edge pixels remain. This is a conservative visual prototype,
not a replacement for the game's equipment atlas.
"""

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "scripts/lpc/spritesheets/weapon/sword/arming/attack_slash"
PACKED = ROOT / "public/assets/graphics/equipments/weapon/sword"
OUTPUT = Path(__file__).resolve().parent
SIZE = 128
DARK = {(97, 72, 44), (131, 99, 50), (46, 37, 51)}
# The game packs the source directions in this order.
SOURCE_ROW = (0, 1, 2)


def clean_mask(source: Image.Image, frame: int, row: int) -> Image.Image:
    tile = source.crop((frame * SIZE, row * SIZE, (frame + 1) * SIZE, (row + 1) * SIZE))
    mask = Image.new("L", (SIZE, SIZE))
    if frame < 3:
        return tile.getchannel("A")
    dark = [(x, y) for y in range(SIZE) for x in range(SIZE)
            if (pixel := tile.getpixel((x, y)))[3] and pixel[:3] in DARK]
    for y in range(SIZE):
        for x in range(SIZE):
            if not tile.getpixel((x, y))[3]:
                continue
            if min(((x - px) ** 2 + (y - py) ** 2 for px, py in dark), default=999) <= 12:
                mask.putpixel((x, y), 255)
    return mask


def main() -> None:
    atlas = Image.open(PACKED / "texture.png").convert("RGBA")
    frames = json.loads((PACKED / "texture.json").read_text())["frames"]
    for side, source_side in (("front", "fg"), ("back", "bg")):
        source = Image.open(SOURCE / source_side / "brass.png").convert("RGBA")
        clean = Image.new("RGBA", (6 * SIZE, 3 * SIZE))
        for direction, row in enumerate(SOURCE_ROW):
            for frame in range(6):
                key = f"{direction * 6 + frame:03d}_graphics_equipments_sword_iron_{side}_action.png"
                box = frames[key]["frame"]
                tile = atlas.crop((box["x"], box["y"], box["x"] + SIZE, box["y"] + SIZE))
                tile.putalpha(clean_mask(source, frame, row))
                clean.paste(tile, (frame * SIZE, direction * SIZE))
        clean.save(OUTPUT / f"sword-iron-{side}-clean.png")


if __name__ == "__main__":
    main()
