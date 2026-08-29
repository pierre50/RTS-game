#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "maps" / "macro-world-preview.png"
DEFAULT_JSON_OUTPUT = ROOT / "public" / "maps" / "macro-world-regions.json"

REGION_MAP_SIZE = 144
WORLD_REGIONS_W = 5
WORLD_REGIONS_H = 4
WORLD_WIDTH = REGION_MAP_SIZE * WORLD_REGIONS_W
WORLD_HEIGHT = REGION_MAP_SIZE * WORLD_REGIONS_H
PREVIEW_SAMPLE_STEP = 2
WORLD_WATER_MARGIN = 0.055

BIOME_SECTORS = [
    "blackforest",
    "jungle",
    "desert",
    "temperate",
]

COLORS = {
    "water": (0, 83, 105),
    "temperate": (79, 132, 62),
    "blackforest": (26, 75, 57),
    "jungle": (34, 125, 78),
    "desert": (197, 156, 82),
    "grid": (245, 238, 205),
}


def hash01(x: int, y: int, seed: int) -> float:
    value = math.sin(x * 127.1 + y * 311.7 + seed * 17.13) * 43758.5453123
    return value - math.floor(value)


def value_noise(x: float, y: float, seed: int) -> float:
    xi = math.floor(x)
    yi = math.floor(y)
    xf = x - xi
    yf = y - yi

    def smooth(value: float) -> float:
        return value * value * (3 - 2 * value)

    a = hash01(xi, yi, seed)
    b = hash01(xi + 1, yi, seed)
    c = hash01(xi, yi + 1, seed)
    d = hash01(xi + 1, yi + 1, seed)
    u = smooth(xf)
    v = smooth(yf)
    top = a + (b - a) * u
    bottom = c + (d - c) * u
    return top + (bottom - top) * v


def fbm(x: float, y: float, seed: int, octaves: int = 5) -> float:
    total = 0.0
    amplitude = 0.5
    frequency = 1.0
    amplitude_sum = 0.0
    for octave in range(octaves):
        total += value_noise(x * frequency, y * frequency, seed + octave * 101) * amplitude
        amplitude_sum += amplitude
        amplitude *= 0.52
        frequency *= 2.0
    return total / amplitude_sum


def make_continent_lobes(rng: random.Random) -> list[tuple[float, float, float, float]]:
    return [
        (rng.uniform(0.18, 0.30), rng.uniform(0.38, 0.54), rng.uniform(0.28, 0.36), rng.uniform(0.42, 0.52)),
        (rng.uniform(0.45, 0.58), rng.uniform(0.43, 0.57), rng.uniform(0.36, 0.44), rng.uniform(0.46, 0.58)),
        (rng.uniform(0.70, 0.82), rng.uniform(0.40, 0.56), rng.uniform(0.28, 0.38), rng.uniform(0.42, 0.55)),
        (rng.uniform(0.42, 0.58), rng.uniform(0.68, 0.78), rng.uniform(0.38, 0.48), rng.uniform(0.23, 0.32)),
    ]


def continent_value(nx: float, ny: float, seed: int, lobes: list[tuple[float, float, float, float]]) -> float:
    if (
        nx < WORLD_WATER_MARGIN
        or nx > 1.0 - WORLD_WATER_MARGIN
        or ny < WORLD_WATER_MARGIN
        or ny > 1.0 - WORLD_WATER_MARGIN
    ):
        return -1.0

    value = -1.0
    for cx, cy, rx, ry in lobes:
        dx = (nx - cx) / rx
        dy = (ny - cy) / ry
        distance = math.sqrt(dx * dx + dy * dy)
        value = max(value, 1.0 - distance)

    edge_distance = min(nx, 1.0 - nx, ny, 1.0 - ny)
    coast_falloff = min(1.0, max(0.0, (edge_distance - WORLD_WATER_MARGIN) / 0.09))
    boundary_noise = fbm(nx * 7.5, ny * 7.5, seed + 41, 4) - 0.5
    detail_noise = fbm(nx * 19.0, ny * 19.0, seed + 73, 3) - 0.5
    return value * coast_falloff + boundary_noise * 0.28 + detail_noise * 0.08


def biome_sector_at(nx: float, ny: float, seed: int, biomes: list[str]) -> str:
    if not biomes:
        raise ValueError("At least one biome sector is required")

    center_x = 0.5 + (fbm(0.5, 0.25, seed + 1601, 2) - 0.5) * 0.08
    center_y = 0.5 + (fbm(0.25, 0.5, seed + 1607, 2) - 0.5) * 0.08
    dx = nx - center_x
    dy = ny - center_y

    angle = math.atan2(dy, dx)
    angle += math.pi / 2.0
    angle += (fbm(nx * 4.5, ny * 4.5, seed + 1703, 4) - 0.5) * 1.05
    angle += (fbm(nx * 13.0, ny * 13.0, seed + 1709, 3) - 0.5) * 0.28
    normalized = (angle % (math.pi * 2.0)) / (math.pi * 2.0)

    centered = (normalized + 0.5 / len(biomes)) % 1.0
    index = int(centered * len(biomes)) % len(biomes)
    return biomes[index]


def terrain_at(
    x: int,
    y: int,
    seed: int,
    continent_lobes: list[tuple[float, float, float, float]],
    biome_sectors: list[str],
) -> str:
    nx = x / WORLD_WIDTH
    ny = y / WORLD_HEIGHT

    if (
        nx < WORLD_WATER_MARGIN
        or nx > 1.0 - WORLD_WATER_MARGIN
        or ny < WORLD_WATER_MARGIN
        or ny > 1.0 - WORLD_WATER_MARGIN
    ):
        return "water"

    if continent_value(nx, ny, seed, continent_lobes) < 0.02:
        return "water"

    lake_noise = fbm(nx * 13.0, ny * 13.0, seed + 503, 4)
    basin_noise = fbm(nx * 4.2, ny * 4.2, seed + 809, 3)
    if 0.15 < nx < 0.88 and 0.18 < ny < 0.82 and lake_noise < 0.20 and basin_noise < 0.39:
        return "water"

    return biome_sector_at(nx, ny, seed, biome_sectors)


def draw_region_grid(draw: ImageDraw.ImageDraw, scale: int) -> None:
    width = WORLD_WIDTH * scale
    height = WORLD_HEIGHT * scale
    line_color = COLORS["grid"] + (150,)
    for region_x in range(1, WORLD_REGIONS_W):
        x = region_x * REGION_MAP_SIZE * scale
        draw.line((x, scale, x, height - scale - 1), fill=line_color, width=max(1, scale))
    for region_y in range(1, WORLD_REGIONS_H):
        y = region_y * REGION_MAP_SIZE * scale
        draw.line((scale, y, width - scale - 1, y), fill=line_color, width=max(1, scale))


def draw_region_labels(draw: ImageDraw.ImageDraw, scale: int) -> None:
    label_color = (255, 255, 255, 190)
    for region_y in range(WORLD_REGIONS_H):
        for region_x in range(WORLD_REGIONS_W):
            x = region_x * REGION_MAP_SIZE * scale + 8 * scale
            y = region_y * REGION_MAP_SIZE * scale + 7 * scale
            draw.text((x, y), f"{region_x},{region_y}", fill=label_color)


def dominant_region_biome(counts: dict[str, int]) -> str:
    land_counts = {biome: count for biome, count in counts.items() if biome != "water"}
    if not land_counts:
        return "water"
    return max(land_counts.items(), key=lambda item: item[1])[0]


def write_regions_json(seed: int, output: Path, biome_sectors: list[str], region_counts: list[dict[str, int]]) -> None:
    regions = []
    for region_y in range(WORLD_REGIONS_H):
        for region_x in range(WORLD_REGIONS_W):
            index = region_y * WORLD_REGIONS_W + region_x
            counts = region_counts[index]
            total = max(1, sum(counts.values()))
            land_total = max(1, total - counts.get("water", 0))
            regions.append(
                {
                    "x": region_x,
                    "y": region_y,
                    "dominantBiome": dominant_region_biome(counts),
                    "biomeWeights": {
                        biome: round(count / land_total, 4)
                        for biome, count in sorted(counts.items())
                        if biome != "water" and count > 0
                    },
                    "waterRatio": round(counts.get("water", 0) / total, 4),
                }
            )

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "format": "macro-world-regions",
                "version": 1,
                "seed": seed,
                "regionMapSize": REGION_MAP_SIZE,
                "regionsWide": WORLD_REGIONS_W,
                "regionsHigh": WORLD_REGIONS_H,
                "biomeSectors": biome_sectors,
                "regions": regions,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def generate(seed: int, output: Path, scale: int, labels: bool, biome_sectors: list[str], json_out: Path | None) -> None:
    rng = random.Random(seed)
    continent_lobes = make_continent_lobes(rng)
    sample_width = math.ceil(WORLD_WIDTH / PREVIEW_SAMPLE_STEP)
    sample_height = math.ceil(WORLD_HEIGHT / PREVIEW_SAMPLE_STEP)
    image = Image.new("RGB", (sample_width, sample_height))
    pixels = image.load()
    region_counts: list[dict[str, int]] = [
        {} for _ in range(WORLD_REGIONS_W * WORLD_REGIONS_H)
    ]

    for y in range(sample_height):
        for x in range(sample_width):
            world_x = x * PREVIEW_SAMPLE_STEP
            world_y = y * PREVIEW_SAMPLE_STEP
            terrain = terrain_at(
                world_x,
                world_y,
                seed,
                continent_lobes,
                biome_sectors,
            )
            pixels[x, y] = COLORS[terrain]
            region_x = min(WORLD_REGIONS_W - 1, world_x // REGION_MAP_SIZE)
            region_y = min(WORLD_REGIONS_H - 1, world_y // REGION_MAP_SIZE)
            region_index = region_y * WORLD_REGIONS_W + region_x
            region_counts[region_index][terrain] = region_counts[region_index].get(terrain, 0) + 1

    image = image.resize((WORLD_WIDTH * scale, WORLD_HEIGHT * scale), Image.Resampling.NEAREST)

    image = image.convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw_region_grid(draw, scale)
    if labels:
        draw_region_labels(draw, scale)

    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    if json_out:
        write_regions_json(seed, json_out, biome_sectors, region_counts)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a 20-region macro world preview PNG.")
    parser.add_argument("--seed", type=int, default=12345, help="Reproducible macro-world seed.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT, help="Output PNG path.")
    parser.add_argument("--scale", type=int, default=1, choices=[1, 2, 3, 4], help="Preview pixel scale.")
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUTPUT, help="Macro-region JSON output path.")
    parser.add_argument(
        "--biomes",
        default=",".join(BIOME_SECTORS),
        help="Comma-separated biome sectors ordered clockwise from north.",
    )
    parser.add_argument("--no-labels", action="store_true", help="Hide region coordinates.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = args.out if args.out.is_absolute() else ROOT / args.out
    json_out = args.json_out if not args.json_out or args.json_out.is_absolute() else ROOT / args.json_out
    biome_sectors = [biome.strip() for biome in args.biomes.split(",") if biome.strip()]
    unknown_biomes = [biome for biome in biome_sectors if biome not in COLORS]
    if unknown_biomes:
        known = ", ".join(sorted(name for name in COLORS if name != "grid"))
        raise SystemExit(f"Unknown biome(s): {', '.join(unknown_biomes)}. Known biomes: {known}.")

    generate(args.seed, output, args.scale, labels=not args.no_labels, biome_sectors=biome_sectors, json_out=json_out)
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
