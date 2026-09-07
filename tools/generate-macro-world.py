#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import random
import re
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "maps" / "macro-world-preview.png"
DEFAULT_JSON_OUTPUT = ROOT / "public" / "maps" / "macro-world-regions.json"
DEFAULT_CIVILIZATIONS_CONFIG = ROOT / "app" / "config" / "civilizations.ts"

REGION_MAP_SIZE = 144
WORLD_REGIONS_W = 5
WORLD_REGIONS_H = 5
WORLD_WIDTH = REGION_MAP_SIZE * WORLD_REGIONS_W
WORLD_HEIGHT = REGION_MAP_SIZE * WORLD_REGIONS_H
PREVIEW_SAMPLE_STEP = 2
WORLD_WATER_MARGIN = 0.055
DEFAULT_PLAYERS = 0
DEFAULT_BANDIT_CAMPS = 0
ISO_HALF_WIDTH = 1.0
ISO_HALF_HEIGHT = 0.5
ISO_MARGIN = 12

BIOME_SECTORS = [
    "blackforest",
    "desert",
    "temperate",
    "steppe",
]

COLORS = {
    "water": (0, 83, 105),
    "temperate": (79, 132, 62),
    "blackforest": (26, 75, 57),
    "jungle": (34, 125, 78),
    "desert": (197, 156, 82),
    "steppe": (142, 151, 76),
    "grid": (245, 238, 205),
}

BIOME_ALIASES = {
    "step": "steppe",
}

TERRAIN_CODES = {
    "water": "W",
    "temperate": "T",
    "blackforest": "F",
    "jungle": "J",
    "desert": "D",
    "steppe": "S",
}

SETTLEMENT_COLORS = [
    (84, 139, 232),
    (221, 82, 82),
    (237, 196, 68),
    (102, 192, 104),
    (196, 104, 220),
    (222, 139, 65),
    (78, 197, 205),
    (226, 106, 156),
]
BANDIT_COLOR = (64, 55, 50)
VILLAGE_RADIUS = 18
BANDIT_CAMP_RADIUS = 12
VILLAGE_LOCAL_PADDING = 28
BANDIT_CAMP_LOCAL_PADDING = 18


def clamp_int(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def configured_civilizations() -> list[str]:
    if not DEFAULT_CIVILIZATIONS_CONFIG.exists():
        return []
    source = DEFAULT_CIVILIZATIONS_CONFIG.read_text(encoding="utf-8")
    return re.findall(r"value:\s*['\"]([^'\"]+)['\"]", source)


def resolve_civilizations(value: str) -> list[str]:
    items = split_csv(value)
    if len(items) == 1 and items[0].lower() == "all":
        return configured_civilizations()
    return items


def normalize_biome(value: str) -> str:
    return BIOME_ALIASES.get(value.strip(), value.strip())


def settlement_region(world_i: int, world_j: int) -> dict[str, int]:
    return {
        "x": clamp_int(world_j // REGION_MAP_SIZE, 0, WORLD_REGIONS_W - 1),
        "y": clamp_int(world_i // REGION_MAP_SIZE, 0, WORLD_REGIONS_H - 1),
    }


def settlement_local(world_i: int, world_j: int) -> dict[str, int]:
    return {
        "i": clamp_int(world_i % REGION_MAP_SIZE, 0, REGION_MAP_SIZE - 1),
        "j": clamp_int(world_j % REGION_MAP_SIZE, 0, REGION_MAP_SIZE - 1),
    }


def has_local_padding(world_i: int, world_j: int, padding: int) -> bool:
    local = settlement_local(world_i, world_j)
    return (
        padding <= local["i"] <= REGION_MAP_SIZE - 1 - padding
        and padding <= local["j"] <= REGION_MAP_SIZE - 1 - padding
    )


def distance_sq(a: tuple[int, int], b: tuple[int, int]) -> int:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2


def pick_spread_position(
    rng: random.Random,
    candidates: list[dict[str, object]],
    occupied: list[tuple[tuple[int, int], int]],
    min_distance: int,
    local_padding: int = 0,
) -> dict[str, object] | None:
    padded = [candidate for candidate in candidates if has_local_padding(candidate["point"][0], candidate["point"][1], local_padding)]
    pool = padded or candidates
    distance = min_distance
    while distance >= 16:
        distance_sq_min = distance ** 2
        valid = [
            candidate
            for candidate in pool
            if all(distance_sq(candidate["point"], point) >= max(distance_sq_min, radius ** 2) for point, radius in occupied)
        ]
        if valid:
            sample = rng.sample(valid, min(len(valid), 24))
            sample.sort(
                key=lambda candidate: min(
                    [distance_sq(candidate["point"], point) for point, _radius in occupied] or [WORLD_WIDTH * WORLD_HEIGHT]
                ),
                reverse=True,
            )
            return rng.choice(sample[: max(1, min(6, len(sample)))])
        distance = int(distance * 0.75)
    return rng.choice(pool) if pool else None


def create_settlement(
    id: str,
    kind: str,
    world_i: int,
    world_j: int,
    radius: int,
    biome: str,
    **extra: object,
) -> dict[str, object]:
    return {
        "id": id,
        "kind": kind,
        "world": {"i": world_i, "j": world_j},
        "region": settlement_region(world_i, world_j),
        "local": settlement_local(world_i, world_j),
        "radius": radius,
        "biome": biome,
        **extra,
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


def draw_settlements(draw: ImageDraw.ImageDraw, scale: int, settlements: list[dict[str, object]]) -> None:
    for settlement in settlements:
        world = settlement["world"]
        x = int(world["j"]) * scale
        y = int(world["i"]) * scale
        radius = int(settlement["radius"]) * scale
        kind = str(settlement["kind"])
        if kind == "banditCamp":
            color = BANDIT_COLOR
            label = settlement["id"].replace("bandit-camp-", "B")
        else:
            player_index = int(settlement.get("playerIndex", 0))
            color = SETTLEMENT_COLORS[player_index % len(SETTLEMENT_COLORS)]
            label = f"P{player_index + 1}"

        fill = color + (46,)
        outline = color + (230,)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill, outline=outline, width=max(2, scale * 2))
        dot_radius = max(3, scale * 3)
        draw.ellipse((x - dot_radius, y - dot_radius, x + dot_radius, y + dot_radius), fill=color + (255,))
        draw.text((x + dot_radius + 2 * scale, y - 5 * scale), label, fill=(255, 255, 255, 230))


def iso_preview_bounds(scale: int) -> dict[str, float]:
    width = (WORLD_WIDTH + WORLD_HEIGHT) * ISO_HALF_WIDTH * scale + ISO_MARGIN * 2
    height = (WORLD_WIDTH + WORLD_HEIGHT) * ISO_HALF_HEIGHT * scale + ISO_MARGIN * 2
    return {
        "width": math.ceil(width),
        "height": math.ceil(height),
        "offsetX": WORLD_WIDTH * ISO_HALF_WIDTH * scale + ISO_MARGIN,
        "offsetY": ISO_MARGIN,
        "halfWidth": ISO_HALF_WIDTH * scale,
        "halfHeight": ISO_HALF_HEIGHT * scale,
    }


def iso_point(world_i: float, world_j: float, bounds: dict[str, float]) -> tuple[float, float]:
    return (
        (world_i - world_j) * bounds["halfWidth"] + bounds["offsetX"],
        (world_i + world_j) * bounds["halfHeight"] + bounds["offsetY"],
    )


def draw_iso_region_grid(draw: ImageDraw.ImageDraw, scale: int, bounds: dict[str, float]) -> None:
    line_color = COLORS["grid"] + (120,)
    width = max(1, scale)
    for region_x in range(WORLD_REGIONS_W + 1):
        world_j = region_x * REGION_MAP_SIZE
        draw.line(
            [iso_point(0, world_j, bounds), iso_point(WORLD_HEIGHT, world_j, bounds)],
            fill=line_color,
            width=width,
        )
    for region_y in range(WORLD_REGIONS_H + 1):
        world_i = region_y * REGION_MAP_SIZE
        draw.line(
            [iso_point(world_i, 0, bounds), iso_point(world_i, WORLD_WIDTH, bounds)],
            fill=line_color,
            width=width,
        )


def draw_iso_region_labels(draw: ImageDraw.ImageDraw, scale: int, bounds: dict[str, float]) -> None:
    label_color = (255, 255, 255, 190)
    for region_y in range(WORLD_REGIONS_H):
        for region_x in range(WORLD_REGIONS_W):
            x, y = iso_point((region_y + 0.5) * REGION_MAP_SIZE, (region_x + 0.5) * REGION_MAP_SIZE, bounds)
            draw.text((x - 8 * scale, y - 5 * scale), f"{region_x},{region_y}", fill=label_color)


def draw_iso_settlements(draw: ImageDraw.ImageDraw, scale: int, bounds: dict[str, float], settlements: list[dict[str, object]]) -> None:
    for settlement in settlements:
        world = settlement["world"]
        x, y = iso_point(int(world["i"]), int(world["j"]), bounds)
        kind = str(settlement["kind"])
        if kind == "banditCamp":
            color = BANDIT_COLOR
            label = settlement["id"].replace("bandit-camp-", "B")
        else:
            player_index = int(settlement.get("playerIndex", 0))
            color = SETTLEMENT_COLORS[player_index % len(SETTLEMENT_COLORS)]
            label = f"P{player_index + 1}"

        radius = max(4, 4 * scale)
        fill = color + (90,)
        outline = color + (255,)
        if kind == "banditCamp":
            draw.rectangle((x - radius, y - radius, x + radius, y + radius), fill=fill, outline=outline, width=max(1, scale))
        else:
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill, outline=outline, width=max(1, scale))
        dot_radius = max(2, 2 * scale)
        draw.ellipse((x - dot_radius, y - dot_radius, x + dot_radius, y + dot_radius), fill=color + (255,))
        draw.text((x + radius + 2 * scale, y - 5 * scale), label, fill=(255, 255, 255, 230))


def draw_iso_preview(
    output: Path,
    scale: int,
    labels: bool,
    seed: int,
    continent_lobes: list[tuple[float, float, float, float]],
    biome_sectors: list[str],
    settlements: list[dict[str, object]],
) -> dict[str, float]:
    bounds = iso_preview_bounds(scale)
    image = Image.new("RGBA", (int(bounds["width"]), int(bounds["height"])), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    step = PREVIEW_SAMPLE_STEP
    for world_i in range(0, WORLD_HEIGHT, step):
        for world_j in range(0, WORLD_WIDTH, step):
            terrain = terrain_at(world_j, world_i, seed, continent_lobes, biome_sectors)
            x, y = iso_point(world_i, world_j, bounds)
            hw = max(1, step * bounds["halfWidth"])
            hh = max(1, step * bounds["halfHeight"])
            draw.polygon(
                [(x, y - hh), (x + hw, y), (x, y + hh), (x - hw, y)],
                fill=COLORS[terrain] + (255,),
            )
    draw_iso_region_grid(draw, scale, bounds)
    draw_iso_settlements(draw, scale, bounds, settlements)
    if labels:
        draw_iso_region_labels(draw, scale, bounds)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    return bounds


def create_settlement_plan(
    seed: int,
    land_samples: list[dict[str, object]],
    players: int,
    civilizations: list[str],
    bandit_camps: int,
    settlement_disparity: float,
) -> list[dict[str, object]]:
    if not land_samples:
        return []

    rng = random.Random(seed + 9029)
    settlements: list[dict[str, object]] = []
    occupied: list[tuple[tuple[int, int], int]] = []
    player_count = max(0, players)
    bandit_count = max(0, bandit_camps)
    disparity = max(0.0, min(0.85, settlement_disparity))

    for player_index in range(player_count):
        base_distance = int(min(WORLD_WIDTH, WORLD_HEIGHT) * (0.34 - disparity * 0.12))
        candidate = pick_spread_position(rng, land_samples, occupied, base_distance, VILLAGE_LOCAL_PADDING)
        if not candidate:
            continue
        world_i, world_j = candidate["point"]
        civ = civilizations[player_index] if player_index < len(civilizations) else f"Civilization {player_index + 1}"
        settlement = create_settlement(
            f"player-{player_index + 1}-village",
            "village",
            world_i,
            world_j,
            VILLAGE_RADIUS,
            str(candidate["biome"]),
            civ=civ,
            playerIndex=player_index,
            importance=round(1.0 + rng.random() * disparity, 3),
        )
        settlements.append(settlement)
        occupied.append(((world_i, world_j), VILLAGE_RADIUS * 3))

    for camp_index in range(bandit_count):
        base_distance = int(min(WORLD_WIDTH, WORLD_HEIGHT) * (0.18 - disparity * 0.05))
        candidate = pick_spread_position(rng, land_samples, occupied, base_distance, BANDIT_CAMP_LOCAL_PADDING)
        if not candidate:
            continue
        world_i, world_j = candidate["point"]
        strength = 1 + int(rng.random() * (2 + disparity * 3))
        settlement = create_settlement(
            f"bandit-camp-{camp_index + 1}",
            "banditCamp",
            world_i,
            world_j,
            BANDIT_CAMP_RADIUS,
            str(candidate["biome"]),
            strength=strength,
        )
        settlements.append(settlement)
        occupied.append(((world_i, world_j), BANDIT_CAMP_RADIUS * 3))

    return settlements


def dominant_region_biome(counts: dict[str, int]) -> str:
    land_counts = {biome: count for biome, count in counts.items() if biome != "water"}
    if not land_counts:
        return "water"
    return max(land_counts.items(), key=lambda item: item[1])[0]


def encoded_region_terrain_rows(
    region_x: int,
    region_y: int,
    seed: int,
    continent_lobes: list[tuple[float, float, float, float]],
    biome_sectors: list[str],
) -> list[str]:
    rows = []
    for local_i in range(REGION_MAP_SIZE + 1):
        row = []
        for local_j in range(REGION_MAP_SIZE + 1):
            world_x = min(WORLD_WIDTH - 1, region_x * REGION_MAP_SIZE + local_j)
            world_y = min(WORLD_HEIGHT - 1, region_y * REGION_MAP_SIZE + local_i)
            terrain = terrain_at(world_x, world_y, seed, continent_lobes, biome_sectors)
            row.append(TERRAIN_CODES[terrain])
        rows.append("".join(row))
    return rows


def write_regions_json(
    seed: int,
    output: Path,
    biome_sectors: list[str],
    continent_lobes: list[tuple[float, float, float, float]],
    region_counts: list[dict[str, int]],
    settlements: list[dict[str, object]],
    iso_preview: dict[str, object] | None = None,
) -> None:
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
                    "terrainRows": encoded_region_terrain_rows(region_x, region_y, seed, continent_lobes, biome_sectors),
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
                **({"isoPreview": iso_preview} if iso_preview else {}),
                "settlements": settlements,
                "regions": regions,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def generate(
    seed: int,
    output: Path,
    scale: int,
    labels: bool,
    biome_sectors: list[str],
    json_out: Path | None,
    players: int,
    civilizations: list[str],
    bandit_camps: int,
    settlement_disparity: float,
) -> None:
    rng = random.Random(seed)
    continent_lobes = make_continent_lobes(rng)
    sample_width = math.ceil(WORLD_WIDTH / PREVIEW_SAMPLE_STEP)
    sample_height = math.ceil(WORLD_HEIGHT / PREVIEW_SAMPLE_STEP)
    image = Image.new("RGB", (sample_width, sample_height))
    pixels = image.load()
    region_counts: list[dict[str, int]] = [
        {} for _ in range(WORLD_REGIONS_W * WORLD_REGIONS_H)
    ]
    land_samples: list[dict[str, object]] = []

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
            if terrain != "water":
                land_samples.append({"point": (world_y, world_x), "biome": terrain})

    settlements = create_settlement_plan(seed, land_samples, players, civilizations, bandit_camps, settlement_disparity)

    image = image.resize((WORLD_WIDTH * scale, WORLD_HEIGHT * scale), Image.Resampling.NEAREST)

    image = image.convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw_region_grid(draw, scale)
    draw_settlements(draw, scale, settlements)
    if labels:
        draw_region_labels(draw, scale)

    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    iso_output = output.with_name(f"{output.stem}-iso{output.suffix}")
    iso_bounds = draw_iso_preview(iso_output, scale, labels, seed, continent_lobes, biome_sectors, settlements)
    iso_preview = {
        "path": iso_output.name,
        "width": iso_bounds["width"],
        "height": iso_bounds["height"],
        "offsetX": iso_bounds["offsetX"],
        "offsetY": iso_bounds["offsetY"],
        "halfWidth": iso_bounds["halfWidth"],
        "halfHeight": iso_bounds["halfHeight"],
    }
    if json_out:
        write_regions_json(seed, json_out, biome_sectors, continent_lobes, region_counts, settlements, iso_preview)


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
    parser.add_argument("--players", type=int, default=DEFAULT_PLAYERS, help="Number of civilization starting villages.")
    parser.add_argument(
        "--civilizations",
        default="",
        help="Comma-separated civilization names used for starting villages, or 'all'.",
    )
    parser.add_argument("--bandit-camps", type=int, default=DEFAULT_BANDIT_CAMPS, help="Number of bandit camps.")
    parser.add_argument(
        "--settlement-disparity",
        type=float,
        default=0.35,
        help="How unevenly settlements may spread, from 0.0 to 0.85.",
    )
    parser.add_argument("--no-labels", action="store_true", help="Hide region coordinates.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = args.out if args.out.is_absolute() else ROOT / args.out
    json_out = args.json_out if not args.json_out or args.json_out.is_absolute() else ROOT / args.json_out
    biome_sectors = [normalize_biome(biome) for biome in split_csv(args.biomes)]
    unknown_biomes = [biome for biome in biome_sectors if biome not in COLORS]
    if unknown_biomes:
        known = ", ".join(sorted(name for name in COLORS if name != "grid"))
        raise SystemExit(f"Unknown biome(s): {', '.join(unknown_biomes)}. Known biomes: {known}.")

    civilizations = resolve_civilizations(args.civilizations)
    players = args.players or len(civilizations)

    generate(
        args.seed,
        output,
        args.scale,
        labels=not args.no_labels,
        biome_sectors=biome_sectors,
        json_out=json_out,
        players=players,
        civilizations=civilizations,
        bandit_camps=args.bandit_camps,
        settlement_disparity=args.settlement_disparity,
    )
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
