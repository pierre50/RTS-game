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
    },
    "halberd": {
        "walk": Equipment(
            background=(LayerSpec("weapon/polearm/halberd/walk/behind/halberd.png"),),
            foreground=(LayerSpec("weapon/polearm/halberd/walk/halberd.png"),),
        ),
        "slash": Equipment(
            background=(LayerSpec("weapon/polearm/halberd/attack_slash/behind/halberd.png"),),
            foreground=(LayerSpec("weapon/polearm/halberd/attack_slash/halberd.png"),),
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
    },
    # Arming sword only. The matching shield is generated as its own dynamic
    # equipment below so runtime loadouts can toggle weapon and shield separately.
    "broadsword": {
        "walk": Equipment(
            background=(LayerSpec("weapon/sword/arming/universal/bg/walk/brass.png"),),
            foreground=(LayerSpec("weapon/sword/arming/universal/fg/walk/brass.png"),),
        ),
        "slash": Equipment(
            background=(LayerSpec("weapon/sword/arming/attack_slash/bg/brass.png"),),
            foreground=(LayerSpec("weapon/sword/arming/attack_slash/fg/brass.png"),),
        ),
    },
    # Silver arming sword only. The matching shield is generated separately.
    "longsword": {
        "walk": Equipment(
            background=(LayerSpec("weapon/sword/arming/universal/bg/walk/silver.png"),),
            foreground=(LayerSpec("weapon/sword/arming/universal/fg/walk/silver.png"),),
        ),
        "slash": Equipment(
            background=(LayerSpec("weapon/sword/arming/attack_slash/bg/silver.png"),),
            foreground=(LayerSpec("weapon/sword/arming/attack_slash/fg/silver.png"),),
        ),
    },
    # Walking stick. Only ships walk art (no spellcast pose), so it's dropped
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
    # Round shields are standalone equipment. The brass sheet is pixel-recolored
    # from the hand-colored gold source by the image pipeline.
    "round_shield_brass_slash": {
        "walk": Equipment(foreground=(LayerSpec("shield/round/walk/brass.png"),)),
        "slash": Equipment(foreground=(LayerSpec("shield/round/slash/brass.png"),)),
    },
    "round_shield_silver_slash": {
        "walk": Equipment(foreground=(LayerSpec("shield/round/walk/silver.png"),)),
        "slash": Equipment(foreground=(LayerSpec("shield/round/slash/silver.png"),)),
    },
}


def equipment_layers(equipment: str | None, animation: str) -> Equipment:
    if not equipment:
        return Equipment()
    return EQUIPMENT.get(equipment, {}).get(animation, Equipment())
