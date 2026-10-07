#!/usr/bin/env python3
"""Rebuild non-LPC interface icons from original sources using the game's .hex palette."""

import argparse
import re
from pathlib import Path

from PIL import Image, ImageColor

from retro_palette import find_hex_palette, load_hex_palette, snap_to_palette


ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "assets" / "icon-sources"
OUTPUT = ROOT / "public" / "assets"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--palette", type=Path, help="Defaults to the LPC pipeline's .hex palette")
    args = parser.parse_args()
    palette_path = args.palette or find_hex_palette(Path(__file__).parent / "_")
    if palette_path is None:
        parser.error("No .hex palette found")
    palette = load_hex_palette(palette_path)
    sources = sorted(p for p in SOURCES.rglob("*") if p.suffix in {".png", ".svg"})
    if not sources:
        parser.error(f"No icon sources in {SOURCES}")

    def svg_color(match):
        attribute, color = match.groups()
        if color in {"none", "currentColor"}:
            return match.group(0)
        sample = Image.new("RGB", (1, 1), ImageColor.getrgb(color))
        rgb = snap_to_palette(sample, palette).getpixel((0, 0))
        return f'{attribute}="#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"'

    for source in sources:
        destination = OUTPUT / source.relative_to(SOURCES)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix == ".svg":
            destination.write_text(re.sub(r'(fill|stroke)="([^"]+)"', svg_color, source.read_text()))
        else:
            with Image.open(source) as image:
                rgba = image.convert("RGBA")
                result = snap_to_palette(rgba.convert("RGB"), palette)
                # Keep the original alpha exactly; background detection damages tiny icons.
                result.putalpha(rgba.getchannel("A"))
                result.save(destination, "PNG", optimize=True)
    print(f"Built {len(sources)} icons with {palette_path.name}; original transparency preserved.")


if __name__ == "__main__":
    main()
