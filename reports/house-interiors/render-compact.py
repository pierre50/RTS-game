from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
exec(Path('reports/house-interiors/render.py').read_text().split('rows=[]')[0])
source=Path('reports/house-interiors/render-grid.py').read_text()
start=source.index("im=Image.new('RGBA'")
end=source.index("im.save(OUT/'maison-n3-vide-grille-transparent.png')")
body=source[start:end]
no_grid=body[:body.index('# Draw after all tiles')]+body[body.index('for wall in sorted'):]
previews=[];files=[]
for data in json.loads((OUT/'compact-layouts.json').read_text()):
 bp=data['bp'];size=data['interiorSize']
 for grid in [False,True]:
  exec(body if grid else no_grid)
  im=im.crop((120,180,840,680))
  name=f"maison-taille-{size}-vide{'-grille' if grid else ''}.png"
  im.save(OUT/name);files.append(OUT/name)
  if not grid:
   panel=Image.new('RGBA',(720,550),(14,19,35,255));panel.alpha_composite(im,(0,50))
   d=ImageDraw.Draw(panel);d.text((30,22),f"Niveau {data['level']} — Taille {size}",font=font,fill='#f2db96')
   previews.append(panel)
board=Image.new('RGBA',(2160,550),(14,19,35,255))
for n,panel in enumerate(previews):board.alpha_composite(panel,(n*720,0))
board.save(OUT/'maisons-vides-9-10-11.png')
with ZipFile(OUT/'maisons-vides-9-10-11.zip','w',ZIP_DEFLATED) as z:
 for p in files:z.write(p,p.name)
