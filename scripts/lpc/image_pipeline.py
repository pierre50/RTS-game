from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from PIL import Image

from config import ANCHORS_BY_OUTPUT_SIZE, ANCHOR, DressItem, FRAME_SIZE, OUTPUT_SCALE, PALETTES, PLAYER_SHORTS, Sheet, UnitLook
from equipment import LayerSpec, equipment_layers


@dataclass(frozen=True)
class LoadedLayer:
    image: Image.Image
    frame_size: int = FRAME_SIZE
    fallback_group: str | None = None
    offset_x: int = 0
    offset_y: int = 0
    direct_columns: bool = False
    behind_rows: tuple[int, ...] = ()
    behind_body_rows: tuple[int, ...] = ()
    is_body: bool = False


def rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.removeprefix("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def luminance(color: tuple[int, int, int]) -> float:
    r, g, b = color
    return 0.299 * r + 0.587 * g + 0.114 * b


def recolor(image: Image.Image, palette_name: str, source_palette_name: str | None = None) -> Image.Image:
    target_palette = sorted((rgb(color) for color in PALETTES[palette_name]), key=luminance)
    pixels = image.convert("RGBA")

    if source_palette_name:
        source_palette = sorted((rgb(color) for color in PALETTES[source_palette_name]), key=luminance)
        replacements = dict(zip(source_palette, target_palette))
        data = []
        for r, g, b, a in pixels.getdata():
            replacement = replacements.get((r, g, b))
            data.append((*replacement, a) if replacement else (r, g, b, a))
        pixels.putdata(data)
        return pixels

    source_colors: set[tuple[int, int, int]] = set()
    for r, g, b, a in pixels.getdata():
        if a == 0:
            continue
        source_colors.add((r, g, b))

    # Bucket every distinct source color into the target palette by luminance rank,
    # rather than keeping only the top-N most frequent ones: an asset with more
    # distinct colors than the palette has shades (e.g. a rare shine highlight) would
    # otherwise have its rarest colors silently left unrecolored.
    ordered_colors = sorted(source_colors, key=luminance)
    bucket_count = len(target_palette)
    replacements = {
        color: target_palette[min(index * bucket_count // len(ordered_colors), bucket_count - 1)]
        for index, color in enumerate(ordered_colors)
    }
    data = []
    for r, g, b, a in pixels.getdata():
        replacement = replacements.get((r, g, b))
        data.append((*replacement, a) if replacement else (r, g, b, a))
    pixels.putdata(data)
    return pixels


@lru_cache(maxsize=None)
def open_layer_cached(
    source_root: str,
    relative_path: str,
    palette: str | None = None,
    source_palette: str | None = None,
) -> Image.Image:
    source_path = Path(source_root)
    image = Image.open(source_path / relative_path).convert("RGBA")
    return recolor(image, palette, source_palette_name=source_palette) if palette else image


# LPC sheets are either 4 rows (one per direction) or, for animations like "hurt"
# that have no directional variants, a single row. A frame size is only valid if
# it's one of these standard LPC canvas sizes, so height alone disambiguates which
# row count applies without needing to know the animation name.
KNOWN_FRAME_SIZES = (64, 128, 192)


def detect_frame_size(image: Image.Image) -> int:
    height = image.height
    if height % 4 == 0 and height // 4 in KNOWN_FRAME_SIZES:
        return height // 4
    if height in KNOWN_FRAME_SIZES:
        return height
    raise ValueError(f"cannot infer frame size from image height {height}")


def open_layer(source_root: Path, layer: LayerSpec) -> LoadedLayer:
    image = open_layer_cached(str(source_root), layer.path, layer.palette, layer.source_palette)
    frame_size = layer.frame_size if layer.frame_size is not None else detect_frame_size(image)
    return LoadedLayer(
        image,
        frame_size,
        layer.fallback_group,
        layer.offset_x,
        layer.offset_y,
        layer.direct_columns,
        layer.behind_rows,
        layer.behind_body_rows,
        layer.is_body,
    )


def source_frames(sheet: Sheet) -> list[int]:
    if sheet.frame_indices:
        return list(sheet.frame_indices)
    frames = list(range(sheet.columns * sheet.rows))
    if not sheet.keep_every_other_frame:
        return frames
    return [frame for frame in frames if frame % sheet.columns % 2 == 0]


def resolve_palette(item: DressItem, team_color: str, default: str | None = None) -> str | None:
    if item.team_colored:
        return f"player_{team_color}"
    return item.palette or default


def layer_paths(
    look: UnitLook,
    animation: str,
    civ: dict[str, str],
    player_color: str,
    equipment: str | None = None,
) -> list[LayerSpec]:
    equipment_spec = equipment_layers(equipment, animation)
    team_color = player_color if player_color in PLAYER_SHORTS else "blue"

    paths: list[LayerSpec] = [
        *equipment_spec.background,
        LayerSpec(f"body/bodies/male/{animation}.png", civ["skin"], is_body=True),
    ]
    if look.cape:
        palette = resolve_palette(look.cape, team_color)
        paths.append(LayerSpec(f"{look.cape.path}/bg/{animation}.png", palette))
    if look.hair and look.hair_split:
        paths.append(LayerSpec(f"hair/{look.hair}/adult/bg/{animation}.png", look.hair_palette or civ["hair"]))
    paths.append(LayerSpec(f"head/heads/{look.head}/{animation}.png", civ["skin"]))
    if look.eyebrows:
        paths.append(LayerSpec(f"eyes/eyebrows/thick/adult/{animation}.png", civ["hair"]))
    if look.hair:
        hair_path = f"hair/{look.hair}/adult/fg/{animation}.png" if look.hair_split else f"hair/{look.hair}/adult/{animation}.png"
        paths.append(LayerSpec(hair_path, look.hair_palette or civ["hair"]))
    if look.hair_extension:
        palette = resolve_palette(look.hair_extension, team_color, default=civ["hair"])
        paths.append(LayerSpec(f"{look.hair_extension.path}/adult/{animation}.png", palette))
    if look.beard:
        paths.append(LayerSpec(f"beards/{look.beard}/{animation}.png", look.beard_palette or civ["hair"]))

    lpc_color = PLAYER_SHORTS[team_color]
    for dress_item in look.dress:
        path = dress_item.path.format(animation=animation, color=lpc_color)
        paths.append(LayerSpec(path, resolve_palette(dress_item, team_color)))
    if look.cape:
        palette = resolve_palette(look.cape, team_color)
        paths.append(LayerSpec(f"{look.cape.path}/fg/{animation}.png", palette))
    if look.hat:
        palette = resolve_palette(look.hat, team_color)
        paths.append(LayerSpec(f"{look.hat.path}/adult/{animation}.png", palette))
    if look.hat_accessory:
        palette = resolve_palette(look.hat_accessory, team_color)
        paths.append(LayerSpec(f"{look.hat_accessory.path}/adult/{animation}.png", palette))

    paths.extend(equipment_spec.foreground)
    return paths


def crop_layer_frame(layer: LoadedLayer, source_row: int, source_column: int, source_columns: int) -> Image.Image | None:
    columns = layer.image.width // layer.frame_size
    if columns <= 0:
        return None
    column = source_column
    if layer.direct_columns:
        column = min(source_column, columns - 1)
    elif columns > source_columns:
        column = min(source_column, columns - 1)
    elif columns != source_columns and source_columns > 1:
        column = round(source_column * (columns - 1) / (source_columns - 1))
    if source_row >= layer.image.height // layer.frame_size:
        return None
    return layer.image.crop(
        (
            column * layer.frame_size,
            source_row * layer.frame_size,
            column * layer.frame_size + layer.frame_size,
            source_row * layer.frame_size + layer.frame_size,
        )
    )


def group_has_pixels(crops: Iterable[Image.Image | None]) -> bool:
    return any(crop is not None and crop.getbbox() for crop in crops)


def nearest_non_empty_group_column(
    group_layers: list[LoadedLayer],
    source_row: int,
    source_column: int,
    source_columns: int,
) -> int | None:
    for distance in range(1, source_columns):
        for candidate in (source_column - distance, source_column + distance):
            if candidate < 0 or candidate >= source_columns:
                continue
            crops = [crop_layer_frame(layer, source_row, candidate, source_columns) for layer in group_layers]
            if group_has_pixels(crops):
                return candidate
    return None


def compose_frame(
    layers: Iterable[LoadedLayer],
    source_index: int,
    source_columns: int,
    context_layers: Iterable[LoadedLayer] = (),
) -> Image.Image:
    loaded_layers = list(layers)
    # Layers that participate in fallback-group emptiness checks without being
    # pasted. A fallback group spans back+front equipment layers: a frame is only
    # "missing" (and worth borrowing from a neighboring column) when the weapon is
    # absent from BOTH — not when it merely lives in the other layer this frame,
    # which is normal mid-swing (weapon passes behind the body). Standalone
    # per-layer bakes (build_equipment.py) must pass the other layer here or every
    # weapon-is-behind frame gets wrongly backfilled, duplicating the weapon.
    scan_layers = loaded_layers + list(context_layers)
    canvas_size = max((layer.frame_size for layer in loaded_layers), default=FRAME_SIZE)
    source_row = source_index // source_columns
    source_column = source_index % source_columns
    frame = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    group_fallback_columns: dict[str, int] = {}
    for group in {layer.fallback_group for layer in scan_layers if layer.fallback_group}:
        group_layers = [layer for layer in scan_layers if layer.fallback_group == group]
        crops = [crop_layer_frame(layer, source_row, source_column, source_columns) for layer in group_layers]
        if not group_has_pixels(crops):
            fallback_column = nearest_non_empty_group_column(group_layers, source_row, source_column, source_columns)
            if fallback_column is not None:
                group_fallback_columns[group] = fallback_column

    # A layer flagged behind_rows swaps paste order with whoever immediately
    # precedes it, on those rows only, e.g. a shield with no per-direction bg/fg
    # split that must stay in front overall but behind the weapon drawn right
    # before it when facing south.
    paste_order = list(range(len(loaded_layers)))
    for index, layer in enumerate(loaded_layers):
        if index > 0 and source_row in layer.behind_rows:
            paste_order[index - 1], paste_order[index] = paste_order[index], paste_order[index - 1]

    # A layer flagged behind_body_rows is pulled out of its normal spot and reinserted
    # right before the body layer, on those rows only, e.g. a carried item held in
    # front of the character everywhere except when facing away, where their own back
    # would hide it anyway. Unlike behind_rows this isn't a simple adjacent swap, since
    # the item can sit anywhere later in the list (e.g. after dress/hat layers).
    body_index = next((index for index, layer in enumerate(loaded_layers) if layer.is_body), None)
    if body_index is not None:
        for index, layer in enumerate(loaded_layers):
            if index == body_index or source_row not in layer.behind_body_rows:
                continue
            body_position = paste_order.index(body_index)
            current_position = paste_order.index(index)
            if current_position > body_position:
                paste_order.pop(current_position)
                paste_order.insert(paste_order.index(body_index), index)

    for index in paste_order:
        layer = loaded_layers[index]
        crop_column = group_fallback_columns.get(layer.fallback_group or "", source_column)
        crop = crop_layer_frame(layer, source_row, crop_column, source_columns)
        if crop is None:
            continue
        offset = (canvas_size - layer.frame_size) // 2
        frame.alpha_composite(crop, (offset + layer.offset_x, offset + layer.offset_y))
    output_size = int(canvas_size * OUTPUT_SCALE)
    return frame.resize((output_size, output_size), Image.Resampling.NEAREST)


def write_sheet(output_dir: Path, frames: list[Image.Image], animation_speed: float | None = None) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    frame_width, frame_height = frames[0].size
    atlas = Image.new("RGBA", (frame_width * len(frames), frame_height), (0, 0, 0, 0))
    json_frames = {}
    for index, frame in enumerate(frames):
        x = index * frame_width
        atlas.alpha_composite(frame, (x, 0))
        name = f"{index:03}.png"
        anchor = ANCHORS_BY_OUTPUT_SIZE.get(frame_height, ANCHOR)
        json_frames[name] = {
            "frame": {"x": x, "y": 0, "w": frame_width, "h": frame_height},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": frame_width, "h": frame_height},
            "sourceSize": {"w": frame_width, "h": frame_height},
            "anchor": anchor,
        }

    atlas.save(output_dir / "texture.png", optimize=True)
    with (output_dir / "texture.json").open("w", encoding="utf8") as file:
        data = {
            "frames": json_frames,
            "meta": {
                "image": "texture.png",
                "scale": "1",
            },
        }
        if animation_speed is not None:
            data["animationSpeed"] = animation_speed
        json.dump(data, file, indent=2)
        file.write("\n")
