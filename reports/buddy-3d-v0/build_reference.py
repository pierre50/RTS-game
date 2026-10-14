#!/usr/bin/env python3
"""Adapt the CC BY Team Buddies mesh to the villager atlas and add a Walk cycle."""

from __future__ import annotations

import copy
import json
import math
import struct
from array import array
from pathlib import Path

from PIL import Image, ImageDraw

from build import Geometry, add_capsule


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "team-buddies-source.glb"
OUTPUT = HERE / "buddy-reference-walk.glb"
ATLAS = HERE / "buddy-simple-uv.png"


def main() -> None:
    source = SOURCE.read_bytes()
    assert source[:4] == b"glTF"
    json_length = struct.unpack_from("<I", source, 12)[0]
    gltf = json.loads(source[20:20 + json_length])
    bin_header = 20 + json_length
    bin_length = struct.unpack_from("<I", source, bin_header)[0]
    binary = bytearray(source[bin_header + 8:bin_header + 8 + bin_length])
    assert len(gltf["buffers"]) == 1

    def values(accessor_index: int) -> list[tuple[float, ...] | int]:
        accessor = gltf["accessors"][accessor_index]
        view = gltf["bufferViews"][accessor["bufferView"]]
        count = accessor["count"]
        components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[accessor["type"]]
        fmt = {5125: "I", 5126: "f"}[accessor["componentType"]]
        width = struct.calcsize(fmt) * components
        offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        stride = view.get("byteStride", width)
        result = [struct.unpack_from("<" + fmt * components, binary, offset + i * stride) for i in range(count)]
        return [entry[0] for entry in result] if components == 1 else result

    def add_view(raw: bytes, target: int | None = None) -> int:
        while len(binary) % 4:
            binary.append(0)
        offset = len(binary)
        binary.extend(raw)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(raw)}
        if target is not None:
            view["target"] = target
        gltf["bufferViews"].append(view)
        return len(gltf["bufferViews"]) - 1

    def add_accessor(items: list[float] | list[int], components: int, component_type: int,
                     target: int | None = None) -> int:
        view = add_view(array("f" if component_type == 5126 else "I", items).tobytes(), target)
        accessor = {"bufferView": view, "componentType": component_type,
                    "count": len(items) // components,
                    "type": {1: "SCALAR", 2: "VEC2", 3: "VEC3"}[components]}
        if component_type == 5126:
            accessor["min"] = [min(items[i::components]) for i in range(components)]
            accessor["max"] = [max(items[i::components]) for i in range(components)]
        gltf["accessors"].append(accessor)
        return len(gltf["accessors"]) - 1

    # The original has both hands combined in each of two material meshes.
    # Separate each side by triangle position so they can swing independently.
    hand_nodes: dict[str, list[int]] = {"negative": [], "positive": []}
    for mesh_index, node_index in ((0, 4), (1, 5)):
        primitive = gltf["meshes"][mesh_index]["primitives"][0]
        positions = values(primitive["attributes"]["POSITION"])
        indices = values(primitive["indices"])
        split = {"negative": [], "positive": []}
        for start in range(0, len(indices), 3):
            triangle = indices[start:start + 3]
            side = "positive" if sum(positions[i][1] for i in triangle) > 0 else "negative"
            split[side].extend(triangle)
        assert all(split.values()), "Both hands should exist in each hand material"
        primitive["indices"] = add_accessor(split["negative"], 1, 5125, 34963)
        negative_positions = [coordinate for x, y, z in positions
                              for coordinate in (x, y + .38, z)]
        primitive["attributes"]["POSITION"] = add_accessor(negative_positions, 3, 5126, 34962)
        hand_nodes["negative"].append(node_index)
        new_mesh = copy.deepcopy(gltf["meshes"][mesh_index])
        new_mesh["name"] += "_right"
        new_mesh["primitives"][0]["indices"] = add_accessor(split["positive"], 1, 5125, 34963)
        positive_positions = [coordinate for x, y, z in positions
                              for coordinate in (x, y - .38, z)]
        new_mesh["primitives"][0]["attributes"]["POSITION"] = add_accessor(positive_positions, 3, 5126, 34962)
        hand_uvs = []
        for x, _y, z in positions:
            hand_uvs.extend((.26 + .22 * (x - .2068) / .6819,
                             .76 + .22 * (.5413 - z) / .8574))
        hand_uv_accessor = add_accessor(hand_uvs, 2, 5126, 34962)
        primitive["attributes"]["TEXCOORD_0"] = hand_uv_accessor
        new_mesh["primitives"][0]["attributes"]["TEXCOORD_0"] = hand_uv_accessor
        gltf["meshes"].append(new_mesh)
        new_node = len(gltf["nodes"])
        gltf["nodes"].append({"name": "Main droite " + str(mesh_index), "mesh": len(gltf["meshes"]) - 1})
        gltf["nodes"][3]["children"].append(new_node)
        hand_nodes["positive"].append(new_node)

    # Discard the source torso, face plate, belt, and buckle. The replacement
    # is one continuous capsule, including underneath the former belt area.
    for node in (6, 7, 8, 9):
        gltf["nodes"][3]["children"].remove(node)
    capsule = Geometry()
    add_capsule(capsule)
    capsule_positions = []
    capsule_normals = []
    for i in range(0, len(capsule.positions), 3):
        x, y, z = capsule.positions[i:i + 3]
        capsule_positions.extend((z * 1.8, x * 1.8, (y - .30) * 1.5 - 1.08))
        nx, ny, nz = capsule.normals[i:i + 3]
        normal = (nz / 1.8, nx / 1.8, ny / 1.5)
        length = math.sqrt(sum(v * v for v in normal))
        capsule_normals.extend(v / length for v in normal)
    capsule_mesh = {"name": "Pilule simple", "primitives": [{
        "attributes": {
            "POSITION": add_accessor(capsule_positions, 3, 5126, 34962),
            "NORMAL": add_accessor(capsule_normals, 3, 5126, 34962),
            "TEXCOORD_0": add_accessor(capsule.uvs, 2, 5126, 34962),
        },
        "indices": add_accessor(capsule.indices, 1, 5125, 34963), "material": 2,
    }]}
    gltf["meshes"].append(capsule_mesh)
    capsule_node = len(gltf["nodes"])
    gltf["nodes"].append({"name": "Corps pilule", "mesh": len(gltf["meshes"]) - 1})
    gltf["nodes"][3]["children"].append(capsule_node)

    # Scale each shoe to 75% of the downloaded model: 1.5 times the prior version.
    for mesh_index in (6, 7):
        shoe = gltf["meshes"][mesh_index]["primitives"][0]
        positions = values(shoe["attributes"]["POSITION"])
        cx = (min(p[0] for p in positions) + max(p[0] for p in positions)) / 2
        cy = (min(p[1] for p in positions) + max(p[1] for p in positions)) / 2
        top = max(p[2] for p in positions)
        scaled = [coordinate for x, y, z in positions
                  for coordinate in (cx + .75 * (x - cx), cy + .75 * (y - cy), top + .75 * (z - top))]
        shoe["attributes"]["POSITION"] = add_accessor(scaled, 3, 5126, 34962)
        shoe_uvs = []
        for x, _y, z in positions:
            shoe_uvs.extend((.02 + .21 * (x + .6384) / 2.1225,
                             .76 + .22 * (top - z) / 1.0279))
        shoe["attributes"]["TEXCOORD_0"] = add_accessor(shoe_uvs, 2, 5126, 34962)

    atlas = Image.open(HERE / "buddy-uv.png").convert("RGBA")
    draw = ImageDraw.Draw(atlas)
    draw.rectangle((0, 170, 255, 191), fill=(20, 118, 192, 255))
    draw.rectangle((88, 151, 168, 157), fill=(20, 118, 192, 255))
    atlas.save(ATLAS)
    atlas_view = add_view(ATLAS.read_bytes())
    gltf["images"].append({"name": "Villageois UV", "bufferView": atlas_view, "mimeType": "image/png"})
    gltf["samplers"].append({"magFilter": 9728, "minFilter": 9728, "wrapS": 10497, "wrapT": 33071})
    gltf["textures"].append({"sampler": len(gltf["samplers"]) - 1, "source": len(gltf["images"]) - 1})
    atlas_texture = len(gltf["textures"]) - 1
    for material_index in (0, 1, 2, 6, 7):
        pbr = gltf["materials"][material_index]["pbrMetallicRoughness"]
        pbr["baseColorFactor"] = [1, 1, 1, 1]
        pbr["baseColorTexture"] = {"index": atlas_texture}

    # Source feet are already separate. Movement is measured in the mesh's
    # local axes: x goes forwards and z goes upwards after the source transforms.
    times = [i / 16 for i in range(17)]
    time_accessor = add_accessor(times, 1, 5126)
    samplers = []
    channels = []

    def track(node: int, samples: list[tuple[float, float, float]]) -> None:
        output = add_accessor([v for sample in samples for v in sample], 3, 5126)
        samplers.append({"input": time_accessor, "output": output, "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1,
                         "target": {"node": node, "path": "translation"}})

    phases = [2 * math.pi * t for t in times]
    track(2, [(0, 1.7 * (1 - math.cos(2 * p)), 0) for p in phases])
    for node, shift in ((10, 0), (11, math.pi)):
        track(node, [(0.13 * math.sin(p + shift), 0, .08 * max(0, math.sin(p + shift)))
                     for p in phases])
    for side, shift in (("negative", math.pi), ("positive", 0)):
        samples = [(0.16 * math.sin(p + shift), 0, .02 * math.sin(p + shift)) for p in phases]
        for node in hand_nodes[side]:
            track(node, samples)
    gltf["animations"] = [{"name": "Walk", "samplers": samplers, "channels": channels}]

    # Remove all disconnected belt, face-plate and old torso data from the
    # deliverable, rather than only hiding it from the active scene.
    reachable = set()

    def visit(node_index: int) -> None:
        if node_index in reachable:
            return
        reachable.add(node_index)
        for child in gltf["nodes"][node_index].get("children", []):
            visit(child)

    for scene in gltf["scenes"]:
        for node in scene["nodes"]:
            visit(node)
    node_ids = sorted(reachable)
    node_map = {old: new for new, old in enumerate(node_ids)}
    gltf["nodes"] = [gltf["nodes"][i] for i in node_ids]
    for node in gltf["nodes"]:
        if "children" in node:
            node["children"] = [node_map[i] for i in node["children"]]
    for scene in gltf["scenes"]:
        scene["nodes"] = [node_map[i] for i in scene["nodes"]]
    for animation in gltf["animations"]:
        for channel in animation["channels"]:
            channel["target"]["node"] = node_map[channel["target"]["node"]]

    mesh_ids = sorted({node["mesh"] for node in gltf["nodes"] if "mesh" in node})
    mesh_map = {old: new for new, old in enumerate(mesh_ids)}
    gltf["meshes"] = [gltf["meshes"][i] for i in mesh_ids]
    for node in gltf["nodes"]:
        if "mesh" in node:
            node["mesh"] = mesh_map[node["mesh"]]
    primitives = [primitive for mesh in gltf["meshes"] for primitive in mesh["primitives"]]
    material_ids = sorted({primitive["material"] for primitive in primitives})
    material_map = {old: new for new, old in enumerate(material_ids)}
    gltf["materials"] = [gltf["materials"][i] for i in material_ids]
    for primitive in primitives:
        primitive["material"] = material_map[primitive["material"]]

    texture_ids = sorted({material["pbrMetallicRoughness"]["baseColorTexture"]["index"]
                          for material in gltf["materials"]})
    texture_map = {old: new for new, old in enumerate(texture_ids)}
    gltf["textures"] = [gltf["textures"][i] for i in texture_ids]
    for material in gltf["materials"]:
        material["pbrMetallicRoughness"]["baseColorTexture"]["index"] = texture_map[
            material["pbrMetallicRoughness"]["baseColorTexture"]["index"]]
    image_ids = sorted({texture["source"] for texture in gltf["textures"]})
    sampler_ids = sorted({texture["sampler"] for texture in gltf["textures"]})
    image_map = {old: new for new, old in enumerate(image_ids)}
    sampler_map = {old: new for new, old in enumerate(sampler_ids)}
    gltf["images"] = [gltf["images"][i] for i in image_ids]
    gltf["samplers"] = [gltf["samplers"][i] for i in sampler_ids]
    for texture in gltf["textures"]:
        texture["source"] = image_map[texture["source"]]
        texture["sampler"] = sampler_map[texture["sampler"]]

    accessor_ids = {accessor for primitive in primitives
                    for accessor in [primitive["indices"], *primitive["attributes"].values()]}
    for animation in gltf["animations"]:
        for sampler in animation["samplers"]:
            accessor_ids.update((sampler["input"], sampler["output"]))
    accessor_ids = sorted(accessor_ids)
    accessor_map = {old: new for new, old in enumerate(accessor_ids)}
    gltf["accessors"] = [gltf["accessors"][i] for i in accessor_ids]
    for primitive in primitives:
        primitive["indices"] = accessor_map[primitive["indices"]]
        primitive["attributes"] = {key: accessor_map[value]
                                   for key, value in primitive["attributes"].items()}
    for animation in gltf["animations"]:
        for sampler in animation["samplers"]:
            sampler["input"] = accessor_map[sampler["input"]]
            sampler["output"] = accessor_map[sampler["output"]]

    view_ids = sorted({accessor["bufferView"] for accessor in gltf["accessors"]}
                      | {image["bufferView"] for image in gltf["images"]})
    view_map = {old: new for new, old in enumerate(view_ids)}
    old_views = gltf["bufferViews"]
    compact = bytearray()
    compact_views = []
    for old_index in view_ids:
        old_view = old_views[old_index]
        compact.extend(b"\0" * (-len(compact) % 4))
        new_view = dict(old_view)
        new_view["byteOffset"] = len(compact)
        start = old_view.get("byteOffset", 0)
        compact.extend(binary[start:start + old_view["byteLength"]])
        compact_views.append(new_view)
    binary = compact
    gltf["bufferViews"] = compact_views
    for accessor in gltf["accessors"]:
        accessor["bufferView"] = view_map[accessor["bufferView"]]
    for image in gltf["images"]:
        image["bufferView"] = view_map[image["bufferView"]]

    gltf["asset"]["extras"]["modification"] = "Simple capsule replacing source torso and belt; hands moved inward, shoes at 75% of source size, villager atlas applied to all visible meshes, Walk animation by RTS-game prototype"
    gltf["buffers"][0]["byteLength"] = len(binary)
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * (-len(json_bytes) % 4)
    binary.extend(b"\0" * (-len(binary) % 4))
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    OUTPUT.write_bytes(struct.pack("<4sII", b"glTF", 2, total)
                       + struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
                       + struct.pack("<I4s", len(binary), b"BIN\0") + binary)
    print(f"Wrote {OUTPUT.name}: {len(gltf['meshes'])} meshes, {len(channels)} Walk tracks")


if __name__ == "__main__":
    main()
