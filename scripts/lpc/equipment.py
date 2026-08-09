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
TOOL_METAL_SOURCE = "tool_metal_source"


def tool_layer(path: str, palette: str | None = None, **kwargs) -> LayerSpec:
    return LayerSpec(path, palette, source_palette=TOOL_METAL_SOURCE if palette else None, **kwargs)


def smash_tool_equipment(tool: str, palette: str | None = None) -> dict[str, Equipment]:
    return {
        "walk": Equipment(foreground=(tool_layer(f"tools/smash/universal/male/walk/{tool}.png", palette),)),
        "slash": Equipment(
            background=(tool_layer(f"tools/smash/background/{tool}.png", palette, fallback_group=f"{tool}_slash"),),
            foreground=(tool_layer(f"tools/smash/foreground/{tool}.png", palette, fallback_group=f"{tool}_slash"),),
        ),
    }


def scythe_equipment(palette: str | None = None) -> dict[str, Equipment]:
    return {
        "walk": Equipment(
            background=(tool_layer("weapon/polearm/scythe/universal_behind/walk/scythe.png", palette),),
            foreground=(tool_layer("weapon/polearm/scythe/walk/scythe.png", palette),),
        ),
        "slash": Equipment(
            background=(tool_layer("weapon/polearm/scythe/attack_slash/behind/scythe.png", palette),),
            foreground=(tool_layer("weapon/polearm/scythe/attack_slash/scythe.png", palette),),
        ),
    }


def arming_sword_equipment(palette: str | None = None) -> dict[str, Equipment]:
    def sword_layer(path: str) -> LayerSpec:
        return LayerSpec(path, palette, source_palette="brass" if palette else None)

    return {
        "walk": Equipment(
            background=(sword_layer("weapon/sword/arming/universal/bg/walk/brass.png"),),
            foreground=(sword_layer("weapon/sword/arming/universal/fg/walk/brass.png"),),
        ),
        "slash": Equipment(
            background=(sword_layer("weapon/sword/arming/attack_slash/bg/brass.png"),),
            foreground=(sword_layer("weapon/sword/arming/attack_slash/fg/brass.png"),),
        ),
    }


def torso_armor_equipment(path: str, color: str) -> dict[str, Equipment]:
    return {
        "walk": Equipment(foreground=(LayerSpec(f"{path}/{{variant}}/walk/{color}.png"),)),
        "slash": Equipment(foreground=(LayerSpec(f"{path}/{{variant}}/slash/{color}.png"),)),
    }


def recolored_torso_armor_equipment(path: str, source_color: str, color: str) -> dict[str, Equipment]:
    return {
        "walk": Equipment(foreground=(LayerSpec(f"{path}/{{variant}}/walk/{source_color}.png", color),)),
        "slash": Equipment(foreground=(LayerSpec(f"{path}/{{variant}}/slash/{source_color}.png", color),)),
    }


def helmet_equipment(path: str, color: str) -> dict[str, Equipment]:
    return {
        "walk": Equipment(foreground=(LayerSpec(f"{path}/adult/walk/{color}.png"),)),
        "slash": Equipment(foreground=(LayerSpec(f"{path}/adult/slash/{color}.png"),)),
    }


def bracers_equipment(color: str) -> dict[str, Equipment]:
    return {
        "walk": Equipment(foreground=(LayerSpec("arms/bracers/male/walk.png", color),)),
        "slash": Equipment(foreground=(LayerSpec("arms/bracers/male/slash.png", color),)),
    }


def cape_solid_equipment() -> dict[str, Equipment]:
    return {
        "walk": Equipment(
            background=(LayerSpec("cape/solid/bg/walk.png", "player_blue"),),
            foreground=(LayerSpec("cape/solid/fg/walk.png", "player_blue"),),
        ),
        "slash": Equipment(
            background=(LayerSpec("cape/solid/bg/slash.png", "player_blue"),),
            foreground=(LayerSpec("cape/solid/fg/slash.png", "player_blue"),),
        ),
    }


def hat_accessory_equipment(path: str) -> dict[str, Equipment]:
    return {
        "walk": Equipment(foreground=(LayerSpec(f"{path}/adult/walk.png", "player_blue"),)),
        "slash": Equipment(foreground=(LayerSpec(f"{path}/adult/slash.png", "player_blue"),)),
    }


def recolored_shield_equipment(color: str) -> dict[str, Equipment]:
    return {
        "walk": Equipment(foreground=(LayerSpec("shield/round/walk/brass.png", color, source_palette="brass"),)),
        "slash": Equipment(foreground=(LayerSpec("shield/round/slash/brass.png", color, source_palette="brass"),)),
    }


EQUIPMENT: dict[str, dict[str, Equipment]] = {
    "axe_ceramic": smash_tool_equipment("axe", "ceramic"),
    "axe_copper": smash_tool_equipment("axe", "copper"),
    "axe_bronze": smash_tool_equipment("axe", "bronze"),
    "axe_iron": smash_tool_equipment("axe", "iron"),
    "pickaxe_ceramic": smash_tool_equipment("pickaxe", "ceramic"),
    "pickaxe_copper": smash_tool_equipment("pickaxe", "copper"),
    "pickaxe_bronze": smash_tool_equipment("pickaxe", "bronze"),
    "pickaxe_iron": smash_tool_equipment("pickaxe", "iron"),
    "hammer_ceramic": smash_tool_equipment("hammer", "ceramic"),
    "hammer_copper": smash_tool_equipment("hammer", "copper"),
    "hammer_bronze": smash_tool_equipment("hammer", "bronze"),
    "hammer_iron": smash_tool_equipment("hammer", "iron"),
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
    "scythe_ceramic": scythe_equipment("ceramic"),
    "scythe_copper": scythe_equipment("copper"),
    "scythe_bronze": scythe_equipment("bronze"),
    "scythe_iron": scythe_equipment("iron"),
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
    "sword_ceramic": arming_sword_equipment("ceramic"),
    "sword_copper": arming_sword_equipment("copper"),
    "sword_bronze": arming_sword_equipment("bronze"),
    "sword_iron": arming_sword_equipment("iron"),
    "armor_leather": torso_armor_equipment("torso/armour/leather", "leather"),
    "armor_mail_ceramic": recolored_torso_armor_equipment("torso/chainmail", "gray", "ceramic"),
    "armor_mail_copper": recolored_torso_armor_equipment("torso/chainmail", "gray", "copper"),
    "armor_mail_bronze": recolored_torso_armor_equipment("torso/chainmail", "gray", "bronze"),
    "armor_mail_iron": recolored_torso_armor_equipment("torso/chainmail", "gray", "iron"),
    "armor_legion_ceramic": torso_armor_equipment("torso/armour/legion", "ceramic"),
    "armor_legion_copper": torso_armor_equipment("torso/armour/legion", "copper"),
    "armor_legion_bronze": torso_armor_equipment("torso/armour/legion", "bronze"),
    "armor_legion_iron": torso_armor_equipment("torso/armour/legion", "iron"),
    "helmet_pointed_ceramic": helmet_equipment("hat/helmet/pointed", "ceramic"),
    "helmet_pointed_copper": helmet_equipment("hat/helmet/pointed", "copper"),
    "helmet_pointed_bronze": helmet_equipment("hat/helmet/pointed", "bronze"),
    "helmet_pointed_iron": helmet_equipment("hat/helmet/pointed", "iron"),
    "helmet_barbuta_ceramic": helmet_equipment("hat/helmet/barbuta_simple", "ceramic"),
    "helmet_barbuta_copper": helmet_equipment("hat/helmet/barbuta_simple", "copper"),
    "helmet_barbuta_bronze": helmet_equipment("hat/helmet/barbuta_simple", "bronze"),
    "helmet_barbuta_iron": helmet_equipment("hat/helmet/barbuta_simple", "iron"),
    "shoulder_legion_ceramic": torso_armor_equipment("shoulders/legion", "ceramic"),
    "shoulder_legion_copper": torso_armor_equipment("shoulders/legion", "copper"),
    "shoulder_legion_bronze": torso_armor_equipment("shoulders/legion", "bronze"),
    "shoulder_legion_iron": torso_armor_equipment("shoulders/legion", "iron"),
    "bracers_ceramic": bracers_equipment("ceramic"),
    "bracers_copper": bracers_equipment("copper"),
    "bracers_bronze": bracers_equipment("bronze"),
    "bracers_iron": bracers_equipment("iron"),
    "leg_armor_ceramic": torso_armor_equipment("legs/armour/plate", "ceramic"),
    "leg_armor_copper": torso_armor_equipment("legs/armour/plate", "copper"),
    "leg_armor_bronze": torso_armor_equipment("legs/armour/plate", "bronze"),
    "leg_armor_iron": torso_armor_equipment("legs/armour/plate", "iron"),
    "cape_solid": cape_solid_equipment(),
    "crest": hat_accessory_equipment("hat/accessory/crest"),
    "centurion_crest": hat_accessory_equipment("hat/accessory/crest_centurion"),
    "centurion_plumage": hat_accessory_equipment("hat/accessory/plumage_centurion"),
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
    "round_shield_ceramic_slash": recolored_shield_equipment("ceramic"),
    "round_shield_copper_slash": recolored_shield_equipment("copper"),
    "round_shield_bronze_slash": recolored_shield_equipment("bronze"),
    "round_shield_iron_slash": recolored_shield_equipment("iron"),
}


def equipment_layers(equipment: str | None, animation: str) -> Equipment:
    if not equipment:
        return Equipment()
    return EQUIPMENT.get(equipment, {}).get(animation, Equipment())
