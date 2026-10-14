#!/usr/bin/env python3
"""Keep the club in the hidden right hand on left-facing walk frames 2–3."""

from pathlib import Path
import math

from PIL import Image

import build_lpc_club_aligned_prototype as aligned
import build_lpc_club_prototype as club
import build_lpc_club_walk_grip_fix as previous
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v7"
TILE = 192

# The character's right hand moves behind the torso during these two strides.
# Positions remain close to frames 1 and 4 so the club head follows a smooth arc.
HIDDEN_HAND_POSES = {
    1: ((87, 112), 157),
    2: ((87, 113), 155),
}


def corrected_walk():
    behind, front = previous.walk.smooth_walk(
        pivot=(118, 104),
        left_grips=previous.LEFT_HAND_GRIPS,
        left_angles=previous.LEFT_HAND_ANGLES,
        front_grips=previous.FRONT_HAND_GRIPS,
    )
    source = club.template()
    row = 1  # left-facing; right-facing remains untouched and is mirrored in-game
    for frame, (grip, angle_degrees) in HIDDEN_HAND_POSES.items():
        box = (frame * TILE, row * TILE, (frame + 1) * TILE, (row + 1) * TILE)
        front.paste(Image.new("RGBA", (TILE, TILE)), box)
        angle = math.radians(angle_degrees)
        direction = (math.cos(angle), math.sin(angle))
        pose = aligned.club_pose(source, grip, direction, pivot=(118, 104))
        behind.alpha_composite(pose, (frame * TILE, row * TILE))
    return behind, front


def main():
    sheets = {
        "walk": corrected_walk(),
        "attack_slash": previous.slash_fix.corrected_slash(),
        "hurt": previous.hurt_fix.corrected_hurt(),
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
        .replace("Massue de pierre · V0", "Club LPC · V7")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Vue gauche : images de marche 2 et 3 replacées dans la main "
                 "droite, masquée derrière le corps. Autres poses inchangées."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Marche adaptée à la main du personnage ; images 2 et 3 vue gauche "
        "replacées sur le calque arrière. Slash natif reverse-oversize ; "
        "hurt dérivé.\n")
    print(page)


if __name__ == "__main__":
    main()
