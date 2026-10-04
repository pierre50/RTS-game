"""Render actual prepared roads, terrain and obstacles; no game sprites required.
Usage: python3 tools/maps/preview-roads.py path/to/world.map [--out reports/roads]
"""
import argparse, base64, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('map', type=Path)
parser.add_argument('--out', type=Path, default=Path('reports/roads'))
args = parser.parse_args()
source = json.loads(args.map.read_text())
prepared = json.loads(args.map.with_suffix('.settlements.json').read_text())
roads = prepared['roads']
stride = roads['stride']
terrain = base64.b64decode(source['terrain'])
relief = base64.b64decode(source['relief'])
layout = source['localGridLayout']
args.out.mkdir(parents=True, exist_ok=True)
font_path = next((p for p in ['/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'] if Path(p).exists()), None)
def font(size):
    return ImageFont.truetype(font_path, size) if font_path else ImageFont.load_default()
BG = '#101b25'
INK = '#e8eee9'
MUTED = '#9db2ba'
GOLD = '#ffd188'
COLORS = [(96, 124, 84), (164, 146, 99), (40, 76, 98), (64, 106, 74), (61, 90, 73), (129, 117, 84), (40, 76, 98), (179, 190, 181)]
def projected(i, j):
    return (i-j+layout['columns']-1, (i+j-layout['columns']+1)/2)
size = (2*(layout['columns']-1)+1, (layout['rows']-1)//2+1)
base = Image.new('RGB', size, COLORS[2])
draw = ImageDraw.Draw(base)
for i in range(stride):
    for j in range(stride):
        k = i*stride+j
        t = terrain[k]
        if t == 255: continue
        x,y = projected(i,j)
        h = relief[k] if relief[k] < 128 else relief[k]-256
        color = tuple(max(0,min(255,c+h*8)) for c in COLORS[t])
        draw.polygon([(x-1,y),(x,y-.5),(x+1,y),(x,y+.5)], fill=color)
# All real trees, rocks, crops and building footprints, including outposts.
for r in prepared['resources']:
    if r.get('isDestroyed'): continue
    x,y = projected(r['i'],r['j'])
    color = '#274d37' if r['type']=='Tree' else '#d0b36d' if r['type']=='Wheat' else '#aaa79b'
    draw.point((round(x),round(y)), fill=color)
for owner in prepared['players']:
    for b in owner.get('buildings',[]):
        s=b.get('size',1); before=(s-1)//2; after=s-before-1
        draw.polygon([projected(b['i']-before-.5,b['j']-before-.5),projected(b['i']+after+.5,b['j']-before-.5),projected(b['i']+after+.5,b['j']+after+.5),projected(b['i']-before-.5,b['j']+after+.5)],fill='#dad6c1')

def route_lines(canvas, transform, width):
    d=ImageDraw.Draw(canvas)
    for color,w in [('#5c4933',width+2),(GOLD,width)]:
        for route in roads['routes']:
            points=[transform(*projected(k//stride,k%stride)) for k in route['cells']]
            if len(points)>1: d.line(points, fill=color, width=w, joint='curve')

canvas=Image.new('RGB',(1500,1260),BG)
d=ImageDraw.Draw(canvas)
d.text((42,28),'CHEMINS ENTRE VILLES ET VILLAGES',font=font(30),fill=INK)
d.text((42,76),'Carte réelle générée • terrain, forêts et implantations existantes',font=font(19),fill=MUTED)
city_count=sum(a['profile']=='city' for a in roads['anchors'])
village_count=sum(a['profile']=='village' for a in roads['anchors'])
d.text((42,108),f"{city_count} villes  /  {village_count} villages  /  {len(roads['routes'])} liaisons  /  {len(roads['cells']):,} cases de chemin".replace(',', ' '),font=font(19),fill=GOLD)
map_image=base.resize((1070,1070),Image.Resampling.NEAREST)
route_lines(map_image,lambda x,y:(x*1070/size[0],y*1070/size[1]),3)
canvas.paste(map_image,(30,160))
d=ImageDraw.Draw(canvas)
for n,a in enumerate(roads['anchors'],1):
    x,y=projected(a['i'],a['j']); x=30+x*1070/size[0]; y=160+y*1070/size[1]
    r=8 if a['profile']=='city' else 5
    d.ellipse((x-r,y-r,x+r,y+r),fill=GOLD if a['profile']=='city' else INK,outline=BG,width=2)
    # Numbered tags keep the overview readable and correspond to the sidebar.
    label=str(n); tx=x+9; ty=y-19
    box=d.textbbox((tx,ty),label,font=font(15))
    d.rectangle((box[0]-3,box[1]-2,box[2]+3,box[3]+2),fill=BG)
    d.text((tx,ty),label,font=font(15),fill=INK)
d.text((1130,165),'LES IMPLANTATIONS',font=font(19),fill=INK)
for n,a in enumerate(roads['anchors'],1):
    label=a['settlementId'].replace(':city',' · ville').replace(':village-',' · village ')
    d.text((1130,207+(n-1)*29),f'{n:02}  {label}',font=font(17),fill=GOLD if a['profile']=='city' else INK)
for k,(color,text) in enumerate([(GOLD,'Chemin de terre'),('#274d37','Arbres / forêts'),('#dad6c1','Bâtiments'),('#d0b36d','Cultures')]):
    y=945+k*31;d.rectangle((1130,y+3,1143,y+16),fill=color);d.text((1155,y),text,font=font(17),fill=MUTED)
d.text((1130,1090),'Vue de planification',font=font(18),fill=INK)
d.text((1130,1118),'Rendu en jeu à intégrer ensuite.',font=font(15),fill=MUTED)
canvas.save(args.out/'roads-overview.png')

# Detail 1: a real town entrance. Detail 2: a bend near woodland away from town centers.
city=next((a for a in roads['anchors'] if a['profile']=='city'), roads['anchors'][0])
center1=projected(city['i'],city['j'])
trees=[(r['i'],r['j']) for r in prepared['resources'] if r['type']=='Tree' and not r.get('isDestroyed')]
# Use local tree buckets to rank real bends without expensive all-pairs comparisons.
buckets={}
for i,j in trees:buckets.setdefault((i//16,j//16),[]).append((i,j))
best=None
for route in roads['routes']:
    cells=route['cells']
    for k in range(8,len(cells)-8):
        id=cells[k];i,j=divmod(id,stride)
        if cells[k]-cells[k-1]==cells[k+1]-cells[k]:continue
        if any(abs(i-a['i'])+abs(j-a['j'])<45 for a in roads['anchors']):continue
        near=sum(1 for di in range(-1,2) for dj in range(-1,2) for a,b in buckets.get((i//16+di,j//16+dj),[]) if abs(a-i)+abs(b-j)<22)
        if best is None or near>best[0]:best=(near,projected(i,j))
center2=best[1] if best else center1
zoom=Image.new('RGB',(1500,910),BG);d=ImageDraw.Draw(zoom)
d.text((35,25),'LE TRACÉ AU PLUS PRÈS DU TERRAIN',font=font(29),fill=INK)
d.text((35,72),'Extraits du même réseau • aucun arbre ni bâtiment supprimé',font=font(19),fill=MUTED)
for x0,center,title in [(30,center1,'01  Accès à la ville de '+city['civ']),(775,center2,'02  Détour au voisinage des arbres')]:
    cx,cy=center; span=112; left=cx-span/2;top=cy-span/2
    patch=base.crop((round(left),round(top),round(left)+span,round(top)+span)).resize((690,690),Image.Resampling.NEAREST)
    factor=690/span
    # Exact offset used by the raster crop preserves overlay alignment.
    route_lines(patch,lambda x,y:((x-round(left))*factor,(y-round(top))*factor),4)
    zoom.paste(patch,(x0,165));d=ImageDraw.Draw(zoom)
    d.text((x0,122),title,font=font(21),fill=GOLD)
d.text((35,873),'Sable : chemins   •   Vert sombre : arbres   •   Blanc : bâtiments   •   Or : cultures',font=font(18),fill=MUTED)
zoom.save(args.out/'roads-details.png')
print(json.dumps({'overview':str(args.out/'roads-overview.png'),'details':str(args.out/'roads-details.png'),'roads':roads['summary']},ensure_ascii=False))
