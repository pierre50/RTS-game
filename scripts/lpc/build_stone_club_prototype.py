#!/usr/bin/env python3
"""Build an isolated stone club study from the generated LPC spear layers."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import json
import math

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "scripts/lpc/spritesheets/weapon/polearm/spear_slash"
OUTPUT = ROOT / "reports/stone-club-v0"
WOOD = {(65, 30, 5), (98, 53, 28)}
METAL = {(138, 170, 171), (74, 80, 87), (169, 201, 202)}
DARK = (29, 19, 30, 255)
STONE_COLORS = {(82, 86, 86), (139, 143, 138), (54, 58, 61),
                (185, 184, 170)}
# Hand contact points measured on the Hellas slash poses, in 192 px cells.
SLASH_GRIPS = (
    ((105, 111), (85, 102), (85, 102), (85, 102), (114, 94), (109, 100)),
    ((88, 108), (83, 111), (84, 110), (80, 108), (73, 97), (77, 95)),
    ((105, 110), (85, 107), (84, 110), (108, 108), (111, 107), (108, 104)),
    ((88, 112), (108, 111), (107, 110), (110, 108), (109, 99), (92, 102)),
)


def replace_head(pair, grip=None):
    merged = Image.alpha_composite(*pair)
    wood = []
    metal = []
    for y in range(192):
        for x in range(192):
            pixel = merged.getpixel((x, y))
            if not pixel[3]:
                continue
            if pixel[:3] in WOOD:
                wood.append((x, y))
            elif pixel[:3] in METAL:
                metal.append((x, y))
    if len(wood) < 2 or not metal:
        return pair

    mx = sum(x for x, _ in wood) / len(wood)
    my = sum(y for _, y in wood) / len(wood)
    xx = sum((x - mx) ** 2 for x, y in wood)
    yy = sum((y - my) ** 2 for x, y in wood)
    xy = sum((x - mx) * (y - my) for x, y in wood)
    angle = 0.5 * math.atan2(2 * xy, xx - yy)
    ux, uy = math.cos(angle), math.sin(angle)
    nearest = sorted(metal, key=lambda point: min(
        (point[0] - x) ** 2 + (point[1] - y) ** 2 for x, y in wood
    ))[:12]
    if sum((x - mx) * ux + (y - my) * uy for x, y in nearest) < 0:
        ux, uy = -ux, -uy
    nx, ny = -uy, ux
    end = max((x - mx) * ux + (y - my) * uy for x, y in wood)
    bx, by = mx + end * ux, my + end * uy
    if grip is not None:
        # The grip stays on the hand while the shortened weapon rotates.
        bx, by = grip[0] + 25 * ux, grip[1] + 25 * uy

    def point(along, across):
        return (round(bx + along * ux + across * nx),
                round(by + along * uy + across * ny))

    result = [Image.new("RGBA", (192, 192)) for _ in pair]
    scores = [0, 0]
    for index, layer in enumerate(pair):
        for y in range(192):
            for x in range(192):
                pixel = layer.getpixel((x, y))
                if pixel[:3] in METAL:
                    scores[index] += 1

    owner = 1 if grip is not None else (0 if scores[0] > scores[1] else 1)
    draw = ImageDraw.Draw(result[owner])
    # A short club with a subtly conical handle: narrow at the butt and
    # broader where the leather wraps beneath the stone.
    length = 30
    draw.polygon([point(-length, -1), point(-length + 2, -2),
                  point(-3, -3), point(1, -3), point(1, 3),
                  point(-3, 3), point(-length + 2, 2), point(-length, 1)],
                 fill=DARK)
    draw.polygon([point(-length + 2, 0), point(-length + 4, -1),
                  point(-3, -2), point(0, -2), point(0, 2),
                  point(-3, 2), point(-length + 4, 1)],
                 fill=(91, 51, 28, 255))
    draw.line([point(-length + 5, -1), point(-7, -2)],
              fill=(130, 79, 43, 255), width=1)
    draw = ImageDraw.Draw(result[owner])
    outline = [point(-2, -3), point(1, -5), point(7, -5),
               point(11, -2), point(10, 3), point(6, 6),
               point(0, 5), point(-3, 2)]
    draw.polygon(outline, fill=DARK)
    draw.polygon([point(-1, -2), point(2, -4), point(7, -4),
                  point(9, -1), point(8, 3), point(5, 4),
                  point(0, 3)], fill=(82, 86, 86, 255))
    draw.polygon([point(1, -2), point(4, -4), point(7, -3),
                  point(5, 0), point(2, 1)], fill=(139, 143, 138, 255))
    draw.line([point(0, 3), point(5, 4), point(8, 2)],
              fill=(54, 58, 61, 255), width=1)
    draw.line([point(4, -3), point(6, -2)],
              fill=(185, 184, 170, 255), width=1)
    for along in (-3, -6):
        draw.line([point(along, -2), point(along + 1, 2)],
                  fill=(192, 149, 87, 255), width=1)
    return result


def stone_center(pair):
    merged = Image.alpha_composite(*pair)
    pixels = [(x, y) for y in range(192) for x in range(192)
              if merged.getpixel((x, y))[:3] in STONE_COLORS]
    return (round(sum(x for x, _ in pixels) / len(pixels)),
            round(sum(y for _, y in pixels) / len(pixels)))


def add_slash_trail(pair, previous, current, previous_grip, grip):
    trail = Image.new("RGBA", (192, 192))
    draw = ImageDraw.Draw(trail)
    start = math.atan2(previous[1] - previous_grip[1],
                       previous[0] - previous_grip[0])
    finish = math.atan2(current[1] - grip[1], current[0] - grip[0])
    sweep = (finish - start + math.pi) % (2 * math.pi) - math.pi
    if abs(sweep) >= 0.18:
        radius = math.hypot(current[0] - grip[0], current[1] - grip[1])
        steps = max(6, round(abs(sweep) * 15))
        points = [
            (round(grip[0] + radius * math.cos(start + sweep * step / steps)),
             round(grip[1] + radius * math.sin(start + sweep * step / steps)))
            for step in range(steps + 1)
        ]
        # The outer edge is pale and the inner edge recedes behind the stone.
        draw.line(points, fill=(100, 135, 145, 135), width=4, joint="curve")
        draw.line(points, fill=(190, 205, 205, 205), width=1, joint="curve")
    return [pair[0], Image.alpha_composite(trail, pair[1])]


def build_sheet(animation, back_path, front_path, rows, columns):
    source = [Image.open(SOURCE / path).convert("RGBA")
              for path in (back_path, front_path)]
    result = [Image.new("RGBA", source[0].size) for _ in source]
    walk_sway = ((0, 0), (0, 1), (-1, 1), (-1, 0), (0, 0),
                 (1, -1), (1, 0), (0, 1), (0, 0))
    for row in range(rows):
        previous_centers = []
        if animation == "walk":
            base_box = (4 * 192, row * 192, 5 * 192, (row + 1) * 192)
            base = replace_head([layer.crop(base_box) for layer in source])
        for column in range(columns):
            box = (column * 192, row * 192,
                   (column + 1) * 192, (row + 1) * 192)
            if animation == "walk":
                offset = walk_sway[column % len(walk_sway)]
                pair = [Image.new("RGBA", (192, 192)) for _ in base]
                for output, tile in zip(pair, base):
                    output.alpha_composite(tile, offset)
            else:
                grip = SLASH_GRIPS[row][column] if animation == "attack_slash" else None
                pair = replace_head([layer.crop(box) for layer in source], grip)
                if animation == "attack_slash":
                    center = stone_center(pair)
                    if column >= 2:
                        pair = add_slash_trail(
                            pair, previous_centers[-1], center,
                            SLASH_GRIPS[row][column - 1], grip)
                    previous_centers.append(center)
            for output, tile in zip(result, pair):
                output.paste(tile, box)
    destination = OUTPUT / "sources" / animation
    (destination / "behind").mkdir(parents=True, exist_ok=True)
    result[0].save(destination / "behind/stone_club.png")
    result[1].save(destination / "stone_club.png")
    return result


def preview(sheets):
    samples = [("marche dos", "walk", 0, 1),
               ("marche gauche", "walk", 1, 1),
               ("marche face", "walk", 2, 1),
               ("marche droite", "walk", 3, 1),
               ("attaque dos", "attack_slash", 0, 3),
               ("attaque gauche", "attack_slash", 1, 3),
               ("attaque face", "attack_slash", 2, 3),
               ("attaque droite", "attack_slash", 3, 3)]
    scale = 4
    panel = 320
    canvas = Image.new("RGB", (panel * 4, (panel + 25) * 2), "#d9d5c8")
    draw = ImageDraw.Draw(canvas)
    for index, (label, animation, row, column) in enumerate(samples):
        x = (index % 4) * panel
        y = (index // 4) * (panel + 25)
        layers = sheets[animation]
        tile = Image.alpha_composite(*[
            layer.crop((column * 192, row * 192,
                        (column + 1) * 192, (row + 1) * 192))
            for layer in layers
        ])
        bounds = tile.getbbox()
        if bounds:
            cropped = tile.crop((max(0, bounds[0] - 3), max(0, bounds[1] - 3),
                                 min(192, bounds[2] + 3), min(192, bounds[3] + 3)))
            enlarged = cropped.resize((cropped.width * scale, cropped.height * scale),
                                      Image.Resampling.NEAREST)
            canvas.paste(enlarged, (x + (panel - enlarged.width) // 2,
                                    y + (panel - enlarged.height) // 2), enlarged)
        draw.text((x + 10, y + panel + 3), label, fill="#292827")
    canvas.save(OUTPUT / "stone-club-v0-contact.png")


def animated_preview(sheets, frame_orders=None):
    frame_orders = frame_orders or {}
    hero_root = ROOT / "public/assets/graphics/units/hero/hellas/male"
    hero = Image.open(hero_root / "texture.png").convert("RGBA")
    hero_frames = json.loads((hero_root / "texture.json").read_text())["frames"]
    animations = {"walk": (9, 4, "body_walking"),
                  "slash": (6, 4, "action_slash"),
                  "hurt": (6, 1, "body_dying")}
    for animation, (count, directions, suffix) in animations.items():
        pair = sheets["attack_slash" if animation == "slash" else animation]
        atlas = Image.new("RGBA", (count * 160, directions * 160))
        gif_frames = []
        for column in range(count):
            source_column = frame_orders.get(animation, range(count))[column]
            display = Image.new("RGB", (1280 if directions == 4 else 320, 320),
                                "#303641")
            for row in range(directions):
                body_row = 1 if row == 3 else row
                body_index = (body_row * (9 if animation == "walk" else 6) + source_column
                              if animation != "hurt" else source_column)
                key = (f"{body_index:03}_graphics_units_hero_hellas_male_"
                       f"{suffix}.png")
                frame = hero_frames[key]["frame"]
                body = hero.crop((frame["x"], frame["y"],
                                  frame["x"] + frame["w"],
                                  frame["y"] + frame["h"]))
                if row == 3:
                    body = ImageOps.mirror(body)
                box = (source_column * 192, row * 192,
                       (source_column + 1) * 192, (row + 1) * 192)
                tile = Image.new("RGBA", (192, 192))
                tile.alpha_composite(pair[0].crop(box))
                tile.alpha_composite(body, (64, 64))
                tile.alpha_composite(pair[1].crop(box))
                tile = tile.crop((16, 12, 176, 172))
                atlas.paste(tile, (column * 160, row * 160))
                enlarged = tile.resize((320, 320), Image.Resampling.NEAREST)
                display.paste(enlarged, (row * 320, 0), enlarged)
            gif_frames.append(display)
        atlas.save(OUTPUT / f"{animation}-atlas.png")
        gif_frames[0].save(OUTPUT / f"{animation}.gif", save_all=True,
                           append_images=gif_frames[1:], duration=150 if animation != "hurt" else 220,
                           loop=0)

    (OUTPUT / "index.html").write_text('''<!doctype html>
<html lang="fr"><meta charset="utf-8"><title>Massue de pierre · V0</title>
<style>
body{background:#181d26;color:#eef0f5;font:16px system-ui;margin:32px auto;max-width:1320px;padding:0 20px}
p{color:#b9c2d1;line-height:1.5}a{color:#b7ddff}
button,select,input{font:inherit;margin:8px;padding:8px}
canvas{display:block;width:100%;max-width:1280px;background:#303641;border-radius:12px;image-rendering:pixelated}
</style>
<h1>Massue de pierre · V0</h1>
<p>Prototype LPC sur le héros Hellas. Quatre directions pour la marche et l'attaque ; six poses pour la chute.</p>
<button id="play">Pause</button>
<label>Animation <select id="anim"><option value="walk">Walk</option><option value="slash">Slash</option><option value="hurt">Hurt</option></select></label>
<label>Vitesse <select id="speed"><option value="150">Normale</option><option value="300">Ralenti</option><option value="80">Rapide</option></select></label>
<label>Image <input id="frame" type="range" min="0" max="8" value="0"></label> <span id="count"></span>
<canvas id="view" width="1280" height="320"></canvas>
<p>Les calques de cette étude ne sont pas encore intégrés à l'équipement du jeu.</p>
<script>
const atlases={walk:new Image(),slash:new Image(),hurt:new Image()};
for(const name of Object.keys(atlases))atlases[name].src=name+'-atlas.png';
const canvas=document.getElementById('view'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const anim=document.getElementById('anim'),speed=document.getElementById('speed');
const range=document.getElementById('frame'),count=document.getElementById('count');
let playing=true,index=0,last=0;
document.getElementById('play').onclick=()=>{playing=!playing;document.getElementById('play').textContent=playing?'Pause':'Lecture'};
anim.onchange=()=>{index=0;range.max=anim.value==='walk'?8:5};
range.oninput=()=>{index=+range.value;playing=false;document.getElementById('play').textContent='Lecture'};
function render(time){
 const name=anim.value,n=name==='walk'?9:6,directions=name==='hurt'?1:4,img=atlases[name];
 if(playing&&time-last>+speed.value){index=(index+1)%n;last=time}
 range.value=index;count.textContent=(index+1)+' / '+n;
 ctx.fillStyle='#303641';ctx.fillRect(0,0,1280,320);
 if(img.complete&&img.naturalWidth){for(let row=0;row<directions;row++)
   ctx.drawImage(img,index*160,row*160,160,160,directions===1?480:row*320,0,320,320)}
 requestAnimationFrame(render)
}requestAnimationFrame(render);
</script></html>
''')


def main():
    sheets = {
        "walk": build_sheet("walk", "walk/behind/spear.png",
                            "walk/spear.png", 4, 13),
        "attack_slash": build_sheet("attack_slash",
                                    "attack_slash/behind/spear.png",
                                    "attack_slash/spear.png", 4, 6),
        "hurt": build_sheet("hurt", "hurt/behind/spear.png",
                            "hurt/spear.png", 1, 6),
    }
    preview(sheets)
    animated_preview(sheets)
    print(OUTPUT / "index.html")


if __name__ == "__main__":
    main()
