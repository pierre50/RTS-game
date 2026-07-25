from PIL import Image
import numpy as np

# ─── INPUTS ───────────────────────────────────────────────────────────────────
HORSE_PATH  = "horse.png"              # spritesheet cheval (1584x62, 18 frames)
ARCHER_PATH = "archer_with_legs.png"  # archer + legs (1536x64, 24 frames)
OUTPUT_PATH = "rider_on_horse.png"

# ─── PARAMÈTRES FRAMES ────────────────────────────────────────────────────────
FW_H = 88        # frame width cheval
FH_H = 62        # frame height cheval
FW_A = 64        # frame width archer
FH_A = 64        # frame height archer
N_HORSE_FRAMES  = 6   # frames par direction cheval
N_ARCHER_FRAMES = 8   # frames par direction archer

CANVAS_H = 80         # hauteur du canvas final (plus grand pour ne pas décapiter)
HORSE_Y  = CANVAS_H - FH_H  # le cheval est collé en bas du canvas

# ─── BOB VERTICAL ─────────────────────────────────────────────────────────────
# Deltas Y mesurés sur le dos du cheval frame par frame (mesuré automatiquement)
# Le cavalier suit ce mouvement pour un rendu naturel
HORSE_BOB = {
    'nord':   [0,  2,  4,  2,  0, -2],
    'gauche': [0, -3,  1,  3,  4,  0],
    'sud':    [0,  2,  4,  2,  0, -2],
}

# Top du corps du cheval sur frame 0 (pour positionner le dos)
HORSE_TOPS = {'nord': 4, 'gauche': 11, 'sud': 4}

# ─── DIRECTIONS ───────────────────────────────────────────────────────────────
# (nom, horse_start_frame, archer_start_frame, archer_devant, extra_x, extra_y)
# archer_devant: True = archer par-dessus le cheval (nord/gauche), False = derrière (sud)
# extra_x: décalage horizontal fin du cavalier
# extra_y: décalage vertical fin du cavalier (négatif = monter)
DIRS = [
    ('nord',   0,  0,  True,   2,  0),
    ('gauche', 6,  8,  True,   0, -8),
    ('sud',    12, 16, False,  2,  0),
]

LOWER_BY = 25  # descendre le cavalier sur le dos du cheval

# ─── SCRIPT ───────────────────────────────────────────────────────────────────
horse  = Image.open(HORSE_PATH)
archer = Image.open(ARCHER_PATH)

output = Image.new('RGBA', (FW_H * len(DIRS) * N_ARCHER_FRAMES, CANVAS_H), (0,0,0,0))

for dir_idx, (dir_name, h_start, a_start, archer_front, extra_x, extra_y) in enumerate(DIRS):
    # Position de base du cavalier
    dos_y   = HORSE_Y + HORSE_TOPS[dir_name] + 8
    ay_base = dos_y - FH_A + LOWER_BY + extra_y
    ax      = (FW_H - FW_A) // 2 + extra_x

    # Cycles: cheval boucle sur 6 frames, bob suit le même cycle
    horse_cycle = [i % N_HORSE_FRAMES for i in range(N_ARCHER_FRAMES)]
    bob_cycle   = [HORSE_BOB[dir_name][i % N_HORSE_FRAMES] for i in range(N_ARCHER_FRAMES)]

    for f in range(N_ARCHER_FRAMES):
        global_frame = dir_idx * N_ARCHER_FRAMES + f

        # Frame cheval (cyclée)
        hf      = h_start + horse_cycle[f]
        h_frame = horse.crop((hf * FW_H, 0, (hf + 1) * FW_H, FH_H)).convert('RGBA')

        # Frame archer (animée)
        a_frame = archer.crop(((a_start + f) * FW_A, 0, (a_start + f + 1) * FW_A, FH_A)).convert('RGBA')

        # Position Y avec bob
        ay = ay_base + bob_cycle[f]

        # Composer les couches
        canvas  = Image.new('RGBA', (FW_H, CANVAS_H), (0,0,0,0))
        h_layer = Image.new('RGBA', (FW_H, CANVAS_H), (0,0,0,0))
        a_layer = Image.new('RGBA', (FW_H, CANVAS_H), (0,0,0,0))

        h_layer.paste(h_frame, (0, HORSE_Y), h_frame)
        a_layer.paste(a_frame, (ax, ay),     a_frame)

        if archer_front:
            # Nord / Gauche: cheval derrière, archer devant
            canvas = Image.alpha_composite(canvas, h_layer)
            canvas = Image.alpha_composite(canvas, a_layer)
        else:
            # Sud: archer derrière, cheval devant
            canvas = Image.alpha_composite(canvas, a_layer)
            canvas = Image.alpha_composite(canvas, h_layer)

        output.paste(canvas, (global_frame * FW_H, 0), canvas)

output.save(OUTPUT_PATH)
print(f"Output: {output.size} — {len(DIRS) * N_ARCHER_FRAMES} frames de {FW_H}px")
print("Nord(0-7) | Gauche(8-15) | Sud(16-23)")
