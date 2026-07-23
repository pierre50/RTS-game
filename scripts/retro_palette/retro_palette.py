#!/usr/bin/env python3
"""
retro_palette.py — Convertit une image en style rétro par indexation de couleurs.

Si un fichier .hex est trouvé à la racine du dossier de l'image, il est utilisé
comme palette fixe (cohérence garantie entre tous les sprites).

Format .hex : une couleur par ligne, avec ou sans #
    1a1c2c
    5d275d
    #b13e53
    ...

Usage :
    python retro_palette.py <image> [options]

Exemples :
    python retro_palette.py hero.png --remove-bg
    python retro_palette.py hero.png --remove-bg --dither
    python retro_palette.py hero.png --palette custom.hex
    python retro_palette.py hero.png --metric rgb          # distance RGB pure (meilleur pour sprites saturés)
    python retro_palette.py hero.png --metric lab          # distance Lab perceptuelle (défaut historique)
    python retro_palette.py hero.png --colors 16 --method kmeans  # sans palette hex
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow manquant. Lance : pip3 install Pillow")
    sys.exit(1)

import numpy as np

try:
    from sklearn.cluster import MiniBatchKMeans
    SKLEARN_OK = True
except ImportError:
    SKLEARN_OK = False


# ─────────────────────────────────────────────
#  PALETTE .HEX
# ─────────────────────────────────────────────

def find_hex_palette(image_path: Path) -> Path | None:
    folder = image_path.parent
    hex_files = sorted(folder.glob("*.hex"))
    if not hex_files:
        print(f"   Aucun .hex trouvé dans {folder.resolve()}")
        return None
    if len(hex_files) > 1:
        names = ", ".join(f.name for f in hex_files)
        print(f"   {len(hex_files)} .hex trouvés ({names}) → utilisation de : {hex_files[0].name}")
    return hex_files[0]


def load_hex_palette(hex_path: Path) -> np.ndarray:
    colors = []
    for line in hex_path.read_text().splitlines():
        line = line.strip().lstrip("#").strip()
        if not line or len(line) < 6:
            continue
        try:
            r = int(line[0:2], 16)
            g = int(line[2:4], 16)
            b = int(line[4:6], 16)
            colors.append((r, g, b))
        except ValueError:
            continue
    if not colors:
        print(f"Erreur : aucune couleur valide dans {hex_path}")
        sys.exit(1)
    palette = np.array(colors, dtype=np.uint8)
    print(f"   Palette .hex : {hex_path.resolve()}  ({len(palette)} couleurs)")
    return palette


# ─────────────────────────────────────────────
#  CONVERSION RGB → LAB
# ─────────────────────────────────────────────

def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """Conversion RGB [0-255] → CIE Lab (approximation rapide sans scipy)."""
    rgb_n = rgb / 255.0
    mask = rgb_n > 0.04045
    lin = np.where(mask, ((rgb_n + 0.055) / 1.055) ** 2.4, rgb_n / 12.92)
    M = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ])
    xyz = lin @ M.T
    xyz /= np.array([0.95047, 1.00000, 1.08883])
    eps = 0.008856
    kappa = 903.3
    fx = np.where(xyz > eps, xyz ** (1/3), (kappa * xyz + 16) / 116)
    L = 116 * fx[:, 1] - 16
    a = 500 * (fx[:, 0] - fx[:, 1])
    b = 200 * (fx[:, 1] - fx[:, 2])
    return np.stack([L, a, b], axis=-1)


# ─────────────────────────────────────────────
#  SNAP VERS PALETTE
# ─────────────────────────────────────────────

def snap_to_palette(img_rgb: Image.Image, palette: np.ndarray,
                    alpha_mask: np.ndarray | None = None,
                    dither: bool = False,
                    lightness_weight: float = 1.0,
                    metric: str = "rgb") -> Image.Image:
    """
    Remplace chaque pixel par la couleur la plus proche dans la palette.

    metric="rgb"  : distance euclidienne RGB — meilleur pour sprites saturés,
                    couleurs franches, pixel-art. Choix par défaut.
    metric="lab"  : distance perceptuelle CIE Lab — meilleur pour photos ou
                    dégradés complexes. lightness_weight s'applique uniquement ici.

    Si dither=True, applique Floyd-Steinberg avant le snap.
    """
    if dither:
        pil_pal = Image.new("P", (1, 1))
        flat = palette.flatten().tolist()
        flat += [0] * (768 - len(flat))
        pil_pal.putpalette(flat)
        img_rgb = img_rgb.quantize(
            palette=pil_pal, dither=Image.Dither.FLOYDSTEINBERG
        ).convert("RGB")

    arr = np.array(img_rgb, dtype=np.float32)
    H, W = arr.shape[:2]
    pixels = arr.reshape(-1, 3)
    pal_f = palette.astype(np.float32)

    if metric == "lab":
        pixels_space = rgb_to_lab(pixels)
        pal_space    = rgb_to_lab(pal_f)
        weights = np.array([lightness_weight, 1.0, 1.0], dtype=np.float32)
        diff = pixels_space[:, np.newaxis, :] - pal_space[np.newaxis, :, :]
        dist = np.sum((diff ** 2) * weights, axis=2)
    else:  # rgb
        diff = pixels[:, np.newaxis, :] - pal_f[np.newaxis, :, :]
        dist = np.sum(diff ** 2, axis=2)

    nearest = np.argmin(dist, axis=1)
    result  = palette[nearest].reshape(H, W, 3)

    if alpha_mask is not None:
        original = np.array(img_rgb)
        fg = (alpha_mask > 128)[:, :, np.newaxis]
        result = np.where(fg, result, original)

    return Image.fromarray(result.astype(np.uint8), "RGB")


# ─────────────────────────────────────────────
#  DÉTECTION & SUPPRESSION DU BACKGROUND
# ─────────────────────────────────────────────

def detect_bg_color(img_rgb: Image.Image, sample_size: int = 5) -> tuple:
    arr = np.array(img_rgb)
    s = sample_size
    border_pixels = np.vstack([
        arr[:s, :].reshape(-1, 3),
        arr[-s:, :].reshape(-1, 3),
        arr[:, :s].reshape(-1, 3),
        arr[:, -s:].reshape(-1, 3),
    ])
    unique, counts = np.unique(border_pixels, axis=0, return_counts=True)
    return tuple(unique[counts.argmax()])


def remove_background(img_rgb: Image.Image, bg_color: tuple,
                      tolerance: int = 30) -> Image.Image:
    arr  = np.array(img_rgb, dtype=np.float32)
    bg   = np.array(bg_color, dtype=np.float32)
    dist = np.sqrt(np.sum((arr - bg) ** 2, axis=2))
    mask_bg   = dist <= tolerance
    near_edge = (dist > tolerance * 0.5) & (dist <= tolerance * 1.5)
    blend     = np.clip((dist - tolerance * 0.5) / tolerance, 0, 1)
    alpha = np.where(mask_bg, 0, 255).astype(np.uint8)
    alpha = np.where(near_edge & ~mask_bg, (blend * 255).astype(np.uint8), alpha)
    rgba = np.dstack([arr.astype(np.uint8), alpha])
    return Image.fromarray(rgba, "RGBA")


# ─────────────────────────────────────────────
#  MÉTHODES DE QUANTIZATION (mode sans palette .hex)
# ─────────────────────────────────────────────

def quantize_median_cut(img_rgb, n_colors, dither):
    method = Image.Dither.FLOYDSTEINBERG if dither else Image.Dither.NONE
    return img_rgb.quantize(colors=n_colors, method=Image.Quantize.MEDIANCUT, dither=method).convert("RGB")

def quantize_maxcoverage(img_rgb, n_colors, dither):
    method = Image.Dither.FLOYDSTEINBERG if dither else Image.Dither.NONE
    return img_rgb.quantize(colors=n_colors, method=Image.Quantize.MAXCOVERAGE, dither=method).convert("RGB")

def quantize_libimagequant(img_rgb, n_colors, dither):
    method = Image.Dither.FLOYDSTEINBERG if dither else Image.Dither.NONE
    try:
        return img_rgb.quantize(colors=n_colors, method=Image.Quantize.LIBIMAGEQUANT, dither=method).convert("RGB")
    except Exception:
        print("  libimagequant non disponible, repli sur median-cut.")
        return quantize_median_cut(img_rgb, n_colors, dither)

def quantize_kmeans(img_rgb, n_colors, dither):
    if not SKLEARN_OK:
        print("  sklearn non disponible, repli sur median-cut.")
        return quantize_median_cut(img_rgb, n_colors, dither)
    arr = np.array(img_rgb, dtype=np.float32).reshape(-1, 3)
    sample = arr[np.random.choice(len(arr), min(50_000, len(arr)), replace=False)]
    km = MiniBatchKMeans(n_clusters=n_colors, n_init=3, random_state=42).fit(sample)
    palette = km.cluster_centers_.astype(np.uint8)
    labels  = km.predict(arr)
    result  = Image.fromarray(palette[labels].reshape(img_rgb.height, img_rgb.width, 3))
    if dither:
        pil_pal = Image.new("P", (1, 1))
        flat = palette.flatten().tolist() + [0] * (768 - len(palette.flatten()))
        pil_pal.putpalette(flat)
        result = result.quantize(palette=pil_pal, dither=Image.Dither.FLOYDSTEINBERG).convert("RGB")
    return result

METHODS = {
    "mediancut":     quantize_median_cut,
    "maxcoverage":   quantize_maxcoverage,
    "libimagequant": quantize_libimagequant,
    "kmeans":        quantize_kmeans,
}


# ─────────────────────────────────────────────
#  EFFETS BONUS
# ─────────────────────────────────────────────

def apply_pixel_scale(img, scale):
    if scale <= 1:
        return img
    small = img.resize((max(1, img.width // scale), max(1, img.height // scale)), Image.Resampling.NEAREST)
    return small.resize(img.size, Image.Resampling.NEAREST)

def apply_scanlines(img, strength=0.25):
    arr = np.array(img, dtype=np.float32)
    arr[::2] *= (1.0 - strength)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

def print_palette_info(palette: np.ndarray):
    print(f"\n  Palette ({len(palette)} couleurs) :")
    for r, g, b in palette:
        ansi = f"\033[48;2;{r};{g};{b}m   \033[0m"
        print(f"    {ansi}  #{r:02X}{g:02X}{b:02X}  rgb({r:3},{g:3},{b:3})")


# ─────────────────────────────────────────────
#  INTÉGRATION PIPELINE (appel direct, sans CLI)
# ─────────────────────────────────────────────

def bake_retro_style(image_path: Path, palette: np.ndarray, bg_tolerance: int = 30,
                     lightness_weight: float = 1.0, metric: str = "rgb") -> None:
    """Snap une sheet RGBA déjà transparente vers `palette` et réécrit le fichier sur place."""
    img = Image.open(image_path)
    if img.mode not in ("RGBA", "LA", "PA"):
        img = img.convert("RGBA")
    original_alpha = img.split()[-1]
    bg_canvas = Image.new("RGB", img.size, (255, 0, 255))
    bg_canvas.paste(img, mask=original_alpha)
    img_rgb = bg_canvas

    bg_color = detect_bg_color(img_rgb)
    img_rgba = remove_background(img_rgb, bg_color, tolerance=bg_tolerance)
    alpha_mask = np.array(img_rgba)[:, :, 3]

    result_rgb = snap_to_palette(img_rgb, palette, alpha_mask=alpha_mask,
                                 lightness_weight=lightness_weight, metric=metric)
    result = Image.fromarray(
        np.dstack([np.array(result_rgb), alpha_mask]).astype(np.uint8), "RGBA"
    )
    result.save(image_path, "PNG")


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description="Convertit une image en style rétro — utilise un .hex si présent.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("input", help="Image source")
    p.add_argument("-p", "--palette", default=None,
                   help="Fichier .hex à utiliser (défaut: auto-détection dans le dossier)")
    p.add_argument("-c", "--colors", type=int, default=16,
                   help="Couleurs si pas de .hex (défaut: 16)")
    p.add_argument("-m", "--method", choices=list(METHODS.keys()), default="mediancut",
                   help="Algo si pas de .hex (défaut: mediancut)")
    p.add_argument("-d", "--dither", action="store_true",
                   help="Dithering Floyd-Steinberg")
    p.add_argument("--metric", choices=["rgb", "lab"], default="rgb",
                   help="Métrique de distance couleur : rgb (défaut, meilleur pour pixel-art/sprites saturés) "
                        "ou lab (perceptuel, meilleur pour photos/dégradés complexes)")
    p.add_argument("--lightness-weight", type=float, default=1.0,
                   help="Poids de la luminosité en mode --metric lab (défaut: 1.0)")
    p.add_argument("-s", "--scale", type=int, default=1,
                   help="Facteur pixel-art ×N (défaut: 1)")
    p.add_argument("--scanlines", action="store_true", help="Effet scanlines CRT")
    p.add_argument("--scanline-strength", type=float, default=0.25)
    p.add_argument("-o", "--output", default=None, help="Chemin de sortie")
    p.add_argument("--show-palette", action="store_true", help="Affiche la palette dans le terminal")
    p.add_argument("--compare", action="store_true", help="Image côte-à-côte original/rétro")
    p.add_argument("--remove-bg", action=argparse.BooleanOptionalAction, default=True,
                   help="Supprime le fond et sort un PNG transparent (défaut: activé)")
    p.add_argument("--bg-tolerance", type=int, default=30,
                   help="Tolérance détection fond (défaut: 30)")
    p.add_argument("--bg-color", default=None,
                   help="Couleur de fond forcée en hex ex: #FFFFFF")
    p.add_argument("--no-palette", action="store_true",
                   help="Ignore le .hex même s'il existe (force la quantization auto)")
    return p.parse_args()


def build_output_path(input_path, args):
    if args.output:
        return Path(args.output)
    stem   = input_path.stem
    suffix = "_retro"
    if args.dither:
        suffix += "_dither"
    if args.scale > 1:
        suffix += f"_px{args.scale}"
    return input_path.with_name(stem + suffix + ".png")


def main():
    args       = parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        print(f"Erreur : fichier introuvable → {input_path}")
        sys.exit(1)

    print(f"\n→ {input_path.name}")
    img = Image.open(input_path)

    has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
    if has_alpha:
        if img.mode not in ("RGBA", "LA", "PA"):
            img = img.convert("RGBA")
        original_alpha = img.split()[-1]
        bg_canvas = Image.new("RGB", img.size, (255, 0, 255))
        bg_canvas.paste(img, mask=original_alpha)
        img_rgb = bg_canvas
    else:
        original_alpha = None
        img_rgb = img.convert("RGB")
        if args.remove_bg:
            arr         = np.array(img_rgb, dtype=np.float32)
            bg_detected = np.array(detect_bg_color(img_rgb), dtype=np.float32)
            dist        = np.sqrt(np.sum((arr - bg_detected) ** 2, axis=2))
            arr[dist <= args.bg_tolerance] = [255, 0, 255]
            img_rgb     = Image.fromarray(arr.astype(np.uint8), "RGB")
            print(f"   Fond remplacé par magenta (rgb{tuple(bg_detected.astype(int))} → #FF00FF)")

    hex_palette = None
    if args.no_palette:
        print("   Palette .hex ignorée (--no-palette)")
    else:
        hex_path = Path(args.palette) if args.palette else find_hex_palette(input_path)
        if hex_path and hex_path.exists():
            hex_palette = load_hex_palette(hex_path)
        elif args.palette:
            print(f"Erreur : palette introuvable → {args.palette}")
            sys.exit(1)

    alpha_mask = None
    if args.remove_bg:
        if args.bg_color:
            hex_c    = args.bg_color.lstrip("#")
            bg_color = tuple(int(hex_c[i:i+2], 16) for i in (0, 2, 4))
            print(f"   Fond forcé  : #{hex_c.upper()}")
        elif not has_alpha:
            bg_color = (255, 0, 255)
        else:
            bg_color = detect_bg_color(img_rgb)
            print(f"   Fond détecté : rgb{bg_color}")

        img_rgba   = remove_background(img_rgb, bg_color, tolerance=args.bg_tolerance)
        alpha_mask = np.array(img_rgba)[:, :, 3]
        removed    = (alpha_mask == 0).sum()
        total      = img_rgb.width * img_rgb.height
        print(f"   Pixels supprimés : {removed:,} / {total:,}  ({removed/total:.0%})")

    if args.scale > 1:
        img_rgb = apply_pixel_scale(img_rgb, args.scale)
        if alpha_mask is not None:
            alpha_mask = np.array(
                Image.fromarray(alpha_mask).resize(img_rgb.size, Image.Resampling.NEAREST)
            )

    if hex_palette is not None:
        print(f"   Mode : snap vers palette .hex  (metric={args.metric})")
        result_rgb = snap_to_palette(img_rgb, hex_palette,
                                     alpha_mask=alpha_mask, dither=args.dither,
                                     lightness_weight=args.lightness_weight,
                                     metric=args.metric)
    else:
        print(f"   Mode : quantization auto ({args.method}, {args.colors} couleurs)")
        quantize_fn = METHODS[args.method]
        if alpha_mask is not None:
            fg_mask    = (alpha_mask > 128)[:, :, np.newaxis].astype(np.uint8)
            img_fg     = Image.fromarray(np.array(img_rgb) * fg_mask)
            result_rgb = quantize_fn(img_fg, args.colors, args.dither)
        else:
            result_rgb = quantize_fn(img_rgb, args.colors, args.dither)

    if args.scanlines:
        result_rgb = apply_scanlines(result_rgb, args.scanline_strength)

    if args.show_palette and hex_palette is not None:
        print_palette_info(hex_palette)

    if args.remove_bg:
        result_arr = np.array(result_rgb)
        result     = Image.fromarray(np.dstack([result_arr, alpha_mask]).astype(np.uint8), "RGBA")
    elif original_alpha is not None:
        result = result_rgb.copy()
        result.putalpha(original_alpha.resize(result_rgb.size, Image.Resampling.NEAREST))
    else:
        result = result_rgb

    if args.compare:
        orig_d  = img_rgb.resize(result_rgb.size, Image.Resampling.NEAREST)
        mode    = "RGBA" if args.remove_bg else "RGB"
        bg_fill = (30, 30, 30, 255) if args.remove_bg else (30, 30, 30)
        compare = Image.new(mode, (result_rgb.width * 2 + 10, result_rgb.height), bg_fill)
        compare.paste(orig_d, (0, 0))
        compare.paste(result, (result_rgb.width + 10, 0),
                      mask=result if args.remove_bg else None)
        cmp_path = build_output_path(input_path, args).with_stem(
                       build_output_path(input_path, args).stem + "_compare")
        compare.save(cmp_path, "PNG")
        print(f"   Compare : {cmp_path}")

    output_path = build_output_path(input_path, args)
    result.save(output_path, "PNG")
    in_kb  = input_path.stat().st_size / 1024
    out_kb = output_path.stat().st_size / 1024
    print(f"✓ {output_path}  ({in_kb:.0f} Ko → {out_kb:.0f} Ko)\n")


if __name__ == "__main__":
    main()