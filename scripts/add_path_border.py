"""Light inner border on exposed road edges, excluding open tile connectors.
Python 3 + Pillow + numpy.
python3 add_path_border.py input.png atlas.json --output output.png
"""
import argparse,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter

def apply_border(image,metadata,strength=.12,thickness=1,seam_margin=2):
    out=image.convert('RGBA').copy()
    ox,oy=metadata.get('offset',[0,0])
    for frame in metadata['frames']:
        x,y,w,h=frame['rect']
        tile=out.crop((x,y,x+w,y+h))
        data=np.array(tile)
        solid=(data[:,:,3]>0)
        # Padding ensures outer frame pixels are treated as exposed too.
        mask=Image.new('L',(w+2*thickness,h+2*thickness))
        mask.paste(Image.fromarray((solid*255).astype('uint8')),(thickness,thickness))
        eroded=mask.filter(ImageFilter.MinFilter(2*thickness+1)).crop((thickness,thickness,w+thickness,h+thickness))
        border=solid & (np.array(eroded)==0)
        yy,xx=np.mgrid[0:h,0:w]
        corners=frame.get('corners')
        if corners is None:
            raise ValueError('Each frame needs corners [N,E,S,W] to identify connection edges.')
        corners=[(a+ox,b+oy) for a,b in corners]
        # Bits: NE=1, SE=2, SW=4, NW=8. Each open edge is a
        # projected terrain segment; this also works on the sloped tiles.
        for k in range(4):
            if not frame['connections']&(1<<k):continue
            ax,ay=corners[k];bx,by=corners[(k+1)%4]
            dx,dy=bx-ax,by-ay;den=dx*dx+dy*dy
            if den==0:continue
            t=np.clip(((xx-ax)*dx+(yy-ay)*dy)/den,0,1)
            distance=np.hypot(xx-ax-t*dx,yy-ay-t*dy)
            border &= distance>seam_margin
        rgb=data[:,:,:3]
        rgb[border]=np.round(rgb[border].astype(float)*(1-strength)).astype('uint8')
        # Alpha is never modified: silhouette and all gaps remain identical.
        out.paste(Image.fromarray(data),(x,y))
    return out

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('image',type=Path)
    p.add_argument('metadata',type=Path)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--strength',type=float,default=.12,help='Darkening 0..1, default 0.12')
    p.add_argument('--thickness',type=int,default=1,help='Inner border width in pixels')
    p.add_argument('--seam-margin',type=float,default=2,help='Protected distance around open connectors')
    a=p.parse_args()
    if not 0<=a.strength<=1 or a.thickness<1 or a.seam_margin<0:p.error('Invalid border parameters')
    im=Image.open(a.image).convert('RGBA')
    meta=json.loads(a.metadata.read_text())
    result=apply_border(im,meta,a.strength,a.thickness,a.seam_margin)
    assert np.array_equal(np.array(im)[:,:,3],np.array(result)[:,:,3])
    a.output.parent.mkdir(parents=True,exist_ok=True)
    result.save(a.output)
    print(a.output)
if __name__=='__main__':main()
