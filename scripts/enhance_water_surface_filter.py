from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "public/assets/border/water-surface-filter-source.png"
FRAME_DIR = ROOT / "public/assets/border/water-surface-filter"
FRAME_COUNT = 4
BASE_SHADOW_ALPHA_MAX = 80
FLASH_COUNT = 0
BRIGHT_ALPHA_MIN = 1
BRIGHT_ALPHA_MAX = 120
BRIGHT_RGB_MIN = 170
BRIGHT_RGB_DELTA_MAX = 70


def clean_shadow_frame(frame: Image.Image) -> Image.Image:
    image = frame.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a > BASE_SHADOW_ALPHA_MAX:
                pixels[x, y] = (255, 255, 255, 0)
    return image


def blend_pixel(base: tuple[int, int, int, int], overlay: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    br, bg, bb, ba = base
    or_, og, ob, oa = overlay
    if oa <= 0:
        return base
    if ba <= 0:
        return overlay
    base_alpha = ba / 255
    overlay_alpha = oa / 255
    out_alpha = overlay_alpha + base_alpha * (1 - overlay_alpha)
    if out_alpha <= 0:
        return (255, 255, 255, 0)
    return (
        round((or_ * overlay_alpha + br * base_alpha * (1 - overlay_alpha)) / out_alpha),
        round((og * overlay_alpha + bg * base_alpha * (1 - overlay_alpha)) / out_alpha),
        round((ob * overlay_alpha + bb * base_alpha * (1 - overlay_alpha)) / out_alpha),
        round(out_alpha * 255),
    )


def add_pixel(image: Image.Image, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    if x < 0 or y < 0 or x >= image.width or y >= image.height:
        return
    image.putpixel((x, y), blend_pixel(image.getpixel((x, y)), color))


def is_flash_candidate(mask: Image.Image, x: int, y: int) -> bool:
    if x < 0 or y < 0 or x >= mask.width or y >= mask.height:
        return False
    return bool(mask.getpixel((x, y)))


def add_masked_pixel(image: Image.Image, candidate_mask: Image.Image, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    if is_flash_candidate(candidate_mask, x, y):
        add_pixel(image, x, y, color)


def add_flash(image: Image.Image, candidate_mask: Image.Image, x: int, y: int, alpha: int, size: int) -> None:
    add_masked_pixel(image, candidate_mask, x, y, (255, 255, 255, alpha))
    add_masked_pixel(image, candidate_mask, x - 1, y, (245, 252, 255, max(0, alpha - 45)))
    add_masked_pixel(image, candidate_mask, x + 1, y, (245, 252, 255, max(0, alpha - 45)))
    add_masked_pixel(image, candidate_mask, x, y - 1, (245, 252, 255, max(0, alpha - 45)))
    add_masked_pixel(image, candidate_mask, x, y + 1, (245, 252, 255, max(0, alpha - 45)))
    if size >= 2:
        add_masked_pixel(image, candidate_mask, x - 1, y - 1, (235, 250, 255, max(0, alpha - 90)))
        add_masked_pixel(image, candidate_mask, x + 1, y - 1, (235, 250, 255, max(0, alpha - 90)))
        add_masked_pixel(image, candidate_mask, x - 1, y + 1, (235, 250, 255, max(0, alpha - 90)))
        add_masked_pixel(image, candidate_mask, x + 1, y + 1, (235, 250, 255, max(0, alpha - 90)))


def flash_strength(frame_index: int, peak_frame: int) -> float:
    # Keep every glint alive through the full 4-frame cycle so the loop breathes
    # instead of popping on/off brutally.
    distance = abs(frame_index - peak_frame)
    distance = min(distance, FRAME_COUNT - distance)
    if distance == 0:
        return 1.0
    if distance == 1:
        return 0.72
    return 0.46


def create_candidate_mask(frame: Image.Image) -> Image.Image:
    mask = Image.new("1", frame.size, 0)
    source = frame.convert("RGBA")
    mask_pixels = mask.load()
    source_pixels = source.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = source_pixels[x, y]
            if (
                BRIGHT_ALPHA_MIN <= a <= BRIGHT_ALPHA_MAX
                and r >= BRIGHT_RGB_MIN
                and g >= BRIGHT_RGB_MIN
                and b >= BRIGHT_RGB_MIN
                and max(r, g, b) - min(r, g, b) <= BRIGHT_RGB_DELTA_MAX
            ):
                mask_pixels[x, y] = 1
    return mask


def create_flash_specs(candidate_mask: Image.Image) -> list[tuple[int, int, int, int]]:
    rng = random.Random(90210)
    width, height = candidate_mask.size
    open_pixels = [
        (x, y)
        for y in range(2, height - 2)
        for x in range(2, width - 2)
        if candidate_mask.getpixel((x, y))
    ]
    specs = []
    for n in range(min(FLASH_COUNT, len(open_pixels))):
        x, y = open_pixels[rng.randrange(len(open_pixels))]
        peak_frame = n % FRAME_COUNT
        max_alpha = rng.randrange(210, 256)
        roll = rng.random()
        size = 3 if roll < 0.34 else 2 if roll < 0.84 else 1
        specs.append((x, y, peak_frame, max_alpha, size))
    rng.shuffle(specs)
    return specs


def rebuild_base_frames_from_source() -> tuple[list[Image.Image], list[Image.Image]]:
    source = Image.open(SOURCE_PATH).convert("RGBA")
    if source.width % FRAME_COUNT != 0:
        raise ValueError(f"{SOURCE_PATH} width must be divisible by {FRAME_COUNT}, got {source.width}")
    frame_width = source.width // FRAME_COUNT
    FRAME_DIR.mkdir(exist_ok=True)
    frames = []
    candidate_masks = []
    for index in range(FRAME_COUNT):
        source_frame = source.crop((index * frame_width, 0, (index + 1) * frame_width, source.height))
        frame = clean_shadow_frame(source_frame)
        frames.append(frame)
        candidate_masks.append(create_candidate_mask(source_frame))
    return frames, candidate_masks


def merge_candidate_masks(candidate_masks: list[Image.Image]) -> Image.Image:
    if not candidate_masks:
        raise ValueError("No candidate masks were generated")
    merged = Image.new("1", candidate_masks[0].size, 0)
    merged_pixels = merged.load()
    for candidate_mask in candidate_masks:
        pixels = candidate_mask.load()
        for y in range(candidate_mask.height):
            for x in range(candidate_mask.width):
                if pixels[x, y]:
                    merged_pixels[x, y] = 1
    return merged


def enhance_frame(
    base_frame: Image.Image,
    candidate_mask: Image.Image,
    index: int,
    specs: list[tuple[int, int, int, int]],
) -> Image.Image:
    image = base_frame.copy()

    for x, y, peak_frame, max_alpha, size in specs:
        strength = flash_strength(index, peak_frame)
        if strength <= 0:
            continue
        alpha = round(max_alpha * strength)
        add_flash(image, candidate_mask, x, y, alpha, size)

    return image


def write_atlas(frames: list[Image.Image]) -> None:
    if not frames:
        raise ValueError("No frames to write")
    frame_width = frames[0].width
    frame_height = frames[0].height
    atlas = Image.new("RGBA", (frame_width * len(frames), frame_height), (255, 255, 255, 0))
    metadata = {
        "frames": {},
        "meta": {
            "app": "scripts/enhance_water_surface_filter.py",
            "image": "texture.png",
            "format": "RGBA8888",
            "size": {"w": atlas.width, "h": atlas.height},
            "scale": 1,
        },
    }

    for index, frame in enumerate(frames):
        x = index * frame_width
        atlas.paste(frame, (x, 0))
        metadata["frames"][f"{index:03d}_border_water-surface-filter.png"] = {
            "frame": {"x": x, "y": 0, "w": frame_width, "h": frame_height},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": frame_width, "h": frame_height},
            "sourceSize": {"w": frame_width, "h": frame_height},
            "anchor": {"x": 0, "y": 0},
        }

    FRAME_DIR.mkdir(exist_ok=True)
    atlas.save(FRAME_DIR / "texture.png")
    (FRAME_DIR / "texture.json").write_text(json.dumps(metadata, indent=2) + "\n")


def main() -> None:
    base_frames, candidate_masks = rebuild_base_frames_from_source()
    flash_candidate_mask = merge_candidate_masks(candidate_masks)
    specs = create_flash_specs(flash_candidate_mask)
    frames = []

    for index, base_frame in enumerate(base_frames):
        frames.append(enhance_frame(base_frame, flash_candidate_mask, index, specs))

    write_atlas(frames)
    print(f"wrote {(FRAME_DIR / 'texture.png').relative_to(ROOT)}")
    print(f"wrote {(FRAME_DIR / 'texture.json').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
