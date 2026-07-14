# LPC — sprite bake pipeline

Generates the baked spritesheets (`public/assets/graphics/lpc-baked/`) from the
Universal LPC source spritesheets (`scripts/lpc/spritesheets/`), for every
unit / civilization / job defined in `config.py`, `jobs.py` and `equipment.py`.

## Fetch the sources

Downloads the Universal LPC spritesheets needed into `scripts/lpc/spritesheets/`:

```bash
pnpm assets:lpc:sync
# or directly:
python3 scripts/lpc/sync.py
```

## Generate the baked sprites

```bash
pnpm assets:lpc:build
# or directly:
python3 scripts/lpc/build.py
```

What it does, in order:

1. Wipes `public/assets/graphics/lpc-baked/` and recomposes every `texture.png` /
   `texture.json` from the source layers (body, hair, clothes, equipment...).
2. Applies the retro style (`scripts/retro_palette/`) to every generated
   `texture.png`, snapping it to the `jehkobas-master.hex` palette — see
   [scripts/retro_palette/README.md](../retro_palette/README.md) for details
   and for testing that step in isolation on a single file.
3. Writes `manifest.json` (skin tones, civilizations, list of generated assets).

Options:

```bash
python3 scripts/lpc/build.py --source <source_folder> --out <output_folder>
```

## Diagnose equipment combinations

Lists, for every equipment and animation, any empty frames (layers that don't
overlap anything visible) — useful after adding a new equipment or animation:

```bash
python3 scripts/lpc/audit_equipment.py
```

## Files

- `config.py`: civilizations, skin tones, palettes, frame sizes, `Sheet`/`UnitLook`.
- `jobs.py`: equipment worn by job/unit for each animation (walk, action, death).
- `equipment.py`: layers (background/foreground) associated with each equipment.
- `sources.py`: paths of the required source spritesheets (used by `sync.py`).
- `image_pipeline.py`: frame composition (recolor, cropping, layers, sheet writing).
- `build.py`: orchestrates the full bake + calls the retro-style pass.
- `sync.py`: downloads the sources from the Universal LPC repository.
- `audit_equipment.py`: diagnoses empty layer/animation combinations.
