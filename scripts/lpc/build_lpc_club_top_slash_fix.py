#!/usr/bin/env python3
"""Fix only the final north-facing native club slash pose."""

from pathlib import Path
from PIL import Image

import build_lpc_club_aligned_prototype as aligned
import build_lpc_club_native_slash as native
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v3"
TILE = 192
ROW = 0
FRAME = 5
GRIP_X = 116


def corrected_slash():
    layers = native.native_slash()
    box = (FRAME * TILE, ROW * TILE, (FRAME + 1) * TILE, (ROW + 1) * TILE)
    original = layers[1].crop(box)
    fixed = Image.new("RGBA", (TILE, TILE))
    # The original head swings across the character's head. Reflect the
    # weapon around its hand contact, retaining its exact grip and pixels.
    for y in range(TILE):
        for x in range(TILE):
            pixel = original.getpixel((x, y))
            target_x = 2 * GRIP_X - x
            if pixel[3] and 0 <= target_x < TILE:
                fixed.putpixel((target_x, y), pixel)
    layers[1].paste(fixed, box)
    return layers


def main():
    sheets = {"walk": aligned.build_sheet("walk"),
              "attack_slash": corrected_slash(),
              "hurt": aligned.build_sheet("hurt")}
    for animation, pair in sheets.items():
        folder = OUTPUT / "sources" / animation
        (folder / "behind").mkdir(parents=True, exist_ok=True)
        pair[0].save(folder / "behind/club.png")
        pair[1].save(folder / "club.png")
    preview.OUTPUT = OUTPUT
    preview.preview(sheets)
    preview.animated_preview(sheets)
    page = OUTPUT / "index.html"
    page.write_text(
        page.read_text()
        .replace("Massue de pierre · V0", "Club LPC · V3")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Correction ciblée : slash vue de haut, image 6/6. "
                 "Le reste du slash et la traînée sont les sprites LPC natifs."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Slash natif reverse-oversize ; seule la sixième image vue de haut "
        "est retournée autour de sa prise en main pour dégager la tête.\n")
    print(page)


if __name__ == "__main__":
    main()
