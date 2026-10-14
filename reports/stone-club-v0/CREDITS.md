# Stone club V0

Prototype derived from the locally generated LPC slash spear in
`scripts/lpc/spritesheets/weapon/polearm/spear_slash/`.
That spear is based on the Liberated Pixel Cup halberd artwork, with motion
effects adapted from the LPC dagger artwork. The stone head and bindings in
this prototype are drawn by `scripts/lpc/build_stone_club_prototype.py`.

This study is not connected to gameplay or the production equipment atlas.

Run `python3 scripts/lpc/build_stone_club_prototype.py` to regenerate the
source layers, contact sheet, animated GIFs, and `index.html` preview.
The preview composites the existing Hellas hero art from this project.
The slash frames place the club in the foreground and draw a short stone-grey
arc following the head. The walking preview uses a stable carrying pose with
a small pixel sway to avoid jumps between source spear poses.
