#!/usr/bin/env python3
"""Build a 3D model straight from an isometric tree sprite (surface of revolution).

A tree sprite is the side view of a roughly round object, so its silhouette is its profile: for every sprite row,
the half-width of the opaque pixels around the trunk axis is the radius at that height. That profile (with the
branch tiers' zigzag and the trunk showing only at the bottom) is simplified and spun around the vertical axis.
Each vertex samples the sprite at its own row; around the trunk the angle maps linearly across the sprite's width
(front half left→right, back half mirrored), so every side shows the sprite's real branches without the edge
stretching of a cylindrical projection.

Outputs, per job (reports/ = reports/sprite-projection/):
  - public/assets/prototypes/sprite-projected/<name>.glb   the model with its UV texture embedded
  - reports/<name>-guide.png        sprite with the extracted profile drawn on it
  - reports/<name>-uv-template.png  the unwrap layout (×4): u = around the trunk (pink edges join), v = apex
                                    (top) to trunk base (bottom); one band per real branch tier (yellow line = its
                                    lit edge), brown = trunk
  - reports/<name>-uv-start.png     that unwrap filled from the sprite, at texture size
Drop a repainted reports/<name>-uv-painted.png (same layout, any size) and rerun: it becomes the texture,
snapped to the sprite's own palette.

Usage:
  python3 scripts/sprite_to_model.py                     # default jobs: the four dark-forest pines
  python3 scripts/sprite_to_model.py SHEET FRAME OUT_NAME
"""

from __future__ import annotations

import io
import json
import math
import struct
import sys
from array import array
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SHEETS = ROOT / "public/assets/graphics"
OUT_DIR = ROOT / "public/assets/prototypes/sprite-projected"
GUIDE_DIR = ROOT / "reports/sprite-projection"
GUIDE_SCALE = 3
SIDES = 16
# Foliage texture lift (gamma < 1): a 3D surface shows the sprite's shaded core that the 2D view hides behind
# its lit branch tips, so the same pixels read darker on the model.
FOLIAGE_GAMMA = 0.75
# Profile simplification tolerance, in sprite pixels: keeps the tier zigzag, drops single-pixel noise.
SIMPLIFY = 1.2
# Vertical lines are foreshortened by cos(30°) under the game camera: undo it to recover real heights.
UPRIGHT = 1 / math.cos(math.radians(30))
# One sprite pixel in model units (the layer rescales models to their category height anyway).
UNIT = 0.01

DEFAULT_JOBS = [
    ("resources/tree/dark-forest", frame, f"tree_dark-forest_{frame:03d}") for frame in range(4)
]


# --- sprite ----------------------------------------------------------------------------------------------

def load_frame(sheet: str, frame: int) -> Image.Image:
    folder = SHEETS / sheet
    meta = json.loads((folder / "texture.json").read_text())
    prefix = f"{frame:03d}_"
    name = next(key for key in meta["frames"] if key.startswith(prefix))
    rect = meta["frames"][name]["frame"]
    image = Image.open(folder / meta.get("meta", {}).get("image", "texture.png")).convert("RGBA")
    return image.crop((rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"]))


def bleed(sprite: Image.Image) -> Image.Image:
    """Grows edge colours outward so samples landing just outside the silhouette never read transparency."""
    width, height = sprite.size
    result = sprite.copy()
    out = result.load()
    filled = {(x, y) for y in range(height) for x in range(width) if out[x, y][3] >= 128}
    for _ in range(4):
        grown = []
        for y in range(height):
            for x in range(width):
                if (x, y) in filled:
                    continue
                near = [out[n] for n in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)) if n in filled]
                if near:
                    grown.append(((x, y), tuple(sum(c[i] for c in near) // len(near) for i in range(3))))
        for point, color in grown:
            out[point] = (*color, 255)
            filled.add(point)
    for y in range(height):
        for x in range(width):
            r, g, b, _ = out[x, y]
            out[x, y] = (r, g, b, 255)
    return result


def extract_profile(sprite: Image.Image) -> tuple[float, list[tuple[float, float]], int]:
    """(axis x, [(row, radius)] from top to bottom, first trunk row), all in sprite pixels."""
    width, height = sprite.size
    pixels = sprite.load()
    opaque = [[x for x in range(width) if pixels[x, y][3] >= 128] for y in range(height)]

    def leafy(x, y):
        r, g, b, _ = pixels[x, y]
        return g > r or min(r, g, b) > 150  # green, or snow on the branches

    trunk_top = height
    for y in range(height - 1, -1, -1):
        if sum(1 for x in opaque[y] if leafy(x, y)) >= 3:
            trunk_top = y + 1
            break
    trunk_rows = [row for row in opaque[trunk_top:] if row]
    axis = (sum(sum(row) / len(row) for row in trunk_rows) / len(trunk_rows)) if trunk_rows else width / 2
    profile = []
    for y in range(height):
        if opaque[y]:
            # Mean of both sides: an isometric sprite is close to, but not exactly, symmetric.
            radius = (max(opaque[y]) + 1 - min(opaque[y])) / 2
            profile.append((y + 0.5, max(0.5, radius)))
    return axis, profile, trunk_top


def simplify(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Ramer–Douglas–Peucker on (row, radius)."""
    if len(points) < 3:
        return points
    (y0, r0), (y1, r1) = points[0], points[-1]
    length = math.hypot(y1 - y0, r1 - r0) or 1.0
    distances = [abs((r1 - r0) * y - (y1 - y0) * r + y1 * r0 - r1 * y0) / length for y, r in points[1:-1]]
    index = max(range(len(distances)), key=distances.__getitem__)
    if distances[index] <= tolerance:
        return [points[0], points[-1]]
    split = index + 1
    return simplify(points[:split + 1], tolerance)[:-1] + simplify(points[split:], tolerance)


# --- mesh ------------------------------------------------------------------------------------------------

def build_mesh(sprite: Image.Image):
    width, height = sprite.size
    axis, raw_profile, trunk_top = extract_profile(sprite)
    foliage = simplify([p for p in raw_profile if p[0] < trunk_top], SIMPLIFY)
    trunk = simplify([p for p in raw_profile if p[0] >= trunk_top], SIMPLIFY)
    # Apex closed at the top, a flat step under the lowest branches, and a cap under the trunk.
    rings = [(foliage[0][0] - 0.5, 0.0)] + foliage
    if trunk:
        rings += [(foliage[-1][0] + 0.5, trunk[0][1])] + trunk
    rings += [(rings[-1][0] + 0.5, 0.0)]

    # Unwrap: u = angle around the trunk, v = distance travelled down the profile (even texel density).
    arcs = [0.0]
    for (row0, radius0), (row1, radius1) in zip(rings, rings[1:]):
        arcs.append(arcs[-1] + math.hypot((row1 - row0) * UPRIGHT, radius1 - radius0))
    positions, normals, uvs, indices = [], [], [], []
    for index, (row, radius) in enumerate(rings):
        # Normal from the profile slope around this ring (radius change per height change).
        before = rings[max(0, index - 1)]
        after = rings[min(len(rings) - 1, index + 1)]
        d_radius = after[1] - before[1]
        d_height = (after[0] - before[0]) * UPRIGHT
        for side in range(SIDES + 1):
            angle = 2 * math.pi * side / SIDES
            x, z = math.sin(angle), math.cos(angle)
            positions.append((x * radius * UNIT, (height - row) * UPRIGHT * UNIT, z * radius * UNIT))
            nx, ny = d_height, d_radius  # outward radial component, upward component (unnormalised)
            length = math.hypot(nx, ny) or 1.0
            normals.append((x * nx / length, ny / length, z * nx / length))
            uvs.append((side / SIDES, arcs[index] / arcs[-1]))
    stride = SIDES + 1
    for ring in range(len(rings) - 1):
        for side in range(SIDES):
            a = ring * stride + side
            b = a + stride
            indices += [a, b, a + 1, a + 1, b, b + 1]
    return positions, normals, uvs, indices, rings, arcs, axis, trunk_top


# --- UV texture ------------------------------------------------------------------------------------------

def texture_size(rings, arcs) -> tuple[int, int]:
    """About one texel per sprite pixel: width = widest circumference, height = profile length."""
    width = max(64, round(2 * math.pi * max(radius for _, radius in rings) / 16) * 16)
    return width, max(64, round(arcs[-1] / 16) * 16)


def ring_at(rings, arcs, v: float) -> tuple[float, float]:
    """(sprite row, radius) at a normalised position down the profile."""
    target = v * arcs[-1]
    for k in range(len(rings) - 1):
        if arcs[k + 1] >= target:
            t = (target - arcs[k]) / max(1e-6, arcs[k + 1] - arcs[k])
            return (rings[k][0] + (rings[k + 1][0] - rings[k][0]) * t,
                    rings[k][1] + (rings[k + 1][1] - rings[k][1]) * t)
    return rings[-1]


def starter_texture(sprite: Image.Image, rings, arcs, axis: float, size) -> Image.Image:
    """The unwrap filled from the sprite (each row from its sprite row, the turn sweeping the sprite width)."""
    width, height = size
    source = sprite.load()
    texture = Image.new("RGBA", size)
    out = texture.load()
    for y in range(height):
        row, radius = ring_at(rings, arcs, (y + 0.5) / height)
        for x in range(width):
            phase = ((x + 0.5) / width * 2 + 0.5) % 2
            wave = (phase if phase <= 1 else 2 - phase) * 2 - 1
            column = axis + wave * radius * 0.95
            out[x, y] = source[min(sprite.width - 1, max(0, int(column))), min(sprite.height - 1, max(0, int(row)))]
    return texture


def tier_edges(sprite: Image.Image, trunk_top: int) -> list[int]:
    """Sprite rows where a branch tier ends: the silhouette is locally widest, then steps back inward."""
    _, profile, _ = extract_profile(sprite)
    radius = {int(row): r for row, r in profile}
    edges = []
    for row in sorted(radius):
        if row >= trunk_top - 1:
            break
        around = [radius.get(row + d, 0) for d in range(-3, 4)]
        below = [radius.get(row + d, 0) for d in range(1, 6)]
        if radius[row] >= max(around) and radius[row] - min(below) >= 2.5:
            if not edges or row - edges[-1] >= 6:
                edges.append(row)
            elif radius[row] > radius[edges[-1]]:
                edges[-1] = row
    return edges + [trunk_top]


def row_to_v(rings, arcs, row: float) -> float:
    """Normalised v of a sprite row, following the same profile the mesh was built from."""
    for k in range(len(rings) - 1):
        (row0, _), (row1, _) = rings[k], rings[k + 1]
        if row0 <= row <= row1 and row1 > row0:
            t = (row - row0) / (row1 - row0)
            return (arcs[k] + (arcs[k + 1] - arcs[k]) * t) / arcs[-1]
    return 0.0 if row < rings[0][0] else 1.0


def uv_template(sprite: Image.Image, rings, arcs, trunk_top: int, size, scale: int = 4) -> Image.Image:
    """The layout to paint: one band per real branch tier (dark core at its top, lit tips at its bottom edge),
    the trunk band at the bottom. Left and right edges join."""
    width, height = size
    W, H = width * scale, height * scale
    template = Image.new("RGBA", (W, H), (24, 26, 30, 255))
    draw = ImageDraw.Draw(template)
    edges = tier_edges(sprite, trunk_top)
    tops = [0.0] + [row_to_v(rings, arcs, row) for row in edges[:-1]]
    bottoms = [row_to_v(rings, arcs, row) for row in edges]
    for number, (top, bottom) in enumerate(zip(tops, bottoms), start=1):
        y0, y1 = top * H, bottom * H
        steps = max(1, int(y1 - y0))
        for k in range(steps):
            t = k / steps  # dark core at the top of the tier → lit tips at its edge
            draw.line((0, y0 + k, W, y0 + k), fill=(int(20 + 60 * t), int(60 + 140 * t), int(35 + 45 * t), 255))
        draw.line((0, y1 - 1, W, y1 - 1), fill=(255, 230, 90, 255), width=3)
        draw.text((8, y0 + 4), f"tier {number}: dark core", fill=(255, 255, 255, 255))
        draw.text((8, y1 - 18), "lit branch tips (tier edge)", fill=(255, 240, 150, 255))
    trunk_v = bottoms[-1] * H
    draw.rectangle((0, trunk_v, W, H), fill=(150, 70, 50, 255))
    draw.text((8, trunk_v + 4), "underside of the lowest tier, then trunk bark", fill=(255, 255, 255, 255))
    draw.line((0, 0, 0, H), fill=(255, 80, 200, 255), width=3)
    draw.line((W - 2, 0, W - 2, H), fill=(255, 80, 200, 255), width=3)
    draw.text((W - 170, 4), "pink edges join (tile)", fill=(255, 150, 230, 255))
    draw.text((W - 120, H - 16), "bottom = ground", fill=(255, 255, 255, 255))
    return template


def sprite_palette(sprite: Image.Image, rows: range) -> list[tuple[int, int, int]]:
    pixels = sprite.load()
    return sorted({pixels[x, y][:3] for y in rows for x in range(sprite.width) if pixels[x, y][3] >= 128})


def to_palette(texture: Image.Image, sprite: Image.Image, trunk_top: int, trunk_v: float) -> Image.Image:
    """Snaps every texel to the nearest sprite colour (weighted RGB), so a repaint keeps the game's palette.
    Foliage rows use the foliage colours only and the trunk band the trunk colours, so no bark speck lands
    in the needles."""
    # Foliage: green (or snow) tones only — bark peeking between the lowest branches is no needle colour —
    # lifted like the starter texture so the repaint does not fall back to the sprite's dark core.
    lift = [min(255, round(255 * (value / 255) ** FOLIAGE_GAMMA)) for value in range(256)]
    foliage = [tuple(lift[c] for c in color) for color in sprite_palette(sprite, range(0, trunk_top))
               if color[1] >= color[0] or min(color) > 150]
    palettes = (foliage, sprite_palette(sprite, range(trunk_top, sprite.height)))
    caches: tuple[dict, dict] = ({}, {})

    def nearest(color, part: int):
        cache = caches[part]
        if color not in cache:
            r, g, b = color
            cache[color] = min(palettes[part] or palettes[0],
                               key=lambda c: 2 * (c[0] - r) ** 2 + 4 * (c[1] - g) ** 2 + 3 * (c[2] - b) ** 2)
        return cache[color]

    result = texture.copy()
    pixels = result.load()
    for y in range(result.height):
        part = 1 if (y + 0.5) / result.height >= trunk_v else 0
        for x in range(result.width):
            r, g, b, _ = pixels[x, y]
            pixels[x, y] = (*nearest((r, g, b), part), 255)
    return result


# --- GLB writer ------------------------------------------------------------------------------------------

def write_glb(path: Path, positions, normals, uvs, indices, texture: Image.Image, name: str) -> None:
    binary = bytearray()
    views, accessors = [], []

    def add(data: bytes, target: int | None) -> int:
        while len(binary) % 4:
            binary.append(0)
        view = {"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)}
        if target:
            view["target"] = target
        binary.extend(data)
        views.append(view)
        return len(views) - 1

    def add_accessor(values, kind: str, component: int, target: int) -> int:
        flat = [c for value in values for c in (value if isinstance(value, tuple) else (value,))]
        view = add(array("f" if component == 5126 else "I", flat).tobytes(), target)
        accessor = {"bufferView": view, "componentType": component, "count": len(values), "type": kind}
        if kind == "VEC3":
            accessor["min"] = [min(v[i] for v in values) for i in range(3)]
            accessor["max"] = [max(v[i] for v in values) for i in range(3)]
        accessors.append(accessor)
        return len(accessors) - 1

    attributes = {
        "POSITION": add_accessor(positions, "VEC3", 5126, 34962),
        "NORMAL": add_accessor(normals, "VEC3", 5126, 34962),
        "TEXCOORD_0": add_accessor(uvs, "VEC2", 5126, 34962),
    }
    index_accessor = add_accessor(indices, "SCALAR", 5125, 34963)
    png = io.BytesIO()
    texture.save(png, "PNG")
    image_view = add(png.getvalue(), None)
    gltf = {
        "asset": {"version": "2.0", "generator": "scripts/sprite_to_model.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": [{"attributes": attributes, "indices": index_accessor, "material": 0}]}],
        "materials": [{"name": f"sprite {name}", "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1}}],
        "textures": [{"sampler": 0, "source": 0}],
        # Nearest (pixel art); repeat around the trunk so the u seam wraps, clamp top/bottom.
        "samplers": [{"magFilter": 9728, "minFilter": 9728, "wrapS": 10497, "wrapT": 33071}],
        "images": [{"bufferView": image_view, "mimeType": "image/png"}],
        "bufferViews": views,
        "accessors": accessors,
    }
    while len(binary) % 4:
        binary.append(0)
    gltf["buffers"] = [{"byteLength": len(binary)}]
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
    json_bytes += b" " * (-len(json_bytes) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    with path.open("wb") as out:
        out.write(struct.pack("<4sII", b"glTF", 2, total))
        out.write(struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes)
        out.write(struct.pack("<I4s", len(binary), b"BIN\0") + bytes(binary))


def lift_foliage(texture: Image.Image, trunk_top: int) -> Image.Image:
    pixels = texture.load()
    curve = [min(255, round(255 * (value / 255) ** FOLIAGE_GAMMA)) for value in range(256)]
    for y in range(min(trunk_top, texture.height)):
        for x in range(texture.width):
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (curve[r], curve[g], curve[b], a)
    return texture


def write_guide(sprite: Image.Image, rings, axis: float, trunk_top: int, path: Path) -> None:
    scale = GUIDE_SCALE
    guide = Image.new("RGBA", (sprite.width * scale, sprite.height * scale), (40, 44, 52, 255))
    guide.alpha_composite(sprite.resize(guide.size, Image.NEAREST))
    draw = ImageDraw.Draw(guide)
    for side in (-1, 1):
        points = [((axis + side * radius) * scale, row * scale) for row, radius in rings]
        draw.line(points, fill=(255, 220, 60, 255), width=2)
    draw.line([(axis * scale, 0), (axis * scale, sprite.height * scale)], fill=(255, 255, 255, 90), width=1)
    draw.line([(0, trunk_top * scale), (sprite.width * scale, trunk_top * scale)], fill=(255, 80, 80, 160), width=1)
    guide.save(path)


def build(sheet: str, frame: int, out_name: str) -> None:
    sprite = load_frame(sheet, frame)
    positions, normals, uvs, indices, rings, arcs, axis, trunk_top = build_mesh(sprite)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    GUIDE_DIR.mkdir(parents=True, exist_ok=True)
    size = texture_size(rings, arcs)
    uv_template(sprite, rings, arcs, trunk_top, size).save(GUIDE_DIR / f"{out_name}-uv-template.png")
    starter = starter_texture(lift_foliage(bleed(sprite), trunk_top), rings, arcs, axis, size)
    starter.save(GUIDE_DIR / f"{out_name}-uv-start.png")
    # A repainted texture (any size, same layout) takes over when present.
    painted_path = GUIDE_DIR / f"{out_name}-uv-painted.png"
    trunk_v = row_to_v(rings, arcs, trunk_top)
    texture = (to_palette(Image.open(painted_path).convert("RGBA").resize(size, Image.NEAREST), sprite, trunk_top, trunk_v)
               if painted_path.exists() else starter)
    write_glb(OUT_DIR / f"{out_name}.glb", positions, normals, uvs, indices, texture, out_name)
    write_guide(sprite, rings, axis, trunk_top, GUIDE_DIR / f"{out_name}-guide.png")
    print(f"{out_name}: {sheet}#{frame:03d}, {len(indices) // 3} triangles, UV {size[0]}x{size[1]}"
          f"{' (painted)' if painted_path.exists() else ''}")


def main() -> None:
    jobs = [(sys.argv[1], int(sys.argv[2]), sys.argv[3])] if len(sys.argv) == 4 else DEFAULT_JOBS
    for job in jobs:
        build(*job)


if __name__ == "__main__":
    main()
