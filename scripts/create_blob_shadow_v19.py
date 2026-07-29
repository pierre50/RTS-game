#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


FrameRegion = dict[str, float | int]
FrameMode = str


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def opaque_run_bottoms(column: np.ndarray, threshold: int, min_run: int) -> list[int]:
    opaque = column > threshold
    bottoms: list[int] = []
    start: int | None = None

    for y, value in enumerate(opaque):
        if value and start is None:
            start = y
        elif not value and start is not None:
            if y - start >= min_run:
                bottoms.append(y - 1)
            start = None

    if start is not None and len(column) - start >= min_run:
        bottoms.append(len(column) - 1)

    return bottoms


def has_local_support(
    opaque: np.ndarray,
    x: int,
    y: int,
    radius_x: int,
    max_gap_y: int,
    min_pixels: int,
) -> bool:
    """
    Vérifie qu'un bloc suspendu possède une structure opaque assez proche
    en dessous, dans les colonnes voisines.
    """
    h, w = opaque.shape
    x0 = max(0, x - radius_x)
    x1 = min(w, x + radius_x + 1)
    y0 = min(h, y + 1)
    y1 = min(h, y + max_gap_y + 1)

    if y0 >= y1:
        return False

    return int(opaque[y0:y1, x0:x1].sum()) >= min_pixels


def max_empty_run(values: np.ndarray) -> int:
    longest = 0
    current = 0
    for value in values:
        if value:
            current = 0
        else:
            current += 1
            longest = max(longest, current)
    return longest


def classify_frame(opaque: np.ndarray, anchor_x: float, anchor_y: float) -> FrameMode:
    h, w = opaque.shape
    if h <= 0 or w <= 0:
        return "solid"

    occupied_columns = opaque.any(axis=0)
    occupied_ratio = float(occupied_columns.mean())
    visible_pixels = int(opaque.sum())
    density = visible_pixels / max(1, h * w)

    center_width = max(8, round(w * 0.22))
    center_x0 = max(0, round(anchor_x - center_width / 2))
    center_x1 = min(w, center_x0 + center_width)
    lower_y0 = max(0, round(anchor_y - h * 0.2))
    lower_y1 = min(h, round(anchor_y + h * 0.28))
    center_lower = opaque[lower_y0:lower_y1, center_x0:center_x1]
    center_density = float(center_lower.mean()) if center_lower.size else 0

    anchor_width = max(8, round(w * 0.32))
    anchor_x0 = max(0, round(anchor_x - anchor_width / 2))
    anchor_x1 = min(w, anchor_x0 + anchor_width)
    anchor_y0 = max(0, round(anchor_y - h * 0.12))
    anchor_y1 = min(h, round(anchor_y + h * 0.12))
    anchor_area = opaque[anchor_y0:anchor_y1, anchor_x0:anchor_x1]
    anchor_density = float(anchor_area.mean()) if anchor_area.size else 0

    scan_y0 = max(0, round(anchor_y - h * 0.24))
    scan_y1 = min(h, round(anchor_y + h * 0.2))
    lower_columns = opaque[scan_y0:scan_y1, :].any(axis=0) if scan_y0 < scan_y1 else occupied_columns
    gap_ratio = max_empty_run(lower_columns) / max(1, w)

    if occupied_ratio < 0.36 or density < 0.18:
        return "thin"
    if occupied_ratio > 0.72 and anchor_density < 0.32:
        return "open"
    if gap_ratio > 0.18 and center_density < 0.22:
        return "open"
    return "solid"


def mode_settings(
    mode: FrameMode,
    anchor_pull_x: float,
    anchor_pull_y: float,
    bridge_gap_x: int,
) -> tuple[float, float, int]:
    if mode == "open":
        return anchor_pull_x * 0.42, anchor_pull_y * 0.58, max(bridge_gap_x, 58)
    if mode == "thin":
        return anchor_pull_x * 0.28, anchor_pull_y * 0.38, max(bridge_gap_x, 24)
    return anchor_pull_x, anchor_pull_y, bridge_gap_x


def create_shadow(
    image: Image.Image,
    frame_regions: list[FrameRegion] | None = None,
    alpha_threshold: int = 8,
    min_run: int = 2,
    support_radius_x: int = 8,
    support_gap_y: int = 28,
    support_min_pixels: int = 8,
    capsule_width: int = 9,
    capsule_height: int = 5,
    drop_y: int = 3,
    stretch_y: int = 4,
    close_x: int = 7,
    close_y: int = 5,
    opacity: int = 205,
    anchor_pull_x: float = 0.72,
    anchor_pull_y: float = 0.86,
    bridge_gap_x: int = 34,
) -> tuple[Image.Image, Image.Image]:
    """
    V19 = V17 + filtre de support local.

    - Le bloc opaque le plus bas de chaque colonne est toujours conservé.
    - Un bloc plus haut ne crée une ombre que s'il existe une structure opaque
      assez proche sous lui dans les colonnes voisines.
    - La cible suspendue reste prise en compte grâce à ses poteaux voisins.
    - Les petits détails hauts et isolés ne produisent plus de taches flottantes.
    """
    image = image.convert("RGBA")
    alpha = np.asarray(image.getchannel("A"))
    opaque = alpha > alpha_threshold
    h, w = opaque.shape

    pad_x = capsule_width
    canvas_h = h + drop_y + stretch_y + capsule_height + 2
    canvas = Image.new("L", (w + pad_x * 2, canvas_h), 0)
    draw = ImageDraw.Draw(canvas)

    rx = capsule_width // 2
    ry = capsule_height // 2
    regions = frame_regions or [
        {
            "x": 0,
            "y": 0,
            "w": w,
            "h": h,
            "anchor_x": w / 2,
            "anchor_y": h,
        }
    ]

    for region in regions:
        region_x = int(region["x"])
        region_y = int(region["y"])
        region_w = int(region["w"])
        region_h = int(region["h"])
        anchor_x = float(region["anchor_x"])
        anchor_y = float(region["anchor_y"])
        region_alpha = alpha[region_y : region_y + region_h, region_x : region_x + region_w]
        region_opaque = opaque[region_y : region_y + region_h, region_x : region_x + region_w]
        projected_centers: list[tuple[int, int]] = []
        mode = classify_frame(region_opaque, anchor_x, anchor_y)
        pull_x, pull_y, frame_bridge_gap_x = mode_settings(mode, anchor_pull_x, anchor_pull_y, bridge_gap_x)

        for x in range(region_w):
            bottoms = opaque_run_bottoms(region_alpha[:, x], alpha_threshold, min_run)
            if not bottoms:
                continue

            lowest = bottoms[-1]

            for y in bottoms:
                keep = y == lowest or has_local_support(
                    region_opaque,
                    x=x,
                    y=y,
                    radius_x=support_radius_x,
                    max_gap_y=support_gap_y,
                    min_pixels=support_min_pixels,
                )

                if not keep:
                    continue

                height_factor = clamp((anchor_y - y) / max(anchor_y, 1.0), 0.0, 1.0)
                projected_x = x + (anchor_x - x) * height_factor * pull_x
                projected_y = y + (anchor_y - y) * height_factor * pull_y
                cx = round(region_x + projected_x + pad_x)
                cy = round(region_y + projected_y + drop_y)
                projected_centers.append((cx, cy))

                draw.ellipse(
                    (cx - rx, cy - ry, cx + rx, cy + ry + stretch_y),
                    fill=255,
                )

        if frame_bridge_gap_x > 0 and len(projected_centers) > 1:
            bands: dict[int, list[int]] = {}
            for cx, cy in projected_centers:
                band = round(cy / max(1, capsule_height))
                bands.setdefault(band, []).append(cx)

            bridge_half_height = max(1, capsule_height // 2)
            for band, xs in bands.items():
                sorted_xs = sorted(xs)
                y = band * capsule_height
                for left, right in zip(sorted_xs, sorted_xs[1:]):
                    if right - left <= frame_bridge_gap_x:
                        draw.rectangle(
                            (left, y - bridge_half_height, right, y + bridge_half_height + stretch_y),
                            fill=255,
                        )

    mask = np.asarray(canvas) > 0
    mask = ndimage.binary_closing(
        mask,
        structure=np.ones((close_y, close_x), dtype=bool),
    )
    mask = ndimage.binary_dilation(
        mask,
        structure=np.ones((2, 3), dtype=bool),
    )

    alpha_mask = Image.fromarray((mask * 255).astype(np.uint8), "L")
    shadow = Image.new("RGBA", alpha_mask.size, (0, 0, 0, 0))
    shadow.putalpha(alpha_mask.point(lambda p: round(p * opacity / 255)))

    preview = shadow.copy()
    original = Image.new("RGBA", shadow.size, (0, 0, 0, 0))
    original.alpha_composite(image, (pad_x, 0))
    preview.alpha_composite(original)

    return shadow, preview


def load_frame_regions(input_path: Path) -> list[FrameRegion] | None:
    metadata_path = input_path.with_name("texture.json")
    if input_path.name != "texture.png" or not metadata_path.exists():
        return None

    metadata = json.loads(metadata_path.read_text())
    regions: list[FrameRegion] = []
    for frame_data in metadata.get("frames", {}).values():
        frame = frame_data.get("frame")
        if not frame:
            continue
        anchor = frame_data.get("anchor") or {"x": 0.5, "y": 1}
        width = int(frame["w"])
        height = int(frame["h"])
        regions.append(
            {
                "x": int(frame["x"]),
                "y": int(frame["y"]),
                "w": width,
                "h": height,
                "anchor_x": float(anchor.get("x", 0.5)) * width,
                "anchor_y": float(anchor.get("y", 1)) * height,
            }
        )
    return regions or None


def process_file(input_path: Path, args) -> None:
    image = Image.open(input_path).convert("RGBA")

    shadow, _ = create_shadow(
        image,
        frame_regions=load_frame_regions(input_path),
        min_run=args.min_run,
        support_radius_x=args.support_radius_x,
        support_gap_y=args.support_gap_y,
        support_min_pixels=args.support_min_pixels,
        capsule_width=args.capsule_width,
        capsule_height=args.capsule_height,
        drop_y=args.drop_y,
        stretch_y=args.stretch_y,
        close_x=args.close_x,
        close_y=args.close_y,
        opacity=args.opacity,
        anchor_pull_x=args.anchor_pull_x,
        anchor_pull_y=args.anchor_pull_y,
        bridge_gap_x=args.bridge_gap_x,
    )

    output = input_path.with_name(f"{input_path.stem}_shadow.png")
    shadow.save(output)
    print(f"Créé : {output}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)

    parser.add_argument("--min-run", type=int, default=2)
    parser.add_argument("--support-radius-x", type=int, default=8)
    parser.add_argument("--support-gap-y", type=int, default=28)
    parser.add_argument("--support-min-pixels", type=int, default=8)
    parser.add_argument("--capsule-width", type=int, default=9)
    parser.add_argument("--capsule-height", type=int, default=5)
    parser.add_argument("--drop-y", type=int, default=3)
    parser.add_argument("--stretch-y", type=int, default=4)
    parser.add_argument("--close-x", type=int, default=7)
    parser.add_argument("--close-y", type=int, default=5)
    parser.add_argument("--opacity", type=int, default=205)
    parser.add_argument("--anchor-pull-x", type=float, default=0.72)
    parser.add_argument("--anchor-pull-y", type=float, default=0.86)
    parser.add_argument("--bridge-gap-x", type=int, default=34)

    args = parser.parse_args()
    input_path = args.input

    if not input_path.exists():
        raise FileNotFoundError(f"Chemin introuvable : {input_path}")

    if input_path.is_file():
        process_file(input_path, args)
        return

    files = sorted(input_path.rglob("*.png"))

    files = [
        file
        for file in files
        if not file.stem.endswith("_shadow")
    ]

    if not files:
        print(f"Aucun PNG trouvé dans : {input_path}")
        return

    print(f"{len(files)} image(s) trouvée(s)")

    for file in files:
        try:
            process_file(file, args)
        except Exception as error:
            print(f"Erreur pour {file} : {error}")

if __name__ == "__main__":
    main()
