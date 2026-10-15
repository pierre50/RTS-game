#!/usr/bin/env python3
"""Stylized ("Animal Crossing"-like) pine models for the game's tree sprites.

The look comes from geometry and vertex colours, not textures:
  - a thick brown trunk flaring into roots, with light oval spots;
  - three stacked cone tiers, each a solid cone covered in rows of small rounded scales laid on its slope
    (dark at the scale's base, bright at its tip), the lowest row overhanging the tier's edge.
Proportions follow the reference style; the sprite only decides the variant: crown spread comes from its
silhouette and snowy sprites get white scale tips.

Output overwrites public/assets/prototypes/sprite-projected/<name>.glb, which the Babylon prototype loads in its
third resource mode (?babylon-terrain&projected).

Usage:
  python3 scripts/stylized_tree.py                       # the four dark-forest pines
  python3 scripts/stylized_tree.py SHEET FRAME OUT_NAME
"""

from __future__ import annotations

import io
import json
import math
import random
import struct
import sys
from array import array
from pathlib import Path

from PIL import Image

from sprite_to_model import OUT_DIR, extract_profile, load_frame

# Model units; the Babylon layer rescales every model to its category height.
HEIGHT = 1.0
TRUNK_TOP = 0.48  # trunk visible below the crown, as in the reference
TRUNK_RADIUS = 0.11
ROOTS = 4
# (bottom height, top height, bottom radius) per tier, from the reference proportions.
TIERS = [(0.40, 0.72, 0.46), (0.60, 0.88, 0.34), (0.77, 1.0, 0.22)]
ROWS_PER_TIER = 4
SCALE_SIDES = 6

GREENS = ((0.10, 0.36, 0.10), (0.20, 0.58, 0.14), (0.55, 0.82, 0.25))  # base, body, tip
SNOW_TIP = (0.93, 0.96, 1.0)
BARK = ((0.36, 0.20, 0.10), (0.52, 0.32, 0.17))  # dark, light
BARK_SPOT = (0.86, 0.72, 0.50)

# Optional painted texture (reports/sprite-projection/pine-stylized-texture.png): rows of branches on top, a bark band
# at the bottom. Each scale row takes one branch band (its lit tips at the scale's tip); the bark wraps the trunk.
TEXTURE = Path(__file__).resolve().parent.parent / "reports/sprite-projection/pine-stylized-texture.png"
FOLIAGE_V = (0.02, 0.83)
FOLIAGE_BANDS = 7
BARK_V = (0.87, 0.99)
SCALE_U = 0.05  # texture width covered by one scale (the image wraps around the tree several times)

DEFAULT_JOBS = [("resources/tree/dark-forest", frame, f"tree_dark-forest_{frame:03d}") for frame in range(4)]


class Mesh:
    def __init__(self):
        self.positions, self.normals, self.colors, self.uvs, self.indices = [], [], [], [], []

    def vertex(self, position, normal, color, uv=(0.0, 0.0)) -> int:
        self.uvs.append(tuple(uv))
        self.positions.append(tuple(position))
        self.normals.append(tuple(normal))
        self.colors.append(tuple(min(1.0, max(0.0, c)) for c in color))
        return len(self.positions) - 1

    def triangle(self, a, b, c):
        # Both windings: the baked glTF mirror and the cupped scales make one-sided faces unreliable.
        self.indices += [a, b, c, a, c, b]


def normalize(v):
    length = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / length for c in v)


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def is_snowy(sprite) -> bool:
    pixels = sprite.load()
    bright = total = 0
    for y in range(sprite.height):
        for x in range(sprite.width):
            r, g, b, a = pixels[x, y]
            if a >= 128:
                total += 1
                bright += min(r, g, b) > 170
    return bright > total * 0.08


def add_scale(mesh: Mesh, base, down, side, normal, length, width, colors, rng, u0=0.0, band=0):
    """A rounded scale lying on the cone: base at `base`, hanging along `down`, slightly lifted at its tip."""
    base_color, body_color, tip_color = colors
    shade = rng.uniform(-0.04, 0.04)
    lift = 0.18 * length

    def point(along, across):
        return tuple(base[i] + down[i] * along * length + side[i] * across * width
                     + normal[i] * lift * along * (1 - abs(across) * 1.6) for i in range(3))

    def color(along):
        c = mix(base_color, body_color, min(1.0, along * 1.8)) if along < 0.55 else mix(body_color, tip_color,
                                                                                       (along - 0.55) / 0.45)
        return tuple(x + shade for x in c)

    band_top = FOLIAGE_V[0] + (FOLIAGE_V[1] - FOLIAGE_V[0]) * band / FOLIAGE_BANDS
    band_height = (FOLIAGE_V[1] - FOLIAGE_V[0]) / FOLIAGE_BANDS

    def uv(along, across):
        # Mostly the band's lit lower part (the dark core hides under the overlapping row), tip on its lit edge.
        return (u0 + across * SCALE_U, band_top + band_height * (0.3 + 0.7 * along))

    centre = mesh.vertex(point(0.45, 0.0), normal, color(0.45), uv(0.45, 0.0))
    rim = []
    for k in range(SCALE_SIDES):
        t = 2 * math.pi * k / SCALE_SIDES
        along = 0.45 - 0.45 * math.cos(t) * (1.1 if math.cos(t) < 0 else 1.0)
        across = 0.5 * math.sin(t)
        rim.append(mesh.vertex(point(along, across), normal, color(along), uv(along, across)))
    for k in range(SCALE_SIDES):
        mesh.triangle(centre, rim[k], rim[(k + 1) % SCALE_SIDES])


def add_tier(mesh: Mesh, bottom_y, top_y, radius, colors, rng, first_band=0):
    # Solid cone under the scales, slightly smaller so only scales show at the edge.
    sides = 14
    core_r = radius * 0.82
    core_v = FOLIAGE_V[0] + (FOLIAGE_V[1] - FOLIAGE_V[0]) * 0.5 / FOLIAGE_BANDS
    apex = mesh.vertex((0, top_y - 0.02, 0), (0, 1, 0), colors[1], (0.5, core_v))
    ring = []
    for k in range(sides):
        a = 2 * math.pi * k / sides
        n = normalize((math.sin(a), core_r / (top_y - bottom_y), math.cos(a)))
        ring.append(mesh.vertex((math.sin(a) * core_r, bottom_y + 0.04, math.cos(a) * core_r), n, colors[0],
                                (k / sides, core_v)))
    under = mesh.vertex((0, bottom_y + 0.09, 0), (0, -1, 0), mix(colors[0], (0, 0, 0), 0.35), (0.5, core_v))
    for k in range(sides):
        mesh.triangle(apex, ring[k], ring[(k + 1) % sides])
        mesh.triangle(under, ring[(k + 1) % sides], ring[k])

    # Rows of scales from the apex down; the last row hangs past the cone's rim.
    slope_len = math.hypot(radius, top_y - bottom_y)
    for row in range(ROWS_PER_TIER):
        t = (row + 1) / ROWS_PER_TIER
        y = top_y - (top_y - bottom_y) * t * 0.92
        r = radius * t * 0.92
        length = slope_len / ROWS_PER_TIER * (1.7 if row == ROWS_PER_TIER - 1 else 1.45)
        width = length * 0.85
        count = max(5, round(2 * math.pi * r / (width * 0.62)))
        offset = (row % 2) * math.pi / count + rng.uniform(-0.1, 0.1)
        for k in range(count):
            a = offset + 2 * math.pi * k / count
            out = (math.sin(a), 0.0, math.cos(a))
            droop = 1.35 if row == ROWS_PER_TIER - 1 else 1.0
            down = normalize((out[0] * radius, -(top_y - bottom_y) * droop, out[2] * radius))
            side = (math.cos(a), 0.0, -math.sin(a))
            normal = normalize((out[0] * (top_y - bottom_y), radius, out[2] * (top_y - bottom_y)))
            back = length * 0.35 / slope_len
            base = (out[0] * (r - radius * back), y + (top_y - bottom_y) * back, out[2] * (r - radius * back))
            add_scale(mesh, base, down, side, normal, length, width, colors, rng,
                      u0=a / (2 * math.pi) * 6 % 1.0, band=(first_band + row) % FOLIAGE_BANDS)


def add_trunk(mesh: Mesh, rng, textured: bool = False):
    sides, rings = 20, 10
    top = TRUNK_TOP + 0.12  # tucked into the lowest tier
    spots = [(rng.uniform(0, 2 * math.pi), rng.uniform(0.12, top - 0.05)) for _ in range(9)]
    stride = sides + 1
    first = len(mesh.positions)
    for ring in range(rings):
        h = ring / (rings - 1)
        y = top * h
        flare = max(0.0, 1 - h / 0.3) ** 2
        for k in range(sides + 1):
            a = 2 * math.pi * k / sides
            lobes = max(0.0, math.cos(ROOTS * a)) ** 2
            r = TRUNK_RADIUS * (1 - 0.15 * h) * (1 + 1.4 * flare * lobes)
            color = mix(BARK[0], BARK[1], 0.4 + 0.6 * h) if not textured else (0.85 + 0.15 * h,) * 3
            for sa, sy in ([] if textured else spots):
                da = math.atan2(math.sin(a - sa), math.cos(a - sa))
                if (da / 0.32) ** 2 + ((y - sy) / 0.05) ** 2 < 1:
                    color = BARK_SPOT
            mesh.vertex((math.sin(a) * r, y, math.cos(a) * r), normalize((math.sin(a), 0.2, math.cos(a))), color,
                        (k / sides * 2, BARK_V[1] - (BARK_V[1] - BARK_V[0]) * h))
    for ring in range(rings - 1):
        for k in range(sides):
            a = first + ring * stride + k
            mesh.triangle(a, a + 1, a + stride)
            mesh.triangle(a + 1, a + stride + 1, a + stride)


def build_pine(sprite, seed: str) -> Mesh:
    rng = random.Random(seed)
    snowy = is_snowy(sprite)
    textured = TEXTURE.exists() and not snowy
    # With the painted texture, vertex colours only add a soft base-to-tip shading over it.
    colors = (((0.9,) * 3, (1.0,) * 3, (1.0,) * 3) if textured
              else (GREENS[0], GREENS[1], SNOW_TIP if snowy else GREENS[2]))
    # Crown spread follows the sprite (width / height), so the four variants stay distinguishable.
    _, profile, _ = extract_profile(sprite)
    ratio = max(r for _, r in profile) / max(1, len(profile))
    spread = min(1.15, max(0.9, ratio / 0.36))
    mesh = Mesh()
    add_trunk(mesh, rng, textured)
    for index, (bottom, top, radius) in enumerate(TIERS):
        add_tier(mesh, bottom * HEIGHT, top * HEIGHT, radius * spread * HEIGHT, colors, rng, first_band=index * 2)
    mesh.textured = textured
    return mesh


def write_glb(path: Path, mesh: Mesh, name: str) -> None:
    binary = bytearray()
    views, accessors = [], []

    def accessor(values, kind: str, component: int, target: int) -> int:
        while len(binary) % 4:
            binary.append(0)
        flat = [c for value in values for c in (value if isinstance(value, tuple) else (value,))]
        raw = array("f" if component == 5126 else "I", flat).tobytes()
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(raw), "target": target})
        binary.extend(raw)
        entry = {"bufferView": len(views) - 1, "componentType": component, "count": len(values), "type": kind}
        if kind == "VEC3":
            entry["min"] = [min(v[i] for v in values) for i in range(3)]
            entry["max"] = [max(v[i] for v in values) for i in range(3)]
        accessors.append(entry)
        return len(accessors) - 1

    attributes = {
        "POSITION": accessor(mesh.positions, "VEC3", 5126, 34962),
        "NORMAL": accessor(mesh.normals, "VEC3", 5126, 34962),
        # VEC3 on purpose: a VEC4 colour makes Babylon's glTF loader set hasVertexAlpha, which renders the trees
        # alpha-blended and sorted per instance batch instead of depth-tested: trees behind pop in front.
        "COLOR_0": accessor(mesh.colors, "VEC3", 5126, 34962),
    }
    material = {"name": f"stylized {name}", "pbrMetallicRoughness": {"metallicFactor": 0, "roughnessFactor": 1}}
    extra = {}
    if getattr(mesh, "textured", False):
        attributes["TEXCOORD_0"] = accessor(mesh.uvs, "VEC2", 5126, 34962)
        png = io.BytesIO()
        texture = Image.open(TEXTURE).convert("RGB")
        # ~4x smaller keeps the pixel-art grain readable on a tree a few cells tall.
        texture.resize((texture.width // 4, texture.height // 4), Image.NEAREST).save(png, "PNG")
        while len(binary) % 4:
            binary.append(0)
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(png.getvalue())})
        binary.extend(png.getvalue())
        material["pbrMetallicRoughness"]["baseColorTexture"] = {"index": 0}
        extra = {"images": [{"bufferView": len(views) - 1, "mimeType": "image/png"}],
                 "samplers": [{"magFilter": 9728, "minFilter": 9728, "wrapS": 10497, "wrapT": 33071}],
                 "textures": [{"sampler": 0, "source": 0}]}
    indices = accessor(mesh.indices, "SCALAR", 5125, 34963)
    gltf = {
        "asset": {"version": "2.0", "generator": "scripts/stylized_tree.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": [{"attributes": attributes, "indices": indices, "material": 0}]}],
        "materials": [material],
        "bufferViews": views,
        "accessors": accessors,
        **extra,
    }
    while len(binary) % 4:
        binary.append(0)
    gltf["buffers"] = [{"byteLength": len(binary)}]
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
    json_bytes += b" " * (-len(json_bytes) % 4)
    with path.open("wb") as out:
        out.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(json_bytes) + 8 + len(binary)))
        out.write(struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes)
        out.write(struct.pack("<I4s", len(binary), b"BIN\0") + bytes(binary))


def build(sheet: str, frame: int, out_name: str) -> None:
    mesh = build_pine(load_frame(sheet, frame), out_name)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_glb(OUT_DIR / f"{out_name}.glb", mesh, out_name)
    print(f"{out_name}: {sheet}#{frame:03d}, {len(mesh.indices) // 3} triangles")


def main() -> None:
    jobs = [(sys.argv[1], int(sys.argv[2]), sys.argv[3])] if len(sys.argv) == 4 else DEFAULT_JOBS
    for job in jobs:
        build(*job)


if __name__ == "__main__":
    main()
