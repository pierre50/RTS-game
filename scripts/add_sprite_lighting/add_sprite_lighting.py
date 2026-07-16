#!/usr/bin/env python3
"""
Ajoute un éclairage directionnel à texture.png et crée texture_shadow.png.

Priorité :
1. Si texture.json existe, le traitement est appliqué séparément à chaque frame.
2. Sinon, le script détecte les groupes de pixels opaques automatiquement.

Installation :
    py -m pip install pillow

Utilisation :
    py add_sprite_lighting.py

Réglages rapides :
    py add_sprite_lighting.py --top 1.12 --bottom 0.78 --contrast 1.06
"""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageEnhance


def clamp(value: float) -> int:
    return max(0, min(255, round(value)))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ajoute du volume aux sprites par un éclairage haut-gauche / bas-droit."
    )
    parser.add_argument("--input", default="texture.png")
    parser.add_argument("--output", default="texture_shadow.png")
    parser.add_argument("--json", default="texture.json")

    parser.add_argument(
        "--top",
        type=float,
        default=1.12,
        help="Luminosité en haut de chaque sprite. Défaut : 1.12",
    )
    parser.add_argument(
        "--bottom",
        type=float,
        default=0.78,
        help="Luminosité en bas de chaque sprite. Défaut : 0.78",
    )
    parser.add_argument(
        "--left",
        type=float,
        default=1.04,
        help="Bonus lumineux sur le côté gauche. Défaut : 1.04",
    )
    parser.add_argument(
        "--right",
        type=float,
        default=0.96,
        help="Assombrissement du côté droit. Défaut : 0.96",
    )
    parser.add_argument(
        "--contrast",
        type=float,
        default=1.06,
        help="Contraste final. Défaut : 1.06",
    )
    parser.add_argument(
        "--min-component",
        type=int,
        default=8,
        help="Taille minimale d'un groupe opaque en mode détection. Défaut : 8 pixels",
    )
    parser.add_argument(
        "--green-bg",
        action="store_true",
        help="Considère le vert pur #00FF00 comme transparent pour la détection et le traitement.",
    )
    return parser.parse_args()


def frame_boxes_from_json(json_path: Path) -> list[tuple[int, int, int, int]]:
    if not json_path.exists():
        return []

    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    frames = data.get("frames", {})
    if isinstance(frames, list):
        entries: Iterable = frames
    elif isinstance(frames, dict):
        entries = frames.values()
    else:
        return []

    boxes: list[tuple[int, int, int, int]] = []

    for entry in entries:
        if not isinstance(entry, dict):
            continue

        frame = entry.get("frame", entry)
        try:
            x = int(frame["x"])
            y = int(frame["y"])
            w = int(frame["w"])
            h = int(frame["h"])
        except (KeyError, TypeError, ValueError):
            continue

        if w > 0 and h > 0:
            boxes.append((x, y, x + w, y + h))

    # Évite de traiter deux fois une frame dupliquée dans le JSON.
    return list(dict.fromkeys(boxes))


def is_visible(pixel: tuple[int, int, int, int], green_bg: bool) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return False
    if green_bg and r == 0 and g == 255 and b == 0:
        return False
    return True


def component_boxes(
    image: Image.Image,
    min_component: int,
    green_bg: bool,
) -> list[tuple[int, int, int, int]]:
    """
    Détection de composantes connexes sur l'alpha.
    Les groupes proches sont ensuite fusionnés afin qu'un sprite dont quelques
    éléments sont séparés par 1-2 pixels reçoive un seul dégradé.
    """
    width, height = image.size
    pixels = image.load()
    visited = bytearray(width * height)
    boxes: list[tuple[int, int, int, int]] = []

    for sy in range(height):
        for sx in range(width):
            index = sy * width + sx

            if visited[index] or not is_visible(pixels[sx, sy], green_bg):
                continue

            queue = deque([(sx, sy)])
            visited[index] = 1

            min_x = max_x = sx
            min_y = max_y = sy
            count = 0

            while queue:
                x, y = queue.popleft()
                count += 1

                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)

                for nx, ny in (
                    (x - 1, y),
                    (x + 1, y),
                    (x, y - 1),
                    (x, y + 1),
                    (x - 1, y - 1),
                    (x + 1, y - 1),
                    (x - 1, y + 1),
                    (x + 1, y + 1),
                ):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue

                    nindex = ny * width + nx
                    if visited[nindex]:
                        continue

                    if is_visible(pixels[nx, ny], green_bg):
                        visited[nindex] = 1
                        queue.append((nx, ny))

            if count >= min_component:
                boxes.append((min_x, min_y, max_x + 1, max_y + 1))

    return merge_nearby_boxes(boxes, gap=3)


def boxes_are_close(
    a: tuple[int, int, int, int],
    b: tuple[int, int, int, int],
    gap: int,
) -> bool:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b

    return not (
        ax2 + gap < bx1
        or bx2 + gap < ax1
        or ay2 + gap < by1
        or by2 + gap < ay1
    )


def merge_nearby_boxes(
    boxes: list[tuple[int, int, int, int]],
    gap: int,
) -> list[tuple[int, int, int, int]]:
    merged = boxes[:]
    changed = True

    while changed:
        changed = False
        result: list[tuple[int, int, int, int]] = []

        while merged:
            current = merged.pop()

            for i, other in enumerate(merged):
                if boxes_are_close(current, other, gap):
                    x1 = min(current[0], other[0])
                    y1 = min(current[1], other[1])
                    x2 = max(current[2], other[2])
                    y2 = max(current[3], other[3])
                    merged[i] = (x1, y1, x2, y2)
                    changed = True
                    break
            else:
                result.append(current)

        merged = result

    return merged


def visible_bbox_inside(
    image: Image.Image,
    box: tuple[int, int, int, int],
    green_bg: bool,
) -> tuple[int, int, int, int] | None:
    pixels = image.load()
    x1, y1, x2, y2 = box

    points = [
        (x, y)
        for y in range(y1, y2)
        for x in range(x1, x2)
        if is_visible(pixels[x, y], green_bg)
    ]

    if not points:
        return None

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def apply_lighting(
    image: Image.Image,
    boxes: list[tuple[int, int, int, int]],
    top: float,
    bottom: float,
    left: float,
    right: float,
    green_bg: bool,
) -> Image.Image:
    result = image.copy()
    source = image.load()
    target = result.load()

    for raw_box in boxes:
        box = visible_bbox_inside(image, raw_box, green_bg)
        if box is None:
            continue

        x1, y1, x2, y2 = box
        sprite_w = max(1, x2 - x1 - 1)
        sprite_h = max(1, y2 - y1 - 1)

        for y in range(y1, y2):
            vertical_position = (y - y1) / sprite_h
            vertical_factor = top + (bottom - top) * vertical_position

            for x in range(x1, x2):
                r, g, b, a = source[x, y]

                if not is_visible((r, g, b, a), green_bg):
                    continue

                horizontal_position = (x - x1) / sprite_w
                horizontal_factor = left + (right - left) * horizontal_position

                # La composante verticale domine, la direction gauche/droite reste subtile.
                factor = vertical_factor * horizontal_factor

                target[x, y] = (
                    clamp(r * factor),
                    clamp(g * factor),
                    clamp(b * factor),
                    a,
                )

    return result


def apply_contrast_preserving_alpha(
    image: Image.Image,
    contrast: float,
) -> Image.Image:
    rgb = image.convert("RGB")
    alpha = image.getchannel("A")
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    rgb.putalpha(alpha)
    return rgb


def apply_sprite_lighting(
    image: Image.Image,
    boxes: list[tuple[int, int, int, int]],
    *,
    top: float,
    bottom: float,
    left: float,
    right: float,
    contrast: float,
    green_bg: bool = False,
) -> Image.Image:
    result = apply_lighting(
        image=image,
        boxes=boxes,
        top=top,
        bottom=bottom,
        left=left,
        right=right,
        green_bg=green_bg,
    )
    return apply_contrast_preserving_alpha(result, contrast)


def process_sprite_file(
    input_path: Path,
    output_path: Path,
    json_path: Path,
    *,
    top: float,
    bottom: float,
    left: float,
    right: float,
    contrast: float,
    min_component: int = 8,
    green_bg: bool = False,
) -> tuple[str, int]:
    image = Image.open(input_path).convert("RGBA")

    boxes = frame_boxes_from_json(json_path)
    mode = "frames de texture.json"

    if not boxes:
        boxes = component_boxes(
            image,
            min_component=min_component,
            green_bg=green_bg,
        )
        mode = "détection automatique des sprites"

    if not boxes:
        raise SystemExit(
            "Aucune frame ou zone opaque détectée. "
            "Vérifiez texture.json, la transparence ou utilisez --green-bg."
        )

    result = apply_sprite_lighting(
        image,
        boxes,
        top=top,
        bottom=bottom,
        left=left,
        right=right,
        contrast=contrast,
        green_bg=green_bg,
    )
    if input_path == output_path:
        temp_output_path = output_path.with_name(f"{output_path.stem}.tmp.png")
        result.save(temp_output_path)
        temp_output_path.replace(output_path)
    else:
        result.save(output_path)
    return mode, len(boxes)


def main() -> None:
    args = parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    json_path = Path(args.json)

    if not input_path.exists():
        raise SystemExit(f"Fichier introuvable : {input_path.resolve()}")

    mode, zone_count = process_sprite_file(
        input_path,
        output_path,
        json_path,
        top=args.top,
        bottom=args.bottom,
        left=args.left,
        right=args.right,
        contrast=args.contrast,
        min_component=args.min_component,
        green_bg=args.green_bg,
    )

    print(f"Entrée  : {input_path.resolve()}")
    print(f"Sortie  : {output_path.resolve()}")
    print(f"Mode    : {mode}")
    print(f"Zones   : {zone_count}")


if __name__ == "__main__":
    main()
