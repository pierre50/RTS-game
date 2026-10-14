#!/usr/bin/env python3
"""Fix the last hurt frame while preserving the native club slash."""

from pathlib import Path
from PIL import Image

import build_lpc_club_aligned_prototype as aligned
import build_lpc_club_prototype as first
import build_lpc_club_top_slash_fix as previous
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v4"
TILE = 192
LAST = 5


def corrected_hurt():
    layers = aligned.build_sheet("hurt")
    box = (LAST * TILE, 0, (LAST + 1) * TILE, TILE)
    for layer in layers:
        layer.paste(Image.new("RGBA", (TILE, TILE)), box)
    # In the final prone frame the visible hand is beside the head, not
    # one of the two raised-looking shapes at the other end of the body.
    pose = aligned.club_pose(first.template(), (111, 116), (-0.8, 0.6))
    layers[1].alpha_composite(pose, (LAST * TILE, 0))
    return layers


def main():
    sheets = {"walk": aligned.build_sheet("walk"),
              "attack_slash": previous.corrected_slash(),
              "hurt": corrected_hurt()}
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
        .replace("Massue de pierre · V0", "Club LPC · V4")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Hurt 6/6 corrigé sur la main au sol ; slash natif et "
                 "correction vue de haut conservés. Non intégré au jeu."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Slash natif reverse-oversize ; image 6/6 vue de haut et hurt "
        "6/6 retouchées autour de la prise en main.\n")
    print(page)


if __name__ == "__main__":
    main()
