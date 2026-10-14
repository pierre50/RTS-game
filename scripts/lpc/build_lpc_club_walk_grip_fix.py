#!/usr/bin/env python3
"""Place the club walk's actual handle end on the hand."""

from pathlib import Path

import build_lpc_club_smooth_walk as walk
import build_lpc_club_top_slash_fix as slash_fix
import build_lpc_club_hurt_finish_fix as hurt_fix
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v6"
LEFT_HAND_GRIPS = ((88, 110), (95, 112), (97, 111), (93, 113), (87, 111),
                   (87, 111), (87, 111), (89, 110), (90, 109))
LEFT_HAND_ANGLES = (159, 161, 156, 161, 157, 164, 159, 153, 153)
FRONT_HAND_GRIPS = ((105, 111), (105, 111), (106, 111), (106, 111),
                    (106, 111), (105, 111), (105, 111), (104, 111),
                    (105, 111))


def main():
    sheets = {"walk": walk.smooth_walk(pivot=(118, 104),
                                       left_grips=LEFT_HAND_GRIPS,
                                       left_angles=LEFT_HAND_ANGLES,
                                       front_grips=FRONT_HAND_GRIPS),
              "attack_slash": slash_fix.corrected_slash(),
              "hurt": hurt_fix.corrected_hurt()}
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
        .replace("Massue de pierre · V0", "Club LPC · V6")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Pivot réel du manche et prises latérales 2 à 6 recalés sur la main. "
                 "Slash et hurt inchangés depuis la V5."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Marche dérivée du club avec pivot de rotation sur le bout du "
        "manche et prises latérales recalées sur la main ; slash natif "
        "reverse-oversize ; hurt dérivé.\n")
    print(page)


if __name__ == "__main__":
    main()
