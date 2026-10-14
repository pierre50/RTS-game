#!/usr/bin/env python3
"""Keep hidden-hand left walk club poses raised and behind the torso."""

from pathlib import Path
import math

from PIL import Image

import build_lpc_club_aligned_prototype as aligned
import build_lpc_club_prototype as club
import build_lpc_club_walk_grip_fix as previous
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v9"
TILE = 192

# The hidden right hand stays close to the waist; the club head does not dip.
# Keys are zero-based: displayed walk frames 2/9, 3/9, 4/9.
HIDDEN_HAND_POSES = {
    1: ((88, 108), 169),
    2: ((88, 108), 166),
    3: ((89, 109), 166),
}


def corrected_walk():
    behind, front = previous.walk.smooth_walk(
        pivot=(118, 104),
        left_grips=previous.LEFT_HAND_GRIPS,
        left_angles=previous.LEFT_HAND_ANGLES,
        front_grips=previous.FRONT_HAND_GRIPS,
    )
    source = club.template()
    row = 1
    for frame, (grip, degrees) in HIDDEN_HAND_POSES.items():
        box = (frame * TILE, row * TILE, (frame + 1) * TILE, (row + 1) * TILE)
        front.paste(Image.new("RGBA", (TILE, TILE)), box)
        angle = math.radians(degrees)
        pose = aligned.club_pose(
            source, grip, (math.cos(angle), math.sin(angle)), pivot=(118, 104)
        )
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
        .replace("Massue de pierre · V0", "Club LPC · V9")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Vue gauche : images 2–4/9 derrière le corps, massue tenue "
                 "à hauteur de taille. Autres poses inchangées."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Marche 2–4/9 vue gauche : massue relevée derrière le torse, "
        "dans la main droite cachée. Slash natif reverse-oversize ; "
        "hurt dérivé.\n")
    print(page)


if __name__ == "__main__":
    main()
