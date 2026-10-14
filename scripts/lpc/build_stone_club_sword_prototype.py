#!/usr/bin/env python3
"""Stone club study using the LPC arming sword's poses, layers and slash sweep."""

from pathlib import Path
from PIL import Image, ImageDraw
import math

import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
SWORD = ROOT / "scripts/lpc/spritesheets/weapon/sword/arming"
OUTPUT = ROOT / "reports/stone-club-v1"
PREVIEW_GRIPS = preview.SLASH_GRIPS
DARK_HANDLE = {(97, 72, 44), (131, 99, 50), (46, 37, 51)}
GOLD = {(253, 208, 130), (253, 245, 204), (175, 138, 53)}
TRAIL_STONE = {(253, 208, 130): (138, 170, 171, 255),
               (253, 245, 204): (205, 220, 215, 255),
               (175, 138, 53): (74, 80, 87, 255)}
STONE_OUTLINE = (29, 19, 30, 255)

SOURCES = {
    "walk": (64, 4, 9, "universal/bg/walk/brass.png", "universal/fg/walk/brass.png"),
    "attack_slash": (128, 4, 6, "attack_slash/bg/brass.png", "attack_slash/fg/brass.png"),
    "hurt": (64, 1, 6, "universal/bg/hurt/brass.png", "universal/fg/hurt/brass.png"),
}


def source_pair(images, size, row, column):
    box = (column * size, row * size, (column + 1) * size, (row + 1) * size)
    pair = [Image.new("RGBA", (192, 192)) for _ in images]
    offset = (192 - size) // 2
    for output, source in zip(pair, images):
        output.alpha_composite(source.crop(box), (offset, offset))
    return pair


def geometry(pair, animation, row, column):
    merged = Image.alpha_composite(*pair)
    dark = []
    gold = []
    for y in range(192):
        for x in range(192):
            pixel = merged.getpixel((x, y))
            if not pixel[3]:
                continue
            if pixel[:3] in DARK_HANDLE:
                dark.append((x, y))
            elif pixel[:3] in GOLD:
                gold.append((x, y))
    if not dark or not gold:
        return None
    if animation == "attack_slash":
        guess = PREVIEW_GRIPS[row][column]
        grip = min(dark, key=lambda point:
                   (point[0] - guess[0]) ** 2 + (point[1] - guess[1]) ** 2)
    else:
        grip = (round(sum(x for x, _ in dark) / len(dark)),
                round(sum(y for _, y in dark) / len(dark)))
    low, high = (7, 20) if animation == "attack_slash" else (5, 30)
    near = [(x, y) for x, y in gold if low <= math.hypot(x - grip[0], y - grip[1]) <= high]
    if not near:
        near = gold
    vx = sum(x - grip[0] for x, _ in near)
    vy = sum(y - grip[1] for _, y in near)
    if abs(vx) + abs(vy) < 0.01:
        vx, vy = 1, 0
    length = math.hypot(vx, vy)
    return grip, (vx / length, vy / length)


def convert(pair, animation, row, column):
    shape = geometry(pair, animation, row, column)
    if shape is None:
        return pair
    grip, (ux, uy) = shape
    nx, ny = -uy, ux

    def point(along, across=0):
        return (round(grip[0] + along * ux + across * nx),
                round(grip[1] + along * uy + across * ny))

    result = [Image.new("RGBA", (192, 192)) for _ in pair]
    # Copy the original arming sword sweep verbatim. The straight blade next
    # to the grip is excluded; the outer arc keeps its LPC pixels and layer.
    if animation == "attack_slash" and column >= 3:
        for index, source in enumerate(pair):
            for y in range(192):
                for x in range(192):
                    pixel = source.getpixel((x, y))
                    if pixel[:3] not in GOLD or not pixel[3]:
                        continue
                    dx, dy = x - grip[0], y - grip[1]
                    if math.hypot(dx, dy) >= 13:
                        result[index].putpixel((x, y), TRAIL_STONE[pixel[:3]])

    if animation == "attack_slash":
        owner = 1
    else:
        owner = 0 if pair[0].getbbox() and not pair[1].getbbox() else 1
    draw = ImageDraw.Draw(result[owner])
    # Short tapered wood shaft; the sword's exact pose fixes the grip.
    butt = 0 if animation == "attack_slash" else -5
    draw.polygon([point(butt, -1), point(butt + 2, -2), point(17, -3),
                  point(18, 3), point(butt + 2, 2), point(butt, 1)], fill=STONE_OUTLINE)
    draw.polygon([point(butt + 2, 0), point(butt + 4, -1), point(17, -2),
                  point(17, 2), point(butt + 4, 1)], fill=(91, 51, 28, 255))
    draw.line([point(butt + 5, -1), point(14, -2)],
              fill=(130, 79, 43, 255), width=1)
    for along in (14, 17):
        draw.line([point(along, -2), point(along + 1, 2)],
                  fill=(192, 149, 87, 255), width=1)
    draw.polygon([point(16, -3), point(20, -5), point(26, -5),
                  point(29, -2), point(28, 3), point(24, 6),
                  point(18, 5), point(15, 2)], fill=STONE_OUTLINE)
    draw.polygon([point(17, -2), point(21, -4), point(26, -4),
                  point(27, -1), point(26, 3), point(23, 4),
                  point(18, 3)], fill=(82, 86, 86, 255))
    draw.polygon([point(19, -2), point(22, -4), point(25, -3),
                  point(23, 0), point(20, 1)], fill=(139, 143, 138, 255))
    draw.line([point(20, -3), point(23, -3)],
              fill=(185, 184, 170, 255), width=1)
    return result


def build_sheet(animation):
    size, rows, columns, back_path, front_path = SOURCES[animation]
    images = [Image.open(SWORD / path).convert("RGBA")
              for path in (back_path, front_path)]
    outputs = [Image.new("RGBA", (columns * 192, rows * 192)) for _ in images]
    for row in range(rows):
        for column in range(columns):
            pair = convert(source_pair(images, size, row, column), animation, row, column)
            for output, tile in zip(outputs, pair):
                output.paste(tile, (column * 192, row * 192))
    destination = OUTPUT / "sources" / animation
    (destination / "behind").mkdir(parents=True, exist_ok=True)
    outputs[0].save(destination / "behind/stone_club.png")
    outputs[1].save(destination / "stone_club.png")
    return outputs


def main():
    sheets = {animation: build_sheet(animation) for animation in SOURCES}
    preview.OUTPUT = OUTPUT
    preview.preview(sheets)
    preview.animated_preview(sheets)
    index = OUTPUT / "index.html"
    index.write_text(index.read_text().replace("Massue de pierre · V0", "Massue de pierre · V1"))
    print(index)


if __name__ == "__main__":
    main()
