from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LayerSpec:
    path: str
    palette: str | None = None
    source_palette: str | None = None
    frame_size: int = 64
    fallback_group: str | None = None
    offset_x: int = 0
    offset_y: int = 0
    direct_columns: bool = False


@dataclass(frozen=True)
class Equipment:
    background: tuple[LayerSpec, ...] = ()
    foreground: tuple[LayerSpec, ...] = ()


EQUIPMENT: dict[str, dict[str, Equipment]] = {
    "axe": {
        "walk": Equipment(foreground=(LayerSpec("tools/smash/universal/male/walk/axe.png"),)),
        "slash": Equipment(
            background=(LayerSpec("tools/smash/background/axe.png", frame_size=128, fallback_group="axe_slash"),),
            foreground=(LayerSpec("tools/smash/foreground/axe.png", frame_size=128, fallback_group="axe_slash"),),
        ),
    },
    "pickaxe": {
        "walk": Equipment(foreground=(LayerSpec("tools/smash/universal/male/walk/pickaxe.png"),)),
        "slash": Equipment(
            background=(LayerSpec("tools/smash/background/pickaxe.png", frame_size=128, fallback_group="pickaxe_slash"),),
            foreground=(LayerSpec("tools/smash/foreground/pickaxe.png", frame_size=128, fallback_group="pickaxe_slash"),),
        ),
    },
    "hammer": {
        "walk": Equipment(foreground=(LayerSpec("tools/smash/universal/male/walk/hammer.png"),)),
        "slash": Equipment(
            background=(LayerSpec("tools/smash/background/hammer.png", frame_size=128, fallback_group="hammer_slash"),),
            foreground=(LayerSpec("tools/smash/foreground/hammer.png", frame_size=128, fallback_group="hammer_slash"),),
        ),
    },
    "scythe": {
        "walk": Equipment(
            background=(LayerSpec("weapon/polearm/scythe/universal_behind/walk/scythe.png"),),
            foreground=(LayerSpec("weapon/polearm/scythe/walk/scythe.png"),),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/polearm/scythe/universal_behind/hurt/scythe.png"),),
            foreground=(LayerSpec("weapon/polearm/scythe/hurt/scythe.png"),),
        ),
        "slash": Equipment(
            background=(LayerSpec("weapon/polearm/scythe/attack_slash/behind/scythe.png", frame_size=192),),
            foreground=(LayerSpec("weapon/polearm/scythe/attack_slash/scythe.png", frame_size=192),),
        ),
    },
    "bow": {
        "walk": Equipment(
            background=(
                LayerSpec(
                    "weapon/ranged/bow/normal/walk/background/dark.png",
                    frame_size=128,
                    direct_columns=True,
                ),
            ),
            foreground=(
                LayerSpec(
                    "weapon/ranged/bow/normal/walk/foreground/dark.png",
                    frame_size=128,
                    direct_columns=True,
                ),
            ),
        ),
        "shoot": Equipment(
            background=(LayerSpec("weapon/ranged/bow/normal/universal/background/shoot/dark.png"),),
            foreground=(
                LayerSpec("weapon/ranged/bow/normal/universal/foreground/shoot/dark.png"),
                LayerSpec("weapon/ranged/bow/arrow/shoot/arrow.png"),
            ),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/ranged/bow/normal/universal/background/hurt/dark.png"),),
            foreground=(LayerSpec("weapon/ranged/bow/normal/universal/foreground/hurt/dark.png"),),
        ),
    },
    "bow_great": {
        "walk": Equipment(
            background=(
                LayerSpec("weapon/ranged/bow/great/walk/background/dark.png", frame_size=128, direct_columns=True),
            ),
            foreground=(
                LayerSpec("weapon/ranged/bow/great/walk/foreground/dark.png", frame_size=128, direct_columns=True),
            ),
        ),
        "shoot": Equipment(
            foreground=(
                LayerSpec("weapon/ranged/bow/great/universal/foreground/shoot/dark.png"),
                LayerSpec("weapon/ranged/bow/arrow/shoot/arrow.png"),
            ),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/ranged/bow/great/universal/background/hurt/dark.png"),),
            foreground=(LayerSpec("weapon/ranged/bow/great/universal/foreground/hurt/dark.png"),),
        ),
    },
    "bow_recurve": {
        "walk": Equipment(
            background=(
                LayerSpec("weapon/ranged/bow/recurve/walk/background/dark.png", frame_size=128, direct_columns=True),
            ),
            foreground=(
                LayerSpec("weapon/ranged/bow/recurve/walk/foreground/dark.png", frame_size=128, direct_columns=True),
            ),
        ),
        "shoot": Equipment(
            background=(LayerSpec("weapon/ranged/bow/recurve/universal/background/shoot/dark.png"),),
            foreground=(
                LayerSpec("weapon/ranged/bow/recurve/universal/foreground/shoot/dark.png"),
                LayerSpec("weapon/ranged/bow/arrow/shoot/arrow.png"),
            ),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/ranged/bow/recurve/universal/background/hurt/dark.png"),),
            foreground=(LayerSpec("weapon/ranged/bow/recurve/universal/foreground/hurt/dark.png"),),
        ),
    },
    "spear": {
        "walk": Equipment(
            background=(LayerSpec("weapon/polearm/spear/background/walk/dark.png"),),
            foreground=(LayerSpec("weapon/polearm/spear/foreground/walk/dark.png"),),
        ),
        "thrust": Equipment(
            background=(LayerSpec("weapon/polearm/spear/background/thrust/dark.png"),),
            foreground=(LayerSpec("weapon/polearm/spear/foreground/thrust/dark.png"),),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/polearm/spear/background/hurt/dark.png"),),
            foreground=(LayerSpec("weapon/polearm/spear/foreground/hurt/dark.png"),),
        ),
    },
    "dagger": {
        "walk": Equipment(
            background=(LayerSpec("weapon/sword/dagger/behind/walk/dagger.png"),),
            foreground=(LayerSpec("weapon/sword/dagger/walk/dagger.png"),),
        ),
        "slash": Equipment(
            background=(LayerSpec("weapon/sword/dagger/behind/slash/dagger.png"),),
            foreground=(LayerSpec("weapon/sword/dagger/slash/dagger.png"),),
        ),
        "hurt": Equipment(foreground=(LayerSpec("weapon/sword/dagger/hurt/dagger.png"),)),
    },
    # Arming sword + round shield, both recolored to brass. The shield has no "brass"
    # source file, so it's pixel-recolored from the hand-colored "gold" variant instead.
    # The shield has no hurt/dying frames, so it's dropped for that pose (like the axe).
    # The shield is a single static layer with no per-direction bg/fg split (unlike the
    # sword), so as a background layer it got inconsistently occluded by the body
    # depending on facing (fully visible boss detail one way, mostly hidden the other).
    # Foreground keeps it fully visible and consistent across all 4 directions.
    "broadsword": {
        "walk": Equipment(
            background=(LayerSpec("weapon/sword/arming/universal/bg/walk/brass.png"),),
            foreground=(
                LayerSpec("weapon/sword/arming/universal/fg/walk/brass.png"),
                LayerSpec("shield/round/walk/gold.png", palette="brass"),
            ),
        ),
        "slash": Equipment(
            background=(LayerSpec("weapon/sword/arming/attack_slash/bg/brass.png", frame_size=128),),
            foreground=(
                LayerSpec("weapon/sword/arming/attack_slash/fg/brass.png", frame_size=128),
                LayerSpec("shield/round/slash/gold.png", palette="brass"),
            ),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/sword/arming/universal/bg/hurt/brass.png"),),
            foreground=(LayerSpec("weapon/sword/arming/universal/fg/hurt/brass.png"),),
        ),
    },
    # Same arming sword + round shield as "broadsword", but both parts ship pre-made
    # "silver" textures, so no palette recolor is needed here.
    "longsword": {
        "walk": Equipment(
            background=(
                LayerSpec("shield/round/walk/silver.png"),
                LayerSpec("weapon/sword/arming/universal/bg/walk/silver.png"),
            ),
            foreground=(LayerSpec("weapon/sword/arming/universal/fg/walk/silver.png"),),
        ),
        "slash": Equipment(
            background=(
                LayerSpec("shield/round/slash/silver.png"),
                LayerSpec("weapon/sword/arming/attack_slash/bg/silver.png", frame_size=128),
            ),
            foreground=(LayerSpec("weapon/sword/arming/attack_slash/fg/silver.png", frame_size=128),),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/sword/arming/universal/bg/hurt/silver.png"),),
            foreground=(LayerSpec("weapon/sword/arming/universal/fg/hurt/silver.png"),),
        ),
    },
}


def equipment_layers(equipment: str | None, animation: str) -> Equipment:
    if not equipment:
        return Equipment()
    return EQUIPMENT.get(equipment, {}).get(animation, Equipment())
