"""Project the supplied tile patterns onto the existing wall atlas (requires Pillow)."""

import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ATLAS = ROOT / "public/assets/terrain/interior-walls"
SOURCES = Path(__file__).resolve().parent / "assets/interior-walls"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", choices=["wood", "dirt"])
    args = parser.parse_args()
    # Keep frame coordinates owned by the map generator.
    subprocess.run(
        ["node", "-e", "require('./tools/maps/interior-walls.cjs').writeInteriorWallAtlas()"],
        cwd=ROOT,
        check=True,
    )
    layout = json.loads((ATLAS / "texture.json").read_text())
    mask = Image.open(ATLAS / "texture.png").convert("RGBA")
    for variant, filename in [("wood", "Wooden_Floor_Horizontal.png"), ("dirt", "Dirt_Road.png")]:
        if args.variant and variant != args.variant:
            continue
        tile = Image.open(SOURCES / filename).convert("RGB")
        result = Image.new("RGBA", mask.size)
        for entry in layout["frames"].values():
            frame = entry["frame"]
            left, top, width, height = (frame[key] for key in ("x", "y", "w", "h"))
            for x in range(left, left + width):
                column = [y for y in range(top, top + height) if mask.getpixel((x, y))[3]]
                if not column:
                    continue
                # Shear without filtering: horizontal plank joints follow each face.
                for y in column:
                    color = tile.getpixel(((x - left) % tile.width, (y - column[0]) % tile.height))
                    result.putpixel((x, y), (*color, mask.getpixel((x, y))[3]))
        assert result.getchannel("A").tobytes() == mask.getchannel("A").tobytes()
        variant_layout = json.loads((ATLAS / variant / "texture.json").read_text())
        size = variant_layout["meta"]["size"]
        atlas = Image.new("RGBA", (size["w"], size["h"]))
        atlas.paste(result, (0, 0))
        entries = list(variant_layout["frames"].values())
        for index, entry in enumerate(entries[:5]):
            source = entry["frame"]
            target = entries[index + 5]["frame"]
            for x in range(target["w"]):
                source_x = source["x"] + round(x * (source["w"] - 1) / (target["w"] - 1))
                column = [y for y in range(source["y"], source["y"] + source["h"])
                          if result.getpixel((source_x, y))[3]]
                if not column:
                    continue
                # Preserve an inclusive bottom pixel and rasterize the slope on
                # the native 33px grid, avoiding fractional scaling or masks.
                rise = [x // 2, 0, 32 - x, 16 - x // 2, 0][index]
                for offset in range(25):
                    atlas.putpixel((target["x"] + x, target["y"] + rise + offset),
                                   result.getpixel((source_x, column[-1] - 24 + offset)))
        atlas.save(ATLAS / variant / "texture.png")
        print(f"Built interior-walls/{variant}/texture.png")


if __name__ == "__main__":
    main()
