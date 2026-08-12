from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BORDER_ROOT = ROOT / "public/assets/border/water-borders"
SOURCE_DIR = BORDER_ROOT / "desert"
WATER_DIR = BORDER_ROOT / "desert-water"
WATER_FILTER_MASK_DIR = BORDER_ROOT / "desert-water-filter-mask"
SAND_DIR = BORDER_ROOT / "desert-sand"


def is_water_pixel(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a > 0 and b >= 120 and b > r + 28 and b > g + 24


def is_filter_mask_pixel(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return is_water_pixel(pixel) and not (r > 80 and g > 150 and b > 190)


def generate_split_atlases() -> None:
    source_json_path = SOURCE_DIR / "texture.json"
    source_png_path = SOURCE_DIR / "texture.png"
    data = json.loads(source_json_path.read_text())
    source = Image.open(source_png_path).convert("RGBA")

    water_atlas = Image.new("RGBA", source.size, (255, 255, 255, 0))
    filter_mask_atlas = Image.new("RGBA", source.size, (255, 255, 255, 0))
    sand_atlas = Image.new("RGBA", source.size, (255, 255, 255, 0))
    water_pixels = water_atlas.load()
    filter_mask_pixels = filter_mask_atlas.load()
    sand_pixels = sand_atlas.load()
    source_pixels = source.load()

    for y in range(source.height):
        for x in range(source.width):
            pixel = source_pixels[x, y]
            if pixel[3] <= 0:
                continue
            if is_water_pixel(pixel):
                water_pixels[x, y] = pixel
                if is_filter_mask_pixel(pixel):
                    filter_mask_pixels[x, y] = (255, 255, 255, pixel[3])
            else:
                sand_pixels[x, y] = pixel

    for output_dir, atlas in ((WATER_DIR, water_atlas), (WATER_FILTER_MASK_DIR, filter_mask_atlas), (SAND_DIR, sand_atlas)):
        output_dir.mkdir(parents=True, exist_ok=True)
        atlas.save(output_dir / "texture.png")
        (output_dir / "texture.json").write_text(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    generate_split_atlases()
