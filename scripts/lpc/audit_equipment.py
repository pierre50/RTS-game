#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from sys import path

path.insert(0, str(Path(__file__).resolve().parent))

from config import DEFAULT_SOURCE_ROOT
from equipment import EQUIPMENT
from image_pipeline import LoadedLayer, compose_frame, open_layer


def source_timeline(loaded_layers: list[LoadedLayer]) -> tuple[int, int]:
    frame_size = max(layer.frame_size for layer in loaded_layers)
    main_layer = next(layer for layer in loaded_layers if layer.frame_size == frame_size)
    return main_layer.image.width // frame_size, main_layer.image.height // frame_size


def empty_composed_frames(loaded_layers: list[LoadedLayer], columns: int, rows: int) -> list[int]:
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
            loaded_layers = [open_layer(DEFAULT_SOURCE_ROOT, layer) for layer in layers]
            columns, rows = source_timeline(loaded_layers)
            empty = empty_composed_frames(loaded_layers, columns, rows)
            status = "OK" if not empty else f"EMPTY {empty}"
            print(f"  {animation}: {columns}x{rows} {status}")
            for layer, loaded in zip(layers, loaded_layers):
                print(f"    {layer.path}={loaded.image.width}x{loaded.image.height}@{loaded.frame_size}")


if __name__ == "__main__":
    main()
