#!/usr/bin/env python3
"""Pack rustic, village and upgraded buildings losslessly into three rows.

Accepts the former age folders on first run, then repacks the unified atlas.
Gameplay levels and costs are unchanged; level-zero buildings without a rustic
variant share the village sprite. Shadows reuse the same pixels for all styles.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILDINGS = ROOT / "public/assets/graphics/structures/buildings"
CIVILIZATIONS = ROOT / "public/assets/data/civilizations"
TYPES = {
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
    "Forge": "forge",
}
STYLES = ("rustic", "village", "upgraded")
SHARED_TYPES = {"ArcheryRange", "Market", "StoragePit", "Forge"}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text())


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n")


def crop(image: Image.Image, frame: dict) -> Image.Image:
    return image.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))


def main() -> None:
    data = read_json(BUILDINGS / "texture.json")
    shadows = read_json(BUILDINGS / "texture_shadow.json")
    legacy = data["meta"]["image"] == "age-0/texture.png"
    images = {
        style: Image.open(BUILDINGS / (f"age-{i}/texture.png" if legacy else "texture.png")).convert("RGBA")
        for i, style in enumerate(STYLES)
    }
    entries = []
    references = {style: {} for style in STYLES}
    for style in STYLES:
        for building_type, slug in TYPES.items():
            if style == "rustic" and building_type in SHARED_TYPES:
                continue
            suffix = f"_{'age-0' if legacy else style}_{slug}.png"
            source_name = next(name for name in data["frames"] if name.endswith(suffix))
            frame_data = copy.deepcopy(data["frames"][source_name])
            source_index = int(source_name.split("_")[0])
            shadow_name = next(name for name in shadows["frames"] if int(name.split("_")[0]) == source_index)
            index = len(entries)
            name = f"{index:03d}_graphics_buildings_{style}_{slug}.png"
            entries.append((style, name, crop(images[style], frame_data["frame"]), frame_data,
                            copy.deepcopy(shadows["frames"][shadow_name])))
            references[style][building_type] = {"sheet": "buildings", "frame": index}

    row_height = max(entry[2].height for entry in entries) + 2
    widths = {style: sum(entry[2].width + 18 for entry in entries if entry[0] == style) - 18 for style in STYLES}
    atlas = Image.new("RGBA", (max(widths.values()), row_height * len(STYLES) - 2))
    frames, shadow_frames = {}, {}
    positions = {style: 0 for style in STYLES}
    for style, name, pixels, frame_data, shadow_data in entries:
        x, y = positions[style], STYLES.index(style) * row_height
        # No alpha mask: preserve source RGBA bytes, including semi-transparent edges.
        atlas.paste(pixels, (x, y))
        frame_data["frame"].update(x=x, y=y)
        frames[name] = frame_data
        shadow_frames[name.replace(".png", "_shadow.png")] = shadow_data
        positions[style] += pixels.width + 18
        assert crop(atlas, frame_data["frame"]).tobytes() == pixels.tobytes()

    atlas.save(BUILDINGS / "texture.png")
    data["frames"] = frames
    data["meta"].update(app="pack_building_atlas.py", image="texture.png", size={"w": atlas.width, "h": atlas.height})
    write_json(BUILDINGS / "texture.json", data)
    shadows["frames"] = shadow_frames
    shadows["meta"]["app"] = "pack_building_atlas.py"
    write_json(BUILDINGS / "texture_shadow.json", shadows)

    for path in sorted(CIVILIZATIONS.glob("*.json")):
        civilization = read_json(path)
        for level, style in enumerate(STYLES):
            for building_type, building in civilization["buildings"][str(level)].items():
                if building_type in TYPES:
                    building["images"]["final"] = references[style].get(building_type) or references["village"][building_type]
        write_json(path, civilization)

    # Remove only migrated inputs; unrelated files in these directories are retained.
    if legacy:
        for level in range(3):
            folder = BUILDINGS / f"age-{level}"
            (folder / "texture.png").unlink()
            if not any(folder.iterdir()):
                folder.rmdir()
    print(f"Packed {len(frames)} sprites in {atlas.width}x{atlas.height}; shared shadow pixels retained.")


if __name__ == "__main__":
    main()
