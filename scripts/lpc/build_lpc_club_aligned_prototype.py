#!/usr/bin/env python3
"""Align the LPC club to mace/sword hand poses, then preview every frame."""

from pathlib import Path
from PIL import Image
import math

import build_lpc_club_prototype as first
import build_stone_club_prototype as preview
import build_stone_club_sword_prototype as sword
import build_stone_club_mace_prototype as mace

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-v1"
TILE = 192
SCALE = 0.65
GRIP_CORRECTIONS = {
    ("attack_slash", 2): {5: (117, 106)},
    # Keep the grip on the visible right hand throughout the fall.
    ("hurt", 0): ((106, 111), (106, 114), (107, 116),
                  (108, 119), (109, 118), (111, 96)),
}
DIRECTION_CORRECTIONS = {
    ("hurt", 0): ((-0.53, 0.85), (-0.82, 0.57), (-0.98, 0.20),
                  (-1.0, 0.0), (-0.96, 0.28), (0.8, -0.6)),
}


def source_sword(animation):
    size, rows, columns, back_path, front_path = sword.SOURCES[animation]
    sources = [Image.open(sword.SWORD / path).convert("RGBA")
               for path in (back_path, front_path)]
    return size, rows, columns, sources


def mace_walk_guides():
    size, _, _, back_path, front_path = mace.SOURCES["walk"]
    return size, [Image.open(mace.MACE / path).convert("RGBA")
                  for path in (back_path, front_path)]


def mace_geometry(pair):
    """Identify the thin grip and thick head of the LPC mace guide."""
    merged = Image.alpha_composite(*pair)
    bounds = merged.getbbox()
    if not bounds:
        return None
    pixels = [(x, y) for y in range(bounds[1], bounds[3])
              for x in range(bounds[0], bounds[2])
              if merged.getpixel((x, y))[3]]
    mx = sum(x for x, _ in pixels) / len(pixels)
    my = sum(y for _, y in pixels) / len(pixels)
    xx = sum((x - mx) ** 2 for x, y in pixels)
    yy = sum((y - my) ** 2 for x, y in pixels)
    xy = sum((x - mx) * (y - my) for x, y in pixels)
    angle = .5 * math.atan2(2 * xy, xx - yy)
    axis = (math.cos(angle), math.sin(angle))
    ordered = sorted(pixels, key=lambda p:
                     (p[0] - mx) * axis[0] + (p[1] - my) * axis[1])
    count = max(2, len(ordered) // 8)
    ends = (ordered[:count], ordered[-count:])
    centers = [(round(sum(x for x, _ in end) / len(end)),
                round(sum(y for _, y in end) / len(end))) for end in ends]
    density = [sum((x - center[0]) ** 2 + (y - center[1]) ** 2 <= 16
                   for x, y in pixels) for center in centers]
    grip_index = 0 if density[0] < density[1] else 1
    grip, head = centers[grip_index], centers[1 - grip_index]
    vx, vy = head[0] - grip[0], head[1] - grip[1]
    length = math.hypot(vx, vy)
    return grip, (vx / length, vy / length)


def club_pose(template, grip, direction, pivot=(123, 104)):
    """Inverse-map one clean LPC club pose, so it has no rotation gaps."""
    output = Image.new("RGBA", (TILE, TILE))
    ux, uy = direction
    nx, ny = -uy, ux
    gx, gy = grip
    for y in range(max(0, gy - 37), min(TILE, gy + 38)):
        for x in range(max(0, gx - 37), min(TILE, gx + 38)):
            dx, dy = x - gx, y - gy
            along = (dx * ux + dy * uy) / SCALE
            across = (dx * nx + dy * ny) / SCALE
            sx, sy = round(pivot[0] + across), round(pivot[1] - along)
            if 0 <= sx < TILE and 0 <= sy < TILE:
                pixel = template.getpixel((sx, sy))
                if pixel[3]:
                    output.putpixel((x, y), pixel)
    return output


def layer_owner(pair, grip):
    # The reference sword already encodes the correct front/back body order.
    scores = [0, 0]
    gx, gy = grip
    for index, source in enumerate(pair):
        for y in range(max(0, gy - 7), min(TILE, gy + 8)):
            for x in range(max(0, gx - 7), min(TILE, gx + 8)):
                if source.getpixel((x, y))[3]:
                    scores[index] += 1
    return 0 if scores[0] > scores[1] else 1


def build_sheet(animation):
    size, rows, columns, guides = source_sword(animation)
    mace_size, mace_guides = mace_walk_guides() if animation == "walk" else (None, None)
    result = [Image.new("RGBA", (columns * TILE, rows * TILE)) for _ in guides]
    template = first.template()
    for row in range(rows):
        for column in range(columns):
            pair = sword.source_pair(guides, size, row, column)
            mace_pair = (mace.source_pair(mace_guides, mace_size, row, column)
                         if animation == "walk" else None)
            shape = (mace_geometry(mace_pair) if mace_pair else
                     sword.geometry(pair, animation, row, column))
            if shape is None:
                continue
            grip, direction = shape
            correction = GRIP_CORRECTIONS.get((animation, row))
            if correction:
                grip = correction.get(column, grip) if isinstance(correction, dict) else correction[column]
            direction_correction = DIRECTION_CORRECTIONS.get((animation, row))
            if direction_correction:
                direction = direction_correction[column]
            # A sword-shaped trail was detached from the shorter club head;
            # keep the hand registration clean until a club trail is authored.
            layers = [Image.new("RGBA", (TILE, TILE)) for _ in pair]
            owner = layer_owner(mace_pair or pair, grip)
            if animation == "hurt":
                owner = 1
            pose = club_pose(template, grip, direction)
            if not any(pose.getpixel((x, y))[3]
                       for y in range(max(0, grip[1] - 3), min(TILE, grip[1] + 4))
                       for x in range(max(0, grip[0] - 3), min(TILE, grip[0] + 4))):
                raise ValueError(f"Detached grip: {animation} row {row} frame {column}")
            layers[owner].alpha_composite(pose)
            for sheet, layer in zip(result, layers):
                sheet.alpha_composite(layer, (column * TILE, row * TILE))
    return result


def main():
    sheets = {animation: build_sheet(animation)
              for animation in ("walk", "attack_slash", "hurt")}
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
        .replace("Massue de pierre · V0", "Club LPC · V1")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Placement en main revu sur chaque pose. La traînée de l'attaque est "
                 "désactivée pour cette passe ; les calques ne sont pas intégrés au jeu."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC original par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Toutes les poses utilisent le club original repositionné selon "
        "la mace LPC pour la marche et l'épée arming LPC pour le slash. "
        "Les poses hurt et quelques prises ont été corrigées sur la main. "
        "La traînée slash reste à créer.\n")
    print(page)


if __name__ == "__main__":
    main()
