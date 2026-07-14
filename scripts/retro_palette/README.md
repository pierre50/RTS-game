# retro_palette — retro style via a fixed palette

Converts an image by snapping every pixel to the closest color (perceptual Lab
distance) in a fixed `.hex` palette, with optional background removal. Used
automatically by the LPC bake (see
[scripts/lpc/README.md](../lpc/README.md)) via the `bake_retro_style()`
function, but also works standalone on any PNG.

## Quick usage

```bash
python3 scripts/retro_palette/retro_palette.py <image.png>
```

By default: background removal enabled (`--remove-bg`), lightness weight at
`4.0` (see below), `.hex` palette auto-detected in the image's folder.

To compare before/after side by side:

```bash
python3 scripts/retro_palette/retro_palette.py <image.png> --compare
```

This outputs `<image>_retro.png` (+ `<image>_retro_compare.png` if `--compare`)
next to the source file.

## `.hex` palette

The script looks for a `.hex` file in the **folder of the processed image**
(not the script's folder). A `.hex` file is one color per line, with or
without `#`:

```
1a1c2c
5d275d
#b13e53
```

`scripts/retro_palette/jehkobas-master.hex` is the palette used for the game's
LPC sprites (64 colors). To test against it without moving it, either drop
your test image into `scripts/retro_palette/` (auto-detection), or point to it
explicitly:

```bash
python3 scripts/retro_palette/retro_palette.py /path/to/texture.png \
  --palette scripts/retro_palette/jehkobas-master.hex --compare
```

Without a `.hex` palette found (or with `--no-palette`), the script falls back
to automatic quantization (`--colors`, `--method`).

## `--lightness-weight`

When the palette has a gap in some hue (e.g. no dark brown), pure Lab-distance
matching can snap a dark pixel to a color of the right hue but too light —
visible as a speckled look on outlines/shadows (e.g. the bowman's bow).
`--lightness-weight` (default `4.0`) makes lightness take priority over hue in
the matching:

- `1.0`: standard Lab distance (can speckle underrepresented dark tones).
- `2.0`–`4.0`: fixes the speckling while keeping a correct-ish hue.
- `8.0`+: overcorrects, flattens colors (loss of variation, drifts toward gray/purple).

`4.0` is the value settled on for `jehkobas-master.hex` after visual comparison.

## Useful options

| Flag | Effect |
|---|---|
| `--remove-bg` / `--no-remove-bg` | Removes the detected background (enabled by default) |
| `--bg-tolerance N` | Background detection tolerance (default 30) |
| `--bg-color '#RRGGBB'` | Forces the background color instead of auto-detection |
| `--dither` | Floyd-Steinberg dithering before the snap |
| `--scale N` | Pixel-art scale factor ×N |
| `--scanlines` | CRT effect |
| `--show-palette` | Prints the palette in the terminal |
| `-o, --output` | Explicit output path |

## Programmatic use

```python
from retro_palette import bake_retro_style, load_hex_palette

palette = load_hex_palette(Path("jehkobas-master.hex"))
bake_retro_style(Path("texture.png"), palette, lightness_weight=4.0)
```

`bake_retro_style()` rewrites the image in place; this is what
`scripts/lpc/build.py` calls at the end of the bake, on every generated
`texture.png`.
