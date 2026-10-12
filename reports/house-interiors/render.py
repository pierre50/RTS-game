from PIL import Image, ImageDraw, ImageFont, ImageChops
from pathlib import Path
import json
ROOT=Path.cwd(); OUT=ROOT/'reports/house-interiors'
SHEETS={'terrain/dirt':'terrain/dirt','buildings/deco':'graphics/structures/decorations','walls':'terrain/interior-walls/wood'}
cache={}
def texture(sheet,index):
 if sheet not in cache:
  base=ROOT/'public/assets'/SHEETS[sheet]
  frames=json.loads((base/'texture.json').read_text())['frames']
  cache[sheet]=(Image.open(base/'texture.png').convert('RGBA'),frames)
 atlas,frames=cache[sheet]
 keys=sorted(frames,key=lambda k:int(k.split('_')[0]))
 key=next((k for k in keys if int(k.split('_')[0])==index),keys[index])
 f=frames[key]; r=f['frame']; im=atlas.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
 return im,f.get('anchor',{'x':.5,'y':.5})
fontpath='/System/Library/Fonts/Supplemental/Arial.ttf'
font=ImageFont.truetype(fontpath,24); small=ImageFont.truetype(fontpath,17)
W,H=960,780; OX,OY=480,150

def paste(im,sprite,x,y): im.alpha_composite(sprite,(round(x+OX),round(y+OY)))
rows=[]
for data in json.loads((OUT/'layouts.json').read_text()):
 pair=[]
 for furnished in [False,True]:
  im=Image.new('RGBA',(W,H),(0,0,0,0));bp=data['bp']
  for i,row in enumerate(bp['floorMask']):
   for j,exists in enumerate(row):
    if exists:
     sprite,_=texture('terrain/dirt',(i*3+j*7)%9)
     paste(im,sprite,(i-j)*32-32,(i+j)*16-16)
  entities=[]
  for wall in data['walls']:
   sprite,_=texture('walls',wall['frame']+(5 if wall['low'] else 0))
   sprite=sprite.resize((round(wall['width']),round(wall['height']-(76 if wall['low'] else 0))),Image.Resampling.NEAREST)
   if wall['tint']!=0xffffff:
    rgb=sprite.convert('RGB');rgb=ImageChops.multiply(rgb,Image.new('RGB',rgb.size,(191,191,191)));rgb.putalpha(sprite.getchannel('A'));sprite=rgb
   if wall['flip']: sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   entities.append((wall['zIndex'],sprite,wall['x'],wall['y']+(76 if wall['low'] else 0)))
  if furnished:
   for b in data['furniture']:
    ref=b['asset']['images']['final'];sprite,anchor=texture(ref['sheet'],ref['frame'])
    if b['asset'].get('mirrored'):
     sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT);anchor={**anchor,'x':1-anchor['x']}
    entities.append((b['z'],sprite,(b['i']-b['j'])*32-anchor['x']*sprite.width,(b['i']+b['j'])*16-anchor['y']*sprite.height))
  for _,sprite,x,y in sorted(entities,key=lambda e:e[0]): paste(im,sprite,x,y)
  im.save(OUT/f"maison-n{data['level']}-{'meublee' if furnished else 'vide'}-transparent.png")
  bg=Image.new('RGBA',(W,H),(14,19,35,255));bg.alpha_composite(im);im=bg
  d=ImageDraw.Draw(im);d.text((30,24),f"Niveau {data['level']} · {data['beds']} lit{'s' if data['beds']>1 else ''} · {'Avec mobilier' if furnished else 'Sans mobilier'}",font=font,fill='#f2db96')
  e=bp['exits'][0];ex=(e['i']-e['j'])*32+OX;ey=(e['i']+e['j'])*16+OY
  d.line([(ex,ey+20),(ex,ey+44)],fill='#79bda8',width=2);d.text((ex-25,ey+48),'Entrée',font=small,fill='#79bda8')
  d.text((30,H-35),'Même échelle · Sprites actuels · Implantation initiale',font=small,fill='#a9b2c8')
  file=f"maison-n{data['level']}-{'meublee' if furnished else 'vide'}.png"; im.save(OUT/file); pair.append(im)
 row=Image.new('RGBA',(W*2,H),(14,19,35,255));row.alpha_composite(pair[0],(0,0));row.alpha_composite(pair[1],(W,0));ImageDraw.Draw(row).line([(W,20),(W,H-20)],fill='#364157',width=2);row.save(OUT/f"maison-n{data['level']}-comparatif.png");rows.append(row)
board=Image.new('RGBA',(W*2,H*3),(14,19,35,255))
for i,row in enumerate(rows):board.alpha_composite(row,(0,i*H))
board.save(OUT/'maisons-tous-niveaux.png')
