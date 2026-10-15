"""Turn the game's isometric grass tiles into a repeating ground texture."""

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
ATLAS = ROOT / "public/assets/terrain/grass/texture.png"
FRAMES = ROOT / "public/assets/terrain/grass/texture.json"
OUTPUT = Path(__file__).with_name("grass-ground.png")
TILE_SIZE = 64
PATTERN = (
    (0, 1, 2, 3),
    (4, 2, 0, 1),
    (1, 3, 4, 0),
    (2, 0, 1, 4),
)


def main() -> None:
    atlas = Image.open(ATLAS).convert("RGBA")
    frames = json.loads(FRAMES.read_text())["frames"]
    ground = Image.new("RGBA", (TILE_SIZE * 4, TILE_SIZE * 4))

    for row, frame_row in enumerate(PATTERN):
        for col, index in enumerate(frame_row):
            frame = frames[f"{index:03d}_terrain_grass.png"]["frame"]
            left, top = frame["x"], frame["y"]
            for y in range(TILE_SIZE):
                v = (y + 0.5) / TILE_SIZE
                for x in range(TILE_SIZE):
                    u = (x + 0.5) / TILE_SIZE
                    # Undo the diamond projection of the original 65x33 sprite.
                    sx = round(left + 32 + (u - v) * 32)
                    sy = round(top + (u + v) * 16)
                    pixel = atlas.getpixel((sx, sy))
                    if pixel[3] == 0:
                        # The atlas has transparent pixels just outside each diamond.
                        sx = round(left + 32 + (u - v) * 30)
                        sy = round(top + 16 + (u + v - 1) * 15)
                        pixel = atlas.getpixel((sx, sy))
                    ground.putpixel((col * TILE_SIZE + x, row * TILE_SIZE + y), pixel)

    ground.convert("RGB").save(OUTPUT)


if __name__ == "__main__":
    main()
