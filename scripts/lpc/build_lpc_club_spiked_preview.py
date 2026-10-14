#!/usr/bin/env python3
"""Preview tiny stone studs on the accepted LPC club without game integration."""

from pathlib import Path
import math

from PIL import Image, ImageDraw

import build_lpc_club_left_walk_high_fix as walk_fix
import build_lpc_club_top_slash_fix as slash_fix
import build_lpc_club_hurt_finish_fix as hurt_fix
import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "reports/lpc-club-spiked-v0"
TILE = 192
WOOD_COLORS = {(98, 53, 28), (143, 80, 48), (43, 28, 29), (72, 36, 33)}
STONE_DARK = (43, 40, 42, 255)
STONE_BASE = (158, 140, 121, 255)
STONE_LIGHT = (204, 195, 177, 255)


def club_pixels(pair, box):
    points = []
    for owner, sheet in enumerate(pair):
        tile = sheet.crop(box).convert("RGBA")
        for y in range(TILE):
            for x in range(TILE):
                color = tile.getpixel((x, y))
                if color[3] and color[:3] in WOOD_COLORS:
                    points.append((x, y, owner))
    return points


def spike_geometry(points):
    count = len(points)
    if count < 12:
        return []
    mean_x = sum(x for x, _, _ in points) / count
    mean_y = sum(y for _, y, _ in points) / count
    xx = sum((x - mean_x) ** 2 for x, _, _ in points)
    yy = sum((y - mean_y) ** 2 for _, y, _ in points)
    xy = sum((x - mean_x) * (y - mean_y) for x, y, _ in points)
    angle = 0.5 * math.atan2(2 * xy, xx - yy)
    axis = (math.cos(angle), math.sin(angle))
    projected = sorted((x * axis[0] + y * axis[1], x, y, owner)
                       for x, y, owner in points)
    end_count = max(3, count // 7)
    ends = (projected[:end_count], projected[-end_count:])

    def width(end):
        lateral = [(-y * axis[0] + x * axis[1]) for _, x, y, _ in end]
        mean = sum(lateral) / len(lateral)
        return sum((value - mean) ** 2 for value in lateral) / len(lateral)

    grip, head = (ends[1], ends[0]) if width(ends[0]) > width(ends[1]) else (ends[0], ends[1])
    grip_center = (sum(x for _, x, _, _ in grip) / len(grip),
                   sum(y for _, _, y, _ in grip) / len(grip))
    head_center = (sum(x for _, x, _, _ in head) / len(head),
                   sum(y for _, _, y, _ in head) / len(head))
    dx, dy = head_center[0] - grip_center[0], head_center[1] - grip_center[1]
    distance = math.hypot(dx, dy)
    if distance < 5:
        return []
    forward = (dx / distance, dy / distance)
    sideways = (-forward[1], forward[0])
    head_projection = max(x * forward[0] + y * forward[1] for x, y, _ in points)
    # Restrict side studs to the broad head, not the thin handle.
    head_band = [(x, y, owner) for x, y, owner in points
                 if head_projection - 12 <= x * forward[0] + y * forward[1] <= head_projection - 3]
    if not head_band:
        return []
    side_center = (sum(x for x, _, _ in head_band) / len(head_band),
                   sum(y for _, y, _ in head_band) / len(head_band))
    tip = max(points, key=lambda p: p[0] * forward[0] + p[1] * forward[1])
    side_pos = max(head_band, key=lambda p:
                   (p[0] - side_center[0]) * sideways[0] +
                   (p[1] - side_center[1]) * sideways[1])
    side_neg = min(head_band, key=lambda p:
                   (p[0] - side_center[0]) * sideways[0] +
                   (p[1] - side_center[1]) * sideways[1])
    return [(tip, forward), (side_pos, sideways),
            (side_neg, (-sideways[0], -sideways[1]))]


def add_spikes(pair, row, frame, spike_length=4):
    box = (frame * TILE, row * TILE, (frame + 1) * TILE, (row + 1) * TILE)
    studs = spike_geometry(club_pixels(pair, box))
    if not studs:
        return
    for (x, y, owner), outward in studs:
        nx, ny = outward
        tangent = (-ny, nx)
        # A three-pixel-wide base embedded in the wood and a short stone tip.
        root = (x - nx, y - ny)
        polygon = [
            (round(root[0] - 1.5 * tangent[0]), round(root[1] - 1.5 * tangent[1])),
            (round(root[0] + 1.5 * tangent[0]), round(root[1] + 1.5 * tangent[1])),
            (round(x + spike_length * nx), round(y + spike_length * ny)),
        ]
        tile = pair[owner].crop(box)
        draw = ImageDraw.Draw(tile)
        draw.polygon(polygon, fill=STONE_BASE, outline=STONE_DARK)
        draw.point((round(x + 2 * nx), round(y + 2 * ny)), fill=STONE_LIGHT)
        pair[owner].paste(tile, box)


def main():
    sheets = {
        "walk": walk_fix.corrected_walk(),
        "attack_slash": slash_fix.corrected_slash(),
        "hurt": hurt_fix.corrected_hurt(),
    }
    for animation, pair in sheets.items():
        rows, frames = (1, 6) if animation == "hurt" else ((4, 9) if animation == "walk" else (4, 6))
        for row in range(rows):
            for frame in range(frames):
                add_spikes(pair, row, frame)
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
        .replace("Massue de pierre · V0", "Club LPC · pointes pierre V0")
        .replace("Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.",
                 "Essai visuel uniquement : trois petites pointes de pierre sur "
                 "la tête du club. Aucune modification de l'arme en jeu."))
    (OUTPUT / "CREDITS.md").write_text(
        "Club LPC par bluecarrot16, [LPC] More Weapons: "
        "https://opengameart.org/content/lpc-more-weapons. "
        "Licences OGA-BY 3.0+, GPL 3.0, CC-BY 4.0. "
        "Petites pointes de pierre ajoutées pour une preview non intégrée.\n")
    print(page)


if __name__ == "__main__":
    main()
