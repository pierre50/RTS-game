#!/usr/bin/env python3
"""Reproducible, cached source preparation for the accepted long slash spear."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import tempfile
from PIL import Image
from config import DEFAULT_SOURCE_ROOT, PROJECT_ROOT
from build_spear_prototype import (
    build_layers,
    build_hurt_layers,
    expand_slash_timeline,
    lengthen_layers,
    split_slash_depth_against_body,
)


def build_spear_sources(source_root: Path = DEFAULT_SOURCE_ROOT) -> None:
    origin = source_root / 'weapon/polearm/halberd'
    target = source_root / 'weapon/polearm/spear_slash'
    inputs = [Path(__file__), Path(__file__).with_name('build_spear_prototype.py')]
    dagger_root = source_root / 'weapon/sword/dagger'
    inputs.extend(dagger_root / layer / 'dagger.png' for layer in ('behind/slash', 'slash'))
    hero_root = PROJECT_ROOT / 'public/assets/graphics/units/hero/hellas/male'
    inputs.extend((hero_root / 'texture.png', hero_root / 'texture.json'))
    outputs = []
    for animation in ('walk', 'attack_slash'):
        for layer in ('', 'behind/'):
            inputs.append(origin / animation / f'{layer}halberd.png')
            outputs.append(target / animation / f'{layer}spear.png')
    inputs.extend(origin / path for path in ('halberd.png', 'behind/halberd.png'))
    outputs.extend(target / 'hurt' / path for path in ('spear.png', 'behind/spear.png'))
    digest = hashlib.sha256(b''.join(p.read_bytes() for p in inputs)).hexdigest()
    cache = target / 'generation.json'
    if cache.exists() and all(p.exists() for p in outputs):
        previous = json.loads(cache.read_text())
        hashes = {str(p.relative_to(target)): hashlib.sha256(p.read_bytes()).hexdigest() for p in outputs}
        if previous.get('inputHash') == digest and previous.get('outputs') == hashes:
            return
    with tempfile.TemporaryDirectory(prefix='lpc-spear-') as temporary:
        work = Path(temporary)
        hero_texture = Image.open(hero_root / 'texture.png').convert('RGBA')
        hero_frames = json.loads((hero_root / 'texture.json').read_text())['frames']
        for animation, size, columns in [('walk', 64, 13), ('attack_slash', 192, 6)]:
            _, short = build_layers(animation, size, columns, source_root=origin, output_root=work)
            long = lengthen_layers(short, animation, columns, output_root=work, dagger_root=dagger_root)
            if animation == 'attack_slash':
                poses = split_slash_depth_against_body(expand_slash_timeline(long), hero_texture, hero_frames)
                slash_root = work / 'sources-long/attack_slash'
                poses[0].save(slash_root / 'behind/spear.png')
                poses[1].save(slash_root / 'spear.png')
        build_hurt_layers(source_root=origin, output_root=work)
        target.mkdir(parents=True, exist_ok=True)
        shutil.copytree(work/'sources-long', target, dirs_exist_ok=True)
    hashes = {str(p.relative_to(target)): hashlib.sha256(p.read_bytes()).hexdigest() for p in outputs}
    cache.write_text(json.dumps({'inputHash': digest, 'outputs': hashes}, indent=2)+'\n')
    print(f'Prepared long slash spear sources: {target}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE_ROOT)
    build_spear_sources(parser.parse_args().source)
