#!/usr/bin/env python3
"""Build a capsule character, UV atlas, and textured GLB from the game's villager sprite."""

from __future__ import annotations

import io
import json
import math
import struct
from array import array
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ATLAS_SOURCE = ROOT / "public/assets/graphics/units/villager/latium/male/texture.png"
SIZE = 256


def sprite_frame(atlas: Image.Image, index: int) -> Image.Image:
    x = index * 65
    return atlas.crop((x, 0, x + 64, 64)).convert("RGBA")


def dominant_color(image: Image.Image, box: tuple[int, int, int, int], fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    pixels = image.crop(box).get_flattened_data()
    colors = Counter(p[:3] for p in pixels if p[3] > 200 and sum(p[:3]) > 95)
    return colors.most_common(1)[0][0] if colors else fallback


def build_atlas(front: Image.Image, back: Image.Image, side: Image.Image) -> Image.Image:
    hair = dominant_color(front, (24, 16, 42, 25), (99, 52, 50))
    hair_light = (136, 80, 65)
    hair_dark = (55, 36, 35)
    skin = dominant_color(front, (27, 27, 40, 36), (213, 141, 107))
    skin_shadow = (173, 110, 81)
    blue = dominant_color(front, (24, 36, 41, 45), (64, 151, 234))
    blue_mid = (20, 118, 192)
    blue_dark = dominant_color(front, (24, 45, 42, 51), (0, 27, 64))
    leather = dominant_color(front, (24, 52, 42, 62), (73, 37, 28))
    outline = (29, 29, 33)

    atlas = Image.new("RGBA", (SIZE, SIZE), (*blue, 255))
    draw = ImageDraw.Draw(atlas)
    # U wraps around the capsule: back at the image seam, left profile,
    # front in the middle, then right profile. V runs from hair to tunic.
    draw.rectangle((0, 0, 255, 58), fill=(*hair, 255))
    draw.rectangle((0, 59, 255, 76), fill=(*hair_dark, 255))
    draw.rectangle((0, 77, 255, 173), fill=(*blue, 255))
    draw.rectangle((0, 117, 255, 169), fill=(*blue_mid, 255))
    draw.rectangle((0, 170, 255, 191), fill=(*blue_dark, 255))

    # Face window, ears, and an irregular hair fringe. All colors come from
    # the existing sprite's palette; features are placed for the capsule UV.
    draw.rectangle((68, 58, 188, 106), fill=(*skin_shadow, 255))
    draw.rectangle((77, 63, 178, 104), fill=(*skin, 255))
    draw.rectangle((81, 97, 174, 108), fill=(*skin_shadow, 255))
    draw.rectangle((77, 101, 178, 109), fill=(*blue_dark, 255))
    draw.rectangle((84, 105, 171, 117), fill=(*blue, 255))
    for x, y, w, h in [(67, 53, 29, 22), (91, 60, 21, 17), (111, 56, 31, 18),
                       (141, 61, 19, 17), (160, 55, 29, 19)]:
        draw.rectangle((x, y, x + w, y + h), fill=(*hair, 255))
    draw.rectangle((68, 61, 82, 82), fill=(*hair_dark, 255))
    draw.rectangle((174, 61, 188, 82), fill=(*hair_dark, 255))

    # Copy small details from the source sprite rather than inventing a face:
    # two eyes and the central nose/mouth region.
    face_detail = front.crop((27, 27, 39, 36)).resize((58, 34), Image.Resampling.NEAREST)
    face_detail.putalpha(face_detail.getchannel("A"))
    atlas.alpha_composite(face_detail, (99, 75))
    # Keep the face from ending in a hard rectangular edge.
    draw.rectangle((100, 106, 155, 112), fill=(*blue_dark, 255))

    # Hair shine and the blue shirt motif use pixels from the villager palette.
    for x, y, w in [(18, 17, 15), (56, 28, 10), (102, 20, 22), (152, 13, 18), (211, 25, 13)]:
        draw.rectangle((x, y, x + w, y + 5), fill=(*hair_light, 255))
    draw.rectangle((88, 119, 168, 128), fill=(85, 177, 241, 255))
    draw.rectangle((76, 132, 180, 138), fill=(*blue, 255))
    draw.rectangle((88, 151, 168, 157), fill=(*blue_dark, 255))
    draw.rectangle((87, 176, 169, 183), fill=(*blue_mid, 255))
    # A soft back fold, using a blue sampled from the rear sprite.
    back_blue = dominant_color(back, (25, 35, 40, 45), blue_mid)
    draw.rectangle((8, 140, 32, 145), fill=(*back_blue, 255))
    draw.rectangle((224, 140, 248, 145), fill=(*back_blue, 255))
    # Profile shading borrows its skin and shirt colors from the side view.
    side_skin = dominant_color(side, (24, 27, 41, 36), skin_shadow)
    draw.rectangle((61, 81, 69, 98), fill=(*side_skin, 255))
    draw.rectangle((187, 81, 195, 98), fill=(*side_skin, 255))

    # Lower atlas: dark boot uppers, nearly black soles, skin hands, and a blue cuff.
    draw.rectangle((0, 192, 63, 255), fill=(42, 39, 42, 255))
    draw.rectangle((0, 192, 63, 208), fill=(64, 57, 56, 255))
    draw.rectangle((10, 218, 53, 223), fill=(*leather, 255))
    draw.rectangle((64, 192, 127, 255), fill=(*skin, 255))
    draw.rectangle((64, 232, 127, 255), fill=(*skin_shadow, 255))
    draw.rectangle((128, 192, 191, 255), fill=(*outline, 255))
    draw.rectangle((136, 201, 183, 210), fill=(73, 37, 28, 255))
    draw.rectangle((192, 192, 255, 255), fill=(*blue_mid, 255))
    return atlas


class Geometry:
    def __init__(self) -> None:
        self.positions: list[float] = []
        self.normals: list[float] = []
        self.uvs: list[float] = []
        self.indices: list[int] = []

    def vertex(self, position: tuple[float, float, float], normal: tuple[float, float, float], uv: tuple[float, float]) -> int:
        index = len(self.positions) // 3
        self.positions.extend(position)
        self.normals.extend(normal)
        self.uvs.extend(uv)
        return index

    def face(self, points: list[tuple[float, float, float]], uvs: list[tuple[float, float]]) -> None:
        a, b, c = points[:3]
        ab = [b[i] - a[i] for i in range(3)]
        ac = [c[i] - a[i] for i in range(3)]
        cross = (ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0])
        length = math.sqrt(sum(v * v for v in cross)) or 1
        normal = tuple(v / length for v in cross)
        ids = [self.vertex(point, normal, uv) for point, uv in zip(points, uvs)]
        self.indices.extend((ids[0], ids[1], ids[2]))
        if len(ids) == 4:
            self.indices.extend((ids[0], ids[2], ids[3]))


def add_capsule(geo: Geometry) -> None:
    radius = 0.55
    top_center = 2.08
    bottom_center = 0.85
    rings: list[tuple[float, float, float]] = []
    for degrees in (0, 15, 30, 45, 60, 75, 90):
        angle = math.radians(degrees)
        rings.append((top_center + radius * math.cos(angle), radius * math.sin(angle), degrees))
    rings.append((bottom_center, radius, 90))
    for degrees in (105, 120, 135, 150, 165, 180):
        angle = math.radians(degrees)
        rings.append((bottom_center + radius * math.cos(angle), radius * math.sin(angle), degrees))
    ring_ids: list[list[int]] = []
    top_y, bottom_y = top_center + radius, bottom_center - radius
    for y, r, degrees in rings:
        ids = []
        for j in range(33):
            u = j / 32
            theta = 2 * math.pi * (u - 0.5)
            x, z = math.sin(theta) * r, math.cos(theta) * r
            phi = math.radians(degrees)
            normal = (math.sin(theta) * math.sin(phi), math.cos(phi), math.cos(theta) * math.sin(phi))
            v = (top_y - y) / (top_y - bottom_y) * 0.75
            ids.append(geo.vertex((x, y, z), normal, (u, v)))
        ring_ids.append(ids)
    for upper, lower in zip(ring_ids, ring_ids[1:]):
        for j in range(32):
            a, b, c, d = upper[j], upper[j + 1], lower[j + 1], lower[j]
            geo.indices.extend((a, c, b, a, d, c))


def add_rounded_prism(geo: Geometry, x: float, z: float,
                      half_width: float, half_depth: float,
                      rings: list[tuple[float, float]], uv: tuple[float, float, float, float]) -> None:
    footprint = [(-.72, 1), (.72, 1), (1, .72), (1, -.72),
                 (.72, -1), (-.72, -1), (-1, -.72), (-1, .72)]
    u0, u1, v0, v1 = uv
    for ring_index in range(len(rings) - 1):
        y0, s0 = rings[ring_index]
        y1, s1 = rings[ring_index + 1]
        for j in range(8):
            p, q = footprint[j], footprint[(j + 1) % 8]
            points = [(x + p[0] * half_width * s0, y0, z + p[1] * half_depth * s0),
                      (x + q[0] * half_width * s0, y0, z + q[1] * half_depth * s0),
                      (x + q[0] * half_width * s1, y1, z + q[1] * half_depth * s1),
                      (x + p[0] * half_width * s1, y1, z + p[1] * half_depth * s1)]
            geo.face(points, [(u0, v1), (u1, v1), (u1, v0), (u0, v0)])
    top_y, top_scale = rings[-1]
    center = (x, top_y, z)
    for j in range(8):
        p, q = footprint[j], footprint[(j + 1) % 8]
        geo.face([center,
                  (x + p[0] * half_width * top_scale, top_y, z + p[1] * half_depth * top_scale),
                  (x + q[0] * half_width * top_scale, top_y, z + q[1] * half_depth * top_scale)],
                 [((u0 + u1) / 2, (v0 + v1) / 2),
                  ((u0 + u1) / 2 + p[0] * (u1 - u0) * .35, (v0 + v1) / 2 - p[1] * (v1 - v0) * .35),
                  ((u0 + u1) / 2 + q[0] * (u1 - u0) * .35, (v0 + v1) / 2 - q[1] * (v1 - v0) * .35)])


def add_boot(geo: Geometry, x_offset: float) -> None:
    # A thick outsole, raised heel/ankle, and a separate bulbous toe.
    add_rounded_prism(geo, x_offset, .17, .39, .51,
                      [(.02, .96), (.07, 1), (.13, 1)], (.51, .74, .76, .98))
    add_rounded_prism(geo, x_offset, -.08, .245, .285,
                      [(.12, 1), (.35, .98), (.53, .82), (.59, .66)], (.02, .23, .77, .97))
    add_rounded_prism(geo, x_offset, .33, .355, .345,
                      [(.12, .93), (.26, 1), (.39, .91), (.47, .66)], (.02, .23, .77, .97))


def add_ellipsoid(geo: Geometry, center: tuple[float, float, float],
                  size: tuple[float, float, float]) -> None:
    sx, sy, sz = size
    rings: list[list[int]] = []
    for i in range(9):
        phi = math.pi * i / 8
        row = []
        for j in range(17):
            theta = 2 * math.pi * j / 16
            x = center[0] + sx * math.sin(phi) * math.cos(theta)
            y = center[1] + sy * math.cos(phi)
            z = center[2] + sz * math.sin(phi) * math.sin(theta)
            nx = math.sin(phi) * math.cos(theta) / sx
            ny = math.cos(phi) / sy
            nz = math.sin(phi) * math.sin(theta) / sz
            length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1
            row.append(geo.vertex((x, y, z), (nx / length, ny / length, nz / length),
                                  (.26 + j / 16 * .22, .76 + i / 8 * .21)))
        rings.append(row)
    for upper, lower in zip(rings, rings[1:]):
        for j in range(16):
            a, b, c, d = upper[j], upper[j + 1], lower[j + 1], lower[j]
            geo.indices.extend((a, b, c, a, c, d))


def add_hand(geo: Geometry, side: int) -> None:
    # The palm and inward-facing thumb give each hand a mitten silhouette.
    add_ellipsoid(geo, (side * .79, 1.31, .04), (.22, .27, .19))
    add_ellipsoid(geo, (side * .62, 1.21, .18), (.105, .14, .11))


def write_glb(parts: dict[str, Geometry], texture: Image.Image, path: Path) -> None:
    data = bytearray()
    views = []
    accessors = []

    def append_view(content: bytes, target: int | None = None) -> int:
        while len(data) % 4:
            data.append(0)
        offset = len(data)
        data.extend(content)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(content)}
        if target is not None:
            view["target"] = target
        views.append(view)
        return len(views) - 1

    def accessor(values: list[float] | list[int], components: int, component_type: int, target: int | None = None) -> int:
        code = "f" if component_type == 5126 else "I"
        raw = array(code, values).tobytes()
        view = append_view(raw, target)
        entry = {"bufferView": view, "componentType": component_type,
                 "count": len(values) // components,
                 "type": {1: "SCALAR", 2: "VEC2", 3: "VEC3", 4: "VEC4"}[components]}
        if components == 3 and component_type == 5126:
            entry["min"] = [min(values[i::3]) for i in range(3)]
            entry["max"] = [max(values[i::3]) for i in range(3)]
        elif components == 1 and component_type == 5126:
            entry["min"] = [min(values)]
            entry["max"] = [max(values)]
        accessors.append(entry)
        return len(accessors) - 1

    meshes = []
    nodes = [{"name": "Villageois capsule", "children": list(range(1, len(parts) + 1))}]
    for name, geo in parts.items():
        pos = accessor(geo.positions, 3, 5126, 34962)
        normal = accessor(geo.normals, 3, 5126, 34962)
        uv = accessor(geo.uvs, 2, 5126, 34962)
        indices = accessor(geo.indices, 1, 5125, 34963)
        meshes.append({"name": name, "primitives": [{
            "attributes": {"POSITION": pos, "NORMAL": normal, "TEXCOORD_0": uv},
            "indices": indices, "material": 0,
        }]})
        nodes.append({"name": name, "mesh": len(meshes) - 1})

    # One complete walk cycle. A separate node per part makes the movement
    # available to any glTF viewer, rather than only to the Babylon preview.
    times = [i / 16 for i in range(17)]
    time_accessor = accessor(times, 1, 5126)
    samplers = []
    channels = []

    def track(node: int, path_name: str, samples: list[tuple[float, ...]]) -> None:
        dimensions = len(samples[0])
        flattened = [value for sample in samples for value in sample]
        output = accessor(flattened, dimensions, 5126)
        samplers.append({"input": time_accessor, "output": output, "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": path_name}})

    phases = [2 * math.pi * t for t in times]
    body_bob = [(0.028 * math.sin(p), 0.035 * (1 - math.cos(2 * p)), 0) for p in phases]
    body_tilt = [(0, 0, math.sin(0.025 * math.sin(p) / 2), math.cos(0.025 * math.sin(p) / 2)) for p in phases]
    track(1, "translation", body_bob)
    track(1, "rotation", body_tilt)
    for node, phase_shift in [(2, 0), (3, math.pi)]:
        foot = []
        for p in phases:
            step = math.sin(p + phase_shift)
            foot.append((0, 0.18 * max(0, step), 0.25 * step))
        track(node, "translation", foot)
    for node, phase_shift in [(4, math.pi), (5, 0)]:
        hand = [(0, 0.025 * math.sin(p + phase_shift), 0.18 * math.sin(p + phase_shift)) for p in phases]
        track(node, "translation", hand)

    png = io.BytesIO()
    texture.save(png, format="PNG")
    image_view = append_view(png.getvalue())
    gltf = {
        "asset": {"version": "2.0", "generator": "RTS-game buddy-3d-v0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": nodes,
        "meshes": meshes,
        "animations": [{"name": "Walk", "samplers": samplers, "channels": channels}],
        "materials": [{"name": "Pixel art du villageois",
                       "pbrMetallicRoughness": {"baseColorTexture": {"index": 0},
                                                "metallicFactor": 0, "roughnessFactor": 1},
                       "emissiveFactor": [0, 0, 0]}],
        "textures": [{"sampler": 0, "source": 0}],
        "samplers": [{"magFilter": 9728, "minFilter": 9728, "wrapS": 10497, "wrapT": 33071}],
        "images": [{"bufferView": image_view, "mimeType": "image/png"}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(data)}],
    }
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    data.extend(b"\0" * ((4 - len(data) % 4) % 4))
    total = 12 + 8 + len(json_bytes) + 8 + len(data)
    with path.open("wb") as handle:
        handle.write(struct.pack("<4sII", b"glTF", 2, total))
        handle.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
        handle.write(json_bytes)
        handle.write(struct.pack("<I4s", len(data), b"BIN\0"))
        handle.write(data)


def main() -> None:
    source = Image.open(ATLAS_SOURCE).convert("RGBA")
    front = sprite_frame(source, 22)
    back = sprite_frame(source, 4)
    side = sprite_frame(source, 13)
    atlas = build_atlas(front, back, side)
    atlas.save(OUT / "buddy-uv.png")
    parts = {
        "Corps": Geometry(),
        "Chaussure gauche": Geometry(),
        "Chaussure droite": Geometry(),
        "Main gauche": Geometry(),
        "Main droite": Geometry(),
    }
    add_capsule(parts["Corps"])
    add_boot(parts["Chaussure gauche"], -.44)
    add_boot(parts["Chaussure droite"], .44)
    add_hand(parts["Main gauche"], -1)
    add_hand(parts["Main droite"], 1)
    write_glb(parts, atlas, OUT / "buddy.glb")
    triangles = sum(len(geo.indices) // 3 for geo in parts.values())
    print(f"Wrote buddy.glb ({triangles} triangles, Walk animation) and buddy-uv.png")


if __name__ == "__main__":
    main()
