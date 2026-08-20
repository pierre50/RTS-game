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


@dataclass(frozen=True)
class DynamicLayer:
    key: str
    z_index: int
    layers: tuple[LayerSpec, ...]


@dataclass(frozen=True)
class DynamicEquipment:
    key: str
    action_animation: str
    layers_by_animation: dict[str, tuple[DynamicLayer, ...]]
    variants: tuple[str, ...] = ()


# LPC universal sheets always order directional rows north/west/south/east.
NORTH_ROW = 0
TOOL_METAL_SOURCE = "tool_metal_source"
VARIANT_SOURCE_PALETTES = {
    "iron": "iron_source",
}


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


def arrow_equipment(palette: str | None = None) -> dict[str, Equipment]:
    return {
        "shoot": Equipment(
            foreground=(
                LayerSpec(
                    "weapon/ranged/bow/arrow/shoot/arrow.png",
                    palette,
                    source_palette="arrow_metal_source" if palette else None,
                ),
            ),
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
        "hurt": Equipment(
            background=(sword_layer("weapon/sword/arming/universal/bg/hurt/brass.png"),),
            foreground=(sword_layer("weapon/sword/arming/universal/fg/hurt/brass.png"),),
        ),
    }


def variant_layer(path: str, color: str) -> LayerSpec:
    source_palette = VARIANT_SOURCE_PALETTES.get(color)
    return LayerSpec(path, color, source_palette=source_palette) if source_palette else LayerSpec(path)


def torso_armor_equipment(path: str, color: str, include_hurt: bool = False) -> dict[str, Equipment]:
    equipment = {
        "walk": Equipment(foreground=(variant_layer(f"{path}/{{variant}}/walk/{color}.png", color),)),
        "slash": Equipment(foreground=(variant_layer(f"{path}/{{variant}}/slash/{color}.png", color),)),
    }
    if include_hurt:
        equipment["hurt"] = Equipment(foreground=(variant_layer(f"{path}/{{variant}}/hurt/{color}.png", color),))
    return equipment


def recolored_torso_armor_equipment(path: str, source_color: str, color: str) -> dict[str, Equipment]:
    source_palette = VARIANT_SOURCE_PALETTES.get(source_color)
    return {
        "walk": Equipment(foreground=(LayerSpec(f"{path}/{{variant}}/walk/{source_color}.png", color, source_palette),)),
        "slash": Equipment(foreground=(LayerSpec(f"{path}/{{variant}}/slash/{source_color}.png", color, source_palette),)),
    }


def helmet_equipment(path: str, color: str, include_hurt: bool = False) -> dict[str, Equipment]:
    equipment = {
        "walk": Equipment(foreground=(variant_layer(f"{path}/adult/walk/{color}.png", color),)),
        "slash": Equipment(foreground=(variant_layer(f"{path}/adult/slash/{color}.png", color),)),
    }
    if include_hurt:
        equipment["hurt"] = Equipment(foreground=(variant_layer(f"{path}/adult/hurt/{color}.png", color),))
    return equipment


def hood_equipment(path: str, color: str) -> dict[str, Equipment]:
    return {
        "walk": Equipment(foreground=(variant_layer(f"{path}/adult/walk/{color}.png", color),)),
        "shoot": Equipment(foreground=(variant_layer(f"{path}/adult/shoot/{color}.png", color),)),
        "hurt": Equipment(foreground=(variant_layer(f"{path}/adult/hurt/{color}.png", color),)),
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
        "hurt": Equipment(
            background=(LayerSpec("cape/solid/bg/hurt.png", "player_blue"),),
            foreground=(LayerSpec("cape/solid/fg/hurt.png", "player_blue"),),
        ),
    }


def hat_accessory_equipment(path: str) -> dict[str, Equipment]:
    return {
        "walk": Equipment(foreground=(LayerSpec(f"{path}/adult/walk.png", "player_blue"),)),
        "slash": Equipment(foreground=(LayerSpec(f"{path}/adult/slash.png", "player_blue"),)),
    }


def split_hat_accessory_equipment(
    path: str,
    palette: str | None = "player_blue",
    include_hurt: bool = False,
) -> dict[str, Equipment]:
    equipment = {
        "walk": Equipment(
            background=(LayerSpec(f"{path}/bg/adult/walk.png", palette),),
            foreground=(LayerSpec(f"{path}/fg/adult/walk.png", palette),),
        ),
        "slash": Equipment(
            background=(LayerSpec(f"{path}/bg/adult/slash.png", palette),),
            foreground=(LayerSpec(f"{path}/fg/adult/slash.png", palette),),
        ),
    }
    if include_hurt:
        equipment["hurt"] = Equipment(
            background=(LayerSpec(f"{path}/bg/adult/hurt.png", palette),),
            foreground=(LayerSpec(f"{path}/fg/adult/hurt.png", palette),),
        )
    return equipment


def recolored_shield_equipment(color: str) -> dict[str, Equipment]:
    return {
        "walk": Equipment(
            foreground=(LayerSpec("shield/round/walk/brown.png", color, source_palette="shield_round_metal_source"),),
        ),
        "slash": Equipment(
            foreground=(LayerSpec("shield/round/slash/brown.png", color, source_palette="shield_round_metal_source"),),
        ),
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
            ),
        ),
        "hurt": Equipment(
            background=(LayerSpec("weapon/ranged/bow/recurve/universal/background/hurt/dark.png"),),
            foreground=(LayerSpec("weapon/ranged/bow/recurve/universal/foreground/hurt/dark.png"),),
        ),
    },
    "arrow_ceramic": arrow_equipment("ceramic"),
    "arrow_copper": arrow_equipment("copper"),
    "arrow_bronze": arrow_equipment("bronze"),
    "arrow_iron": arrow_equipment("iron"),
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
    "armor_leather": torso_armor_equipment("torso/armour/leather", "leather", include_hurt=True),
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
    "helmet_legion_ceramic": helmet_equipment("hat/helmet/legion", "ceramic"),
    "helmet_legion_copper": helmet_equipment("hat/helmet/legion", "copper"),
    "helmet_legion_bronze": helmet_equipment("hat/helmet/legion", "bronze"),
    "helmet_legion_iron": helmet_equipment("hat/helmet/legion", "iron"),
    "helmet_nasal_ceramic": helmet_equipment("hat/helmet/nasal", "ceramic"),
    "helmet_nasal_copper": helmet_equipment("hat/helmet/nasal", "copper"),
    "helmet_nasal_bronze": helmet_equipment("hat/helmet/nasal", "bronze"),
    "helmet_nasal_iron": helmet_equipment("hat/helmet/nasal", "iron"),
    "helmet_bascinet_round_ceramic": helmet_equipment("hat/helmet/bascinet_round", "ceramic"),
    "helmet_bascinet_round_copper": helmet_equipment("hat/helmet/bascinet_round", "copper"),
    "helmet_bascinet_round_bronze": helmet_equipment("hat/helmet/bascinet_round", "bronze"),
    "helmet_bascinet_round_iron": helmet_equipment("hat/helmet/bascinet_round", "iron"),
    "helmet_norman_ceramic": helmet_equipment("hat/helmet/norman", "ceramic"),
    "helmet_norman_copper": helmet_equipment("hat/helmet/norman", "copper"),
    "helmet_norman_bronze": helmet_equipment("hat/helmet/norman", "bronze"),
    "helmet_norman_iron": helmet_equipment("hat/helmet/norman", "iron"),
    "helmet_barbarian_ceramic": helmet_equipment("hat/helmet/barbarian", "ceramic", include_hurt=True),
    "helmet_barbarian_nasal_ceramic": helmet_equipment(
        "hat/helmet/barbarian_nasal",
        "ceramic",
        include_hurt=True,
    ),
    "sack_cloth_hood_leather": hood_equipment("hat/cloth/hood_sack", "leather"),
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
    "legion_plumage": hat_accessory_equipment("hat/accessory/plumage_legion"),
    "plumage": hat_accessory_equipment("hat/accessory/plumage"),
    "helmet_wings": split_hat_accessory_equipment("hat/accessory/wings", palette=None),
    "upward_horns_white": split_hat_accessory_equipment("hat/accessory/horns_upward", palette=None),
    "upward_horns_ceramic": split_hat_accessory_equipment(
        "hat/accessory/horns_upward",
        palette="ceramic",
        include_hurt=True,
    ),
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


EQUIPMENT_LAYER_ORDER: tuple[tuple[str, int], ...] = (
    ("back", 8),
    ("front", 12),
)

EQUIPMENT_ACTION_ANIMATIONS: dict[str, str] = {
    "axe_ceramic": "slash",
    "axe_copper": "slash",
    "axe_bronze": "slash",
    "axe_iron": "slash",
    "pickaxe_ceramic": "slash",
    "pickaxe_copper": "slash",
    "pickaxe_bronze": "slash",
    "pickaxe_iron": "slash",
    "hammer_ceramic": "slash",
    "hammer_copper": "slash",
    "hammer_bronze": "slash",
    "hammer_iron": "slash",
    "meat": "walk",
    "stone": "walk",
    "gold": "walk",
    "scythe_ceramic": "slash",
    "scythe_copper": "slash",
    "scythe_bronze": "slash",
    "scythe_iron": "slash",
    "bow": "shoot",
    "bow_great": "shoot",
    "bow_recurve": "shoot",
    "arrow_ceramic": "shoot",
    "arrow_copper": "shoot",
    "arrow_bronze": "shoot",
    "arrow_iron": "shoot",
    "halberd": "slash",
    "sword_ceramic": "slash",
    "sword_copper": "slash",
    "sword_bronze": "slash",
    "sword_iron": "slash",
    "armor_leather": "slash",
    "armor_mail_ceramic": "slash",
    "armor_mail_copper": "slash",
    "armor_mail_bronze": "slash",
    "armor_mail_iron": "slash",
    "armor_legion_ceramic": "slash",
    "armor_legion_copper": "slash",
    "armor_legion_bronze": "slash",
    "armor_legion_iron": "slash",
    "helmet_pointed_ceramic": "slash",
    "helmet_pointed_copper": "slash",
    "helmet_pointed_bronze": "slash",
    "helmet_pointed_iron": "slash",
    "helmet_barbuta_ceramic": "slash",
    "helmet_barbuta_copper": "slash",
    "helmet_barbuta_bronze": "slash",
    "helmet_barbuta_iron": "slash",
    "helmet_legion_ceramic": "slash",
    "helmet_legion_copper": "slash",
    "helmet_legion_bronze": "slash",
    "helmet_legion_iron": "slash",
    "helmet_nasal_ceramic": "slash",
    "helmet_nasal_copper": "slash",
    "helmet_nasal_bronze": "slash",
    "helmet_nasal_iron": "slash",
    "helmet_bascinet_round_ceramic": "slash",
    "helmet_bascinet_round_copper": "slash",
    "helmet_bascinet_round_bronze": "slash",
    "helmet_bascinet_round_iron": "slash",
    "helmet_norman_ceramic": "slash",
    "helmet_norman_copper": "slash",
    "helmet_norman_bronze": "slash",
    "helmet_norman_iron": "slash",
    "helmet_barbarian_ceramic": "slash",
    "helmet_barbarian_nasal_ceramic": "slash",
    "sack_cloth_hood_leather": "shoot",
    "shoulder_legion_ceramic": "slash",
    "shoulder_legion_copper": "slash",
    "shoulder_legion_bronze": "slash",
    "shoulder_legion_iron": "slash",
    "bracers_ceramic": "slash",
    "bracers_copper": "slash",
    "bracers_bronze": "slash",
    "bracers_iron": "slash",
    "leg_armor_ceramic": "slash",
    "leg_armor_copper": "slash",
    "leg_armor_bronze": "slash",
    "leg_armor_iron": "slash",
    "cape_solid": "slash",
    "crest": "slash",
    "centurion_crest": "slash",
    "centurion_plumage": "slash",
    "legion_plumage": "slash",
    "plumage": "slash",
    "helmet_wings": "slash",
    "upward_horns_white": "slash",
    "upward_horns_ceramic": "slash",
    "longsword": "slash",
    "round_shield_ceramic_slash": "slash",
    "round_shield_copper_slash": "slash",
    "round_shield_bronze_slash": "slash",
    "round_shield_iron_slash": "slash",
    "cane": "spellcast",
    "quiver": "shoot",
}


def dynamic_layers_for(key: str, animation: str) -> tuple[DynamicLayer, ...]:
    equipment = equipment_layers(key, animation)
    specs_by_layer = {
        "back": equipment.background,
        "front": equipment.foreground,
    }
    return tuple(
        DynamicLayer(layer_key, z_index, specs_by_layer[layer_key])
        for layer_key, z_index in EQUIPMENT_LAYER_ORDER
    )


def dynamic_equipment_for(key: str, action_animation: str) -> DynamicEquipment:
    variants = ("male", "female") if "{variant}" in repr(EQUIPMENT[key]) else ()
    layers_by_animation = {
        "walk": dynamic_layers_for(key, "walk"),
        action_animation: dynamic_layers_for(key, action_animation),
    }
    if "hurt" in EQUIPMENT[key]:
        layers_by_animation["hurt"] = dynamic_layers_for(key, "hurt")
    return DynamicEquipment(
        key,
        action_animation,
        layers_by_animation,
        variants,
    )


EXTRA_DYNAMIC_EQUIPMENT: dict[str, DynamicEquipment] = {
    "quiver": DynamicEquipment(
        "quiver",
        "shoot",
        {
            "walk": (
                DynamicLayer("back", 8, (LayerSpec("quiver/walk/quiver.png"),)),
                DynamicLayer("front", 12, ()),
            ),
            "shoot": (
                DynamicLayer("back", 8, (LayerSpec("quiver/shoot/quiver.png"),)),
                DynamicLayer("front", 12, ()),
            ),
            "hurt": (
                DynamicLayer("back", 8, (LayerSpec("quiver/hurt/quiver.png"),)),
                DynamicLayer("front", 12, ()),
            ),
        },
    ),
}


DYNAMIC_EQUIPMENT: dict[str, DynamicEquipment] = {
    key: dynamic_equipment_for(key, EQUIPMENT_ACTION_ANIMATIONS[key])
    for key in EQUIPMENT
    if key in EQUIPMENT_ACTION_ANIMATIONS
}
DYNAMIC_EQUIPMENT.update(EXTRA_DYNAMIC_EQUIPMENT)


def active_layer_keys(equipment: DynamicEquipment) -> tuple[str, ...]:
    """Layer keys ("back"/"front") that carry pixels on at least one of this
    equipment's sheets. A layer that's empty on every sheet (e.g. round
    shields never have a "back" layer) would otherwise still get baked and
    wired up at runtime as a fully transparent spritesheet."""
    return tuple(
        layer_key
        for layer_key, _z_index in EQUIPMENT_LAYER_ORDER
        if any(
            layer.layers
            for layers in equipment.layers_by_animation.values()
            for layer in layers
            if layer.key == layer_key
        )
    )


def has_animation_content(equipment: DynamicEquipment, animation: str) -> bool:
    """Whether any layer has pixels for this specific animation. Some equipment
    only ships art for one of its two sheets (e.g. the cane has no action
    pose), so the other sheet would otherwise still get baked and wired up as
    fully transparent."""
    return any(layer.layers for layer in equipment.layers_by_animation.get(animation, ()))


def required_dynamic_equipment_source_paths() -> list[str]:
    paths: set[str] = set()
    for equipment in DYNAMIC_EQUIPMENT.values():
        for layers in equipment.layers_by_animation.values():
            for layer in layers:
                for spec in layer.layers:
                    if equipment.variants:
                        paths.update(spec.path.format(variant=variant) for variant in equipment.variants)
                    else:
                        paths.add(spec.path)
    return sorted(paths)
