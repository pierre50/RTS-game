#!/usr/bin/env python3
"""Reverse the complete slash playback while keeping body and club in sync."""

from pathlib import Path

import build_lpc_club_left_walk_high_fix as previous
import build_lpc_club_top_slash_fix as slash_fix
import build_lpc_club_hurt_finish_fix as hurt_fix
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v11"


def main():
    sheets = {
        "walk": previous.corrected_walk(),
        "attack_slash": slash_fix.corrected_slash(),
        "hurt": hurt_fix.corrected_hurt(),
    }
    for animation, pair in sheets.items():
        folder = OUTPUT / "sources" / animation
        (folder / "behind").mkdir(parents=True, exist_ok=True)
        pair[0].save(folder / "behind/club.png")
        pair[1].save(folder / "club.png")
    preview.OUTPUT = OUTPUT
    preview.preview(sheets)
    # Reverse the composite frames, not just the weapon: the hand, club and
    # swing trail must all advance through matching poses.
    preview.animated_preview(sheets, frame_orders={"slash": (5, 4, 3, 2, 1, 0)})
    page = OUTPUT / "index.html"
    page.write_text(
        page.read_text()
        .replace("Massue de pierre · V0", "Club LPC · V11")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Slash lu de 6 vers 1, personnage, massue et traînée ensemble. "
                 "Marche et hurt inchangés depuis V9."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Preview slash : corps et calques du club lus ensemble en ordre "
        "inverse. Marche et hurt dérivés.\n")
    print(page)


if __name__ == "__main__":
    main()
