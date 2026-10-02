from pathlib import Path
from collections import defaultdict,Counter
from PIL import Image
import numpy as np
import shutil,json
root=Path('public/assets/graphics/buildings'); current=root/'age-0'; backup=root/'age-0-backup-2026-10-03-v4'
a=np.array(Image.open('tmp/roof-color-match/test2-original-atlas.png').convert('RGBA'))
b=np.array(Image.open(root/'age-0-backup-2026-10-03-v3/texture.png').convert('RGBA'))
assert np.array_equal(a[:,:,3],b[:,:,3])
m=a[:,:,3]>0;counts=defaultdict(Counter)
for s,t in zip(a[:,:,:3][m],b[:,:,:3][m]): counts[tuple(map(int,s))][tuple(map(int,t))]+=1
mapping={s:c.most_common(1)[0][0] for s,c in counts.items()}
keys=np.array(list(mapping),dtype=float);values=np.array(list(mapping.values()),dtype=np.uint8)
im=Image.open(current/'texture.png').convert('RGBA');before=np.array(im); after=before.copy();m=before[:,:,3]>0
unique,inverse=np.unique(before[:,:,:3][m],axis=0,return_inverse=True)
# Weighted RGB distance keeps the existing discrete pixel-art palette.
distance=(((unique[:,None,:]-keys[None,:,:])**2)*np.array([.299,.587,.114])).sum(axis=2)
after[:,:,:3][m]=values[distance.argmin(axis=1)][inverse]
assert not backup.exists(), 'Backup exists'
shutil.copytree(current,backup)
Image.fromarray(after).save(current/'texture.png')
check=np.array(Image.open(current/'texture.png'))
assert check.shape==before.shape and np.array_equal(check[:,:,3],before[:,:,3])
assert np.array_equal(check[~m],before[~m])
for name in ['texture.json','texture_shadow.json','texture_shadow.png']:
 assert (current/name).read_bytes()==(backup/name).read_bytes()
report={'method':'Most frequent original test2 RGB to edited v3 RGB mapping; nearest weighted RGB for new colors','mapping':[{'from':list(k),'to':list(v)} for k,v in mapping.items()],'backup':str(backup),'changed_pixels':int(np.any(check[:,:,:3]!=before[:,:,:3],axis=2).sum())}
Path('tmp/roof-color-match/mapping.json').write_text(json.dumps(report,indent=2)+'\n')
print('Verified dimensions, transparency, invisible pixels, JSON and shadows unchanged. Changed pixels:',report['changed_pixels'])
