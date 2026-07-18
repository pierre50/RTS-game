from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LayerSpec:
    path: str
    palette: str | None = None
    source_palette: str | None = None
    # Auto-detected from the source image's height at load time (see
    # image_pipeline.detect_frame_size). Only set this explicitly when a layer's
    # canvas doesn't follow the standard "4 directional rows, or 1 row for hurt"
    # layout and the auto-detection would guess wrong.
    frame_size: int | None = None
    fallback_group: str | None = None
    offset_x: int = 0
    offset_y: int = 0
    direct_columns: bool = False
    # Rows (LPC universal order: 0=north, 1=west, 2=south, 3=east) on which this
    # layer should swap paste order with whatever immediately precedes it. Used for
    # a foreground layer that must sit in front of everything on most facings but
    # behind the one immediately before it (e.g. a weapon) on a specific facing.
    behind_rows: tuple[int, ...] = ()
    # Rows on which this layer is repositioned to paste immediately behind the body
    # layer, regardless of where it sits in the layer list. Used for a carried item
    # held in front of the character that must instead be hidden behind their back
    # when they're facing away (e.g. north), which a single-swap behind_rows can't
    # express since the item isn't adjacent to the body in the layer list.
    behind_body_rows: tuple[int, ...] = ()
    # Marks the single layer in the list that behind_body_rows repositions others
    # relative to. Only ever set on the body LayerSpec built in layer_paths.
    is_body: bool = False


@dataclass(frozen=True)
class Equipment:
    background: tuple[LayerSpec, ...] = ()
    foreground: tuple[LayerSpec, ...] = ()


# LPC universal sheets always order directional rows north/west/south/east.
NORTH_ROW = 0
SOUTH_ROW = 2


EQUIPMENT: dict[str, dict[str, Equipment]] = {
    "axe": {
        "walk": Equipment(foreground=(LayerSpec("tools/smash/universal/male/walk/axe.png"),)),
        "slash": Equipment(
            background=(LayerSpec("tools/smash/background/axe.png", fallback_group="axe_slash"),),
            foreground=(LayerSpec("tools/smash/foreground/axe.png", fallback_group="axe_slash"),),
        ),
    },
    "pickaxe": {
        "walk": Equipment(foreground=(LayerSpec("tools/smash/universal/male/walk/pickaxe.png"),)),
        "slash": Equipment(
            background=(LayerSpec("tools/smash/background/pickaxe.png", fallback_group="pickaxe_slash"),),
            foreground=(LayerSpec("tools/smash/foreground/pickaxe.png", fallback_group="pickaxe_slash"),),
        ),
    },
    "hammer": {
        "walk": Equipment(foreground=(LayerSpec("tools/smash/universal/male/walk/hammer.png"),)),
        "slash": Equipment(
            background=(LayerSpec("tools/smash/background/hammer.png", fallback_group="hammer_slash"),),
            foreground=(LayerSpec("tools/smash/foreground/hammer.png", fallback_group="hammer_slash"),),
        ),
    },
    # Carried in hand for the "loaded" walk (bringing a gathered resource home), not
    # equipped during any combat pose, so each only defines "walk". Held in front on
    # west/south, but hidden behind the body when facing north (away from camera),
    # since the character's back would otherwise occlude it anyway.
    "meat": {
        "walk": Equipment(
            foreground=(
                LayerSpec(
                    "tools/carry/universal/male/walk/meat.png",
                    behind_body_rows=(NORTH_ROW,),
                ),
            )
        ),
    },
    "stone": {
        "walk": Equipment(
            foreground=(
                LayerSpec(
                    "tools/carry/universal/male/walk/stone.png",
                    behind_body_rows=(NORTH_ROW,),
                ),
            )
        ),
    },
    "gold": {
        "walk": Equipment(
            foreground=(
                LayerSpec(
                    "tools/carry/universal/male/walk/gold.png",
                    behind_body_rows=(NORTH_ROW,),
                ),
            )
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
            background=(LayerSpec("weapon/polearm/scythe/attack_slash/behind/scythe.png"),),
            foreground=(LayerSpec("weapon/polearm/scythe/attack_slash/scythe.png"),),
        ),
    },
    "bow": {
        "walk": Equipment(
            background=(
                LayerSpec(
                    "weapon/ranged/bow/normal/walk/background/dark.png",
                    direct_columns=True,
                ),
            ),
            foreground=(
                LayerSpec(
                    "weapon/ranged/bow/normal/walk/foreground/dark.png",
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
                LayerSpec("weapon/ranged/bow/great/walk/background/dark.png", direct_columns=True),
            ),
            foreground=(
                LayerSpec("weapon/ranged/bow/great/walk/foreground/dark.png", direct_columns=True),
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
                LayerSpec("weapon/ranged/bow/recurve/walk/background/dark.png", direct_columns=True),
            ),
            foreground=(
                LayerSpec("weapon/ranged/bow/recurve/walk/foreground/dark.png", direct_columns=True),
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
    # Foreground keeps it fully visible and consistent across all 4 directions, except
    # facing south the sword must still read as held in front of the shield, so it's
    # flagged behind_rows=SOUTH_ROW to swap paste order with the sword there.
    "broadsword": {
        "walk": Equipment(
            background=(LayerSpec("weapon/sword/arming/universal/bg/walk/brass.png"),),
            foreground=(
                LayerSpec("weapon/sword/arming/universal/fg/walk/brass.png"),
                LayerSpec("shield/round/walk/gold.png", palette="brass", behind_rows=(SOUTH_ROW,)),
            ),
        ),
        "slash": Equipment(
            background=(LayerSpec("weapon/sword/arming/attack_slash/bg/brass.png"),),
            foreground=(
                LayerSpec("weapon/sword/arming/attack_slash/fg/brass.png"),
                LayerSpec("shield/round/slash/gold.png", palette="brass", behind_rows=(SOUTH_ROW,)),
            ),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/sword/arming/universal/bg/hurt/brass.png"),),
            foreground=(LayerSpec("weapon/sword/arming/universal/fg/hurt/brass.png"),),
        ),
    },
    # Same arming sword + round shield as "broadsword", both parts ship pre-made
    # "silver" textures, so no palette recolor is needed. Like "broadsword"'s shield,
    # this one has no per-direction bg/fg split, so it must go in foreground (not
    # background) or it gets inconsistently occluded by the body depending on facing,
    # and it's flagged behind_rows=SOUTH_ROW so the sword still reads as in front of
    # it on that one facing.
    "longsword": {
        "walk": Equipment(
            background=(LayerSpec("weapon/sword/arming/universal/bg/walk/silver.png"),),
            foreground=(
                LayerSpec("weapon/sword/arming/universal/fg/walk/silver.png"),
                LayerSpec("shield/round/walk/silver.png", behind_rows=(SOUTH_ROW,)),
            ),
        ),
        "slash": Equipment(
            background=(LayerSpec("weapon/sword/arming/attack_slash/bg/silver.png"),),
            foreground=(
                LayerSpec("weapon/sword/arming/attack_slash/fg/silver.png"),
                LayerSpec("shield/round/slash/silver.png", behind_rows=(SOUTH_ROW,)),
            ),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/sword/arming/universal/bg/hurt/silver.png"),),
            foreground=(LayerSpec("weapon/sword/arming/universal/fg/hurt/silver.png"),),
        ),
    },
    # Longspear + round shield, brass-recolored like "broadsword"'s shield (no
    # pre-made "brass" round shield source, so it's pixel-recolored from "gold").
    # The longspear's walk art ships on the same oversized held-item canvas as the
    # bow (direct_columns), and its thrust art on a 192px canvas
    # (like the scythe's slash). It has no hurt frames at all, so — like the axe —
    # the weapon (and its shield) are dropped for that pose.
    "longspear": {
        "walk": Equipment(
            background=(
                LayerSpec(
                    "weapon/polearm/longspear/background/walk/dark.png",
                    direct_columns=True,
                ),
            ),
            foreground=(
                LayerSpec(
                    "weapon/polearm/longspear/foreground/walk/dark.png",
                    direct_columns=True,
                ),
                LayerSpec("shield/round/walk/gold.png", palette="brass", behind_rows=(SOUTH_ROW,)),
            ),
        ),
        "thrust": Equipment(
            background=(LayerSpec("weapon/polearm/longspear/background/thrust/dark.png"),),
            foreground=(
                LayerSpec("weapon/polearm/longspear/foreground/thrust/dark.png"),
                LayerSpec("shield/round/thrust/gold.png", palette="brass", behind_rows=(SOUTH_ROW,)),
            ),
        ),
    },
    # Walking stick. Only ships walk/thrust art (no spellcast pose), so it's dropped
    # during the action animation rather than shown floating in the wrong hand position.
    "cane": {
        "walk": Equipment(foreground=(LayerSpec("weapon/polearm/cane/male/walk/cane.png"),)),
    },
    "fishing_rod": {
        "tool_rod": Equipment(
            background=(LayerSpec("tools/fishing/rod-bg.png"),),
            foreground=(LayerSpec("tools/fishing/rod-fg.png"),),
        ),
    },
    # Same longspear + round shield as "longspear", but both parts ship pre-made
    # "silver" textures like "longsword" vs "broadsword", so no palette recolor is
    # needed. Same south-facing occlusion fix as the other round-shield combos.
    "longspear_silver": {
        "walk": Equipment(
            background=(
                LayerSpec(
                    "weapon/polearm/longspear/background/walk/silver.png",
                    direct_columns=True,
                ),
            ),
            foreground=(
                LayerSpec(
                    "weapon/polearm/longspear/foreground/walk/silver.png",
                    direct_columns=True,
                ),
                LayerSpec("shield/round/walk/silver.png", behind_rows=(SOUTH_ROW,)),
            ),
        ),
        "thrust": Equipment(
            background=(LayerSpec("weapon/polearm/longspear/background/thrust/silver.png"),),
            foreground=(
                LayerSpec("weapon/polearm/longspear/foreground/thrust/silver.png"),
                LayerSpec("shield/round/thrust/silver.png", behind_rows=(SOUTH_ROW,)),
            ),
        ),
    },
}


def equipment_layers(equipment: str | None, animation: str) -> Equipment:
    if not equipment:
        return Equipment()
    return EQUIPMENT.get(equipment, {}).get(animation, Equipment())
