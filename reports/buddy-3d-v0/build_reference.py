#!/usr/bin/env python3
"""Adapt the CC BY Team Buddies mesh to the villager atlas and add a Walk cycle."""

from __future__ import annotations

import copy
import json
import math
import struct
from array import array
from pathlib import Path

from build import Geometry, add_capsule


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "team-buddies-source.glb"
OUTPUT = HERE / "buddy-antiquity-pixel-actions-v23.glb"
ATLAS = HERE / "buddy-antiquity-pixel-uv.png"
# The Buddy faces local +X, so local -Y is his anatomical right side.
RIGHT_HAND_REST = (.60, -1.18, -.07)
LEFT_HAND_REST = (.60, 1.18, -.07)


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
                    "type": {1: "SCALAR", 2: "VEC2", 3: "VEC3", 4: "VEC4"}[components]}
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
        rx, ry, rz = RIGHT_HAND_REST
        negative_positions = [coordinate for x, y, z in positions
                              for coordinate in (x - rx, y + .38 - ry, z - .13 - rz)]
        primitive["attributes"]["POSITION"] = add_accessor(negative_positions, 3, 5126, 34962)
        gltf["nodes"][node_index]["name"] = "Main droite " + str(mesh_index)
        hand_nodes["negative"].append(node_index)
        new_mesh = copy.deepcopy(gltf["meshes"][mesh_index])
        new_mesh["name"] += "_left"
        new_mesh["primitives"][0]["indices"] = add_accessor(split["positive"], 1, 5125, 34963)
        # Both hands have their own pivots so the weapon and offhand can move
        # independently without rotating a hand through the capsule.
        px, py, pz = LEFT_HAND_REST
        positive_positions = [coordinate for x, y, z in positions
                              for coordinate in (x - px, y - .38 - py, z - .13 - pz)]
        new_mesh["primitives"][0]["attributes"]["POSITION"] = add_accessor(positive_positions, 3, 5126, 34962)
        hand_uvs = []
        for x, _y, z in positions:
            hand_uvs.extend((.26 + .22 * (x - .2068) / .6819,
                             .71 + .27 * (.5413 - z) / .8574))
        hand_uv_accessor = add_accessor(hand_uvs, 2, 5126, 34962)
        primitive["attributes"]["TEXCOORD_0"] = hand_uv_accessor
        new_mesh["primitives"][0]["attributes"]["TEXCOORD_0"] = hand_uv_accessor
        gltf["meshes"].append(new_mesh)
        new_node = len(gltf["nodes"])
        gltf["nodes"].append({"name": "Main gauche " + str(mesh_index), "mesh": len(gltf["meshes"]) - 1})
        gltf["nodes"][3]["children"].append(new_node)
        hand_nodes["positive"].append(new_node)

    right_pivot = len(gltf["nodes"])
    gltf["nodes"].append({"name": "Poignet droit", "translation": list(RIGHT_HAND_REST),
                          "children": hand_nodes["negative"]})
    left_pivot = len(gltf["nodes"])
    gltf["nodes"].append({"name": "Poignet gauche", "translation": list(LEFT_HAND_REST),
                          "children": hand_nodes["positive"]})
    for node in (*hand_nodes["negative"], *hand_nodes["positive"]):
        gltf["nodes"][3]["children"].remove(node)
    gltf["nodes"][3]["children"].extend((right_pivot, left_pivot))

    # Discard the source torso, face plate, belt, and buckle. The replacement
    # is one continuous capsule, including underneath the former belt area.
    for node in (6, 7, 8, 9):
        gltf["nodes"][3]["children"].remove(node)
    capsule = Geometry()
    add_capsule(capsule)
    capsule_positions = []
    capsule_normals = []

    def body_v(original: float) -> float:
        # Give the face more room on the shorter body while keeping the hair
        # on the upper dome and the painted tunic on the lower half.
        stops = ((0.0, 0.0), (.15, .17), (.24, .28), (.49, .42), (.75, .70))
        for (source_a, target_a), (source_b, target_b) in zip(stops, stops[1:]):
            if original <= source_b:
                t = (original - source_a) / (source_b - source_a)
                return target_a + t * (target_b - target_a)
        return .70

    for i in range(0, len(capsule.positions), 3):
        x, y, z = capsule.positions[i:i + 3]
        if y <= .85:
            new_height = -1.08 + (y - .30) * 1.8
            height_scale = 1.8
        elif y <= 2.08:
            new_height = -.09 + (y - .85) * (.99 / 1.23)
            height_scale = .99 / 1.23
        else:
            new_height = .90 + (y - 2.08) * 1.8
            height_scale = 1.8
        capsule_positions.extend((z * 1.8, x * 1.8, new_height))
        nx, ny, nz = capsule.normals[i:i + 3]
        normal = (nz / 1.8, nx / 1.8, ny / height_scale)
        length = math.sqrt(sum(v * v for v in normal))
        capsule_normals.extend(v / length for v in normal)
    capsule_mesh = {"name": "Pilule simple", "primitives": [{
        "attributes": {
            "POSITION": add_accessor(capsule_positions, 3, 5126, 34962),
            "NORMAL": add_accessor(capsule_normals, 3, 5126, 34962),
            "TEXCOORD_0": add_accessor([body_v(v) if i % 2 else v
                                        for i, v in enumerate(capsule.uvs)], 2, 5126, 34962),
        },
        "indices": add_accessor(capsule.indices, 1, 5125, 34963), "material": 2,
    }]}
    gltf["meshes"].append(capsule_mesh)
    capsule_node = len(gltf["nodes"])
    gltf["nodes"].append({"name": "Corps pilule", "mesh": len(gltf["meshes"]) - 1})
    gltf["nodes"][3]["children"].append(capsule_node)

    # Keep the body and hands together when the upper body leans. The shoes
    # remain children of the original root so they can step independently.
    upper_parts = [capsule_node, right_pivot, left_pivot]
    for node in upper_parts:
        gltf["nodes"][3]["children"].remove(node)
    upper_node = len(gltf["nodes"])
    gltf["nodes"].append({"name": "Balancement du corps", "children": upper_parts})
    gltf["nodes"][3]["children"].append(upper_node)

    # Scale each shoe to 75% of the downloaded model. Tuck the broad, flat
    # outsole into the boot so its lower edge follows the rounded upper.
    for mesh_index in (6, 7):
        shoe = gltf["meshes"][mesh_index]["primitives"][0]
        positions = values(shoe["attributes"]["POSITION"])
        cx = (min(p[0] for p in positions) + max(p[0] for p in positions)) / 2
        cy = (min(p[1] for p in positions) + max(p[1] for p in positions)) / 2
        top = max(p[2] for p in positions)
        scaled = []
        for x, y, z in positions:
            sole = max(0.0, min(1.0, (-1.57 - z) / .23))
            sole = sole * sole * (3 - 2 * sole)
            inset = 1 - .50 * sole
            rounded_z = z + .13 * sole
            scaled.extend((cx + .75 * inset * (x - cx),
                           cy + .75 * inset * (y - cy),
                           top + .75 * (rounded_z - top)))
        shoe["attributes"]["POSITION"] = add_accessor(scaled, 3, 5126, 34962)
        shoe_uvs = []
        for x, _y, z in positions:
            shoe_uvs.extend((.02 + .21 * (x + .6384) / 2.1225,
                             .71 + .27 * (top - z) / 1.0279))
        shoe["attributes"]["TEXCOORD_0"] = add_accessor(shoe_uvs, 2, 5126, 34962)

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

    def track(node: int, path: str, samples: list[tuple[float, ...]]) -> None:
        output = add_accessor([v for sample in samples for v in sample], len(samples[0]), 5126)
        samplers.append({"input": time_accessor, "output": output, "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1,
                         "target": {"node": node, "path": path}})

    def mirror_position(position: tuple[float, float, float]) -> tuple[float, float, float]:
        x, y, z = position
        return x, -y, z

    def mirror_rotation(rotation: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
        x, y, z, w = rotation
        return -x, y, -z, w

    def track_offhand(offsets: list[tuple[float, float, float]],
                      rotations: list[tuple[float, float, float, float]] | None = None) -> None:
        x, y, z = LEFT_HAND_REST
        track(left_pivot, "translation", [(x + dx, y - dy, z + dz) for dx, dy, dz in offsets])
        track(left_pivot, "rotation", rotations or [(0, 0, 0, 1) for _ in offsets])

    def track_weapon_hand(positions: list[tuple[float, float, float]],
                          rotations: list[tuple[float, float, float, float]]) -> None:
        track(right_pivot, "translation", [mirror_position(position) for position in positions])
        track(right_pivot, "rotation", [mirror_rotation(rotation) for rotation in rotations])

    phases = [2 * math.pi * t for t in times]
    # The source root uses centimetres; its local Y becomes world vertical.
    track(2, "translation", [(0, 3.5 * (1 - math.cos(2 * p)), 0) for p in phases])
    track(upper_node, "translation", [(.025 * math.sin(p), .045 * math.sin(p),
                                       .012 * (1 - math.cos(2 * p))) for p in phases])

    def lean(p: float) -> tuple[float, float, float, float]:
        # Local X tilts the head from side to side; local Y adds a small
        # forward lean. Both motions are inherited by the hands.
        side = .085 * math.sin(p)
        forward = .055 * math.sin(p + math.pi / 4)
        sx, cx = math.sin(side / 2), math.cos(side / 2)
        sy, cy = math.sin(forward / 2), math.cos(forward / 2)
        return (sx * cy, cx * sy, sx * sy, cx * cy)

    track(upper_node, "rotation", [lean(p) for p in phases])
    for node, shift in ((10, 0), (11, math.pi)):
        track(node, "translation", [(.23 * math.sin(p + shift), 0,
                                     .15 * max(0, math.sin(p + shift))) for p in phases])
    # The shield arm rides slightly outside the torso and turns its palm out.
    # The matching shield mount rotates the disc to face away from the body.
    shield_hand_turn = .22
    track_offhand([(.23 * math.sin(p), -.18, .045 * math.sin(p)) for p in phases],
                  [(0, 0, math.sin(shield_hand_turn / 2), math.cos(shield_hand_turn / 2))
                   for _ in phases])
    rx, ry, rz = RIGHT_HAND_REST
    track(right_pivot, "translation", [(rx + .23 * math.sin(p + math.pi), ry,
                                        rz + .045 * math.sin(p + math.pi)) for p in phases])
    track(right_pivot, "rotation", [(0, 0, 0, 1) for _ in phases])
    gltf["animations"] = [{"name": "Walk", "samplers": samplers, "channels": channels}]
    walk_track_count = len(channels)

    # The right hand drops beside the hip, then drives upward and forward
    # toward nose height. The strike is deliberately faster than the wind-up.
    # Give every animated part a Thrust track so switching actions resets the
    # entire character to the new pose rather than retaining a Walk offset.
    thrust_times = [0, .16, .34, .43, .56, .67, .84, 1]
    time_accessor = add_accessor(thrust_times, 1, 5126)
    samplers = []
    channels = []
    track(2, "translation", [(x, y, 0) for x, y in
                              ((0, 0), (0, -.8), (-2, -1.5), (-1, -1.2),
                               (5, 1.4), (6, 1.6), (2, .5), (0, 0))])
    track(upper_node, "translation", [mirror_position((x, y, z)) for x, y, z in
                                       ((0, 0, 0), (-.03, -.04, -.02),
                                        (-.10, -.08, -.07), (-.08, -.07, -.05),
                                        (.16, .07, .03), (.18, .08, .04),
                                        (.06, .03, .01), (0, 0, 0))])

    def body_turn(twist: float, lean: float) -> tuple[float, float, float, float]:
        sz, cz = math.sin(twist / 2), math.cos(twist / 2)
        sx, cx = math.sin(lean / 2), math.cos(lean / 2)
        return (sx * cz, sx * sz, cx * sz, cx * cz)

    track(upper_node, "rotation", [body_turn(-twist, -lean) for twist, lean in
                                    ((0, 0), (-.04, .02), (-.10, -.07),
                                     (-.10, -.06), (.09, .07), (.14, .08),
                                     (.04, .02), (0, 0))])
    track(10, "translation", [(x, 0, z) for x, z in
                              ((0, 0), (-.02, 0), (.06, 0), (.05, 0),
                               (-.07, 0), (-.09, 0), (-.03, 0), (0, 0))])
    track(11, "translation", [(x, 0, z) for x, z in
                              ((0, 0), (.02, 0), (-.06, .02), (-.05, .01),
                               (.10, .04), (.13, 0), (.04, 0), (0, 0))])
    guard = [(x, y, z) for x, y, z in
             ((0, 0, 0), (.02, .02, .03), (.05, .04, .09),
              (.04, .03, .07), (-.12, -.10, -.12), (-.14, -.12, -.16),
              (-.05, -.04, -.05), (0, 0, 0))]
    track_offhand(guard)
    # Follow the outside of the capsule from hip to face. The shortest center
    # distance in the arc stays beyond the body radius, even during wind-up.
    thrust_hand_positions = [(.60, 1.18, -.07), (.38, 1.32, -.38),
                             (.30, 1.36, -.65), (.75, 1.30, -.36),
                             (1.50, .20, .25), (1.57, .28, .32),
                             (1.05, 1.26, .20), (.60, 1.18, -.07)]

    def hand_turn(outward: float, yaw: float, roll: float) -> tuple[float, float, float, float]:
        # Positive rotation around local X aims the downward fingers toward
        # the outside of the right side. Keep the impact close to 45 degrees.
        sx, cx = math.sin(outward / 2), math.cos(outward / 2)
        sy, cy = math.sin(yaw / 2), math.cos(yaw / 2)
        sz, cz = math.sin(roll / 2), math.cos(roll / 2)
        return (sx * cy * cz - cx * sy * sz,
                cx * sy * cz + sx * cy * sz,
                cx * cy * sz - sx * sy * cz,
                cx * cy * cz + sx * sy * sz)

    track_weapon_hand(thrust_hand_positions,
                      [hand_turn(outward, yaw, roll) for outward, yaw, roll in
                       ((0, 0, 0), (.12, -.18, -.12),
                        (.20, -.30, -.18), (.35, -.10, -.12),
                        (.70, .10, .12), (.78, .16, .18),
                        (.30, .08, .06), (0, 0, 0))])
    gltf["animations"].append({"name": "Thrust", "samplers": samplers, "channels": channels})

    # Sword slash: pull the hand behind the right shoulder, lift the sword,
    # then drive it around the OUTSIDE of the capsule toward the front left.
    # The hand follows a broad circular arc; the wrist turns the blade into
    # the direction of travel while the body twists through the strike.
    slash_times = [0, .12, .27, .40, .51, .60, .69, .77, .85, .92, 1]
    time_accessor = add_accessor(slash_times, 1, 5126)
    samplers = []
    channels = []
    track(2, "translation", [(x, y, 0) for x, y in
                              ((0, 0), (-1, -.5), (-3, -1.1), (-3, -1.3),
                               (-2, -.9), (2, .5), (5, 1.2), (6, 1.4),
                               (2, .5), (1, .2), (0, 0))])
    track(upper_node, "translation", [mirror_position((x, y, z)) for x, y, z in
                                       ((0, 0, 0), (-.03, -.04, -.02),
                                        (-.11, -.08, -.06), (-.13, -.10, -.07),
                                        (-.10, -.07, -.04), (.04, .03, .02),
                                        (.16, .09, .05), (.20, .11, .06),
                                        (.07, .04, .02), (.02, .01, 0), (0, 0, 0))])
    track(upper_node, "rotation", [body_turn(-twist, -lean) for twist, lean in
                                    ((0, 0), (-.06, -.03), (-.14, -.07),
                                     (-.18, -.10), (-.14, -.08), (.02, .02),
                                     (.17, .09), (.27, .12), (.09, .04),
                                     (.03, .01), (0, 0))])
    for node in (10, 11):
        track(node, "translation", [(0, 0, 0) for _ in slash_times])
    slash_guard = [(x, y, z) for x, y, z in
                   ((0, 0, 0), (.01, -.02, .02), (.04, -.06, .08),
                    (.05, -.08, .11), (.04, -.07, .10),
                    (-.03, -.03, .04), (-.09, -.09, -.06),
                    (-.13, -.12, -.11), (-.05, -.05, -.04),
                    (-.02, -.02, -.01), (0, 0, 0))]
    track_offhand(slash_guard)
    slash_hand_arc = [
        # angle around the body, distance from its centre, height
        (63, 1.32, -.07), (100, 1.40, .32), (125, 1.48, .90),
        (130, 1.52, 1.25), (92, 1.58, 1.40), (52, 1.63, 1.10),
        (12, 1.68, .45), (-10, 1.58, -.25), (-8, 1.45, -.32),
        (25, 1.45, -.16), (63, 1.32, -.07),
    ]
    track_weapon_hand([(radius * math.cos(math.radians(angle)),
                        radius * math.sin(math.radians(angle)), height)
                       for angle, radius, height in slash_hand_arc],
                      [hand_turn(outward, pitch, roll) for outward, pitch, roll in
                       ((0, 0, 0), (.10, -.35, .35),
                        (.15, -.75, .75), (.20, -1.05, .85),
                        (.20, -.90, .60), (.30, -.30, -.15),
                        (.45, .20, -.20), (.55, .70, -.10),
                        (.40, .55, -.10), (.18, .22, -.30),
                        (0, 0, 0))])
    gltf["animations"].append({"name": "Slash", "samplers": samplers, "channels": channels})

    # A quick side cut for a short click. The hand winds back at chest height
    # and circles across the front without reaching above the shoulder.
    side_times = [0, .10, .22, .34, .45, .55, .67, .79, 1]
    time_accessor = add_accessor(side_times, 1, 5126)
    samplers = []
    channels = []
    track(2, "translation", [(x, y, 0) for x, y in
                              ((0, 0), (-1, -.3), (-2, -.7), (-1, -.5),
                               (2, .3), (4, .8), (4, .8), (1, .2), (0, 0))])
    track(upper_node, "translation", [mirror_position(position) for position in
                                       ((0, 0, 0), (-.03, -.03, -.01),
                                        (-.08, -.06, -.03), (-.05, -.04, -.02),
                                        (.08, .04, .02), (.15, .08, .03),
                                        (.13, .07, .02), (.03, .02, 0), (0, 0, 0))])
    track(upper_node, "rotation", [body_turn(-twist, -lean) for twist, lean in
                                    ((0, 0), (-.05, -.02), (-.12, -.04),
                                     (-.09, -.03), (.05, .02), (.17, .06),
                                     (.19, .07), (.04, .02), (0, 0))])
    for node in (10, 11):
        track(node, "translation", [(0, 0, 0) for _ in side_times])
    track_offhand([(0, 0, 0), (.01, -.01, .01), (.03, -.03, .04),
                   (.02, -.02, .03), (-.04, -.04, -.02),
                   (-.08, -.07, -.05), (-.08, -.07, -.05),
                   (-.02, -.02, -.01), (0, 0, 0)])
    side_hand_arc = [
        # angle around the torso, radius, height
        (63, 1.32, -.07), (95, 1.43, -.02), (118, 1.52, .05),
        (85, 1.56, .15), (40, 1.65, .18), (5, 1.68, .13),
        (-30, 1.60, -.05), (-10, 1.46, -.12), (63, 1.32, -.07),
    ]
    track_weapon_hand([(radius * math.cos(math.radians(angle)),
                        radius * math.sin(math.radians(angle)), height)
                       for angle, radius, height in side_hand_arc],
                      [hand_turn(outward, pitch, roll) for outward, pitch, roll in
                       ((0, 0, 0), (.08, -.05, .40), (.12, -.10, .80),
                        (.20, -.08, .50), (.35, .05, -.15),
                        (.45, .08, -.75), (.45, .12, -1.10),
                        (.20, .05, -.40), (0, 0, 0))])
    gltf["animations"].append({"name": "SideSlash", "samplers": samplers, "channels": channels})

    # Holdable guard: both hands advance. The sword hand presents its blade
    # diagonally, while the shield hand turns the shield toward the front.
    block_times = [0, .08, .22, .32]
    time_accessor = add_accessor(block_times, 1, 5126)
    samplers = []
    channels = []
    track(2, "translation", [(0, 0, 0) for _ in block_times])
    track(upper_node, "translation", [mirror_position(position) for position in
                                       ((0, 0, 0), (.01, 0, 0),
                                        (.04, 0, -.02), (.04, 0, -.02))])
    track(upper_node, "rotation", [body_turn(-twist, -lean) for twist, lean in
                                    ((0, 0), (0, .01), (.02, .04), (.02, .04))])
    for node in (10, 11):
        track(node, "translation", [(0, 0, 0) for _ in block_times])
    track(left_pivot, "translation", [LEFT_HAND_REST,
                                      (0.88, 1.12, .10),
                                      (1.30, .87, .42),
                                      (1.34, .84, .45)])
    shield_angles = (0, -.18, -.42, -.45)
    track(left_pivot, "rotation", [(0, 0, math.sin(a / 2), math.cos(a / 2))
                                    for a in shield_angles])
    track_weapon_hand([(.60, 1.18, -.07), (.78, 1.16, -.03),
                       (1.12, 1.08, .04), (1.18, 1.04, .05)],
                      [hand_turn(outward, pitch, roll) for outward, pitch, roll in
                       ((0, 0, 0), (.12, -.12, .18),
                        (.30, -.28, .44), (.34, -.30, .48))])
    gltf["animations"].append({"name": "Block", "samplers": samplers, "channels": channels})

    # Ranged shot: the weapon arm extends, the free hand draws the string or
    # sling pouch back to the face, then releases it without moving the feet.
    shot_times = [0, .14, .30, .46, .60, .68, .80, 1]
    time_accessor = add_accessor(shot_times, 1, 5126)
    samplers = []
    channels = []
    track(2, "translation", [(0, 0, 0) for _ in shot_times])
    track(upper_node, "translation", [mirror_position(position) for position in
                                       ((0, 0, 0), (.02, 0, 0), (.04, .01, 0),
                                        (.06, .01, 0), (.06, .01, 0),
                                        (-.03, -.01, -.02), (0, 0, 0), (0, 0, 0))])
    track(upper_node, "rotation", [body_turn(-twist, -lean) for twist, lean in
                                    ((0, 0), (.02, .01), (.04, .02), (.05, .02),
                                     (.05, .02), (-.03, -.02), (0, 0), (0, 0))])
    for node in (10, 11):
        track(node, "translation", [(0, 0, 0) for _ in shot_times])
    track(left_pivot, "translation", [LEFT_HAND_REST,
                                      (1.15, .70, .08), (1.40, .45, .18),
                                      (1.12, .42, .18), (1.00, .55, .14),
                                      (1.28, .65, .24), (.95, 1.0, .06),
                                      LEFT_HAND_REST])
    shot_offhand_angles = (0, -.10, -.22, -.35, -.40, -.22, -.08, 0)
    track(left_pivot, "rotation", [(0, 0, math.sin(a / 2), math.cos(a / 2))
                                    for a in shot_offhand_angles])
    track_weapon_hand([(.60, 1.18, -.07), (1.32, .46, .08),
                       (2.10, -.40, .18), (2.25, -.55, .18),
                       (2.25, -.55, .18), (2.15, -.45, .15),
                       (1.28, 1.0, .04), (.60, 1.18, -.07)],
                      [hand_turn(outward, pitch, roll) for outward, pitch, roll in
                       ((0, 0, 0), (.03, -.06, -.04), (.08, -.12, -.08),
                        (.10, -.14, -.08), (.10, -.14, -.08),
                        (.13, -.10, -.04), (.04, -.04, -.02), (0, 0, 0))])
    gltf["animations"].append({"name": "Shot", "samplers": samplers, "channels": channels})

    # A one-handed overhead strike for chopping and mining tools. The wrist
    # stays outside the capsule while the tool rises, then falls in front.
    chop_times = [0, .12, .30, .43, .52, .63, .72, .86, 1]
    time_accessor = add_accessor(chop_times, 1, 5126)
    samplers = []
    channels = []
    track(2, "translation", [(x, y, 0) for x, y in
                              ((0, 0), (-1, -.7), (-2, -1.4), (-2, -1.4),
                               (-1, -1.2), (4, .8), (5, 1.2), (1, .3), (0, 0))])
    track(upper_node, "translation", [mirror_position((x, y, z)) for x, y, z in
                                       ((0, 0, 0), (-.05, -.02, -.02),
                                        (-.10, -.04, -.07), (-.10, -.04, -.07),
                                        (-.07, -.03, -.05), (.13, .05, .04),
                                        (.16, .06, .05), (.04, .02, .01), (0, 0, 0))])
    track(upper_node, "rotation", [body_turn(-twist, -lean) for twist, lean in
                                    ((0, 0), (-.03, -.03), (-.06, -.09),
                                     (-.06, -.09), (-.03, -.06), (.08, .09),
                                     (.10, .11), (.03, .03), (0, 0))])
    for node in (10, 11):
        track(node, "translation", [(0, 0, 0) for _ in chop_times])
    guard = [(x, y, z) for x, y, z in
             ((0, 0, 0), (.01, -.02, .03), (.02, -.04, .10),
              (.02, -.04, .12), (.01, -.02, .09),
              (-.08, -.08, -.06), (-.10, -.09, -.10),
              (-.03, -.03, -.03), (0, 0, 0))]
    track_offhand(guard)
    chop_hand_positions = [(.60, 1.18, -.07), (.42, 1.20, .42),
                           (.28, 1.22, 1.32), (.28, 1.22, 1.65),
                           (.43, 1.22, 1.65), (1.03, 1.20, .55),
                           (1.45, 1.18, -.50), (1.03, 1.18, -.33),
                           (.60, 1.18, -.07)]
    # Rotating around the hand's lateral axis points the tool upward for the
    # wind-up and down toward the ground at impact.
    wrist_pitch = (0, -.55, -1.18, -1.38, -1.28, .10, .82, .30, 0)
    track_weapon_hand(chop_hand_positions,
                      [(0, math.sin(p / 2), 0, math.cos(p / 2)) for p in wrist_pitch])
    gltf["animations"].append({"name": "Chop", "samplers": samplers, "channels": channels})

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

    gltf["asset"]["extras"]["modification"] = "Short capsule replacing source torso and belt; weapon in the right hand, shoes at 75% of source size, stylized pixel-art UV atlas, Walk, Thrust, overhead Slash, SideSlash, Chop, Block and Shot animations by RTS-game prototype"
    gltf["buffers"][0]["byteLength"] = len(binary)
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * (-len(json_bytes) % 4)
    binary.extend(b"\0" * (-len(binary) % 4))
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    OUTPUT.write_bytes(struct.pack("<4sII", b"glTF", 2, total)
                       + struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
                       + struct.pack("<I4s", len(binary), b"BIN\0") + binary)
    print(f"Wrote {OUTPUT.name}: {len(gltf['meshes'])} meshes, {walk_track_count} Walk tracks, {len(channels)} Chop tracks")


if __name__ == "__main__":
    main()
