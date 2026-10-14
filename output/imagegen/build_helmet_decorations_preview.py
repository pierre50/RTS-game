"""Build the helmet-decoration comparison preview with the game's icon palette."""

from pathlib import Path
import sys

from PIL import Image, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "retro_palette"))
from retro_palette import load_hex_palette, snap_to_palette  # noqa: E402

OUT = ROOT / "output" / "imagegen"
SHEET = Image.open(OUT / "helmet-decorations-white-front-icons-sheet-v3-horsehair.png").convert("RGBA")
BASE = Image.open(OUT / "all-white-helmet-decorations-on-every-helmet-6x6.png").convert("RGBA")
ORIGINAL = BASE.copy()
PALETTE = load_hex_palette(ROOT / "scripts" / "retro_palette" / "duel.hex")
MODELS = ("pointed", "barbuta", "legion", "nasal", "bascinet_round", "norman")


def pixelate(source: Image.Image, pixel_size: float = 1.5) -> Image.Image:
    size = source.size
    small = source.resize((round(size[0] / pixel_size), round(size[1] / pixel_size)), Image.Resampling.LANCZOS)
    icon = small.resize(size, Image.Resampling.NEAREST)
    snapped = snap_to_palette(icon.convert("RGB"), PALETTE)
    snapped.putalpha(icon.getchannel("A"))
    return snapped


def decoration(box: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    return pixelate(SHEET.crop(box).resize(size, Image.Resampling.LANCZOS))


def reset_cell(row: int, col: int) -> tuple[int, int]:
    x, y = 150 + 200 * col, 42 + 215 * row
    ImageDraw.Draw(BASE).rectangle((x + 1, y + 1, x + 198, y + 213), fill=(21, 24, 47, 255))
    return x, y


def helmet(model: str, x: int, y: int, vertical_offset: int = 0) -> None:
    icon = Image.open(ROOT / "public" / "assets" / "icons" / "armor" / f"helmet_{model}_bronze.png").convert("RGBA")
    BASE.alpha_composite(icon, (x + 36, y + 64 + vertical_offset))


centurion = decoration((73, 181, 561, 410), (136, 86))
legion = decoration((730, 123, 884, 459), (35, 78))


def original_decoration(model: str, x: int, y: int) -> Image.Image:
    """Extract the existing ornament while preserving its exact layout."""
    cell = np.array(ORIGINAL.convert("RGB").crop((x + 1, y + 1, x + 199, y + 214)))
    clean = Image.new("RGBA", (200, 215), (21, 24, 47, 255))
    icon = Image.open(ROOT / "public" / "assets" / "icons" / "armor" / f"helmet_{model}_bronze.png").convert("RGBA")
    clean.alpha_composite(icon, (36, 64))
    reference = np.array(clean.convert("RGB").crop((1, 1, 199, 214)))
    visible = np.any(np.abs(cell.astype("int16") - reference.astype("int16")) > 2, axis=2)
    visible[:8, :] = False
    visible[-8:, :] = False
    visible[:, :8] = False
    visible[:, -8:] = False
    rgba = Image.fromarray(cell).convert("RGBA")
    rgba.putalpha(Image.fromarray((visible * 255).astype("uint8")))
    return pixelate(rgba)


# Keep the larger plume from the prior preview. Align each helmet crown to the
# third column so the plume meets the helmet at the same visual height.
simple_x, simple_y = 150, 42 + 215 * 2
simple_reference = original_decoration(MODELS[0], simple_x, simple_y)
simple_bounds = simple_reference.getchannel("A").getbbox()
simple_plume = simple_reference.crop(simple_bounds)
plume_row_helmet_offsets = (0, 0, 0, -3, 2, 0)
row_reference_gaps = {}
for row in (3, 4, 5):
    ref_x, ref_y = 150 + 200 * 2, 42 + 215 * row
    reference = original_decoration(MODELS[2], ref_x, ref_y)
    alpha = reference.getchannel("A")
    left = alpha.crop((0, 0, 99, 213)).getbbox()
    right = alpha.crop((99, 0, 198, 213)).getbbox()
    row_reference_gaps[row] = 99 + right[0] - left[2]

for col, model in enumerate(MODELS):
    x, y = reset_cell(0, col)
    BASE.alpha_composite(centurion, (x + 32, y + 28))  # lower, behind the helmet
    helmet(model, x, y)

    x, y = reset_cell(1, col)
    helmet(model, x, y)
    BASE.alpha_composite(legion, (x + 82, y + 31))

    for row in range(2, 6):
        x, y = 150 + 200 * col, 42 + 215 * row
        ornament = original_decoration(model, x, y)
        reset_cell(row, col)
        if row == 2:
            helmet(model, x, y, plume_row_helmet_offsets[col])
            BASE.alpha_composite(simple_plume, (x + 100 - simple_plume.width // 2, y + 18))
            continue
        alpha = ornament.getchannel("A")
        left_bounds = alpha.crop((0, 0, 99, 213)).getbbox()
        right_bounds = alpha.crop((99, 0, 198, 213)).getbbox()
        gap = 99 + right_bounds[0] - left_bounds[2]
        reduction = max(0, gap - row_reference_gaps[row])
        left_inward = reduction // 2
        right_inward = reduction - left_inward
        top = y - 9 if row == 4 else y + 1
        BASE.alpha_composite(ornament.crop((0, 0, 99, 213)), (x + 1 + left_inward, top))
        BASE.alpha_composite(ornament.crop((99, 0, 198, 213)), (x + 100 - right_inward, top))
        helmet(model, x, y)

destination = OUT / "all-white-helmet-decorations-on-every-helmet-6x6-v10-pairs-tightened.png"
BASE.convert("RGB").save(destination)
print(destination)


def composite_inventory_icon(row: int, col: int) -> Image.Image:
    """Build a transparent 128px icon from the helmet and ornament layers."""
    model = MODELS[col]
    x, y = 150 + 200 * col, 42 + 215 * row
    canvas = Image.new("RGBA", (200, 215))
    helmet_icon = Image.open(
        ROOT / "public" / "assets" / "icons" / "armor" / f"helmet_{model}_bronze.png"
    ).convert("RGBA")

    def put_helmet(offset: int = 0) -> None:
        canvas.alpha_composite(helmet_icon, (36, 64 + offset))

    if row == 0:
        canvas.alpha_composite(centurion, (32, 28))
        put_helmet()
    elif row == 1:
        put_helmet()
        canvas.alpha_composite(legion, (82, 31))
    elif row == 2:
        put_helmet(plume_row_helmet_offsets[col])
        canvas.alpha_composite(simple_plume, (100 - simple_plume.width // 2, 18))
    else:
        ornament = original_decoration(model, x, y)
        alpha = ornament.getchannel("A")
        left_bounds = alpha.crop((0, 0, 99, 213)).getbbox()
        right_bounds = alpha.crop((99, 0, 198, 213)).getbbox()
        gap = 99 + right_bounds[0] - left_bounds[2]
        reduction = max(0, gap - row_reference_gaps[row])
        left_inward = reduction // 2
        right_inward = reduction - left_inward
        top = -9 if row == 4 else 1
        canvas.alpha_composite(ornament.crop((0, 0, 99, 213)), (1 + left_inward, top))
        canvas.alpha_composite(ornament.crop((99, 0, 198, 213)), (100 - right_inward, top))
        put_helmet()

    bounds = canvas.getchannel("A").getbbox()
    cropped = canvas.crop(bounds)
    scale = min(116 / cropped.width, 116 / cropped.height)
    resized = cropped.resize(
        (round(cropped.width * scale), round(cropped.height * scale)), Image.Resampling.LANCZOS
    )
    result = Image.new("RGBA", (128, 128))
    result.alpha_composite(resized, ((128 - resized.width) // 2, (128 - resized.height) // 2))
    mapped = snap_to_palette(result.convert("RGB"), PALETTE)
    mapped.putalpha(result.getchannel("A"))
    return mapped


decoration_keys = (
    "centurion_crest", "legion_plumage", "plumage", "helmet_wings",
    "upward_horns_white", "horns_short",
)
icons_dir = OUT / "helmet-composite-icons"
icons_dir.mkdir(parents=True, exist_ok=True)
icon_board = Image.new("RGBA", (150 + 180 * 6, 42 + 180 * 6), (21, 24, 47, 255))
draw = ImageDraw.Draw(icon_board)
for col, label in enumerate(("Conique", "Corinthien", "Légionnaire", "Nasal", "Masqué", "Nasard")):
    draw.text((150 + col * 180 + 90, 20), label, fill="white", anchor="mm")
for row, label in enumerate(("Cimier centurion", "Plumet légion", "Plumet simple", "Ailes", "Grandes cornes", "Cornes courtes")):
    draw.text((8, 42 + row * 180 + 90), label, fill="white", anchor="lm")
    for col, model in enumerate(MODELS):
        x, y = 150 + col * 180, 42 + row * 180
        draw.rectangle((x, y, x + 180, y + 180), outline=(48, 54, 80, 255))
        icon = composite_inventory_icon(row, col)
        icon.save(icons_dir / f"helmet_{model}_bronze_{decoration_keys[row]}.png")
        icon_board.alpha_composite(icon, (x + 26, y + 26))

destination = OUT / "helmet-decorations-composite-inventory-icons-6x6.png"
icon_board.convert("RGB").save(destination)
print(destination)
