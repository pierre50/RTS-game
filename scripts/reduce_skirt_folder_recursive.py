from PIL import Image
from pathlib import Path
import argparse


def shorten_frame(frame, cut_px=4, border_depth=2, alpha_threshold=1):
    src = frame.copy().convert("RGBA")
    out = frame.copy().convert("RGBA")

    spx = src.load()
    opx = out.load()
    w, h = src.size

    bottoms = {}

    # Contour inférieur original.
    for x in range(w):
        ys = [y for y in range(h) if spx[x, y][3] >= alpha_threshold]
        if ys:
            bottoms[x] = max(ys)

    # Raccourcissement.
    for x, old_bottom in bottoms.items():
        new_bottom = old_bottom - cut_px

        if new_bottom < 0:
            continue

        for y in range(new_bottom + 1, h):
            if opx[x, y][3] >= alpha_threshold:
                opx[x, y] = (0, 0, 0, 0)

    # Remontée de la bordure originale.
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

            # Ne jamais créer de bordure dans une zone
            # qui était transparente à la position cible.
            if spx[x, dst_y][3] < alpha_threshold:
                continue

            opx[x, dst_y] = border_pixel

    return out


def process_image(input_path, output_path,
                  frame_w=64, frame_h=64,
                  cut_px=4, border_depth=2,
                  alpha_threshold=1):

    img = Image.open(input_path).convert("RGBA")
    out = img.copy()

    # Permet aussi de traiter les PNG qui ne sont pas
    # exactement multiples de 64 : seules les frames complètes sont traitées.
    cols = img.width // frame_w
    rows = img.height // frame_h

    if cols == 0 or rows == 0:
        print(f"IGNORÉ (trop petit) : {input_path}")
        return False

    for row in range(rows):
        for col in range(cols):
            x0 = col * frame_w
            y0 = row * frame_h

            frame = img.crop((
                x0,
                y0,
                x0 + frame_w,
                y0 + frame_h
            ))

            changed = shorten_frame(
                frame,
                cut_px=cut_px,
                border_depth=border_depth,
                alpha_threshold=alpha_threshold
            )

            # Sans masque : la transparence doit remplacer l'ancien contenu.
            out.paste(changed, (x0, y0))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(output_path)

    return True


def process_folder(input_folder, output_folder,
                   frame_w=64, frame_h=64,
                   cut_px=4, border_depth=2,
                   alpha_threshold=1,
                   overwrite=False):

    input_folder = Path(input_folder).resolve()

    if output_folder:
        output_folder = Path(output_folder).resolve()

    # Recherche récursive : dossier + TOUS les sous-dossiers.
    png_files = sorted(
        p for p in input_folder.rglob("*")
        if p.is_file() and p.suffix.lower() == ".png"
    )

    # Si le dossier de sortie se trouve dans le dossier source,
    # ne pas retraiter les fichiers déjà générés.
    if output_folder and (
        output_folder == input_folder
        or input_folder in output_folder.parents
    ):
        png_files = [
            p for p in png_files
            if p != output_folder and output_folder not in p.parents
        ]

    print(f"{len(png_files)} PNG trouvé(s).")

    processed = 0
    errors = 0

    for src in png_files:
        try:
            if overwrite:
                dst = src
            else:
                relative = src.relative_to(input_folder)
                dst = output_folder / relative

            print(f"Traitement : {src}")

            if process_image(
                src,
                dst,
                frame_w=frame_w,
                frame_h=frame_h,
                cut_px=cut_px,
                border_depth=border_depth,
                alpha_threshold=alpha_threshold
            ):
                processed += 1
                print(f"       -> {dst}")

        except Exception as exc:
            errors += 1
            print(f"ERREUR : {src}")
            print(f"         {exc}")

    print()
    print("Terminé.")
    print(f"Traités : {processed}")
    print(f"Erreurs : {errors}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Raccourcit les sprites de tous les PNG d'un dossier et de ses sous-dossiers."
    )

    parser.add_argument(
        "input_folder",
        help="Dossier contenant les PNG."
    )

    parser.add_argument(
        "output_folder",
        nargs="?",
        help="Dossier de sortie. L'arborescence des sous-dossiers est conservée."
    )

    parser.add_argument("--frame-width", type=int, default=64)
    parser.add_argument("--frame-height", type=int, default=64)
    parser.add_argument("--cut", type=int, default=4)
    parser.add_argument("--border", type=int, default=2)
    parser.add_argument("--alpha-threshold", type=int, default=1)

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Modifie directement les PNG originaux. ATTENTION : irréversible sans sauvegarde."
    )

    args = parser.parse_args()

    if not args.overwrite and not args.output_folder:
        parser.error(
            "Indiquez un dossier de sortie, ou utilisez --overwrite."
        )

    process_folder(
        args.input_folder,
        args.output_folder,
        frame_w=args.frame_width,
        frame_h=args.frame_height,
        cut_px=args.cut,
        border_depth=args.border,
        alpha_threshold=args.alpha_threshold,
        overwrite=args.overwrite
    )
