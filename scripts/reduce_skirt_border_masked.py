from PIL import Image
import argparse


def shorten_frame(frame, cut_px=4, border_depth=2, alpha_threshold=1):
    """
    Raccourcit le bas du sprite en remontant son contour inférieur original.

    Règles :
    - le contour inférieur original est détecté colonne par colonne ;
    - on remonte ce contour de `cut_px` pixels ;
    - on supprime uniquement la partie située sous ce nouveau contour ;
    - on recopie la bande de bordure originale (`border_depth`) vers le haut ;
    - IMPORTANT : on ne recopie JAMAIS une bordure sur une zone qui était
      transparente dans l'image originale à la position cible.
      Cela évite de créer des ponts artificiels dans les ouvertures / entre les jambes.
    """
    src = frame.copy().convert("RGBA")
    out = frame.copy().convert("RGBA")

    spx = src.load()
    opx = out.load()
    w, h = src.size

    # Contour inférieur original : dernier pixel opaque de chaque colonne.
    bottoms = {}
    for x in range(w):
        ys = [y for y in range(h) if spx[x, y][3] >= alpha_threshold]
        if ys:
            bottoms[x] = max(ys)

    # 1) Effacement : raccourcir réellement la jupe.
    for x, old_bottom in bottoms.items():
        new_bottom = old_bottom - cut_px

        if new_bottom < 0:
            continue

        # On efface seulement les pixels réellement opaques.
        for y in range(new_bottom + 1, h):
            if opx[x, y][3] >= alpha_threshold:
                opx[x, y] = (0, 0, 0, 0)

    # 2) Remonter la bordure originale.
    # On recopie les derniers pixels de la colonne (bordure + éventuellement ombrage).
    for x, old_bottom in bottoms.items():
        new_bottom = old_bottom - cut_px

        for depth in range(border_depth):
            src_y = old_bottom - depth
            dst_y = new_bottom - depth

            if not (0 <= src_y < h and 0 <= dst_y < h):
                continue

            border_pixel = spx[x, src_y]

            if border_pixel[3] < alpha_threshold:
                continue

            # RÈGLE IMPORTANTE :
            # si la zone cible était transparente dans l'original,
            # ne pas y créer de nouveau pixel.
            if spx[x, dst_y][3] < alpha_threshold:
                continue

            opx[x, dst_y] = border_pixel

    return out


def process_spritesheet(input_path, output_path, frame_w=64, frame_h=64,
                        cut_px=4, border_depth=2, alpha_threshold=1):
    img = Image.open(input_path).convert("RGBA")
    out = img.copy()

    cols = img.width // frame_w
    rows = img.height // frame_h

    for row in range(rows):
        for col in range(cols):
            x0 = col * frame_w
            y0 = row * frame_h

            frame = img.crop((x0, y0, x0 + frame_w, y0 + frame_h))

            changed = shorten_frame(
                frame,
                cut_px=cut_px,
                border_depth=border_depth,
                alpha_threshold=alpha_threshold
            )

            # Sans masque alpha : les pixels effacés doivent vraiment remplacer l'original.
            out.paste(changed, (x0, y0))

    out.save(output_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument("input")
    parser.add_argument("output")

    parser.add_argument("--frame-width", type=int, default=64)
    parser.add_argument("--frame-height", type=int, default=64)

    parser.add_argument(
        "--cut",
        type=int,
        default=4,
        help="Nombre de pixels retirés en hauteur."
    )

    parser.add_argument(
        "--border",
        type=int,
        default=2,
        help="Épaisseur de la bordure originale à remonter."
    )

    parser.add_argument(
        "--alpha-threshold",
        type=int,
        default=1
    )

    args = parser.parse_args()

    process_spritesheet(
        args.input,
        args.output,
        frame_w=args.frame_width,
        frame_h=args.frame_height,
        cut_px=args.cut,
        border_depth=args.border,
        alpha_threshold=args.alpha_threshold
    )
