#!/usr/bin/env python3
"""Stone club study directly derived from the LPC mace poses."""

from pathlib import Path
from PIL import Image, ImageDraw
import math

import build_stone_club_prototype as preview

ROOT = Path(__file__).resolve().parents[2]
MACE = ROOT / "scripts/lpc/spritesheets/weapon/blunt/mace"
OUTPUT = ROOT / "reports/stone-club-v2"
WOOD = {
    (0, 0, 0): (29, 19, 30, 255),
    (58, 55, 55): (67, 37, 23, 255),
    (99, 91, 91): (99, 56, 31, 255),
    (136, 129, 127): (136, 84, 46, 255),
    (167, 163, 162): (153, 98, 55, 255),
    (210, 205, 198): (183, 128, 76, 255),
}
SOURCES = {
    "walk": (64, 4, 9, "universal_behind/walk/mace.png", "walk/mace.png"),
    "attack_slash": (192, 4, 6, "attack_slash/behind/mace.png", "attack_slash/mace.png"),
    "hurt": (64, 1, 6, "universal_behind/hurt/mace.png", "hurt/mace.png"),
}


def source_pair(images, size, row, column):
    box = (column * size, row * size, (column + 1) * size, (row + 1) * size)
    offset = (192 - size) // 2
    pair = [Image.new("RGBA", (192, 192)) for _ in images]
    for output, source in zip(pair, images):
        output.alpha_composite(source.crop(box), (offset, offset))
    return pair


def head_center(pair):
    merged = Image.alpha_composite(*pair)
    bounds = merged.getbbox()
    if not bounds:
        return None
    pixels = [(x, y) for y in range(bounds[1], bounds[3])
              for x in range(bounds[0], bounds[2])
              if merged.getpixel((x, y))[3]]
    black = [(x, y) for x, y in pixels
             if merged.getpixel((x, y))[:3] == (0, 0, 0)]
    # The spiked head is the dense, dark part; the slash sweep is thinner.
    return max(pixels, key=lambda center: (
        sum((center[0] - x) ** 2 + (center[1] - y) ** 2 <= 16 for x, y in pixels)
        + .25 * sum((center[0] - x) ** 2 + (center[1] - y) ** 2 <= 36
                    for x, y in black)
    ))


def thicken_handle(layer, handle_pixels, center):
    """Widen the shaft across its axis without adding missing lengthwise rows."""
    if len(handle_pixels) < 2:
        return
    cx, cy = center
    distant = max(handle_pixels, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
    dx, dy = distant[0] - cx, distant[1] - cy
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    nx, ny = -uy, ux
    perpendicular = max(
        ((x, y) for x in (-1, 0, 1) for y in (-1, 0, 1) if x or y),
        key=lambda p: p[0] * nx + p[1] * ny - 2 * abs(p[0] * ux + p[1] * uy),
    )

    # Each connected shaft piece is treated separately. A projection row that
    # is absent in the source never gains pixels, preserving hand gaps.
    remaining = set(handle_pixels)
    components = []
    while remaining:
        component = {remaining.pop()}
        pending = list(component)
        while pending:
            x, y = pending.pop()
            for ox in (-1, 0, 1):
                for oy in (-1, 0, 1):
                    neighbor = (x + ox, y + oy)
                    if neighbor in remaining:
                        remaining.remove(neighbor)
                        component.add(neighbor)
                        pending.append(neighbor)
        components.append(component)

    additions = []
    for component in components:
        rows = {}
        for x, y in component:
            along = round((x - cx) * ux + (y - cy) * uy)
            rows.setdefault(along, []).append((x, y))
        for along, pixels in rows.items():
            # One-pixel rows alternate between 1px and 2px: 50% average.
            if len(pixels) == 1 and along % 2:
                continue
            edge = max(pixels, key=lambda p: (p[0] - cx) * nx + (p[1] - cy) * ny)
            candidate = (edge[0] + perpendicular[0], edge[1] + perpendicular[1])
            if not (0 <= candidate[0] < 192 and 0 <= candidate[1] < 192):
                continue
            candidate_row = round((candidate[0] - cx) * ux + (candidate[1] - cy) * uy)
            if candidate_row != along or candidate in handle_pixels:
                continue
            if layer.getpixel(candidate)[3] == 0:
                additions.append(candidate)
    for candidate in additions:
        layer.putpixel(candidate, (67, 37, 23, 255))


def convert(pair, animation, row, column):
    center = head_center(pair)
    if center is None:
        return pair
    cx, cy = center
    result = [Image.new("RGBA", (192, 192)) for _ in pair]
    ownership = [0, 0]
    handle_pixels = [set(), set()]
    for index, source in enumerate(pair):
        bounds = source.getbbox()
        if not bounds:
            continue
        for y in range(bounds[1], bounds[3]):
            for x in range(bounds[0], bounds[2]):
                pixel = source.getpixel((x, y))
                if not pixel[3]:
                    continue
                distance = math.hypot(x - cx, y - cy)
                if distance <= 7:
                    ownership[index] += 1
                    continue
                # The existing mace slash sweep stays grey. Only the short
                # handle segment beside the head gets a wooden colour.
                if animation == "attack_slash" and column == 4:
                    grip = preview.SLASH_GRIPS[row][column]
                    dx, dy = grip[0] - cx, grip[1] - cy
                    length = math.hypot(dx, dy)
                    if length:
                        along = ((x - cx) * dx + (y - cy) * dy) / length
                        across = abs((x - cx) * -dy + (y - cy) * dx) / length
                        is_handle = 7 < along < min(length, 18) and across <= 2.5
                    else:
                        is_handle = False
                    result[index].putpixel((x, y), WOOD.get(pixel[:3], pixel)
                                                if is_handle else pixel)
                    if is_handle:
                        handle_pixels[index].add((x, y))
                else:
                    result[index].putpixel((x, y), WOOD.get(pixel[:3], pixel))
                    handle_pixels[index].add((x, y))

    for layer, pixels in zip(result, handle_pixels):
        thicken_handle(layer, pixels, center)

    owner = 0 if ownership[0] > ownership[1] else 1
    draw = ImageDraw.Draw(result[owner])
    # The stone covers every original spike while keeping the head's position.
    draw.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=(29, 19, 30, 255))
    draw.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=(79, 84, 85, 255))
    draw.ellipse((cx - 4, cy - 4, cx + 3, cy + 3), fill=(117, 124, 122, 255))
    draw.polygon([(cx - 4, cy - 3), (cx - 2, cy - 4),
                  (cx + 1, cy - 4), (cx - 1, cy - 1),
                  (cx - 3, cy)], fill=(160, 164, 155, 255))
    draw.line([(cx + 2, cy + 4), (cx + 4, cy + 3)],
              fill=(52, 57, 61, 255), width=1)
    return result


def build_sheet(animation):
    size, rows, columns, back_path, front_path = SOURCES[animation]
    images = [Image.open(MACE / path).convert("RGBA")
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
    index.write_text(index.read_text().replace("Massue de pierre · V0", "Massue de pierre · V2"))
    print(index)


if __name__ == "__main__":
    main()
