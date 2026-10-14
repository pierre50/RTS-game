#!/usr/bin/env python3
"""Preview the LPC club with its native reverse-oversize slash mapping."""

from pathlib import Path
from PIL import Image

import build_lpc_club_aligned_prototype as aligned
import build_lpc_club_prototype as first
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v2"
TILE = 192
SLASH_FRAMES = 6
SLASH_ROWS = 4


def native_slash():
    """Upstream slash_reverse_oversize maps source columns 5,4,3,2,1,0."""
    sources = first.slash_sheet()
    outputs = [Image.new("RGBA", source.size) for source in sources]
    for row in range(SLASH_ROWS):
        for column in range(SLASH_FRAMES):
            source_column = SLASH_FRAMES - 1 - column
            source_box = (source_column * TILE, row * TILE,
                          (source_column + 1) * TILE, (row + 1) * TILE)
            for output, source in zip(outputs, sources):
                output.paste(source.crop(source_box), (column * TILE, row * TILE))
    return outputs


def main():
    sheets = {"walk": aligned.build_sheet("walk"),
              "attack_slash": native_slash(),
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
        .replace("Massue de pierre · V0", "Club LPC · V2 — slash natif")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Slash et traînée LPC d'origine, synchronisés selon "
                 "slash_reverse_oversize (images 5 à 0). Marche et hurt restent "
                 "des poses dérivées provisoires. Non intégré au jeu."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC original par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Le slash conserve les deux calques et tous les pixels d'origine, "
        "en inversant l'ordre des six frames selon slash_reverse_oversize "
        "du générateur LPC. La marche est alignée sur la mace LPC et le "
        "hurt est provisoire.\n")
    print(page)


if __name__ == "__main__":
    main()
