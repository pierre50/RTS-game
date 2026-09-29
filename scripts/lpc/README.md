# LPC — sprite bake pipeline

Generates the baked spritesheets (`public/assets/graphics/units/`) from the
Universal LPC source spritesheets (`scripts/lpc/spritesheets/`), for every
unit / civilization / job defined in `config.py`, `jobs.py` and `equipment.py`.
Villager jobs only bake their job-specific movement/action/loaded sheets; death
and corpse sheets are shared from the default villager job.

## Generate the baked sprites

### Villager sit source preparation

The village outfits now use sit-compatible tops and plain long skirts. Female
Hellas/Kemet use `sleeveless2_scoop`, Latium/Nobatia use `sleeveless2`,
Sumeria/Nord use `longsleeve2`, and Xia/Alba use `longsleeve2_scoop`.
Male Sumeria uses `sleeveless2`; male Kemet/Nobatia use the plain long skirt.
Hellas/Latium retain the custom `tuniq`. Tops use team colors and skirts use
`cloth_brown`; the configured footwear, hijab and obi remain civilization-specific.
All units, including priests, use the standard LPC male/female heads.
The straight nose is a separate layer immediately above the head, sharing its
skin-color mapping. Its six required source sheets include `sit`; original
credits and the upstream revision are in `sheet_definitions/head_nose_straight.json`.
These head sources include the requested RGB substitutions `2a3c49` and
`f2f7f8` to `f9d5ba`, and `57cee4` to `e4a47c`, preserving alpha.

`sources.required_villager_sit_source_paths()` enumerates all 45 source layers
needed by the 16 villager appearances. Split female hairstyles now use the
upstream adult back/front layers. `villager-sit-import.json` records the pinned
upstream revision, source paths, palette conversions and hashes of the 107
imported PNGs. Original author/license definitions are retained in
`sheet_definitions/villager_sit_upstream/`.

The villager build plan selects one static pose per direction: cross-legged
(source column 0) for men, side-sitting (column 1) for women. Column 2, the chair
pose, is excluded. The four composed frames join the existing variant atlas as
`body/sitting`, with the same recoloring and finishing as the other sheets.
The runtime uses `sittingSheet` for stationary, awake villagers during morning,
lunch and evening breaks. Work, movement, danger and sleep take priority; tools
without sitting art are hidden. Older atlases without sitting frames keep the
standing fallback until the assets are built. This change does not itself run
the build or modify generated atlases.

```bash
pnpm assets:lpc:build
# or directly:
python3 scripts/lpc/build.py
```

The build is incremental by default. It writes
`public/assets/graphics/units/.build-cache.json` and skips sheets whose
source layers and visual pipeline settings did not change.

What it does, in order:

1. Composes each changed `texture.png` /
   `texture.json` from the source layers (body, hair, clothes, equipment...).
2. Applies the sprite lighting pass (`scripts/add_sprite_lighting/`) to every
   generated `texture.png`, adding contrast before the palette snap.
3. Applies the retro style (`scripts/retro_palette/`) to every generated
   `texture.png`, snapping it to the `jehkobas-master.hex` palette — see
   [scripts/retro_palette/README.md](../retro_palette/README.md) for details
   and for testing that step in isolation on a single file.
4. Optionally restyles the outer silhouette outline (`outline_style.py`) — off
   by default, see below.
5. Writes `manifest.json` (skin tones, civilizations, list of generated assets).

## Experiment: softening the sprite outline

LPC source art traces every character's outer silhouette in near-black, which
reads as a harder "inked" edge than the rest of the game's art (e.g. the
buildings, which have no such traced line). `outline_style.py` is an
experimental pass that recolors just that outer ring toward its neighboring
color, without touching alpha or shape. Controlled by the `OUTLINE_MODE`
constant at the top of the file (`"off"` / `"attenuate"` / `"remove"`) — flip
it and re-run `pnpm assets:lpc:build` to compare.

To test on a single already-baked sheet without rerunning the full build:

```bash
python3 scripts/lpc/outline_style.py public/assets/graphics/units/infantry/xia/male/walking/texture.png --mode remove
```

Options:

```bash
python3 scripts/lpc/build.py --source <source_folder> --out <output_folder>
python3 scripts/lpc/build.py --clean
```

## Generate the animal sprites

Bakes the wildlife spritesheets (`public/assets/graphics/animals/`) from the
source sheets in `scripts/lpc/spritesheets/animals/` — separate from the unit
build above, but reuses the same lighting/retro-palette/outline pipeline.

```bash
pnpm assets:lpc:build-animals
# or directly:
python3 scripts/lpc/build_animals.py
```

Options:

```bash
python3 scripts/lpc/build_animals.py --animal deer   # only one animal, repeatable
python3 scripts/lpc/build_animals.py --source <source_folder> --out <output_folder>
```

`pnpm assets:lpc:build` runs the unit, equipment, and animal builds in sequence.

## Diagnose equipment combinations

Lists, for every equipment and animation, any empty frames (layers that don't
overlap anything visible) — useful after adding a new equipment or animation:

```bash
python3 scripts/lpc/audit_equipment.py
```

## Files

- `config.py`: civilizations, skin tones, palettes, frame sizes, `Sheet`/`UnitLook`.
- `jobs.py`: equipment worn by job/unit for each animation (walk, action, death).
- `equipment.py`: layers (background/foreground) and runtime overlay metadata for each equipment.
- `sources.py`: paths of the required source spritesheets (used by `sync.py`).
- `image_pipeline.py`: frame composition (recolor, cropping, layers, sheet writing).
- `outline_style.py`: experimental outline softening/removal pass (see above).
- `build.py`: orchestrates the full bake + calls the retro-style and outline passes.
- `build_equipment.py`: bakes the runtime equipment overlay sheets.
- `build_animals.py`: bakes the wildlife spritesheets (see above).
- `sync.py`: downloads the sources from the Universal LPC repository.
- `audit_equipment.py`: diagnoses empty layer/animation combinations.
