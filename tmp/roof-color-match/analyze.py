from PIL import Image
from pathlib import Path
import numpy as np
import json, colorsys
from scipy.optimize import least_squares
root=Path('public/assets/graphics/buildings')
source=Image.open(root/'test2.png').convert('RGBA');meta=json.loads((root/'age-0/texture.json').read_text())
boxes=[(9,5,179,133),(192,3,372,140),(397,2,540,112),(27,145,155,248),(194,142,370,248),(392,142,549,268),(30,280,159,389),(215,282,348,421),(382,282,551,417),(47,419,141,553),(195,426,370,559)]
atlas=Image.new('RGBA',(1807,139))
for entry,box in zip(meta['frames'].values(),boxes):
 sprite=source.crop(box);f=entry['frame'];scale=min(1,f['w']/sprite.width,f['h']/sprite.height)
 if scale<1:sprite=sprite.resize((round(sprite.width*scale),round(sprite.height*scale)),Image.Resampling.NEAREST)
 atlas.paste(sprite,(f['x']+(f['w']-sprite.width)//2,f['y']+f['h']-sprite.height))
a=np.array(atlas);b=np.array(Image.open(root/'age-0-backup-2026-10-03-v3/texture.png').convert('RGBA'))
mask=(a[:,:,3]>0)&(b[:,:,3]>0)
x=a[:,:,:3][mask]/255.; y=b[:,:,:3][mask]/255.
print('alpha equality',np.array_equal(a[:,:,3],b[:,:,3]), 'n',len(x))
coef=np.linalg.lstsq(np.c_[x,np.ones(len(x))],y,rcond=None)[0];print('RGB affine',coef,'mae',np.abs(np.c_[x,np.ones(len(x))]@coef-y).mean()*255)
for name,forward,inverse in [('hsv',colorsys.rgb_to_hsv,colorsys.hsv_to_rgb),('hls',colorsys.rgb_to_hls,colorsys.hls_to_rgb)]:
 xx=np.array([forward(*v) for v in x]); yy=np.array([forward(*v) for v in y]);
 for i in [1,2]:
  p=np.linalg.lstsq(np.c_[xx[:,i],np.ones(len(xx))],yy[:,i],rcond=None)[0];print(name,i,'linear',p,'diff percentiles',np.percentile(yy[:,i]-xx[:,i],[10,50,90]))
 def fun(p):return (np.clip(xx[:,1:]*p[:2]+p[2:],0,1)-yy[:,1:]).ravel()
 fit=least_squares(fun,[1,1,0,0],loss='soft_l1',f_scale=.01);print(name,'fit',fit.x)
 np.save('tmp/roof-color-match/'+name+'.npy',fit.x)
atlas.save('tmp/roof-color-match/test2-original-atlas.png')
