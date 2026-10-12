from pathlib import Path
exec(Path('reports/house-interiors/render.py').read_text().split('rows=[]')[0])
data=json.loads((OUT/'maison-n3-towncenter-layout.json').read_text());bp=data['bp']
im=Image.new('RGBA',(W,H),(0,0,0,0));coords=ImageFont.truetype(fontpath,10)
for i,row in enumerate(bp['floorMask']):
 for j,exists in enumerate(row):
  if not exists:continue
  sprite,_=texture('terrain/dirt',(i*3+j*7)%9)
  paste(im,sprite,(i-j)*32-32,(i+j)*16-16)
# Draw after all tiles so borders and coordinates stay crisp.
d=ImageDraw.Draw(im)
for i,row in enumerate(bp['floorMask']):
 for j,exists in enumerate(row):
  if not exists:continue
  x=(i-j)*32+OX;y=(i+j)*16+OY
  d.line([(x-32,y),(x,y-16),(x+32,y),(x,y+16),(x-32,y)],fill=(246,229,171,155),width=1)
  d.text((x,y),f'{i},{j}',font=coords,anchor='mm',fill='#fff2c7',stroke_width=1,stroke_fill='#574337')
for wall in sorted(data['walls'],key=lambda w:w['zIndex']):
 sprite,_=texture('walls',wall['frame']+(5 if wall['low'] else 0))
 sprite=sprite.resize((round(wall['width']),round(wall['height']-(76 if wall['low'] else 0))),Image.Resampling.NEAREST)
 if wall['tint']!=0xffffff:
  rgb=ImageChops.multiply(sprite.convert('RGB'),Image.new('RGB',sprite.size,(191,191,191)));rgb.putalpha(sprite.getchannel('A'));sprite=rgb
 if wall['flip']:sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 paste(im,sprite,wall['x'],wall['y']+(76 if wall['low'] else 0))
im.save(OUT/'maison-n3-vide-grille-transparent.png')
bg=Image.new('RGBA',(W,H),(14,19,35,255));bg.alpha_composite(im);im=bg
d=ImageDraw.Draw(im)
d.text((30,28),'Maison niveau 3 — Taille du Town Center',font=font,fill='#f2db96')
d.text((30,66),'109 cases de sol · Grille de placement · Sans mobilier',font=small,fill='#a9b2c8')
e=bp['exits'][0];x=(e['i']-e['j'])*32+OX;y=(e['i']+e['j'])*16+OY
d.line([(x,y+18),(x,y+44)],fill='#79bda8',width=2);d.text((x,y+49),'Entrée',font=small,anchor='mt',fill='#79bda8')
d.text((30,H-40),'Les nombres indiquent les coordonnées des cases (i, j).',font=small,fill='#a9b2c8')
im.save(OUT/'maison-n3-vide-grille.png')
im.resize((W*2,H*2),Image.Resampling.NEAREST).save(OUT/'maison-n3-vide-grille-x2.png')
