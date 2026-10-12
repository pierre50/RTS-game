#!/usr/bin/env python3
"""Build the small stone projectile in the game's duel.hex palette."""
import json
from PIL import Image
from config import PROJECT_ROOT


def build_pebble_projectile():
    palette = ['#222323', '#434549', '#626871', '#a6aeba']
    pixels = ['.122.', '12332', '12221', '.111.']
    image = Image.new('RGBA', (5, 4))
    for y, row in enumerate(pixels):
        for x, value in enumerate(row):
            if value != '.':
                color = palette[int(value)]
                image.putpixel((x, y), (*bytes.fromhex(color[1:]), 255))
    output = PROJECT_ROOT / 'public/assets/graphics/projectiles/pebble'
    output.mkdir(parents=True, exist_ok=True)
    image.save(output / 'texture.png')
    frame = {'frame': {'x': 0, 'y': 0, 'w': 5, 'h': 4}, 'rotated': False, 'trimmed': False,
             'spriteSourceSize': {'x': 0, 'y': 0, 'w': 5, 'h': 4}, 'sourceSize': {'w': 5, 'h': 4},
             'anchor': {'x': 0.5, 'y': 0.5}}
    atlas = {'frames': {'000_graphics_projectiles_pebble.png': frame},
             'meta': {'app': 'build_pebble_projectile.py', 'version': '1.0.0', 'image': 'texture.png',
                      'format': 'RGBA8888', 'size': {'w': 5, 'h': 4}, 'scale': 1}}
    (output / 'texture.json').write_text(json.dumps(atlas, indent=2) + '\n')


if __name__ == '__main__':
    build_pebble_projectile()
