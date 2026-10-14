"""Complete empty LPC action cells by rotating an existing layered weapon pose."""

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from PIL import Image


Point = tuple[int, int]
Box = tuple[int, int, int, int]


@dataclass(frozen=True)
class LayerTransfer:
    """Move part of the rotated foreground behind the character's hand."""

    box: Box
    background_position: Point
    foreground_shift: Point = (0, 0)


@dataclass(frozen=True)
class RotatedPose:
    source_frame: int
    pivot: Point
    angle: float
    offset: Point = (0, 0)
    layer_transfer: LayerTransfer | None = None
    final_shift: Point = (0, 0)


def _shift(image: Image.Image, offset: Point) -> Image.Image:
    shifted = Image.new("RGBA", image.size)
    shifted.alpha_composite(image, offset)
    return shifted


def _cell(image: Image.Image, row: int, frame: int, size: int) -> Image.Image:
    return image.crop((frame * size, row * size, (frame + 1) * size, (row + 1) * size))


def write_rotated_action_frames(
    source_dir: Path,
    output_dir: Path,
    sprite_name: str,
    frame_size: int,
    recipes: Mapping[tuple[int, int], RotatedPose],
) -> None:
    """Fill selected (row, frame) cells and preserve all other source pixels.

    Both directories use ``background/<sprite_name>`` and
    ``foreground/<sprite_name>``. A rotated pose combines both source layers,
    then draws in front unless a recipe transfers a region behind the body.
    """

    layers = {
        side: Image.open(source_dir / side / sprite_name).convert("RGBA")
        for side in ("background", "foreground")
    }
    width, height = layers["foreground"].size
    if frame_size <= 0 or layers["background"].size != (width, height):
        raise ValueError("layer sizes must match and frame_size must be positive")
    if width % frame_size or height % frame_size:
        raise ValueError("layer dimensions must be multiples of frame_size")
    columns, rows = width // frame_size, height // frame_size
    completed = {side: image.copy() for side, image in layers.items()}

    for (row, target_frame), recipe in sorted(recipes.items()):
        if not (0 <= row < rows and 0 <= target_frame < columns and 0 <= recipe.source_frame < columns):
            raise ValueError(f"pose {(row, target_frame)} is outside the sprite sheet")
        if any(_cell(image, row, target_frame, frame_size).getbbox() for image in layers.values()):
            raise ValueError(f"pose {(row, target_frame)} already has source pixels")

        source = _cell(layers["background"], row, recipe.source_frame, frame_size)
        source.alpha_composite(_cell(layers["foreground"], row, recipe.source_frame, frame_size))
        if not source.getbbox():
            raise ValueError(f"source pose {(row, recipe.source_frame)} is empty")
        rotated = source.rotate(recipe.angle, resample=Image.Resampling.NEAREST, center=recipe.pivot)
        foreground = _shift(rotated, recipe.offset)
        background = Image.new("RGBA", (frame_size, frame_size))

        if transfer := recipe.layer_transfer:
            left, top, right, bottom = transfer.box
            if not (0 <= left < right <= frame_size and 0 <= top < bottom <= frame_size):
                raise ValueError(f"invalid transferred region for pose {(row, target_frame)}")
            background.alpha_composite(foreground.crop(transfer.box), transfer.background_position)
            foreground.paste((0, 0, 0, 0), transfer.box)
            foreground = _shift(foreground, transfer.foreground_shift)

        for side, image in (("background", background), ("foreground", foreground)):
            image = _shift(image, recipe.final_shift)
            completed[side].paste(image, (target_frame * frame_size, row * frame_size))

    for side, image in completed.items():
        destination = output_dir / side / sprite_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination)
