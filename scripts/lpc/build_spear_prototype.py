#!/usr/bin/env python3
"""Build an isolated slash spear study from local LPC halberd art (Pillow only).

Usage: python3 scripts/lpc/build_spear_prototype.py
Outputs source layers, comparison PNG/GIF and a self-contained HTML viewer.
Does not replace production assets. See output CREDITS.md for source attribution.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import base64
import io
import json
import math

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/spear-v1'
SRC = ROOT / 'scripts/lpc/spritesheets/weapon/polearm/halberd'
WOOD = {(65, 30, 5), (98, 53, 28)}
METAL = {(138, 170, 171), (74, 80, 87), (169, 201, 202)}
DARK = (29, 19, 30, 255)
# These cells have a readable head, not a broad motion smear.
CLEAN_POSES = {(r, c) for r in range(4) for c in range(3)} | {(0, 3)}
# The last side-facing cell mixes a readable head and a lingering trail.
MIXED_POSES = {(1, 5), (3, 5)}
SLASH_BODY_TIMELINE = (0, 1, 2, 2, 3, 3, 4, 4, 5)


def spear_head(back, front, mixed=False):
    combined = Image.alpha_composite(back, front)
    wood, metal = [], []
    for y in range(combined.height):
        for x in range(combined.width):
            p = combined.getpixel((x, y))
            if not p[3]:
                continue
            if p[:3] in WOOD:
                wood.append((x, y))
            if p[:3] in METAL:
                metal.append((x, y))
    if len(wood) < 2 or not metal:
        return back, front
    # Principal axis through the existing wooden shaft, including its hand gaps.
    mx = sum(x for x, y in wood) / len(wood)
    my = sum(y for x, y in wood) / len(wood)
    xx = sum((x-mx)**2 for x,y in wood)
    yy = sum((y-my)**2 for x,y in wood)
    xy = sum((x-mx)*(y-my) for x,y in wood)
    a = .5 * math.atan2(2*xy, xx-yy)
    ux, uy = math.cos(a), math.sin(a)
    # Point towards the original metal head, rather than the butt of the shaft.
    metal_near = sorted(metal, key=lambda p: min((p[0]-x)**2+(p[1]-y)**2 for x,y in wood))[:12]
    gx = sum(x for x,y in metal_near)/len(metal_near)
    gy = sum(y for x,y in metal_near)/len(metal_near)
    if (gx-mx)*ux+(gy-my)*uy < 0:
        ux, uy = -ux, -uy
    t = max((x-mx)*ux+(y-my)*uy for x,y in wood)
    bx, by = mx+t*ux, my+t*uy
    nx, ny = -uy, ux
    layers = [back.copy(), front.copy()]
    scores = [0, 0]
    for li, layer in enumerate(layers):
        for y in range(layer.height):
            for x in range(layer.width):
                p = layer.getpixel((x,y))
                if not p[3] or p[:3] in WOOD:
                    continue
                along = (x-bx)*ux+(y-by)*uy
                across = (x-bx)*nx+(y-by)*ny
                # Mixed cells retain every pixel outside the small head region.
                if mixed and not (-1 <= along <= 15 and abs(across) <= 7):
                    continue
                keep_shaft_outline = p == DARK and along <= 0 and abs(across) <= 1.4
                if not keep_shaft_outline:
                    if p[:3] in METAL:
                        scores[li] += 1
                    layer.putpixel((x,y), (0,0,0,0))
    target = layers[0 if scores[0] > scores[1] else 1]
    draw = ImageDraw.Draw(target)
    def pt(t, w):
        return (round(bx+t*ux+w*nx), round(by+t*uy+w*ny))
    # Narrow leaf-shaped grey tip. Same palette as the original motion trails.
    draw.polygon([pt(0,0), pt(3,-2), pt(11,0), pt(3,2)], fill=DARK)
    draw.polygon([pt(1,0), pt(3,-1), pt(9,0), pt(3,1)], fill=(138,170,171,255))
    draw.line([pt(3,-1), pt(9,0)], fill=(169,201,202,255))
    draw.line([pt(1,0), pt(3,1)], fill=(74,80,87,255))
    return layers


def dagger_trails(pair, dagger_root=None):
    """Accepted dagger ribbons, aligned by explicit 64px source blade poses."""
    root=dagger_root or ROOT/'scripts/lpc/spritesheets/weapon/sword/dagger'
    sources=[Image.open(root/path/'dagger.png').convert('RGBA') for path in ('behind/slash','slash')]
    # base, blade tip, crop below blade (or left of it for the back pose).
    poses={(0,4):((53,25),(53,17),'left',52),
           (1,3):((13,44),(8,50),'below',49),
           (1,4):((9,33),(1,33),'below',34),
           (2,4):((54,44),(59,50),'below',50),
           (3,3):((50,44),(55,50),'below',50),
           (3,4):((54,33),(62,33),'below',34)}
    palette={(196,181,159):(138,170,171,255), (255,255,255):(169,201,202,255),
             (114,107,126):(74,80,87,255)}
    result=[im.copy() for im in pair]
    for (row,col),(base,head,side,limit) in poses.items():
        box=(col*192,row*192,(col+1)*192,(row+1)*192)
        tiles=[im.crop(box) for im in pair];merged=Image.alpha_composite(*tiles)
        wood=[];metal=[]
        for y in range(192):
            for x in range(192):
                p=merged.getpixel((x,y))
                if p[3] and p[:3] in WOOD: wood.append((x,y))
                if p[3] and p[:3] in METAL: metal.append((x,y))
        mx=sum(x for x,y in wood)/len(wood);my=sum(y for x,y in wood)/len(wood)
        gx=sum(x for x,y in metal)/len(metal);gy=sum(y for x,y in metal)/len(metal)
        angle=math.atan2(gy-my,gx-mx);ux,uy=math.cos(angle),math.sin(angle)
        tip=max(metal,key=lambda p:(p[0]-mx)*ux+(p[1]-my)*uy)
        masks=[{},{}]
        for li,im in enumerate(sources):
            cell=im.crop((col*64,row*64,(col+1)*64,(row+1)*64))
            for y in range(64):
                for x in range(64):
                    p=cell.getpixel((x,y))
                    keep=x<=limit if side=='left' else y>=limit
                    if keep and p[3]==255 and p[:3] in palette: masks[li][x,y]=palette[p[:3]]
        points=set(masks[0])|set(masks[1])
        ax,ay=min(points,key=lambda p:(p[0]-head[0])**2+(p[1]-head[1])**2)
        angle-=math.atan2(head[1]-base[1],head[0]-base[0]);ca,sa=math.cos(angle),math.sin(angle)
        ribbons=[Image.new('RGBA',(192,192)) for _ in range(2)]
        for y in range(max(0,tip[1]-40),min(192,tip[1]+41)):
            for x in range(max(0,tip[0]-40),min(192,tip[0]+41)):
                dx,dy=x-tip[0],y-tip[1]
                q=(round(ax+ca*dx+sa*dy),round(ay-sa*dx+ca*dy))
                for li in range(2):
                    if q in masks[li]: ribbons[li].putpixel((x,y),masks[li][q])
        for li in range(2):
            ribbons[li].alpha_composite(tiles[li]);result[li].paste(ribbons[li],box)
    return result


def build_layers(animation, size, columns, source_root=SRC, output_root=OUT):
    back = Image.open(source_root/animation/'behind/halberd.png').convert('RGBA')
    front = Image.open(source_root/animation/'halberd.png').convert('RGBA')
    modified = [back.copy(), front.copy()]
    for r in range(4):
        for c in range(columns):
            box=(c*size,r*size,(c+1)*size,(r+1)*size)
            pair=[im.crop(box) for im in [back,front]]
            pair=spear_head(*pair)
            for im, tile in zip(modified,pair):
                im.paste(tile,box)
    dest=output_root/'sources'/animation
    (dest/'behind').mkdir(parents=True,exist_ok=True)
    modified[0].save(dest/'behind/spear.png')
    modified[1].save(dest/'spear.png')
    return [back,front],modified


def build_hurt_layers(source_root=SRC, output_root=OUT):
    """Convert the six LPC fall poses, preserving their original grip/layering."""
    sources=[Image.open(source_root/path).convert('RGBA') for path in ('behind/halberd.png','halberd.png')]
    pair=[Image.new('RGBA',(6*64,64)) for _ in range(2)]
    for col in range(6):
        box=(col*64,20*64,(col+1)*64,21*64)
        for layer,tile in zip(pair,spear_head(*(im.crop(box) for im in sources))):
            layer.paste(tile,(col*64,0))
    return lengthen_layers(pair,'hurt',6,output_root=output_root)


def lengthen_layers(pair, animation, columns, output_root=OUT, dagger_root=None):
    """Extend only the outer shaft; move the head and sweep radially, at 1x pixels."""
    old_size=64 if animation in ('walk','hurt') else 192
    rows=pair[0].height//old_size
    result=[Image.new('RGBA',(columns*192,rows*192)) for _ in range(2)]
    for row in range(rows):
        for col in range(columns):
            layers=[]
            for source in pair:
                tile=Image.new('RGBA',(192,192))
                tile.alpha_composite(source.crop((col*old_size,row*old_size,(col+1)*old_size,(row+1)*old_size)),((192-old_size)//2,)*2)
                layers.append(tile)
            merged=Image.alpha_composite(*layers)
            wood=[];metal=[]
            for y in range(192):
                for x in range(192):
                    pixel=merged.getpixel((x,y))
                    if pixel[3] and pixel[:3] in WOOD: wood.append((x,y))
                    if pixel[3] and pixel[:3] in METAL: metal.append((x,y))
            if len(wood)<2 or not metal: continue
            mx=sum(x for x,y in wood)/len(wood);my=sum(y for x,y in wood)/len(wood)
            xx=sum((x-mx)**2 for x,y in wood);yy=sum((y-my)**2 for x,y in wood);xy=sum((x-mx)*(y-my) for x,y in wood)
            a=.5*math.atan2(2*xy,xx-yy);ux,uy=math.cos(a),math.sin(a)
            near=sorted(metal,key=lambda p:min((p[0]-x)**2+(p[1]-y)**2 for x,y in wood))[:10]
            if sum((x-mx)*ux+(y-my)*uy for x,y in near)<0: ux,uy=-ux,-uy
            tip=max((x-mx)*ux+(y-my)*uy for x,y in wood)
            bx,by=mx+tip*ux,my+tip*uy
            # Project the character's hand region onto the existing shaft.
            grip=(96-mx)*ux+(100-my)*uy
            px,py=mx+grip*ux,my+grip*uy
            extra=.4*(tip-grip+11)
            extra=max(4,extra)
            if animation in ('walk','hurt'):
                # Match the extended slash shaft (~48px), adding wood only
                # towards the tip; grip, butt and hand occlusion stay fixed.
                shaft_length=tip-min((x-mx)*ux+(y-my)*uy for x,y in wood)
                extra=max(0,48-shaft_length)
            shafts=[];effects=[]
            for tile in layers:
                shaft=Image.new('RGBA',(192,192));effect=shaft.copy()
                for y in range(192):
                    for x in range(192):
                        p=tile.getpixel((x,y))
                        if not p[3]: continue
                        along=(x-bx)*ux+(y-by)*uy;across=-(x-bx)*uy+(y-by)*ux
                        is_wood=p[:3] in WOOD or (p==DARK and along<=0 and abs(across)<=1.5)
                        (shaft if is_wood else effect).putpixel((x,y),p)
                shafts.append(shaft);effects.append(effect)
            for li,effect in enumerate(effects):
                moved=Image.new('RGBA',(192,192))
                moved.alpha_composite(effect,(round(extra*ux),round(extra*uy)))
                # Add wood only past the old shaft end: original hand gaps remain.
                scores=[sum(1 for p in e.get_flattened_data() if p[3]) for e in effects]
                owner=0 if scores[0]>scores[1] else 1
                if li==owner:
                    draw=ImageDraw.Draw(shafts[li]);start=(round(bx),round(by));end=(round(bx+extra*ux),round(by+extra*uy))
                    draw.line([start,end],fill=DARK,width=3)
                    draw.line([start,end],fill=(98,53,28,255),width=1)
                shafts[li].alpha_composite(moved)
                result[li].paste(shafts[li],(col*192,row*192))
    if animation == 'attack_slash':
        result=dagger_trails(result, dagger_root)
    dest=output_root/'sources-long'/animation
    (dest/'behind').mkdir(parents=True,exist_ok=True)
    result[0].save(dest/'behind/spear.png');result[1].save(dest/'spear.png')
    return result


def data_url(im):
    buf=io.BytesIO();im.save(buf,format='PNG')
    return 'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()


def _directed_weapon_angle(back, front):
    """Return the shaft angle pointing from the grip/butt towards the metal head."""
    combined=Image.alpha_composite(back,front)
    wood=[];metal=[]
    for y in range(combined.height):
        for x in range(combined.width):
            p=combined.getpixel((x,y))
            if not p[3]: continue
            if p[:3] in WOOD: wood.append((x,y))
            if p[:3] in METAL: metal.append((x,y))
    if len(wood)<2 or not metal: return 0
    mx=sum(x for x,y in wood)/len(wood);my=sum(y for x,y in wood)/len(wood)
    xx=sum((x-mx)**2 for x,y in wood);yy=sum((y-my)**2 for x,y in wood);xy=sum((x-mx)*(y-my) for x,y in wood)
    angle=.5*math.atan2(2*xy,xx-yy)
    ux,uy=math.cos(angle),math.sin(angle)
    # Motion trails share the metal palette but must not steer the shaft.
    # Only metal pixels nearest to the wooden shaft identify the actual tip.
    metal_near=sorted(metal,key=lambda p:min((p[0]-x)**2+(p[1]-y)**2 for x,y in wood))[:12]
    gx=sum(x for x,y in metal_near)/len(metal_near);gy=sum(y for x,y in metal_near)/len(metal_near)
    if (gx-mx)*ux+(gy-my)*uy<0: angle+=math.pi
    return angle


def expand_slash_timeline(pair, columns=6):
    """Create weapon-only in-betweens while the six-frame body holds its poses."""
    rows=pair[0].height//192
    result=[Image.new('RGBA',(len(SLASH_BODY_TIMELINE)*192,rows*192)) for _ in range(2)]
    for row in range(rows):
        poses=[]
        angles=[]
        for col in range(columns):
            box=(col*192,row*192,(col+1)*192,(row+1)*192)
            pose=[layer.crop(box) for layer in pair]
            poses.append(pose);angles.append(_directed_weapon_angle(*pose))

        def grip_for(pose):
            merged=Image.alpha_composite(*pose)
            wood=[]
            for y in range(merged.height):
                for x in range(merged.width):
                    if merged.getpixel((x,y))[:3] in WOOD and merged.getpixel((x,y))[3]: wood.append((x,y))
            # Select the shaft pixel nearest the animated hand, rather than
            # rotating every direction around one global canvas coordinate.
            hand=(96,100)
            return min(wood,key=lambda p:(p[0]-hand[0])**2+(p[1]-hand[1])**2) if wood else hand

        def behind_head(pose):
            back,front=(layer.copy() for layer in pose)
            # The body is composited between these layers. Moving only pixels
            # inside the head silhouette keeps the shaft in the hand while the
            # upper section correctly disappears behind the skull.
            cx,cy,rx,ry=96,77,12,14
            for y in range(cy-ry,cy+ry+1):
                for x in range(cx-rx,cx+rx+1):
                    if ((x-cx)/rx)**2+((y-cy)/ry)**2>1: continue
                    pixel=front.getpixel((x,y))
                    if pixel[3]:
                        back.putpixel((x,y),pixel);front.putpixel((x,y),(0,0,0,0))
            return [back,front]

        def rotated(source, target, progress, pivot_source=None):
            delta=(angles[target]-angles[source]+math.pi)%(2*math.pi)-math.pi
            degrees=-math.degrees(delta*progress)
            pivot=grip_for(poses[pivot_source if pivot_source is not None else source])
            return [tile.rotate(degrees,resample=Image.Resampling.NEAREST,center=pivot) for tile in poses[source]]

        # Start the first in-between while the body still holds pose 2.
        # The body never receives a synthetic frame: only its timing changes.
        timeline=[
            poses[0],poses[1],poses[2],
            rotated(3,2,1/2),poses[3],
            rotated(3,4,.33),rotated(4,3,1/2),poses[4],
            rotated(4,5,1/2),
        ]
        if row in (0,2):
            # The source angles of poses 2 and 3 are nearly identical in
            # these views; move the held pose 3 toward the next spear angle.
            timeline[4]=rotated(3,4,.18)
        def shorten_butt(layers,grip_y,ratio):
            """Remove only the excess wood above the hand; preserve the tip."""
            merged=Image.alpha_composite(*layers)
            wood=[(x,y) for y in range(192) for x in range(192)
                  if (p:=merged.getpixel((x,y)))[3] and p[:3] in WOOD]
            if not wood: return layers
            top=min(y for x,y in wood)
            cutoff=round(grip_y-(grip_y-top)*ratio)
            left=min(x for x,y in wood)-2;right=max(x for x,y in wood)+2
            result=[layer.copy() for layer in layers]
            for layer in result:
                # Rotation can leave a dark outline pixel just above the
                # first wood pixel. Trim that outline with the shortened butt.
                for y in range(max(0,top-3),cutoff):
                    for x in range(left,right+1):
                        p=layer.getpixel((x,y))
                        if p[:3] in WOOD or p==DARK: layer.putpixel((x,y),(0,0,0,0))
            return result
        def tuck_upper_butt(layers,grip_y,shift_x):
            """Lean only the wood above the grip toward the character."""
            merged=Image.alpha_composite(*layers)
            wood=[(x,y) for y in range(grip_y) for x in range(192)
                  if (p:=merged.getpixel((x,y)))[3] and p[:3] in WOOD]
            if not wood: return layers
            top=min(y for x,y in wood)
            left=min(x for x,y in wood)-2;right=max(x for x,y in wood)+2
            result=[layer.copy() for layer in layers]
            for layer in result:
                moved=[]
                for y in range(top,grip_y):
                    dx=round(shift_x*(grip_y-y)/(grip_y-top))
                    for x in range(left,right+1):
                        p=layer.getpixel((x,y))
                        if p[:3] in WOOD or p==DARK:
                            layer.putpixel((x,y),(0,0,0,0))
                            moved.append((x+dx,y,p))
                for x,y,p in moved:
                    layer.putpixel((x,y),p)
            return result
        def trim_right_butt(layers,grip_x):
            """Stop the butt at the visible hand without shrinking the spearhead."""
            result=[layer.copy() for layer in layers]
            for layer in result:
                for y in range(192):
                    for x in range(grip_x+1,192):
                        p=layer.getpixel((x,y))
                        if p[:3] in WOOD or p==DARK:
                            layer.putpixel((x,y),(0,0,0,0))
            return result
        if row==1:
            # 4/9, vue gauche only: the pointing hand is left of the generic
            # canvas centre. Rotate, then attach the result to that visible
            # hand; changing the pivot alone leaves it between the feet.
            delta=(angles[2]-angles[3]+math.pi)%(2*math.pi)-math.pi
            degrees=-math.degrees(delta/2)
            corrected=[]
            for tile in poses[3]:
                turned=tile.rotate(degrees,resample=Image.Resampling.NEAREST,center=(86,98))
                # With the body still on pose 2, its visible grip is farther
                # right than pose 3's: keep the shaft attached to that hand.
                placed=Image.new('RGBA',turned.size);placed.alpha_composite(turned,(-11,-18));corrected.append(placed)
            # 4/9, gauche: only the butt above the hand recedes in depth.
            # The full-size metal tip, trail and hand-to-tip shaft stay put.
            timeline[3]=tuck_upper_butt(shorten_butt(corrected,107,.38),107,3)
            # Split the former vertical-to-diagonal jump across the two
            # held-body images, rotating about the pointing hand.
            delta=(angles[2]-angles[3]+math.pi)%(2*math.pi)-math.pi
            degrees=-math.degrees(delta*.23)
            timeline[4]=[tile.rotate(degrees,resample=Image.Resampling.NEAREST,center=(76,109)) for tile in poses[3]]
            # During the raise, the shaft must stop in the pointing hand;
            # its old butt otherwise runs horizontally through the neck.
            timeline[5]=trim_right_butt(timeline[5],77)
            timeline[6]=trim_right_butt(timeline[6],77)
        if row==0:
            # In back view, the incoming pose likewise has an extra tail
            # sticking out beyond the raised hand.
            timeline[6]=trim_right_butt(timeline[6],116)
        if row==2:
            # 7/9, face only: keep pose 4's correct hand contact and rotate it
            # only a quarter turn back, avoiding the vertical between the feet.
            delta=(angles[3]-angles[4]+math.pi)%(2*math.pi)-math.pi
            degrees=-math.degrees(delta/4)
            face=[]
            for tile in poses[4]:
                turned=tile.rotate(degrees,resample=Image.Resampling.NEAREST,center=(106,101))
                placed=Image.new('RGBA',turned.size);placed.alpha_composite(turned,(5,-8));face.append(placed)
            timeline[6]=face
        for index in (3,4,5,6,7,8): timeline[index]=behind_head(timeline[index])
        for col,pose in enumerate(timeline):
            for layer,tile in zip(result,pose): layer.paste(tile,(col*192,row*192))
    return result


def split_slash_depth_against_body(pair, body_texture, body_frames):
    """Bake the accepted nine-pose back/front split against the body silhouette.

    The weapon art stays in two layers; the body is not baked into either one.
    This matches the preview's body-aware overlap at the held slash poses.
    """
    result=[layer.copy() for layer in pair]
    for row in range(4):
        for col in (3,5,6,8):
            box=(col*192,row*192,(col+1)*192,(row+1)*192)
            weapon=Image.alpha_composite(*(layer.crop(box) for layer in pair))
            body_frame=SLASH_BODY_TIMELINE[col]
            body_row=1 if row==3 else row
            key=f'{body_row*6+body_frame:03}_graphics_units_hero_hellas_male_action_slash.png'
            frame=body_frames[key]['frame']
            body=body_texture.crop((frame['x'],frame['y'],frame['x']+frame['w'],frame['y']+frame['h']))
            if row==3: body=ImageOps.mirror(body)
            character=Image.new('RGBA',(192,192))
            character.alpha_composite(body,(64,64))
            back=Image.new('RGBA',(192,192));front=Image.new('RGBA',(192,192))
            for y in range(192):
                for x in range(192):
                    pixel=weapon.getpixel((x,y))
                    if not pixel[3]: continue
                    behind=character.getpixel((x,y))[3] and (y<100 or (row==0 and col in (3,5)))
                    (back if behind else front).putpixel((x,y),pixel)
            result[0].paste(back,box)
            result[1].paste(front,box)
    return result


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    original,modified=build_layers('attack_slash',192,6)
    walk_original,walk_modified=build_layers('walk',64,13)
    original=modified
    modified=lengthen_layers(original,'attack_slash',6)
    original=dagger_trails(original)
    original=expand_slash_timeline(original)
    modified=expand_slash_timeline(modified)
    walk_original=walk_modified
    walk_modified=lengthen_layers(walk_original,'walk',13)
    hurt=build_hurt_layers()
    hero_path=ROOT/'public/assets/graphics/units/hero/hellas/male'
    hero=Image.open(hero_path/'texture.png').convert('RGBA')
    frames=json.loads((hero_path/'texture.json').read_text())['frames']
    def body(r,c,walking=False):
        index=(1 if r==3 else r)*(9 if walking else 6)+c
        suffix='body_walking' if walking else 'action_slash'
        key=f'{index:03}_graphics_units_hero_hellas_male_{suffix}.png'
        f=frames[key]['frame']
        tile=hero.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
        return ImageOps.mirror(tile) if r==3 else tile
    def composed(pair,r,c,walking=False):
        size=64 if walking and pair is walk_original else 192
        box=(c*size,r*size,(c+1)*size,(r+1)*size)
        im=Image.new('RGBA',(192,192))
        offset=(192-size)//2
        im.alpha_composite(pair[0].crop(box),(offset,offset))
        im.alpha_composite(body(r,c,walking),(64,64))
        im.alpha_composite(pair[1].crop(box),(offset,offset))
        return im.crop((16,12,176,172))
    def composed_dynamic_depth(pair,r,c,body_frame):
        """Split the complete weapon with the current character silhouette.

        The overlap is derived from the actual body pixels, so the occlusion
        hole stays attached to the character instead of rotating with the art.
        """
        box=(c*192,r*192,(c+1)*192,(r+1)*192)
        back=pair[0].crop(box);front=pair[1].crop(box)
        weapon=Image.alpha_composite(back,front)
        character=Image.new('RGBA',(192,192));character.alpha_composite(body(r,body_frame),(64,64))
        dynamic_back=Image.new('RGBA',(192,192));dynamic_front=Image.new('RGBA',(192,192))
        # Above the hand, intersections belong behind the character (notably
        # the head). Below it, the shaft remains in front and readable.
        for y in range(192):
            for x in range(192):
                pixel=weapon.getpixel((x,y))
                if not pixel[3]: continue
                overlaps_character=character.getpixel((x,y))[3]>0
                # In back-view 4/9 and 6/9, the shaft passes behind the
                # entire character silhouette until it reaches the hand.
                # A y-only cutoff exposes it across the neck on 4/10.
                target=dynamic_back if overlaps_character and (y<100 or (r==0 and c in (3,5))) else dynamic_front
                target.putpixel((x,y),pixel)
        im=Image.new('RGBA',(192,192));im.alpha_composite(dynamic_back)
        im.alpha_composite(character);im.alpha_composite(dynamic_front)
        return im.crop((16,12,176,172))
    def composed_original_depth(pair,r,c,body_frame):
        box=(c*192,r*192,(c+1)*192,(r+1)*192)
        im=Image.new('RGBA',(192,192));im.alpha_composite(pair[0].crop(box))
        im.alpha_composite(body(r,body_frame),(64,64));im.alpha_composite(pair[1].crop(box))
        return im.crop((16,12,176,172))
    slash_frames=len(SLASH_BODY_TIMELINE)
    atlas=Image.new('RGBA',(slash_frames*160,8*160))
    walking_atlas=Image.new('RGBA',(9*160,8*160))
    for r in range(4):
        for v,pair in enumerate([original,modified]):
            for c,body_frame in enumerate(SLASH_BODY_TIMELINE):
                tile=(composed_dynamic_depth(pair,r,c,body_frame) if c in (3,5,6,8) else composed_original_depth(pair,r,c,body_frame))
                atlas.paste(tile,(c*160,(r*2+v)*160))
        for v,pair in enumerate([walk_original,walk_modified]):
            for c in range(9): walking_atlas.paste(composed(pair,r,c,True),(c*160,(r*2+v)*160))
    atlas.save(OUT/'comparison-atlas.png')
    walking_atlas.save(OUT/'walking-atlas.png')
    sheet=Image.new('RGB',(slash_frames*320+140,3*320),'#303641');draw=ImageDraw.Draw(sheet)
    for r in range(3):
        draw.text((10,r*320+30),['Dos','Gauche','Face','Droite'][r],fill='white')
        for c in range(slash_frames):
            tile=atlas.crop((c*160,(r*2+1)*160,(c+1)*160,(r*2+2)*160)).resize((320,320),Image.Resampling.NEAREST)
            sheet.paste(tile,(140+c*320,r*320),tile)
    sheet.save(OUT/'spear-v1-contact.png')
    gifs=[]
    for c in range(slash_frames):
        im=Image.new('RGB',(1280,696),'#303641');d=ImageDraw.Draw(im)
        d.text((15,12),'LANCE COURTE',fill='white');d.text((15,360),'LANCE LONGUE — MARCHE AJUSTÉE',fill='white')
        for r in range(4):
            for v in range(2):
                tile=atlas.crop((c*160,(r*2+v)*160,(c+1)*160,(r*2+v+1)*160)).resize((320,320),Image.Resampling.NEAREST)
                im.paste(tile,(r*320,28+v*348),tile)
        gifs.append(im)
    gifs[0].save(OUT/'spear-v1.gif',save_all=True,append_images=gifs[1:],duration=[147]+[80]*(slash_frames-2)+[200],loop=0)
    hurt_frames=[]
    hurt_sheet=Image.new('RGB',(6*320,320),'#303641')
    for c in range(6):
        key=f'{c:03}_graphics_units_hero_hellas_male_body_dying.png'
        f=frames[key]['frame'];tile=Image.new('RGBA',(192,192))
        tile.alpha_composite(hurt[0].crop((c*192,0,(c+1)*192,192)))
        tile.alpha_composite(hero.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])),(64,64))
        tile.alpha_composite(hurt[1].crop((c*192,0,(c+1)*192,192)))
        tile=tile.crop((16,12,176,172)).resize((320,320),Image.Resampling.NEAREST)
        display=Image.new('RGB',(320,320),'#303641');display.paste(tile,(0,0),tile)
        hurt_frames.append(display);hurt_sheet.paste(display,(c*320,0))
    hurt_sheet.save(OUT/'hurt-contact.png')
    hurt_frames[0].save(OUT/'hurt.gif',save_all=True,append_images=hurt_frames[1:],duration=[250]*5+[900],loop=0)
    html='''<!doctype html><html lang="fr"><meta charset="utf-8"><title>Lance slash · V1</title>
<style>body{background:#181d26;color:#eef0f5;font:16px system-ui;margin:32px auto;max-width:1160px;padding:0 20px}h1{font-size:28px}p{color:#b9c2d1;line-height:1.5}canvas{width:100%;image-rendering:pixelated;background:#303641;border-radius:12px}button,select,input{font:inherit;margin:8px;padding:8px}label{display:inline-block}a{color:#b7ddff}</style>
<h1>Lance longue · rotation expérimentale</h1><p>Le corps tient brièvement sa pose 2 puis sa pose 3 pendant que la lance tourne. La séparation arrière/avant est recalculée avec sa silhouette réelle.</p>
<button id="play">Pause</button><label>Animation <select id="anim"><option value="slash">Slash 9 temps</option><option value="walk">Marche</option></select></label><label>Vitesse <select id="speed"><option value="120">Normale</option><option value="300">Ralenti</option><option value="80">Rapide</option></select></label><label>Image <input id="frame" type="range" min="0" max="8" value="0"></label><span id="count"></span>
<canvas id="view" width="960" height="352"></canvas><p>Corps : 0 · 1 · 2 · 3 · 3 · 3 · 4 · 4 · 5. Vues : dos, gauche et face.</p>
<h2>Hurt · chute</h2><img src="hurt.gif" width="320" height="320" style="image-rendering:pixelated"><p>Six poses ; la dernière est utilisée pour le corps au sol.</p><script>const slash=new Image(),walk=new Image();slash.src=SLASH_DATA;walk.src=WALK_DATA;const cv=document.getElementById('view'),ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;let running=true,index=0,last=0;const range=document.getElementById('frame');document.getElementById('play').onclick=()=>{running=!running;document.getElementById('play').textContent=running?'Pause':'Lecture'};range.oninput=()=>{index=+range.value;running=false;document.getElementById('play').textContent='Lecture'};document.getElementById('anim').onchange=()=>{index=0;range.max=8};function render(t){let isWalk=document.getElementById('anim').value==='walk',n=9,img=isWalk?walk:slash,delay=+document.getElementById('speed').value*(isWalk?1:2/3);if(running&&t-last>delay){index=(index+1)%n;last=t}range.value=index;document.getElementById('count').textContent=(index+1)+' / '+n;ctx.fillStyle='#303641';ctx.fillRect(0,0,960,352);ctx.fillStyle='#eef0f5';ctx.font='16px system-ui';ctx.fillText('LANCE LONGUE',16,24);if(img.complete&&img.naturalWidth){for(let r=0;r<3;r++){let row=r*2+1;ctx.drawImage(img,index*160,row*160,160,160,r*320,30,320,320)}}requestAnimationFrame(render)}requestAnimationFrame(render);</script></html>'''
    html=html.replace('SLASH_DATA',json.dumps(data_url(atlas))).replace('WALK_DATA',json.dumps(data_url(walking_atlas)))
    (OUT/'index.html').write_text(html)
    credits='''# Lance slash V1 — prototype visuel

Dérivé des sprites LPC de hallebarde locaux, par Benjamin K. Smith (BenCreating), bluecarrot16 et Sander Frenken (castelonia).
Source : https://opengameart.org/content/lpc-medieval-weapons
Licence retenue pour les sprites dérivés : CC-BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/).
Crédits originaux : scripts/lpc/sheet_definitions/weapon_polearm_halberd.json.
Modifications : tête affinée, pointe axiale grise ; conservation des manches et des couches ; traînées extraites de la dague LPC, recolorées et orientées selon chaque pose, au pixel le plus proche sans anticrénelage.
Traînées de cet aperçu : dague LPC, bluecarrot16, Johannes Sjölund (wulax), Matthew Krohn (makrohn). Licence retenue CC-BY-SA 3.0. Crédits : scripts/lpc/sheet_definitions/weapon_sword_dagger.json.
La lance LPC a servi de référence visuelle uniquement ; aucun de ses pixels n'est importé.
Les aperçus utilisent le héros Hellas existant du projet, dont les crédits LPC restent applicables (scripts/lpc/sheet_definitions/).

Régénération : python3 scripts/lpc/build_spear_prototype.py
Ouvrir index.html pour comparer slash/marche, ralentir et avancer image par image.
Les PNG dans sources/ conservent la lance courte ; sources-long/ contient la version longue, avec la hampe de marche ajustée à 48 pixels pour rejoindre le slash. Toutes les cases longues font 192 × 192 pixels, marche comprise. Version longue utilisée par le générateur LPC pour les lances pierre, bronze et fer. Raccords définis par pose, rotation au pixel le plus proche, aucune transparence partielle.
Les quatre directions sources sont conservées. Le runtime actuel ne conserve que dos/gauche/face et reflète gauche pour droite.
'''
    (OUT/'CREDITS.md').write_text(credits)
    print(f'Generated {OUT}/index.html and spear-v1.gif')

if __name__=='__main__':
    main()
