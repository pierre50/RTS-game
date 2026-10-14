#!/usr/bin/env python3
"""V3: keep the LPC sword poses and layers, recolor its blade as wood, add stone."""

from pathlib import Path
from PIL import Image, ImageDraw
import math

import build_stone_club_prototype as preview
import build_stone_club_sword_prototype as sword

OUTPUT = sword.ROOT / "reports/stone-club-v3"
WOOD = {
    (46, 37, 51): (39, 27, 29, 255),
    (97, 72, 44): (82, 47, 27, 255),
    (131, 99, 50): (125, 76, 39, 255),
    (175, 138, 53): (105, 60, 30, 255),
    (253, 208, 130): (163, 108, 57, 255),
    (253, 245, 204): (207, 157, 91, 255),
}
TRAIL = {
    (46, 37, 51): (48, 58, 65, 255),
    (97, 72, 44): (65, 82, 88, 255),
    (131, 99, 50): (95, 119, 123, 255),
    (175, 138, 53): (76, 98, 106, 255),
    (253, 208, 130): (143, 174, 179, 255),
    (253, 245, 204): (207, 222, 221, 255),
}


def convert(pair, animation, row, column):
    shape = sword.geometry(pair, animation, row, column)
    if shape is None:
        return pair
    grip, (ux, uy) = shape
    nx, ny = -uy, ux
    merged = Image.alpha_composite(*pair)
    blade = []
    for y in range(192):
        for x in range(192):
            pixel = merged.getpixel((x, y))
            if pixel[:3] not in sword.GOLD or not pixel[3]:
                continue
            dx, dy = x - grip[0], y - grip[1]
            along, across = dx * ux + dy * uy, dx * nx + dy * ny
            if 2 <= along <= 34 and abs(across) <= 4.5:
                blade.append((along, x, y))
    if blade:
        _, tip_x, tip_y = max(blade)
    else:
        tip_x, tip_y = round(grip[0] + 10 * ux), round(grip[1] + 10 * uy)
    tip_length = (tip_x - grip[0]) * ux + (tip_y - grip[1]) * uy
    result = [Image.new("RGBA", (192, 192)) for _ in pair]
    for index, source in enumerate(pair):
        for y in range(192):
            for x in range(192):
                pixel = source.getpixel((x, y))
                if not pixel[3]:
                    continue
                dx, dy = x - grip[0], y - grip[1]
                along, across = dx * ux + dy * uy, dx * nx + dy * ny
                is_trail = (animation == "attack_slash" and column >= 3
                            and not (-9 <= along <= tip_length + 2
                                     and abs(across) <= 5.5))
                color = (TRAIL if is_trail else WOOD).get(pixel[:3], pixel)
                # The stone cap conceals the sword point, without changing the grip.
                if math.hypot(x - tip_x, y - tip_y) <= 6.5 and not is_trail:
                    continue
                result[index].putpixel((x, y), color)

    # Put the cap in the layer that actually carries the original blade.
    scores = []
    for source in pair:
        score = sum(1 for y in range(max(0, tip_y - 8), min(192, tip_y + 9))
                    for x in range(max(0, tip_x - 8), min(192, tip_x + 9))
                    if source.getpixel((x, y))[3])
        scores.append(score)
    owner = 0 if scores[0] > scores[1] else 1
    draw = ImageDraw.Draw(result[owner])
    center = (tip_x, tip_y)
    draw.ellipse((tip_x - 7, tip_y - 7, tip_x + 7, tip_y + 7),
                 fill=(36, 32, 39, 255))
    draw.ellipse((tip_x - 6, tip_y - 6, tip_x + 5, tip_y + 5),
                 fill=(91, 96, 96, 255))
    draw.polygon([(tip_x - 5, tip_y - 4), (tip_x, tip_y - 6),
                  (tip_x + 3, tip_y - 3), (tip_x, tip_y),
                  (tip_x - 4, tip_y)], fill=(151, 154, 145, 255))
    draw.line([(tip_x - 4, tip_y + 3), (tip_x + 1, tip_y + 5)],
              fill=(59, 65, 68, 255), width=1)
    return result


def build_sheet(animation):
    size, rows, columns, back_path, front_path = sword.SOURCES[animation]
    images = [Image.open(sword.SWORD / path).convert("RGBA")
              for path in (back_path, front_path)]
    outputs = [Image.new("RGBA", (columns * 192, rows * 192)) for _ in images]
    for row in range(rows):
        for column in range(columns):
            pair = convert(sword.source_pair(images, size, row, column),
                           animation, row, column)
            for output, tile in zip(outputs, pair):
                output.paste(tile, (column * 192, row * 192))
    destination = OUTPUT / "sources" / animation
    (destination / "behind").mkdir(parents=True, exist_ok=True)
    outputs[0].save(destination / "behind/stone_club.png")
    outputs[1].save(destination / "stone_club.png")
    return outputs


def main():
    sheets = {animation: build_sheet(animation) for animation in sword.SOURCES}
    preview.OUTPUT = OUTPUT
    preview.preview(sheets)
    preview.animated_preview(sheets)
    index = OUTPUT / "index.html"
    index.write_text(index.read_text().replace("Massue de pierre · V0",
                                               "Massue de pierre · V3"))
    (OUTPUT / "CREDITS.md").write_text(
        "Prototype dérivé des sprites LPC de l'épée arming (brass) présents "
        "dans scripts/lpc/spritesheets/weapon/sword/arming. "
        "Poses et calques originaux conservés; lame recolorée en bois, "
        "tête de pierre ajoutée. Voir les crédits LPC du projet.\n")
    print(index)


if __name__ == "__main__":
    main()
