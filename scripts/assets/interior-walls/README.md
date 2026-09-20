# Interior wall materials

Original 32×32 tiles supplied in `32x32 Tiles.rar`:

- `Wooden_Floor_Horizontal.png`: building interiors (`wood`).
- `Dirt_Road.png`: cave interiors (`dirt`).

Run `pnpm assets:interior-walls` from the repository root (Python 3 and Pillow required).
The builder repeats and shears each material over the original wall silhouettes in
`public/assets/terrain/interior-walls/texture.png`, preserving their alpha exactly.
Frame coordinates come from `tools/maps/interior-walls.cjs`, shared with map generation.

Frames 0–4 are the original tall panels. Frames 5–9 are opaque 24px low
panels, sampled from the same materials with an inclusive bottom pixel.
Their slopes use native pixel steps (including a corrected 33px-wide north-east
panel), so runtime clipping masks and fractional resizing are unnecessary.

Each generated variant lives in its own `wood/` or `dirt/` directory with
`texture.png` and `texture.json`. Runtime face shading still applies to both.
