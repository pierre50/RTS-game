#!/usr/bin/env python3
"""
Bake boat team-color overlays into final boat sprites.

This intentionally does not bake sails. Sail sheets stay separate at runtime.
"""

import json
from pathlib import Path
from PIL import Image

GRAPHICS_DIR = Path(__file__).parent.parent / "public/assets/graphics"


def load_json(folder):
    return json.loads((GRAPHICS_DIR / folder / "texture.json").read_text())


def save_json(folder, data):
    (GRAPHICS_DIR / folder / "texture.json").write_text(json.dumps(data, indent=2) + "\n")


def frame_number(frame_name):
    return frame_name.split("_")[0]


def frame_key(frame_num, folder):
    return f"{frame_num}_{folder}.png"


def crop_frame(sheet, info):
    frame = info["frame"]
    return sheet.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))


def paste_aligned(base_frame, base_info, overlay_frame, overlay_info):
    base_anchor = base_info.get("anchor", {"x": 0.5, "y": 0.5})
    overlay_anchor = overlay_info.get("anchor", {"x": 0.5, "y": 0.5})
    base = base_info["frame"]
    overlay = overlay_info["frame"]
    paste_x = round(base_anchor["x"] * base["w"]) - round(overlay_anchor["x"] * overlay["w"])
    paste_y = round(base_anchor["y"] * base["h"]) - round(overlay_anchor["y"] * overlay["h"])
    base_frame.paste(overlay_frame, (paste_x, paste_y), mask=overlay_frame)
    return base_frame


def bake_into_existing(final_folder, overlay_folder):
    final_data = load_json(final_folder)
    overlay_data = load_json(overlay_folder)
    final_img_path = GRAPHICS_DIR / final_folder / "texture.png"
    overlay_img_path = GRAPHICS_DIR / overlay_folder / "texture.png"

    backup = GRAPHICS_DIR / final_folder / "texture_base.png"
    final_img = Image.open(backup if backup.exists() else final_img_path).convert("RGBA")
    overlay_img = Image.open(overlay_img_path).convert("RGBA")

    if not backup.exists():
        final_img.save(backup)

    result = final_img.copy()
    overlay_by_num = {frame_number(name): info for name, info in overlay_data["frames"].items()}
    count = 0
    for name, base_info in final_data["frames"].items():
        overlay_info = overlay_by_num.get(frame_number(name))
        if not overlay_info:
            continue
        base_frame = crop_frame(result, base_info)
        overlay_frame = crop_frame(overlay_img, overlay_info)
        base_frame = paste_aligned(base_frame, base_info, overlay_frame, overlay_info)
        frame = base_info["frame"]
        result.paste(base_frame, (frame["x"], frame["y"]))
        count += 1

    result.save(final_img_path)
    print(f"{final_folder} <- {overlay_folder} ({count} frames)")


def make_final_from_base(target_folder, base_folder, overlay_folder):
    base_data = load_json(base_folder)
    base_img = Image.open(GRAPHICS_DIR / base_folder / "texture_base.png").convert("RGBA")

    target_dir = GRAPHICS_DIR / target_folder
    target_img_path = target_dir / "texture.png"
    target_json_path = target_dir / "texture.json"
    color_backup_img = target_dir / "texture_color.png"
    color_backup_json = target_dir / "texture_color.json"

    if not color_backup_img.exists():
      Image.open(target_img_path).convert("RGBA").save(color_backup_img)
    if not color_backup_json.exists():
      color_backup_json.write_text(target_json_path.read_text())

    overlay_data = json.loads(color_backup_json.read_text())
    overlay_img = Image.open(color_backup_img).convert("RGBA")
    overlay_by_num = {frame_number(name): info for name, info in overlay_data["frames"].items()}
    result = base_img.copy()

    target_data = json.loads(json.dumps(base_data))
    target_data["frames"] = {}
    count = 0
    for base_name, base_info in base_data["frames"].items():
        num = frame_number(base_name)
        overlay_info = overlay_by_num.get(num)
        target_name = frame_key(num, target_folder)
        target_data["frames"][target_name] = base_info
        if not overlay_info:
            continue
        base_frame = crop_frame(result, base_info)
        overlay_frame = crop_frame(overlay_img, overlay_info)
        base_frame = paste_aligned(base_frame, base_info, overlay_frame, overlay_info)
        frame = base_info["frame"]
        result.paste(base_frame, (frame["x"], frame["y"]))
        count += 1

    result.save(target_img_path)
    save_json(target_folder, target_data)
    print(f"{target_folder} = {base_folder} + {overlay_folder} ({count} frames)")


def main():
    bake_into_existing("693", "694")
    make_final_from_base("695", "693", "695")


if __name__ == "__main__":
    main()
