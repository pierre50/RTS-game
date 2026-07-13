#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from sys import path

from PIL import Image

path.insert(0, str(Path(__file__).resolve().parent))

from config import DEFAULT_SOURCE_ROOT
from equipment import EQUIPMENT, LayerSpec
from image_pipeline import compose_frame, open_layer


def source_timeline(layers: list[LayerSpec]) -> tuple[int, int]:
    frame_size = max(layer.frame_size for layer in layers)
    main_layer = next(layer for layer in layers if layer.frame_size == frame_size)
    with Image.open(DEFAULT_SOURCE_ROOT / main_layer.path) as image:
        return image.width // main_layer.frame_size, image.height // main_layer.frame_size


def empty_composed_frames(layers: list[LayerSpec], columns: int, rows: int) -> list[int]:
    loaded_layers = [open_layer(DEFAULT_SOURCE_ROOT, layer) for layer in layers]
    return [
        frame_index
        for frame_index in range(columns * rows)
        if not compose_frame(loaded_layers, frame_index, columns).getbbox()
    ]


def main() -> None:
    for equipment, animations in EQUIPMENT.items():
        print(f"{equipment}:")
        for animation, spec in animations.items():
            layers = [*spec.background, *spec.foreground]
            if not layers:
                continue
            columns, rows = source_timeline(layers)
            empty = empty_composed_frames(layers, columns, rows)
            layer_sizes = []
            for layer in layers:
                with Image.open(DEFAULT_SOURCE_ROOT / layer.path) as image:
                    layer_sizes.append(f"{layer.path}={image.width}x{image.height}@{layer.frame_size}")
            status = "OK" if not empty else f"EMPTY {empty}"
            print(f"  {animation}: {columns}x{rows} {status}")
            for layer_size in layer_sizes:
                print(f"    {layer_size}")


if __name__ == "__main__":
    main()
