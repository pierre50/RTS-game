#!/usr/bin/env python3
"""Fix stone studs to the club template before rendering every walking pose."""

from pathlib import Path
import math

from PIL import Image

import build_lpc_club_aligned_prototype as aligned
import build_lpc_club_prototype as original
import build_lpc_club_smooth_walk as walk
import build_lpc_club_walk_grip_fix as grip_fix
import build_lpc_club_left_walk_high_fix as left_fix
import build_lpc_club_spiked_preview as previous
import build_lpc_club_top_slash_fix as slash_fix
import build_lpc_club_hurt_finish_fix as hurt_fix
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-spiked-v1"
TILE = 192


def spiked_template():
    layers = [Image.new("RGBA", (TILE, TILE)), original.template().copy()]
    # One master set of studs. Scaling to the walking art shrinks six source
    # pixels to roughly four output pixels, matching the first preview.
    previous.add_spikes(layers, 0, 0, spike_length=6)
    return layers[1]


def stable_walk():
    source = spiked_template()
    layers = [Image.new("RGBA", (9 * TILE, 4 * TILE)) for _ in range(2)]
    for row in range(4):
        for frame in range(9):
            grip, direction = walk.walk_pose(
                row, frame,
                left_grips=grip_fix.LEFT_HAND_GRIPS,
                left_angles=grip_fix.LEFT_HAND_ANGLES,
                front_grips=grip_fix.FRONT_HAND_GRIPS,
            )
            owner = 0 if row == 0 else 1
            if row == 1 and frame in left_fix.HIDDEN_HAND_POSES:
                grip, degrees = left_fix.HIDDEN_HAND_POSES[frame]
                radians = math.radians(degrees)
                direction = (math.cos(radians), math.sin(radians))
                owner = 0
            pose = aligned.club_pose(source, grip, direction, pivot=(118, 104))
            layers[owner].alpha_composite(pose, (frame * TILE, row * TILE))
    return layers


def build_spiked_sheets():
    sheets = {
        "walk": stable_walk(),
        "attack_slash": slash_fix.corrected_slash(),
        "hurt": hurt_fix.corrected_hurt(),
    }
    for animation in ("attack_slash", "hurt"):
        rows, frames = (1, 6) if animation == "hurt" else (4, 6)
        for row in range(rows):
            for frame in range(frames):
                previous.add_spikes(sheets[animation], row, frame)
    return sheets


def main():
    sheets = build_spiked_sheets()
    for animation, pair in sheets.items():
        folder = OUTPUT / "sources" / animation
        (folder / "behind").mkdir(parents=True, exist_ok=True)
        pair[0].save(folder / "behind/club.png")
        pair[1].save(folder / "club.png")
    preview.OUTPUT = OUTPUT
    preview.preview(sheets)
    preview.animated_preview(sheets, frame_orders={"slash": (5, 4, 3, 2, 1, 0)})
    page = OUTPUT / "index.html"
    page.write_text(
        page.read_text()
        .replace("Massue de pierre · V0", "Club LPC · pointes pierre V1")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Marche : les pointes sont fixées sur le club avant animation. "
                 "Slash et hurt inchangés depuis la preview pointes V0. "
                 "Essai non intégré au jeu."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Pointes de pierre fixées au modèle source avant génération de la marche. "
        "Preview non intégrée.\n")
    print(page)


if __name__ == "__main__":
    main()
