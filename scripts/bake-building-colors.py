#!/usr/bin/env python3
"""
Merge building color overlays into final sprites.

For each building that has a separate color overlay:
  1. Composites the blue overlay onto the final sprite (texture.png)
  2. Saves the original as texture_base.png

After this, changeSpriteColorDirectly works directly on the final sprite,
and the separate color sprite folders are no longer needed.
"""

import json
import sys
from pathlib import Path
from PIL import Image

GRAPHICS_DIR = Path(__file__).parent.parent / "public/assets/graphics"
CIV_DIR = Path(__file__).parent.parent / "public/assets/data/civilizations"


def collect_pairs():
    pairs = {}
    for path in CIV_DIR.glob("*.json"):
        data = json.loads(path.read_text())
        for age, buildings in data.get("buildings", {}).items():
            for name, info in buildings.items():
                imgs = info.get("images", {})
                if "final" in imgs and "color" in imgs:
                    f_folder = imgs["final"].split("_")[1]
                    c_folder = imgs["color"].split("_")[1]
                    pairs[f_folder] = c_folder
    return pairs


def load_frames(folder):
    data = json.loads((GRAPHICS_DIR / folder / "texture.json").read_text())
    frames = {}
    for frame_name, info in data["frames"].items():
        frame_num = frame_name.split("_")[0]
        f = info["frame"]
        a = info.get("anchor", {"x": 0.5, "y": 0.5})
        frames[frame_num] = {"x": f["x"], "y": f["y"], "w": f["w"], "h": f["h"],
                             "ax": a["x"], "ay": a["y"]}
    return frames


def bake_pair(final_folder, color_folder, dry_run=False):
    final_frames = load_frames(final_folder)
    color_frames = load_frames(color_folder)
    common = set(final_frames) & set(color_frames)

    if not common:
        print(f"  [skip] no common frames: {final_folder} / {color_folder}")
        return

    if dry_run:
        print(f"  {final_folder} <- {color_folder} ({len(common)} frames)")
        return

    final_path = GRAPHICS_DIR / final_folder / "texture.png"
    final_img = Image.open(final_path).convert("RGBA")
    color_img = Image.open(GRAPHICS_DIR / color_folder / "texture.png").convert("RGBA")

    # Backup original
    base_path = GRAPHICS_DIR / final_folder / "texture_base.png"
    if not base_path.exists():
        final_img.save(base_path)

    result = final_img.copy()
    for frame_num in common:
        ff = final_frames[frame_num]
        cf = color_frames[frame_num]

        final_frame = result.crop((ff["x"], ff["y"], ff["x"] + ff["w"], ff["y"] + ff["h"]))
        color_frame = color_img.crop((cf["x"], cf["y"], cf["x"] + cf["w"], cf["y"] + cf["h"]))

        paste_x = round(ff["ax"] * ff["w"]) - round(cf["ax"] * cf["w"])
        paste_y = round(ff["ay"] * ff["h"]) - round(cf["ay"] * cf["h"])
        final_frame.paste(color_frame, (paste_x, paste_y), mask=color_frame)
        result.paste(final_frame, (ff["x"], ff["y"]))

    result.save(final_path)
    print(f"  {final_folder} <- {color_folder} ({len(common)} frames)")


def main():
    dry_run = "--dry-run" in sys.argv
    pairs = collect_pairs()
    print(f"Found {len(pairs)} final→color pairs\n")
    if dry_run:
        print("Dry run — no files written\n")

    for final_folder, color_folder in sorted(pairs.items(), key=lambda x: int(x[0])):
        bake_pair(final_folder, color_folder, dry_run=dry_run)

    if not dry_run:
        print(f"\nDone. {len(pairs)} texture.png updated. Originals saved as texture_base.png.")


if __name__ == "__main__":
    main()
