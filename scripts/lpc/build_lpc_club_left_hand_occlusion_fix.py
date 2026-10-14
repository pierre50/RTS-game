#!/usr/bin/env python3
"""Keep left-facing walk frames 2–4 behind the body like the LPC sword."""

from pathlib import Path

from PIL import Image

import build_lpc_club_aligned_prototype as aligned
import build_lpc_club_prototype as club
import build_lpc_club_walk_grip_fix as previous
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v8"
TILE = 192

# These poses follow the sword's right-hand swing while that arm is hidden.
# Their source columns are 1, 2, 3 (displayed as 2/9, 3/9, 4/9).
HIDDEN_HAND_POSES = {
    1: ((86, 115), (-0.7926239891, 0.6097107608)),
    2: ((87, 118), (-0.4472135955, 0.8944271910)),
    3: ((86, 117), (-0.7926239891, 0.6097107608)),
}


def corrected_walk():
    behind, front = previous.walk.smooth_walk(
        pivot=(118, 104),
        left_grips=previous.LEFT_HAND_GRIPS,
        left_angles=previous.LEFT_HAND_ANGLES,
        front_grips=previous.FRONT_HAND_GRIPS,
    )
    source = club.template()
    row = 1  # only the left-facing sprites; the game mirrors them to face right
    for frame, (grip, direction) in HIDDEN_HAND_POSES.items():
        box = (frame * TILE, row * TILE, (frame + 1) * TILE, (row + 1) * TILE)
        front.paste(Image.new("RGBA", (TILE, TILE)), box)
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
        .replace("Massue de pierre · V0", "Club LPC · V8")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Vue gauche : marche 2–4/9 calée sur le mouvement de l'épée "
                 "LPC, massue derrière le corps. Autres poses inchangées."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Marche 2–4/9 vue gauche alignée sur la main droite cachée, "
        "d'après les poses de l'épée LPC et sur le calque arrière. "
        "Slash natif reverse-oversize ; hurt dérivé.\n")
    print(page)


if __name__ == "__main__":
    main()
