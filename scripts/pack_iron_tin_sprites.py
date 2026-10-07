#!/usr/bin/env python3
"""Recolor original mineral pixels with duel.hex; never rescale runtime sprites."""
from copy import deepcopy
from pathlib import Path

from PIL import Image

from merge_resource_atlases import read_json, write_json, atlas_meta, write_shadow_json, SHADOW_PAD_X

ROOT = Path(__file__).resolve().parents[1]
ATLAS = ROOT / 'public/assets/graphics/resources/minerals'
# Original iron frames recovered from the committed mineral atlas, at native size.
SOURCE = ROOT / 'assets/concepts/sources/iron-original.png'
PALETTE = ROOT / 'scripts/retro_palette/duel.hex'
# Only the metallic deposits change hue; the surrounding rock keeps its palette.
TIN_COLORS = dict(zip(
    ('626871', '828b98', 'a6aeba', 'cdd2da'),
    ('857565', 'bbafa4', 'eadbc9', 'fff3d6'),
))


def rgb(value):
    return tuple(bytes.fromhex(value))


def main():
    palette = [rgb(line.strip().lstrip('#')) for line in PALETTE.read_text().splitlines() if line.strip()]
    tin_colors = {rgb(key): rgb(value) for key, value in TIN_COLORS.items()}
    if not set(tin_colors.values()).issubset(palette):
        raise ValueError('Tin colors must belong to duel.hex')
    source = Image.open(SOURCE).convert('RGBA')
    old = Image.open(ATLAS / 'texture.png').convert('RGBA')
    old_shadow = Image.open(ATLAS / 'texture_shadow.png').convert('RGBA')
    data = read_json(ATLAS / 'texture.json')
    frames = dict(list(data['frames'].items())[:12])
    iron = list(frames.items())[9:12]
    last = iron[-1][1]['frame']
    start = last['x'] + last['w'] + SHADOW_PAD_X
    width = start + sum(entry['frame']['w'] + SHADOW_PAD_X for _, entry in iron) - SHADOW_PAD_X
    atlas = Image.new('RGBA', (width, old.height))
    atlas.paste(old.crop((0, 0, start - SHADOW_PAD_X, old.height)), (0, 0))
    shadow = Image.new('RGBA', (width + SHADOW_PAD_X, old_shadow.height))
    shadow.paste(old_shadow.crop((0, 0, start, old_shadow.height)), (0, 0))
    preview = Image.new('RGBA', (3 * 87, 2 * 70))
    # One deterministic substitution per source color, with no dithering.
    nearest = {
        color[:3]: min(palette, key=lambda p: sum((a - b) ** 2 for a, b in zip(color[:3], p)))
        for color in source.getdata() if color[3]
    }
    for row, metal in enumerate(('iron', 'tin')):
        cursor = start
        for i, (name, original) in enumerate(iron):
            sprite = source.crop((i * 69, 0, (i + 1) * 69, 56))
            recolored = []
            for r, g, b, a in sprite.getdata():
                color = (r, g, b)
                target = tin_colors.get(color, nearest.get(color, color)) if metal == 'tin' else nearest.get(color, color)
                recolored.append((*target, a))
            sprite.putdata(recolored)
            frame = deepcopy(original)
            f = frame['frame']
            if metal == 'tin':
                f['x'] = cursor
                name = f'{12+i:03d}_graphics_resources_minerals_tin_{i:03d}.png'
                old_x = original['frame']['x']
                shadow.paste(old_shadow.crop((old_x, 0, old_x + f['w'] + SHADOW_PAD_X, old_shadow.height)), (cursor, 0))
                cursor += f['w'] + SHADOW_PAD_X
            atlas.paste(sprite, (f['x'], f['y']))
            preview.paste(sprite, (i * 87, row * 70))
            frames[name] = frame
    atlas.save(ATLAS / 'texture.png')
    shadow.save(ATLAS / 'texture_shadow.png')
    write_json(ATLAS / 'texture.json', {'frames': frames, 'meta': atlas_meta(atlas)})
    write_shadow_json(ATLAS, frames, shadow)
    preview.save(ROOT / 'assets/concepts/iron-tin-palette.png')
    preview.resize((783, 420), Image.Resampling.NEAREST).save(ROOT / 'assets/concepts/iron-tin-ingame-preview.png')
    print('Recolored original iron and tin sprites using duel.hex, preserving every alpha pixel.')


if __name__ == '__main__':
    main()
