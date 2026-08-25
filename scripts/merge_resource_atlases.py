#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RESOURCE_ROOT = ROOT / "public/assets/graphics/resources"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf8"))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf8")


def load_sheet(sheet_id: str) -> tuple[dict, Image.Image, Image.Image | None]:
    base = RESOURCE_ROOT / sheet_id
    data = read_json(base / "texture.json")
    image = Image.open(base / "texture.png").convert("RGBA")
    shadow_path = base / "texture_shadow.png"
    shadow = Image.open(shadow_path).convert("RGBA") if shadow_path.exists() else None
    return data, image, shadow


def sorted_frames(data: dict) -> list[tuple[str, dict]]:
    return sorted(data["frames"].items(), key=lambda item: int(item[0].split("_")[0]))


SHADOW_PAD_X = 18
SHADOW_PAD_Y = 14


def atlas_meta(image: Image.Image, image_name: str = "texture.png") -> dict:
    return {
        "app": "merge_resource_atlases.py",
        "version": "1.0.0",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": image.width, "h": image.height},
        "scale": 1,
    }


def make_shadow_frame_data(frame_data: dict) -> dict:
    shadow_frame_data = json.loads(json.dumps(frame_data))
    frame = shadow_frame_data["frame"]
    base_width = frame["w"]
    base_height = frame["h"]
    frame["w"] = base_width + SHADOW_PAD_X
    frame["h"] = base_height + SHADOW_PAD_Y
    shadow_frame_data["spriteSourceSize"] = {"x": 0, "y": 0, "w": frame["w"], "h": frame["h"]}
    shadow_frame_data["sourceSize"] = {"w": frame["w"], "h": frame["h"]}
    anchor = shadow_frame_data.get("anchor", {"x": 0.5, "y": 0.5})
    shadow_frame_data["anchor"] = {
        "x": (anchor["x"] * base_width + SHADOW_PAD_X / 2) / frame["w"],
        "y": (anchor["y"] * base_height) / frame["h"],
    }
    return shadow_frame_data


def shadow_frame_name(frame_name: str) -> str:
    if frame_name.endswith(".png"):
        return f"{frame_name[:-4]}_shadow.png"
    return f"{frame_name}_shadow"


def write_shadow_json(output: Path, frames: dict, shadow_atlas: Image.Image) -> None:
    shadow_frames = {shadow_frame_name(name): make_shadow_frame_data(frame_data) for name, frame_data in frames.items()}
    write_json(
        output / "texture_shadow.json",
        {"frames": shadow_frames, "meta": atlas_meta(shadow_atlas, "texture_shadow.png")},
    )


def pack_static_atlas(output_id: str, sources: list[str], frame_name: Callable[[int, str, str], str]) -> None:
    entries = []
    x = 0
    height = 0

    for source_id in sources:
        data, image, _shadow = load_sheet(source_id)
        for old_name, frame_data in sorted_frames(data):
            frame = frame_data["frame"]
            entries.append(
                {
                    "source_id": source_id,
                    "old_name": old_name,
                    "image": image,
                    "frame_data": json.loads(json.dumps(frame_data)),
                    "src_box": (frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]),
                    "x": x,
                    "y": 0,
                    "name": frame_name(len(entries), source_id, old_name),
                }
            )
            x += frame["w"]
            height = max(height, frame["h"])

    atlas = Image.new("RGBA", (x, height), (0, 0, 0, 0))
    frames = {}
    for entry in entries:
        crop = entry["image"].crop(entry["src_box"])
        atlas.paste(crop, (entry["x"], entry["y"]), crop)
        frame_data = entry["frame_data"]
        frame_data["frame"]["x"] = entry["x"]
        frame_data["frame"]["y"] = entry["y"]
        frames[entry["name"]] = frame_data

    output = RESOURCE_ROOT / output_id
    output.mkdir(parents=True, exist_ok=True)
    atlas.save(output / "texture.png")
    write_json(output / "texture.json", {"frames": frames, "meta": atlas_meta(atlas)})
    print(f"wrote {output.relative_to(ROOT)}/texture.png {atlas.size} frames={len(frames)}")


def pack_minerals() -> None:
    sources = ["gold", "stone", "copper", "iron"]
    output = RESOURCE_ROOT / "minerals"
    existing_atlas = output / "texture.json"
    first_source = RESOURCE_ROOT / sources[0] / "texture.json"
    if existing_atlas.exists() and not first_source.exists():
        frames = read_json(existing_atlas).get("frames", {})
        shadow_atlas = Image.open(output / "texture_shadow.png").convert("RGBA")
        write_shadow_json(output, frames, shadow_atlas)
        print(f"using existing merged atlas {existing_atlas.relative_to(ROOT)}")
        return

    entries = []
    x = 0
    height = 0

    for source_id in sources:
        data, image, shadow = load_sheet(source_id)
        if shadow is None:
            raise RuntimeError(f"Missing shadow texture for {source_id}")
        for old_name, frame_data in sorted_frames(data):
            frame = frame_data["frame"]
            entries.append(
                {
                    "source_id": source_id,
                    "old_name": old_name,
                    "image": image,
                    "shadow": shadow,
                    "frame_data": json.loads(json.dumps(frame_data)),
                    "src_box": (frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]),
                    "shadow_box": (
                        frame["x"],
                        frame["y"],
                        frame["x"] + frame["w"] + SHADOW_PAD_X,
                        frame["y"] + frame["h"] + SHADOW_PAD_Y,
                    ),
                    "x": x,
                    "y": 0,
                    "name": f'{len(entries):03d}_graphics_resources_minerals_{source_id}_{old_name.split("_")[0]}.png',
                }
            )
            x += frame["w"] + SHADOW_PAD_X
            height = max(height, frame["h"])

    width = max(1, x - SHADOW_PAD_X)
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shadow_atlas = Image.new("RGBA", (width + SHADOW_PAD_X, height + SHADOW_PAD_Y), (0, 0, 0, 0))
    frames = {}
    for entry in entries:
        crop = entry["image"].crop(entry["src_box"])
        atlas.paste(crop, (entry["x"], entry["y"]), crop)
        shadow_crop = entry["shadow"].crop(entry["shadow_box"])
        shadow_atlas.paste(shadow_crop, (entry["x"], entry["y"]), shadow_crop)
        frame_data = entry["frame_data"]
        frame_data["frame"]["x"] = entry["x"]
        frame_data["frame"]["y"] = entry["y"]
        frames[entry["name"]] = frame_data

    output.mkdir(parents=True, exist_ok=True)
    atlas.save(output / "texture.png")
    shadow_atlas.save(output / "texture_shadow.png")
    write_json(output / "texture.json", {"frames": frames, "meta": atlas_meta(atlas)})
    write_shadow_json(output, frames, shadow_atlas)
    print(f"wrote {output.relative_to(ROOT)}/texture.png {atlas.size} frames={len(frames)}")
    print(f"wrote {output.relative_to(ROOT)}/texture_shadow.png {shadow_atlas.size}")


def dead_tree_frame_name(index: int, source_id: str, old_name: str) -> str:
    state = "fallen" if source_id.endswith("fallen") else "stump"
    old_index = old_name.split("_")[0]
    return f"{index:03d}_graphics_resources_tree_{state}_{old_index}.png"


def main() -> None:
    pack_static_atlas(
        "tree/grass",
        ["tree/grass-1", "tree/grass-2", "tree/grass-3", "tree/grass-4"],
        lambda index, _source, _old: f"{index:03d}_graphics_resources_tree_grass_{index + 1}.png",
    )
    pack_static_atlas(
        "tree/palm",
        ["tree/palm-1", "tree/palm-2", "tree/palm-3", "tree/palm-4"],
        lambda index, _source, _old: f"{index:03d}_graphics_resources_tree_palm_{index + 1}.png",
    )
    pack_static_atlas(
        "tree/dark-forest",
        ["tree/dark-forest-1", "tree/dark-forest-2", "tree/dark-forest-3", "tree/dark-forest-4"],
        lambda index, _source, _old: f"{index:03d}_graphics_resources_tree_dark_forest_{index + 1}.png",
    )
    pack_static_atlas("tree/dead", ["tree/fallen", "tree/stump"], dead_tree_frame_name)
    pack_minerals()


if __name__ == "__main__":
    main()
