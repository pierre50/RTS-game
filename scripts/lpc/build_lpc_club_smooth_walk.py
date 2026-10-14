#!/usr/bin/env python3
"""Hand-tuned cyclic club walk poses with a continuous 9-frame swing."""

from pathlib import Path
from PIL import Image
import math

import build_lpc_club_aligned_prototype as aligned
import build_lpc_club_prototype as first
import build_lpc_club_top_slash_fix as slash_fix
import build_lpc_club_hurt_finish_fix as hurt_fix
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v5"
TILE = 192
FRAMES = 9

# Each position is the handle end touching the weapon hand. Angles are in
# screen coordinates (positive y points down), including the closing 8→0 step.
BACK_GRIPS = ((107, 109), (107, 108), (107, 107), (107, 106), (107, 107),
              (107, 108), (107, 109), (107, 110), (107, 109))
BACK_TILTS = (16, 17, 18, 19, 18, 17, 16, 15, 16)
LEFT_GRIPS = ((88, 110), (90, 110), (92, 109), (91, 110), (89, 111),
              (87, 111), (87, 111), (89, 110), (90, 109))
LEFT_ANGLES = (159, 153, 148, 153, 159, 164, 159, 153, 153)
FRONT_GRIPS = ((105, 111), (105, 112), (106, 112), (106, 113), (106, 112),
               (105, 112), (105, 111), (104, 111), (105, 111))
FRONT_ANGLES = (150, 140, 125, 115, 125, 140, 155, 160, 155)


def walk_pose(row, frame, left_grips=LEFT_GRIPS, left_angles=LEFT_ANGLES,
              front_grips=FRONT_GRIPS):
    if row == 0:
        grip = BACK_GRIPS[frame]
        tilt = math.radians(BACK_TILTS[frame])
        direction = (math.sin(tilt), -math.cos(tilt))
    elif row == 1:
        grip = left_grips[frame]
        angle = math.radians(left_angles[frame])
        direction = (math.cos(angle), math.sin(angle))
    elif row == 2:
        grip = front_grips[frame]
        angle = math.radians(FRONT_ANGLES[frame])
        direction = (math.cos(angle), math.sin(angle))
    else:
        left = left_grips[frame]
        grip = (191 - left[0], left[1])
        angle = math.radians(left_angles[frame])
        direction = (-math.cos(angle), math.sin(angle))
    return grip, direction


def smooth_walk(pivot=(123, 104), left_grips=LEFT_GRIPS,
                left_angles=LEFT_ANGLES, front_grips=FRONT_GRIPS):
    source = first.template()
    sheets = [Image.new("RGBA", (FRAMES * TILE, 4 * TILE)) for _ in range(2)]
    for row in range(4):
        for frame in range(FRAMES):
            grip, direction = walk_pose(row, frame, left_grips, left_angles,
                                        front_grips)
            pose = aligned.club_pose(source, grip, direction, pivot=pivot)
            owner = 0 if row == 0 else 1
            sheets[owner].alpha_composite(pose, (frame * TILE, row * TILE))
    return sheets


def main():
    sheets = {"walk": smooth_walk(),
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
        .replace("Massue de pierre · V0", "Club LPC · V5")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Marche recalée image par image sur la main avec une boucle "
                 "de neuf poses continue. Slash et hurt de la V4 conservés."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Marche composée à partir de la forme originale du club, "
        "recalée sur les neuf poses du héros Hellas ; slash natif "
        "reverse-oversize, avec correction ciblée sur la sixième image "
        "vue de haut ; hurt dérivé et corrigé.\n")
    print(page)


if __name__ == "__main__":
    main()
