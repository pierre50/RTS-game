from __future__ import annotations

from dataclasses import dataclass

from equipment import EQUIPMENT, LayerSpec, equipment_layers


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


def equipment(key: str, action_animation: str) -> DynamicEquipment:
    variants = ("male", "female") if "{variant}" in repr(EQUIPMENT[key]) else ()
    return DynamicEquipment(
        key,
        action_animation,
        {
            "walk": dynamic_layers_for(key, "walk"),
            action_animation: dynamic_layers_for(key, action_animation),
        },
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
        },
    ),
}


DYNAMIC_EQUIPMENT: dict[str, DynamicEquipment] = {
    key: equipment(key, EQUIPMENT_ACTION_ANIMATIONS[key])
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
