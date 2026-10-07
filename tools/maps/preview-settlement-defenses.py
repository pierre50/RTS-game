"""Preview prepared settlement footprints, roads and actual tower range.

Usage: python3 tools/maps/preview-settlement-defenses.py world.map --prepared world.settlements.json --out report.png
"""
import argparse
import base64
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('map', type=Path)
parser.add_argument('--prepared', type=Path)
parser.add_argument('--out', type=Path, default=Path('reports/roads/settlement-defenses.png'))
args = parser.parse_args()
source = json.loads(args.map.read_text())
prepared = json.loads((args.prepared or args.map.with_suffix('.settlements.json')).read_text())
roads = prepared['roads']
stride = roads['stride']
terrain = source['terrain']
if isinstance(terrain, str):
    terrain = base64.b64decode(terrain)
definition = json.loads((Path(__file__).resolve().parents[2] / 'public/assets/data/gameplay/buildings.json').read_text())
font_path = next((p for p in ['/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'] if Path(p).exists()), None)
def font(size):
    return ImageFont.truetype(font_path, size) if font_path else ImageFont.load_default()

owners = [p for p in prepared['players'] if p.get('settlementType') == 'city']
if not owners:
    owners = [p for p in prepared['players'] if p.get('type') == 'AI']
columns = min(3, max(1, len(owners)))
panel_size, radius, scale = 580, 32, 8
canvas = Image.new('RGB', (columns * panel_size, 100 + math.ceil(len(owners) / columns) * 620), '#101b25')
draw = ImageDraw.Draw(canvas)
draw.text((24, 18), 'IMPLANTATIONS ET DÉFENSES — données générées', fill='#e8eee9', font=font(24))
draw.text((24, 55), 'Or : routes · Orange : tours et portée · Bleu : centre · Vert : cultures · Blanc : bâtiments', fill='#b9c8ca', font=font(16))
colors = {0: '#607c54', 1: '#a49263', 2: '#284c62', 3: '#406a4a', 4: '#3d5a49', 5: '#817554', 6: '#284c62', 7: '#b3beb5', 255: '#101b25'}
labels = {'TownCenter': 'TC', 'WatchTower': 'T', 'Granary': 'G', 'StoragePit': 'D', 'Market': 'M', 'Forge': 'F', 'Barracks': 'C', 'ArcheryRange': 'A', 'Stable': 'E', 'Temple': 'S'}
for n, owner in enumerate(owners):
    center = next(b for b in owner['buildings'] if b['type'] in ['TownCenter', 'Granary', 'FireCamp'])
    origin_i, origin_j = center['i'] - radius, center['j'] - radius
    tile = Image.new('RGBA', (520, 520), '#101b25')
    d = ImageDraw.Draw(tile)
    def point(i, j):
        return ((j-origin_j)*scale+scale/2, (i-origin_i)*scale+scale/2)
    for di in range(65):
        for dj in range(65):
            i, j = origin_i+di, origin_j+dj
            if not (0 <= i < stride and 0 <= j < stride):
                continue
            value = terrain[i][j] if isinstance(terrain, list) else terrain[i*stride+j]
            color = colors.get(value, '#607c54')
            d.rectangle((dj*scale, di*scale, (dj+1)*scale, (di+1)*scale), fill=color)
    for resource in prepared['resources']:
        if resource.get('isDestroyed'):
            continue
        x, y = point(resource['i'], resource['j'])
        color = '#243d2b' if resource['type'] == 'Tree' else '#bed66a' if resource['type'] == 'Wheat' else '#aaa79b'
        d.rectangle((x-3,y-3,x+3,y+3), fill=color)
    coverage = Image.new('RGBA', tile.size)
    cd = ImageDraw.Draw(coverage)
    towers = [b for b in owner['buildings'] if b['type'] == 'WatchTower']
    for tower in towers:
        x, y = point(tower['i'], tower['j'])
        reach = definition['WatchTower']['range'] * scale
        cd.ellipse((x-reach,y-reach,x+reach,y+reach), fill=(255,157,66,28), outline=(255,157,66,230), width=2)
    tile = Image.alpha_composite(tile, coverage)
    d = ImageDraw.Draw(tile)
    for id, mask in roads['cells']:
        i, j = divmod(id, stride)
        if not (origin_i <= i <= origin_i+64 and origin_j <= j <= origin_j+64):
            continue
        x, y = point(i,j)
        for bit, (di,dj) in enumerate([(0,-1),(1,0),(0,1),(-1,0)]):
            if mask & (1 << bit):
                d.line((x,y,*point(i+di,j+dj)), fill='#ffdb7e', width=3)
    for player in prepared['players']:
        for building in player.get('buildings', []):
            size = building.get('size', definition[building['type']]['size'])
            before = (size-1)//2
            x,y = point(building['i']-before, building['j']-before)
            color = '#ff9d42' if building['type']=='WatchTower' else '#82c2e8' if building['type']=='TownCenter' else '#e1ded0'
            d.rectangle((x-4,y-4,x+size*scale-4,y+size*scale-4), fill=color, outline='#273033')
            if building['type'] in labels:
                d.text((x-3,y-4),labels[building['type']], fill='#182026', font=font(10))
    x, y = (n % columns)*panel_size+26, 100+(n//columns)*620
    draw.text((x,y), f"{owner.get('civ', '')} · {len(towers)} tours", fill='#e8eee9', font=font(22))
    canvas.paste(tile.convert('RGB'), (x,y+38))
    draw.text((x,y+568), 'C caserne · A archerie · E écurie · M marché · D dépôt', fill='#b9c8ca', font=font(13))
args.out.parent.mkdir(parents=True, exist_ok=True)
canvas.save(args.out)
print(args.out)
