#!/usr/bin/env python3
"""
Bake wall player-color overlays into the final wall sprites.

For each civilization wall set missing its player color, composites the blue
color overlay (buildings/{civ}/wall/level-X-large) onto the base sprites
(buildings/{civ}/wall/level-X) using anchor alignment, so changeSpriteColor
works directly on the final sprite.

Asian level-2/3 and babylonian level-3 already ship with the player color
baked into the base SLP export, so they are not listed here.

Frames grow when the overlay overflows the base frame; the atlas and
texture.json are repacked accordingly.
"""

import json
import sys
from pathlib import Path
from PIL import Image

BUILDINGS_DIR = Path(__file__).parent.parent / "public/assets/graphics/buildings"
TARGETS = {
    "level-2": ["greek", "egyptian", "babylonian"],
    "level-3": ["greek", "egyptian"],
}
GAP = 1


def load_atlas(folder):
    data = json.loads((folder / "texture.json").read_text())
    image = Image.open(folder / "texture.png").convert("RGBA")
    return data, image


def frame_num(name):
    return name.split("_")[0].replace(".png", "")


def bake_wall(level, civ, dry_run=False):
    base_dir = BUILDINGS_DIR / civ / "wall" / level
    overlay_dir = BUILDINGS_DIR / civ / "wall" / f"{level}-large"
    base_data, base_img = load_atlas(base_dir)
    overlay_data, overlay_img = load_atlas(overlay_dir)

    overlay_frames = {frame_num(k): v for k, v in overlay_data["frames"].items()}

    baked = {}
    for name, info in base_data["frames"].items():
        f = info["frame"]
        a = info["anchor"]
        crop = base_img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))

        ovl = overlay_frames.get(frame_num(name))
        if ovl is None:
            baked[name] = (info, crop)
            continue

        of, oa = ovl["frame"], ovl["anchor"]
        ocrop = overlay_img.crop((of["x"], of["y"], of["x"] + of["w"], of["y"] + of["h"]))
        paste_x = round(a["x"] * f["w"]) - round(oa["x"] * of["w"])
        paste_y = round(a["y"] * f["h"]) - round(oa["y"] * of["h"])

        # Grow the canvas if the overlay overflows the base frame
        left = min(0, paste_x)
        top = min(0, paste_y)
        right = max(f["w"], paste_x + of["w"])
        bottom = max(f["h"], paste_y + of["h"])
        new_w, new_h = right - left, bottom - top

        canvas = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
        canvas.paste(crop, (-left, -top))
        canvas.paste(ocrop, (paste_x - left, paste_y - top), mask=ocrop)

        new_info = dict(info)
        new_info["frame"] = dict(f)
        new_info["spriteSourceSize"] = {"x": 0, "y": 0, "w": new_w, "h": new_h}
        new_info["sourceSize"] = {"w": new_w, "h": new_h}
        new_info["anchor"] = {
            "x": (a["x"] * f["w"] - left) / new_w,
            "y": (a["y"] * f["h"] - top) / new_h,
        }
        if (new_w, new_h) != (f["w"], f["h"]):
            print(f"  [{level}/{civ}] {name}: frame grown {f['w']}x{f['h']} -> {new_w}x{new_h}")
        baked[name] = (new_info, canvas)

    # Repack horizontally with a 1px gap (same convention as the source atlases)
    atlas_w = sum(c.width for _, c in baked.values()) + GAP * (len(baked) - 1)
    atlas_h = max(c.height for _, c in baked.values())
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))

    x = 0
    for name, (info, canvas) in baked.items():
        info["frame"] = {"x": x, "y": 0, "w": canvas.width, "h": canvas.height}
        atlas.paste(canvas, (x, 0))
        x += canvas.width + GAP

    base_data["frames"] = {name: info for name, (info, _) in baked.items()}
    base_data["meta"]["size"] = {"w": atlas_w, "h": atlas_h}

    if dry_run:
        print(f"  [{level}/{civ}] would write {atlas_w}x{atlas_h} atlas ({len(baked)} frames)")
        return

    atlas.save(base_dir / "texture.png")
    (base_dir / "texture.json").write_text(json.dumps(base_data, indent=2) + "\n")
    print(f"  [{level}/{civ}] baked {len(baked)} frames -> {atlas_w}x{atlas_h}")


def main():
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("Dry run — no files written\n")
    for level, civs in TARGETS.items():
        for civ in civs:
            bake_wall(level, civ, dry_run=dry_run)


if __name__ == "__main__":
    main()
