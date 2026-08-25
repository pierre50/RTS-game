#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILDINGS_ROOT = ROOT / "public/assets/graphics/buildings"
CIV_ROOT = ROOT / "public/assets/data/civilizations"

BUILDING_FRAME_ORDER = [
    "ArcheryRange",
    "Barracks",
    "Granary",
    "House",
    "Market",
    "Stable",
    "StoragePit",
    "Temple",
    "TownCenter",
    "WatchTower",
]

BUILDING_DIRS = {
    "ArcheryRange": "archery-range",
    "Barracks": "barracks",
    "Granary": "granary",
    "House": "house",
    "Market": "market",
    "Stable": "stable",
    "StoragePit": "storage-pit",
    "Temple": "temple",
    "TownCenter": "town-center",
    "WatchTower": "watch-tower",
}

SHADOW_PAD_X = 18
SHADOW_PAD_Y = 14


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf8"))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf8")


def atlas_meta(image: Image.Image, image_name: str = "texture.png") -> dict:
    return {
        "app": "merge_building_age_atlases.py",
        "version": "1.0.0",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": image.width, "h": image.height},
        "scale": 1,
    }


def load_single_frame(building_dir: Path) -> tuple[str, dict, Image.Image, Image.Image]:
    data = read_json(building_dir / "texture.json")
    frames = data.get("frames", {})
    if len(frames) != 1:
        raise RuntimeError(f"Expected one frame in {building_dir / 'texture.json'}, found {len(frames)}")
    frame_name, frame_data = next(iter(frames.items()))
    image = Image.open(building_dir / "texture.png").convert("RGBA")
    shadow = Image.open(building_dir / "texture_shadow.png").convert("RGBA")
    return frame_name, json.loads(json.dumps(frame_data)), image, shadow


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


def write_shadow_json(age_dir: Path, frames: dict, shadow_atlas: Image.Image) -> None:
    shadow_frames = {shadow_frame_name(name): make_shadow_frame_data(frame_data) for name, frame_data in frames.items()}
    write_json(
        age_dir / "texture_shadow.json",
        {"frames": shadow_frames, "meta": atlas_meta(shadow_atlas, "texture_shadow.png")},
    )


def pack_age(age: str) -> dict[str, int]:
    age_dir = BUILDINGS_ROOT / age
    existing_atlas = age_dir / "texture.json"
    first_source = age_dir / BUILDING_DIRS[BUILDING_FRAME_ORDER[0]] / "texture.json"
    if existing_atlas.exists() and not first_source.exists():
        frames = read_json(existing_atlas).get("frames", {})
        shadow_atlas = Image.open(age_dir / "texture_shadow.png").convert("RGBA")
        write_shadow_json(age_dir, frames, shadow_atlas)
        print(f"using existing merged atlas {existing_atlas.relative_to(ROOT)}")
        return {building_type: index for index, building_type in enumerate(BUILDING_FRAME_ORDER)}

    entries = []
    x = 0
    height = 0

    for frame_index, building_type in enumerate(BUILDING_FRAME_ORDER):
        source_dir = age_dir / BUILDING_DIRS[building_type]
        old_name, frame_data, image, shadow = load_single_frame(source_dir)
        frame = frame_data["frame"]
        if image.size != (frame["w"], frame["h"]):
            raise RuntimeError(f"Unexpected packed source frame for {source_dir}: {image.size} vs {frame}")
        if shadow.size != (image.width + SHADOW_PAD_X, image.height + SHADOW_PAD_Y):
            raise RuntimeError(f"Unexpected shadow size for {source_dir}: {shadow.size}")
        entries.append(
            {
                "building_type": building_type,
                "old_name": old_name,
                "image": image,
                "shadow": shadow,
                "frame_data": frame_data,
                "x": x,
                "y": 0,
                "frame_index": frame_index,
                "name": f"{frame_index:03d}_graphics_buildings_{age}_{BUILDING_DIRS[building_type]}.png",
            }
        )
        x += image.width + SHADOW_PAD_X
        height = max(height, image.height)

    width = max(1, x - SHADOW_PAD_X)
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shadow_atlas = Image.new("RGBA", (width + SHADOW_PAD_X, height + SHADOW_PAD_Y), (0, 0, 0, 0))
    frames = {}

    for entry in entries:
        atlas.paste(entry["image"], (entry["x"], entry["y"]), entry["image"])
        shadow_atlas.paste(entry["shadow"], (entry["x"], entry["y"]), entry["shadow"])
        frame_data = entry["frame_data"]
        frame_data["frame"]["x"] = entry["x"]
        frame_data["frame"]["y"] = entry["y"]
        frames[entry["name"]] = frame_data

    atlas.save(age_dir / "texture.png")
    shadow_atlas.save(age_dir / "texture_shadow.png")
    write_json(age_dir / "texture.json", {"frames": frames, "meta": atlas_meta(atlas)})
    write_shadow_json(age_dir, frames, shadow_atlas)
    print(f"wrote {age_dir.relative_to(ROOT)}/texture.png {atlas.size} frames={len(frames)}")
    print(f"wrote {age_dir.relative_to(ROOT)}/texture_shadow.png {shadow_atlas.size}")
    return {entry["building_type"]: entry["frame_index"] for entry in entries}


def update_civilization_refs(frame_indices_by_age: dict[str, dict[str, int]]) -> None:
    for path in sorted(CIV_ROOT.glob("*.json")):
        data = read_json(path)
        for age, frame_indices in frame_indices_by_age.items():
            buildings = data.get("buildings", {}).get(age, {})
            for building_type, frame_index in frame_indices.items():
                asset = buildings.get(building_type)
                if not asset:
                    continue
                asset["images"] = {"final": {"sheet": f"buildings/age-{age}", "frame": frame_index}}
        write_json(path, data)
        print(f"updated {path.relative_to(ROOT)}")


def remove_per_building_sources() -> None:
    for age in ("age-0", "age-1"):
        for building_dir in BUILDING_DIRS.values():
            source_dir = BUILDINGS_ROOT / age / building_dir
            for filename in ("texture.json", "texture.png", "texture_shadow.png"):
                path = source_dir / filename
                if path.exists():
                    path.unlink()


def main() -> None:
    frame_indices_by_age = {
        "0": pack_age("age-0"),
        "1": pack_age("age-1"),
    }
    update_civilization_refs(frame_indices_by_age)
    remove_per_building_sources()


if __name__ == "__main__":
    main()
