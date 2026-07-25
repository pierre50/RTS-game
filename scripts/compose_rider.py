#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


DEFAULT_CUT_Y = 51
DEFAULT_LEGS_ATTACH_Y = 47
DEFAULT_FRAME_WIDTH = 64
DEFAULT_FRAME_HEIGHT = 64
DEFAULT_LEG_FRAME_WIDTH = 54
DEFAULT_LEG_FRAME_HEIGHT = 62
DEFAULT_DIRECTIONS = 3

# Direction rows are north, west, south. East is mirrored at runtime.
DIRECTION_LEG_FRAMES = (0, 1, 2)
DIRECTION_ALIGNMENT = (
    # archer_belt_cx, legs_cx, extra_x
    (30, 24, 1),
    (33, 18, -4),
    (30, 26, 1),
)


def _opaque_top(image: Image.Image) -> int:
    arr = np.array(image.convert("RGBA"))
    rows = np.where(arr[:, :, 3] > 0)[0]
    return int(rows.min()) if rows.size else 0


def compose_rider_frames(
    source_frames: list[Image.Image],
    legs: Image.Image,
    *,
    cut_y: int = DEFAULT_CUT_Y,
    frame_width: int = DEFAULT_FRAME_WIDTH,
    frame_height: int = DEFAULT_FRAME_HEIGHT,
    leg_frame_width: int = DEFAULT_LEG_FRAME_WIDTH,
    directions: int = DEFAULT_DIRECTIONS,
    legs_attach_y: int = DEFAULT_LEGS_ATTACH_Y,
) -> list[Image.Image]:
    if directions != len(DIRECTION_LEG_FRAMES):
        raise ValueError(f"expected {len(DIRECTION_LEG_FRAMES)} directions, got {directions}")
    if len(source_frames) % directions != 0:
        raise ValueError(f"source frame count {len(source_frames)} is not divisible by {directions}")

    frames_per_direction = len(source_frames) // directions
    output: list[Image.Image] = []

    for direction_index in range(directions):
        leg_index = DIRECTION_LEG_FRAMES[direction_index]
        archer_cx, legs_cx, extra_x = DIRECTION_ALIGNMENT[direction_index]
        legs_frame = legs.crop((leg_index * leg_frame_width, 0, (leg_index + 1) * leg_frame_width, DEFAULT_LEG_FRAME_HEIGHT)).convert("RGBA")
        lx = archer_cx - legs_cx + extra_x
        ly = legs_attach_y + 1 - _opaque_top(legs_frame)

        for frame_index in range(frames_per_direction):
            source_index = direction_index * frames_per_direction + frame_index
            source = source_frames[source_index].convert("RGBA")
            torso = source.crop((0, 0, frame_width, cut_y))

            canvas = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
            legs_layer = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
            torso_layer = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
            legs_layer.paste(legs_frame, (lx, ly), legs_frame)
            torso_layer.paste(torso, (0, 0), torso)
            canvas = Image.alpha_composite(canvas, legs_layer)
            canvas = Image.alpha_composite(canvas, torso_layer)
            output.append(canvas)

    return output


def compose_rider_sheet(
    source_path: Path,
    legs_path: Path,
    output_path: Path,
    *,
    frame_width: int = DEFAULT_FRAME_WIDTH,
    frame_height: int = DEFAULT_FRAME_HEIGHT,
    directions: int = DEFAULT_DIRECTIONS,
    cut_y: int = DEFAULT_CUT_Y,
    legs_attach_y: int = DEFAULT_LEGS_ATTACH_Y,
) -> None:
    source = Image.open(source_path).convert("RGBA")
    legs = Image.open(legs_path).convert("RGBA")
    frame_count = source.width // frame_width
    frames = [
        source.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height))
        for index in range(frame_count)
    ]
    output_frames = compose_rider_frames(
        frames,
        legs,
        cut_y=cut_y,
        frame_width=frame_width,
        frame_height=frame_height,
        directions=directions,
        legs_attach_y=legs_attach_y,
    )
    atlas = Image.new("RGBA", (frame_width * len(output_frames), frame_height), (0, 0, 0, 0))
    for index, frame in enumerate(output_frames):
        atlas.alpha_composite(frame, (index * frame_width, 0))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compose an LPC rider action sheet by replacing legs.")
    parser.add_argument("source", type=Path, help="Input LPC action texture.png")
    parser.add_argument("output", type=Path, help="Output texture.png")
    parser.add_argument("--legs", type=Path, default=Path(__file__).with_name("legs_3frames.png"))
    parser.add_argument("--cut-y", type=int, default=DEFAULT_CUT_Y)
    parser.add_argument("--legs-attach-y", type=int, default=DEFAULT_LEGS_ATTACH_Y)
    parser.add_argument("--frame-width", type=int, default=DEFAULT_FRAME_WIDTH)
    parser.add_argument("--frame-height", type=int, default=DEFAULT_FRAME_HEIGHT)
    args = parser.parse_args()
    compose_rider_sheet(
        args.source,
        args.legs,
        args.output,
        cut_y=args.cut_y,
        legs_attach_y=args.legs_attach_y,
        frame_width=args.frame_width,
        frame_height=args.frame_height,
    )


if __name__ == "__main__":
    main()
