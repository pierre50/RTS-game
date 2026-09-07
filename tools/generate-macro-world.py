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
DEFAULT_LAND_MASK = ROOT / "public" / "maps" / "world-masks" / "continent-001.png"

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


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def make_continent_lobes(rng: random.Random) -> list[tuple[float, float, float, float]]:
    return [
        (rng.uniform(0.18, 0.30), rng.uniform(0.38, 0.54), rng.uniform(0.28, 0.36), rng.uniform(0.42, 0.52)),
        (rng.uniform(0.45, 0.58), rng.uniform(0.43, 0.57), rng.uniform(0.36, 0.44), rng.uniform(0.46, 0.58)),
        (rng.uniform(0.70, 0.82), rng.uniform(0.40, 0.56), rng.uniform(0.28, 0.38), rng.uniform(0.42, 0.55)),
        (rng.uniform(0.42, 0.58), rng.uniform(0.68, 0.78), rng.uniform(0.38, 0.48), rng.uniform(0.25, 0.34)),
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


def terrain_cell(grid: list[list[str]], x: int, y: int) -> str:
    return grid[min(WORLD_HEIGHT - 1, max(0, y))][min(WORLD_WIDTH - 1, max(0, x))]


def count_land_neighbors(land: list[list[bool]], x: int, y: int) -> int:
    count = 0
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            nx = x + dx
            ny = y + dy
            if 0 <= nx < WORLD_WIDTH and 0 <= ny < WORLD_HEIGHT and land[ny][nx]:
                count += 1
    return count


def keep_largest_land_component(land: list[list[bool]]) -> None:
    visited = [[False for _x in range(WORLD_WIDTH)] for _y in range(WORLD_HEIGHT)]
    best: list[tuple[int, int]] = []
    for y in range(WORLD_HEIGHT):
        for x in range(WORLD_WIDTH):
            if not land[y][x] or visited[y][x]:
                continue
            visited[y][x] = True
            component = [(x, y)]
            queue = [(x, y)]
            for qx, qy in queue:
                for nx, ny in ((qx - 1, qy), (qx + 1, qy), (qx, qy - 1), (qx, qy + 1)):
                    if nx < 0 or ny < 0 or nx >= WORLD_WIDTH or ny >= WORLD_HEIGHT:
                        continue
                    if visited[ny][nx] or not land[ny][nx]:
                        continue
                    visited[ny][nx] = True
                    component.append((nx, ny))
                    queue.append((nx, ny))
            if len(component) > len(best):
                best = component

    keep = set(best)
    for y in range(WORLD_HEIGHT):
        for x in range(WORLD_WIDTH):
            land[y][x] = (x, y) in keep


def fill_small_water_holes(land: list[list[bool]], max_size: int = 180) -> None:
    visited = [[False for _x in range(WORLD_WIDTH)] for _y in range(WORLD_HEIGHT)]
    for y in range(WORLD_HEIGHT):
        for x in range(WORLD_WIDTH):
            if land[y][x] or visited[y][x]:
                continue
            visited[y][x] = True
            touches_edge = x == 0 or y == 0 or x == WORLD_WIDTH - 1 or y == WORLD_HEIGHT - 1
            component = [(x, y)]
            queue = [(x, y)]
            for qx, qy in queue:
                for nx, ny in ((qx - 1, qy), (qx + 1, qy), (qx, qy - 1), (qx, qy + 1)):
                    if nx < 0 or ny < 0 or nx >= WORLD_WIDTH or ny >= WORLD_HEIGHT:
                        continue
                    if visited[ny][nx] or land[ny][nx]:
                        continue
                    visited[ny][nx] = True
                    touches_edge = touches_edge or nx == 0 or ny == 0 or nx == WORLD_WIDTH - 1 or ny == WORLD_HEIGHT - 1
                    component.append((nx, ny))
                    queue.append((nx, ny))
            if not touches_edge and len(component) <= max_size:
                for wx, wy in component:
                    land[wy][wx] = True


def smooth_land_edges(land: list[list[bool]]) -> None:
    for _pass in range(2):
        next_land = [row[:] for row in land]
        for y in range(1, WORLD_HEIGHT - 1):
            for x in range(1, WORLD_WIDTH - 1):
                neighbors = count_land_neighbors(land, x, y)
                if land[y][x] and neighbors <= 2:
                    next_land[y][x] = False
                elif not land[y][x] and neighbors >= 6:
                    next_land[y][x] = True
        land[:] = next_land


def distance_to_water(land: list[list[bool]]) -> list[list[int]]:
    max_distance = WORLD_WIDTH + WORLD_HEIGHT
    distances = [[max_distance for _x in range(WORLD_WIDTH)] for _y in range(WORLD_HEIGHT)]
    queue: list[tuple[int, int]] = []
    for y in range(WORLD_HEIGHT):
        for x in range(WORLD_WIDTH):
            if not land[y][x]:
                distances[y][x] = 0
                queue.append((x, y))
    cursor = 0
    while cursor < len(queue):
        x, y = queue[cursor]
        cursor += 1
        next_distance = distances[y][x] + 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= WORLD_WIDTH or ny >= WORLD_HEIGHT:
                continue
            if distances[ny][nx] <= next_distance:
                continue
            distances[ny][nx] = next_distance
            queue.append((nx, ny))
    return distances


def load_land_mask_image(mask_path: Path) -> list[list[bool]] | None:
    if not mask_path.exists():
        return None
    source = Image.open(mask_path).convert("L")
    bbox = source.point(lambda value: 255 if value >= 128 else 0).getbbox()
    if bbox:
        left, top, right, bottom = bbox
        margin = int(max(right - left, bottom - top) * 0.035)
        source = source.crop(
            (
                max(0, left - margin),
                max(0, top - margin),
                min(source.width, right + margin),
                min(source.height, bottom + margin),
            )
        )
    image = source.resize((WORLD_WIDTH, WORLD_HEIGHT), Image.Resampling.BILINEAR)
    pixels = image.load()
    land = [[False for _x in range(WORLD_WIDTH)] for _y in range(WORLD_HEIGHT)]
    for y in range(WORLD_HEIGHT):
        for x in range(WORLD_WIDTH):
            land[y][x] = pixels[x, y] >= 128

    keep_largest_land_component(land)
    fill_small_water_holes(land, max_size=80)
    keep_largest_land_component(land)
    return land


def build_land_mask(
    seed: int,
    continent_lobes: list[tuple[float, float, float, float]],
    land_mask: Path | None = DEFAULT_LAND_MASK,
) -> list[list[bool]]:
    if land_mask:
        loaded = load_land_mask_image(land_mask if land_mask.is_absolute() else ROOT / land_mask)
        if loaded:
            return loaded

    land = [[False for _x in range(WORLD_WIDTH)] for _y in range(WORLD_HEIGHT)]
    for y in range(WORLD_HEIGHT):
        ny = y / max(1, WORLD_HEIGHT - 1)
        for x in range(WORLD_WIDTH):
            nx = x / max(1, WORLD_WIDTH - 1)
            warp_x = (fbm(nx * 2.2, ny * 2.2, seed + 211, 4) - 0.5) * 0.09
            warp_y = (fbm(nx * 2.1, ny * 2.1, seed + 307, 4) - 0.5) * 0.09
            value = continent_value(nx + warp_x, ny + warp_y, seed, continent_lobes)
            shore_noise = fbm(nx * 34.0, ny * 34.0, seed + 419, 2) - 0.5
            land[y][x] = value + shore_noise * 0.035 >= 0.015

    smooth_land_edges(land)
    keep_largest_land_component(land)
    fill_small_water_holes(land)
    keep_largest_land_component(land)
    return land


def biome_scores_at(x: int, y: int, seed: int, coast_distance: int) -> dict[str, float]:
    nx = x / max(1, WORLD_WIDTH - 1)
    ny = y / max(1, WORLD_HEIGHT - 1)
    climate_noise = fbm(nx * 3.0, ny * 3.0, seed + 1703, 4) - 0.5
    dry_noise = fbm(nx * 4.6, ny * 4.6, seed + 1901, 4) - 0.5
    coastal_humidity = 1.0 - smoothstep(min(1.0, coast_distance / 92.0))
    west_humidity = 1.0 - smoothstep(nx)
    east_dryness = smoothstep(nx)
    north = 1.0 - smoothstep(ny)
    south = smoothstep(ny)

    humidity = max(0.0, min(1.0, coastal_humidity * 0.48 + west_humidity * 0.34 + climate_noise * 0.28 + 0.26))
    dryness = max(0.0, min(1.0, east_dryness * 0.42 + south * 0.42 + dry_noise * 0.24 + (1.0 - humidity) * 0.35))

    return {
        "blackforest": north * 1.1 + humidity * 0.58 + climate_noise * 0.2 - south * 0.38,
        "temperate": (1.0 - nx) * 0.82 + humidity * 0.55 + (1.0 - abs(ny - 0.48) * 2.0) * 0.28,
        "steppe": nx * 0.92 + dryness * 0.52 + (1.0 - abs(ny - 0.50) * 2.0) * 0.24,
        "desert": south * 1.08 + dryness * 0.78 - humidity * 0.42,
    }


def choose_biome(x: int, y: int, seed: int, scores: dict[str, float], biomes: list[str]) -> str:
    allowed_scores = {biome: scores[biome] for biome in biomes if biome in scores}
    if not allowed_scores:
        return biomes[0]
    values = sorted(allowed_scores.items(), key=lambda item: item[1], reverse=True)
    best, best_score = values[0]
    if len(values) == 1:
        return best
    second, second_score = values[1]
    blend = max(0.0, min(1.0, 1.0 - (best_score - second_score) / 0.22))
    patch_noise = fbm(x * 0.035, y * 0.035, seed + 2309, 3)
    if blend > 0.35 and patch_noise < 0.32 + blend * 0.24:
        return second
    return best


def build_macro_terrain_grid(
    seed: int,
    continent_lobes: list[tuple[float, float, float, float]],
    biome_sectors: list[str],
    land_mask: Path | None,
) -> list[list[str]]:
    if not biome_sectors:
        raise ValueError("At least one biome sector is required")
    land = build_land_mask(seed, continent_lobes, land_mask)

    for y in range(WORLD_HEIGHT):
        ny = y / max(1, WORLD_HEIGHT - 1)
        for x in range(WORLD_WIDTH):
            nx = x / max(1, WORLD_WIDTH - 1)
            if not land[y][x]:
                continue
            lake_noise = fbm(nx * 11.0, ny * 11.0, seed + 503, 4)
            basin_noise = fbm(nx * 3.8, ny * 3.8, seed + 809, 3)
            if 0.18 < nx < 0.84 and 0.20 < ny < 0.80 and lake_noise < 0.145 and basin_noise < 0.34:
                land[y][x] = False

    fill_small_water_holes(land, max_size=80)
    keep_largest_land_component(land)
    distances = distance_to_water(land)
    terrain = [["water" for _x in range(WORLD_WIDTH)] for _y in range(WORLD_HEIGHT)]
    for y in range(WORLD_HEIGHT):
        for x in range(WORLD_WIDTH):
            if not land[y][x]:
                continue
            scores = biome_scores_at(x, y, seed, distances[y][x])
            terrain[y][x] = choose_biome(x, y, seed, scores, biome_sectors)
    return terrain


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
    terrain_grid: list[list[str]],
    settlements: list[dict[str, object]],
) -> dict[str, float]:
    bounds = iso_preview_bounds(scale)
    image = Image.new("RGBA", (int(bounds["width"]), int(bounds["height"])), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    step = PREVIEW_SAMPLE_STEP
    for world_i in range(0, WORLD_HEIGHT, step):
        for world_j in range(0, WORLD_WIDTH, step):
            terrain = terrain_cell(terrain_grid, world_j, world_i)
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
    terrain_grid: list[list[str]],
) -> list[str]:
    rows = []
    for local_i in range(REGION_MAP_SIZE + 1):
        row = []
        for local_j in range(REGION_MAP_SIZE + 1):
            world_x = min(WORLD_WIDTH - 1, region_x * REGION_MAP_SIZE + local_j)
            world_y = min(WORLD_HEIGHT - 1, region_y * REGION_MAP_SIZE + local_i)
            terrain = terrain_cell(terrain_grid, world_x, world_y)
            row.append(TERRAIN_CODES[terrain])
        rows.append("".join(row))
    return rows


def write_regions_json(
    seed: int,
    output: Path,
    biome_sectors: list[str],
    terrain_grid: list[list[str]],
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
                    "terrainRows": encoded_region_terrain_rows(region_x, region_y, terrain_grid),
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
    land_mask: Path | None,
    json_out: Path | None,
    players: int,
    civilizations: list[str],
    bandit_camps: int,
    settlement_disparity: float,
) -> None:
    rng = random.Random(seed)
    continent_lobes = make_continent_lobes(rng)
    terrain_grid = build_macro_terrain_grid(seed, continent_lobes, biome_sectors, land_mask)
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
            terrain = terrain_cell(terrain_grid, world_x, world_y)
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
    iso_bounds = draw_iso_preview(iso_output, scale, labels, terrain_grid, settlements)
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
        write_regions_json(seed, json_out, biome_sectors, terrain_grid, region_counts, settlements, iso_preview)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a 20-region macro world preview PNG.")
    parser.add_argument("--seed", type=int, default=12345, help="Reproducible macro-world seed.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT, help="Output PNG path.")
    parser.add_argument("--scale", type=int, default=1, choices=[1, 2, 3, 4], help="Preview pixel scale.")
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUTPUT, help="Macro-region JSON output path.")
    parser.add_argument(
        "--land-mask",
        type=Path,
        default=DEFAULT_LAND_MASK,
        help="Black/white source mask used for land and water.",
    )
    parser.add_argument("--no-land-mask", action="store_true", help="Use procedural continent generation instead.")
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
    land_mask = None if args.no_land_mask else args.land_mask
    if land_mask and not land_mask.is_absolute():
        land_mask = ROOT / land_mask
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
        land_mask=land_mask,
        json_out=json_out,
        players=players,
        civilizations=civilizations,
        bandit_camps=args.bandit_camps,
        settlement_disparity=args.settlement_disparity,
    )
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
