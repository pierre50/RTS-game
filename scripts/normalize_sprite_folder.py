#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


SUPPORTED_EXTENSIONS = {".png"}
DEFAULT_ROWS = 4


@dataclass(frozen=True)
class SheetRule:
    columns: int

    # Ligne cible reconstruite depuis une autre ligne par miroir horizontal.
    # Convention : 0=face, 1=dos, 2=gauche, 3=droite.
    mirror_rows: dict[int, int] | None = None


# Règles exactes de vos spritesheets.
# L'ordre est important : les règles spécifiques passent avant les génériques.
RULES: tuple[tuple[str, SheetRule], ...] = (
    ("black_grouse_death", SheetRule(4, mirror_rows={2: 3})),
    ("black_grouse_flight", SheetRule(6, mirror_rows={2: 3})),
    ("black_grouse_idle", SheetRule(4)),
    ("black_grouse_walk", SheetRule(6)),

    ("deer_death", SheetRule(5)),
    ("deer_idle", SheetRule(4)),
    ("deer_walk", SheetRule(6)),
    ("deer_run", SheetRule(6)),

    ("hare_death", SheetRule(4)),
    ("hare_idle", SheetRule(4)),
    ("hare_walk", SheetRule(5, mirror_rows={2: 3})),
    ("hare_run", SheetRule(6, mirror_rows={2: 3})),

    ("boar_death", SheetRule(4)),
    ("boar_idle", SheetRule(4)),
    ("boar_walk", SheetRule(6)),
    ("boar_run", SheetRule(5, mirror_rows={2: 3})),
    ("boar_attack", SheetRule(5)),

    ("fox_death", SheetRule(4)),
    ("fox_idle", SheetRule(4)),
    ("fox_walk", SheetRule(6)),
    ("fox_run", SheetRule(6, mirror_rows={2: 3})),

    ("horse_idle", SheetRule(4)),
    ("horse_walk", SheetRule(6, mirror_rows={2: 3})),
)


@dataclass(frozen=True)
class SpriteFrame:
    image: Image.Image

    # Décalages du centre visuel par rapport au centre de la cellule source.
    # Ils sont conservés dans la nouvelle spritesheet.
    offset_x: float
    original_top: int


@dataclass(frozen=True)
class SpriteBox:
    left: int
    top: int
    right: int
    bottom: int

    @property
    def width(self) -> int:
        return self.right - self.left

    @property
    def height(self) -> int:
        return self.bottom - self.top

    @property
    def center_x(self) -> float:
        return (self.left + self.right) / 2


def normalized_name(path: Path) -> str:
    return (
        path.stem.lower()
        .replace("-", "_")
        .replace(" ", "_")
        .replace("(1)", "")
        .replace("(2)", "")
        .replace("copie", "")
    )


def get_rule(path: Path, fallback_columns: int | None) -> SheetRule:
    name = normalized_name(path)

    for key, rule in RULES:
        if key in name:
            return rule

    if fallback_columns is not None:
        return SheetRule(fallback_columns)

    raise ValueError(
        f"Aucune règle trouvée pour {path.name}. "
        "Ajoutez ce type dans RULES ou utilisez --columns."
    )


def detect_row_bounds(
    image: Image.Image,
    rows: int,
    alpha_threshold: int,
) -> tuple[int, ...]:
    """
    Cherche les séparations horizontales proches de la grille théorique.
    """
    alpha = np.asarray(image.getchannel("A"))
    opaque_per_y = (alpha > alpha_threshold).sum(axis=1)

    step = image.height / rows
    window = max(3, round(step * 0.25))
    bounds = [0]

    for row_index in range(1, rows):
        expected = round(step * row_index)
        start = max(bounds[-1] + 1, expected - window)
        end = min(image.height - 1, expected + window)

        best_y = min(
            range(start, end + 1),
            key=lambda y: (
                int(opaque_per_y[y]),
                abs(y - expected),
            ),
        )
        bounds.append(best_y)

    bounds.append(image.height)
    return tuple(bounds)


def detect_components(
    row_image: Image.Image,
    alpha_threshold: int,
    minimum_component_pixels: int,
) -> list[SpriteBox]:
    alpha = np.asarray(row_image.getchannel("A"))
    mask = alpha > alpha_threshold

    labels, count = ndimage.label(
        mask,
        structure=np.ones((3, 3), dtype=np.uint8),
    )

    boxes: list[SpriteBox] = []

    for label_id in range(1, count + 1):
        ys, xs = np.where(labels == label_id)

        if len(xs) < minimum_component_pixels:
            continue

        boxes.append(
            SpriteBox(
                left=int(xs.min()),
                top=int(ys.min()),
                right=int(xs.max()) + 1,
                bottom=int(ys.max()) + 1,
            )
        )

    return boxes


def extract_row_frames(
    row_image: Image.Image,
    columns: int,
    alpha_threshold: int,
    minimum_component_pixels: int,
) -> list[SpriteFrame]:
    """
    Extrait les sprites tout en conservant leur véritable décalage horizontal
    dans leur cellule source. On ne recentre donc plus chaque silhouette.
    """
    components = detect_components(
        row_image,
        alpha_threshold=alpha_threshold,
        minimum_component_pixels=minimum_component_pixels,
    )

    if not components:
        raise RuntimeError("Aucun sprite détecté sur la ligne.")

    source_cell_width = row_image.width / columns
    theoretical_centers = np.array(
        [(column + 0.5) * source_cell_width for column in range(columns)]
    )

    groups: list[list[SpriteBox]] = [[] for _ in range(columns)]

    for component in components:
        owner = int(
            np.argmin(np.abs(theoretical_centers - component.center_x))
        )
        groups[owner].append(component)

    frames: list[SpriteFrame] = []

    for column_index, group in enumerate(groups):
        if not group:
            raise RuntimeError(
                f"Frame {column_index + 1}/{columns} vide. "
                "Ajoutez mirror_rows pour cette ligne/type."
            )

        box = SpriteBox(
            left=min(item.left for item in group),
            top=min(item.top for item in group),
            right=max(item.right for item in group),
            bottom=max(item.bottom for item in group),
        )

        sprite = row_image.crop(
            (box.left, box.top, box.right, box.bottom)
        )

        offset_x = box.center_x - theoretical_centers[column_index]

        frames.append(
            SpriteFrame(
                image=sprite,
                offset_x=float(offset_x),
                original_top=box.top,
            )
        )

    return frames



def remove_small_isolated_components(
    image: Image.Image,
    maximum_pixels: int,
    alpha_threshold: int,
) -> Image.Image:
    """
    Supprime uniquement les petits groupes de pixels opaques isolés.

    Les pixels reliés à la silhouette principale ne sont jamais modifiés.
    """
    if maximum_pixels <= 0:
        return image

    rgba = np.array(image)
    mask = rgba[:, :, 3] > alpha_threshold

    labels, component_count = ndimage.label(
        mask,
        structure=np.ones((3, 3), dtype=np.uint8),
    )

    for label_id in range(1, component_count + 1):
        component = labels == label_id
        size = int(component.sum())

        if size <= maximum_pixels:
            rgba[component, 3] = 0

    return Image.fromarray(rgba, "RGBA")



def mirror_frames(frames: list[SpriteFrame]) -> list[SpriteFrame]:
    """
    Retourne les images et inverse aussi leur décalage horizontal.
    """
    return [
        SpriteFrame(
            image=frame.image.transpose(Image.Transpose.FLIP_LEFT_RIGHT),
            offset_x=-frame.offset_x,
            original_top=frame.original_top,
        )
        for frame in frames
    ]


def normalize_image(
    source_path: Path,
    destination_path: Path,
    rule: SheetRule,
    rows: int,
    padding_x: int,
    padding_top: int,
    padding_bottom: int,
    alpha_threshold: int,
    minimum_component_pixels: int,
    maximum_island_pixels: int,
    preview: bool,
) -> tuple[int, int]:
    source = Image.open(source_path).convert("RGBA")

    row_bounds = detect_row_bounds(
        source,
        rows=rows,
        alpha_threshold=alpha_threshold,
    )

    row_images = [
        source.crop(
            (
                0,
                row_bounds[row_index],
                source.width,
                row_bounds[row_index + 1],
            )
        )
        for row_index in range(rows)
    ]

    mirror_targets = set((rule.mirror_rows or {}).keys())
    extracted: dict[int, list[SpriteFrame]] = {}

    # On extrait d'abord les lignes fiables.
    for row_index in range(rows):
        if row_index in mirror_targets:
            continue

        extracted[row_index] = extract_row_frames(
            row_images[row_index],
            columns=rule.columns,
            alpha_threshold=alpha_threshold,
            minimum_component_pixels=minimum_component_pixels,
        )

    # Puis on reconstruit les lignes problématiques.
    for target_row, source_row in (rule.mirror_rows or {}).items():
        if source_row not in extracted:
            extracted[source_row] = extract_row_frames(
                row_images[source_row],
                columns=rule.columns,
                alpha_threshold=alpha_threshold,
                minimum_component_pixels=minimum_component_pixels,
            )

        extracted[target_row] = mirror_frames(extracted[source_row])

    # Nettoyage final : retire les petits fragments isolés récupérés
    # depuis une frame voisine. Aucun pixel relié au sprite principal
    # n'est supprimé.
    for row_index in range(rows):
        extracted[row_index] = [
            SpriteFrame(
                image=remove_small_isolated_components(
                    frame.image,
                    maximum_pixels=maximum_island_pixels,
                    alpha_threshold=alpha_threshold,
                ),
                offset_x=frame.offset_x,
                original_top=frame.original_top,
            )
            for frame in extracted[row_index]
        ]

    all_frames = [
        frame
        for row_index in range(rows)
        for frame in extracted[row_index]
    ]

    # Largeur nécessaire pour conserver le décalage X sans aucune coupe.
    required_half_width = max(
        abs(frame.offset_x) + frame.image.width / 2
        for frame in all_frames
    )

    source_cell_width = source.width / rule.columns

    frame_width = max(
        math.ceil(source_cell_width + padding_x * 2),
        math.ceil(required_half_width * 2 + padding_x * 2),
    )

    maximum_row_height = max(row.height for row in row_images)
    frame_height = maximum_row_height + padding_top + padding_bottom

    output = Image.new(
        "RGBA",
        (frame_width * rule.columns, frame_height * rows),
        (0, 0, 0, 0),
    )

    for row_index in range(rows):
        frames = extracted[row_index]

        if len(frames) != rule.columns:
            raise RuntimeError(
                f"Ligne {row_index + 1}: {len(frames)} frames au lieu de "
                f"{rule.columns}."
            )

        for column_index, frame in enumerate(frames):
            target_center_x = (
                column_index * frame_width
                + frame_width / 2
                + frame.offset_x
            )

            target_x = round(
                target_center_x - frame.image.width / 2
            )

            # Le mouvement vertical original est strictement conservé.
            target_y = (
                row_index * frame_height
                + padding_top
                + frame.original_top
            )

            output.alpha_composite(
                frame.image,
                (target_x, target_y),
            )

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination_path)

    if preview:
        preview_image = output.copy()
        pixels = preview_image.load()

        for column in range(1, rule.columns):
            x = column * frame_width
            for y in range(preview_image.height):
                pixels[x, y] = (255, 0, 0, 255)

        for row in range(1, rows):
            y = row * frame_height
            for x in range(preview_image.width):
                pixels[x, y] = (255, 0, 0, 255)

        preview_path = destination_path.with_name(
            destination_path.stem + "_preview.png"
        )
        preview_image.save(preview_path)

    return frame_width, frame_height


def process_folder(
    source_root: Path,
    destination_root: Path,
    rows: int,
    fallback_columns: int | None,
    padding_x: int,
    padding_top: int,
    padding_bottom: int,
    alpha_threshold: int,
    minimum_component_pixels: int,
    maximum_island_pixels: int,
    recursive: bool,
    preview: bool,
) -> None:
    pattern = "**/*" if recursive else "*"

    files = sorted(
        path
        for path in source_root.glob(pattern)
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_EXTENSIONS
        and not path.stem.endswith("_preview")
    )

    success_count = 0
    error_count = 0

    for source_path in files:
        relative_path = source_path.relative_to(source_root)
        destination_path = destination_root / relative_path

        try:
            rule = get_rule(source_path, fallback_columns)

            frame_width, frame_height = normalize_image(
                source_path=source_path,
                destination_path=destination_path,
                rule=rule,
                rows=rows,
                padding_x=padding_x,
                padding_top=padding_top,
                padding_bottom=padding_bottom,
                alpha_threshold=alpha_threshold,
                minimum_component_pixels=minimum_component_pixels,
                maximum_island_pixels=maximum_island_pixels,
                preview=preview,
            )

            print(
                f"[OK] {relative_path}: "
                f"{rule.columns}×{rows}, "
                f"frame {frame_width}×{frame_height}, "
                f"miroir={rule.mirror_rows or {}}"
            )
            success_count += 1

        except Exception as error:
            print(f"[ERREUR] {relative_path}: {error}")
            error_count += 1

    print()
    print(f"Terminé : {success_count} succès, {error_count} erreur(s).")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Nettoie les spritesheets tout en conservant leurs offsets X/Y."
        )
    )

    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--rows", type=int, default=DEFAULT_ROWS)
    parser.add_argument("--columns", type=int)
    parser.add_argument("--padding-x", type=int, default=4)
    parser.add_argument("--padding-top", type=int, default=0)
    parser.add_argument("--padding-bottom", type=int, default=0)
    parser.add_argument("--alpha-threshold", type=int, default=10)
    parser.add_argument("--minimum-component-pixels", type=int, default=3)
    parser.add_argument(
        "--maximum-island-pixels",
        type=int,
        default=8,
        help=(
            "Supprime les fragments opaques isolés de cette taille ou moins "
            "(défaut : 8, 0 pour désactiver)."
        ),
    )
    parser.add_argument("--no-recursive", action="store_true")
    parser.add_argument("--preview", action="store_true")

    args = parser.parse_args()

    if not args.source.is_dir():
        parser.error(f"Dossier source introuvable : {args.source}")

    process_folder(
        source_root=args.source,
        destination_root=args.destination,
        rows=args.rows,
        fallback_columns=args.columns,
        padding_x=args.padding_x,
        padding_top=args.padding_top,
        padding_bottom=args.padding_bottom,
        alpha_threshold=args.alpha_threshold,
        minimum_component_pixels=args.minimum_component_pixels,
        maximum_island_pixels=args.maximum_island_pixels,
        recursive=not args.no_recursive,
        preview=args.preview,
    )


if __name__ == "__main__":
    main()