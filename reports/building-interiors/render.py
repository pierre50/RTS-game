from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
exec(Path('reports/house-interiors/render.py').read_text().split('rows=[]')[0])
OUT=ROOT/'reports/building-interiors'; W,H=960,720
source=Path('reports/house-interiors/render-grid.py').read_text()
body=source[source.index("im=Image.new('RGBA'"):source.index("im.save(OUT/'maison-n3-vide-grille-transparent.png')")]
plain=body[:body.index('# Draw after all tiles')]+body[body.index('for wall in sorted'):]
floor_only=plain[:plain.index('for wall in sorted')]
files=[];panels=[]
for data in json.loads((OUT/'layouts.json').read_text()):
 bp=data['bp'];center=round(bp['size']/2+.001);OX=480;OY=380-center*32
 previews=[]
 for state in ['vide','grille','meuble']:
  exec(body if state=='grille' else (floor_only if state=='meuble' else plain))
  if state=='meuble':
   for rug in data['rugs']:
    i=round(center+(rug['offsetX']/32+rug['offsetY']/16)/2);j=round(center+(rug['offsetY']/16-rug['offsetX']/32)/2)
    if bp['floorMask'][i][j]!=1 or (bp['borderMask'][i][j] and not rug.get('allowBorderPlacement')):continue
    sprite,anchor=texture('buildings/deco',rug['frame'])
    paste(im,sprite,rug['offsetX']-anchor['x']*sprite.width,center*32+rug['offsetY']-anchor['y']*sprite.height)
   entities=[]
   for wall in data['walls']:
    sprite,_=texture('walls',wall['frame']+(5 if wall['low'] else 0))
    sprite=sprite.resize((round(wall['width']),round(wall['height']-(76 if wall['low'] else 0))),Image.Resampling.NEAREST)
    if wall['tint']!=0xffffff:
     rgb=ImageChops.multiply(sprite.convert('RGB'),Image.new('RGB',sprite.size,(191,191,191)));rgb.putalpha(sprite.getchannel('A'));sprite=rgb
    if wall['flip']:sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    entities.append((wall['zIndex'],sprite,wall['x'],wall['y']+(76 if wall['low'] else 0)))
   for b in data['furniture']:
    ref=b['asset']['images']['final'];sprite,anchor=texture(ref['sheet'],ref['frame'])
    if b['asset'].get('mirrored'):
     sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT);anchor={**anchor,'x':1-anchor['x']}
    entities.append((b['z'],sprite,(b['i']-b['j'])*32-anchor['x']*sprite.width,(b['i']+b['j'])*16-anchor['y']*sprite.height))
   for _,sprite,x,y in sorted(entities,key=lambda e:e[0]):paste(im,sprite,x,y)
  filename=f"{data['type']}-{state}.png";im.save(OUT/filename);files.append(OUT/filename)
  panel=Image.new('RGBA',(W,H),(14,19,35,255));panel.alpha_composite(im)
  d=ImageDraw.Draw(panel);d.text((30,24),f"{data['name']} — {'Avec mobilier' if state=='meuble' else 'Vide avec grille' if state=='grille' else 'Vide'}",font=font,fill='#f2db96')
  d.text((30,H-45),f"{data['cells']} cases · Coins légèrement coupés",font=small,fill='#a9b2c8')
  if state=='meuble':panels.append(panel)
  if state!='grille':previews.append(panel)
 pair=Image.new('RGBA',(2*W,H));pair.alpha_composite(previews[0]);pair.alpha_composite(previews[1],(W,0));pair.save(OUT/f"{data['type']}-comparatif.png");files.append(OUT/f"{data['type']}-comparatif.png")
board=Image.new('RGBA',(1440,2160),(14,19,35,255))
for index,panel in enumerate(panels):board.alpha_composite(panel.resize((720,540),Image.Resampling.LANCZOS),((index%2)*720,(index//2)*540))
d=ImageDraw.Draw(board);d.text((760,1760),'Intérieurs de bâtiments',font=font,fill='#f2db96');d.text((760,1810),'Sprites et mobilier actuels',font=small,fill='#a9b2c8');d.text((760,1840),'Sans éclairage dynamique ni chevaux',font=small,fill='#a9b2c8');d.text((760,1870),'Grottes inchangées',font=small,fill='#a9b2c8')
board.save(OUT/'apercu-interieurs.png')
with ZipFile(OUT/'interieurs-coins-adoucis.zip','w',ZIP_DEFLATED) as z:
 for p in files:z.write(p,p.name)
