#!/usr/bin/env python3
"""Play the club slash in its visual strike order, not the reversed preview order."""

from pathlib import Path

from PIL import Image

import build_lpc_club_left_walk_high_fix as previous
import build_lpc_club_top_slash_fix as slash_fix
import build_lpc_club_hurt_finish_fix as hurt_fix
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v10"
TILE = 192
FRAMES = 6
ROWS = 4


def corrected_slash_order():
    reversed_layers = slash_fix.corrected_slash()
    ordered_layers = []
    for source in reversed_layers:
        ordered = Image.new("RGBA", source.size)
        for row in range(ROWS):
            for frame in range(FRAMES):
                source_frame = FRAMES - 1 - frame
                box = (source_frame * TILE, row * TILE,
                       (source_frame + 1) * TILE, (row + 1) * TILE)
                ordered.paste(source.crop(box), (frame * TILE, row * TILE))
        ordered_layers.append(ordered)
    return ordered_layers


def main():
    sheets = {
        "walk": previous.corrected_walk(),
        "attack_slash": corrected_slash_order(),
        "hurt": hurt_fix.corrected_hurt(),
    }
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
        .replace("Massue de pierre · V0", "Club LPC · V10")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Slash : massue et traînée remises dans le sens du coup "
                 "(arme levée vers repos). Marche et hurt inchangés depuis V9."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Slash du club remis dans l'ordre visuel du coup ; correction "
        "de la pose vue de haut conservée. Marche et hurt dérivés.\n")
    print(page)


if __name__ == "__main__":
    main()
