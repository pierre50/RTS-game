"""Export the normal macro-world biome field at the requested continent resolution.

Uses the world's climate, coastline, lake and biome transition rules unchanged;
only the offline raster resolution changes. No 25-million Python-cell object grid.
"""
import importlib.util
import sys
from pathlib import Path
from PIL import Image


def generate(source, width, height, destination, preview_path, seed, biomes):
    spec = importlib.util.spec_from_file_location(
        "macro_world", Path(__file__).resolve().parents[1] / "generate-macro-world.py")
    macro = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(macro)
    source = Path(source).resolve()
    if not source.is_file():
        raise ValueError(f"Missing continent mask: {source}")
    allowed = [macro.normalize_biome(value) for value in biomes.split(',')]
    if not allowed or any(value not in macro.BIOME_SECTORS for value in allowed):
        raise ValueError(f"Biomes must be selected from {macro.BIOME_SECTORS}")
    terrain = macro.build_macro_terrain_grid(seed, [], allowed, source)
    codes = bytes(ord(macro.TERRAIN_CODES[biome]) for row in terrain for biome in row)
    field = Image.frombytes('L', (macro.WORLD_WIDTH, macro.WORLD_HEIGHT), codes)
    field = field.resize((width, height), Image.Resampling.NEAREST)
    Path(destination).write_bytes(field.tobytes())
    preview = field.resize((1000, 1000), Image.Resampling.NEAREST).convert('P')
    palette = [0] * 768
    for biome, code in macro.TERRAIN_CODES.items():
        palette[ord(code) * 3:ord(code) * 3 + 3] = macro.COLORS[biome]
    preview.putpalette(palette)
    preview.convert('RGB').save(preview_path)


if __name__ == '__main__':
    generate(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5],
             int(sys.argv[6]), sys.argv[7])
