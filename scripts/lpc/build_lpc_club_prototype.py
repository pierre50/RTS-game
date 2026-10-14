#!/usr/bin/env python3
"""Preview the original LPC club slash plus provisional walk/hurt poses."""

from pathlib import Path
from PIL import Image

import build_stone_club_prototype as preview
import build_stone_club_sword_prototype as sword

ROOT = Path(__file__).resolve().parents[2]
CLUB = ROOT / "scripts/lpc/spritesheets/weapon/blunt/club"
OUTPUT = ROOT / "reports/lpc-club-v0"
TILE = 192


def template():
    # The clean, upright front-facing original club (slash, frame 0).
    source = Image.open(CLUB / "club.png").convert("RGBA")
    return source.crop((0, 2 * TILE, TILE, 3 * TILE))


def posed_club(source, grip, direction):
    """Rotate and scale the original club pixels around the handle end."""
    output = Image.new("RGBA", (TILE, TILE))
    ux, uy = direction
    nx, ny = -uy, ux
    scale = 0.72
    gx, gy = grip
    for y in range(max(0, gy - 38), min(TILE, gy + 39)):
        for x in range(max(0, gx - 38), min(TILE, gx + 39)):
            dx, dy = x - gx, y - gy
            along = (dx * ux + dy * uy) / scale
            across = (dx * nx + dy * ny) / scale
            sx, sy = round(123 + across), round(104 - along)
            if 0 <= sx < TILE and 0 <= sy < TILE:
                output.putpixel((x, y), source.getpixel((sx, sy)))
    return output


def generated_sheet(animation):
    size, rows, columns, back_path, front_path = sword.SOURCES[animation]
    guides = [Image.open(sword.SWORD / path).convert("RGBA")
              for path in (back_path, front_path)]
    result = [Image.new("RGBA", (columns * TILE, rows * TILE)) for _ in guides]
    club = template()
    for row in range(rows):
        for column in range(columns):
            guide = sword.source_pair(guides, size, row, column)
            shape = sword.geometry(guide, animation, row, column)
            if shape is None:
                continue
            grip, direction = shape
            pose = posed_club(club, grip, direction)
            owner = 0 if guide[0].getbbox() and not guide[1].getbbox() else 1
            result[owner].paste(pose, (column * TILE, row * TILE))
    return result


def slash_sheet():
    return [Image.open(CLUB / "background/club.png").convert("RGBA"),
            Image.open(CLUB / "club.png").convert("RGBA")]


def main():
    sheets = {"walk": generated_sheet("walk"),
              "attack_slash": slash_sheet(),
              "hurt": generated_sheet("hurt")}
    for animation, pair in sheets.items():
        directory = OUTPUT / "sources" / animation
        (directory / "behind").mkdir(parents=True, exist_ok=True)
        pair[0].save(directory / "behind/club.png")
        pair[1].save(directory / "club.png")
    preview.OUTPUT = OUTPUT
    preview.preview(sheets)
    preview.animated_preview(sheets)
    index = OUTPUT / "index.html"
    index.write_text(index.read_text().replace("Massue de pierre · V0",
                                               "Club LPC · V0"))
    (OUTPUT / "CREDITS.md").write_text(
        "Club original de bluecarrot16, [LPC] More Weapons, "
        "https://opengameart.org/content/lpc-more-weapons ; "
        "licences OGA-BY 3.0+, GPL 3.0 et CC-BY 4.0. "
        "Sprites source du générateur LPC, commit "
        "58ce1aa479e4df32845a73a5d0afc221c3a893c2. "
        "Le slash est intact ; marche et hurt sont des poses provisoires "
        "dérivées du club original.\n")
    print(index)


if __name__ == "__main__":
    main()
