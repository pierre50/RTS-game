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


EQUIPMENT_LAYER_ORDER: tuple[tuple[str, int], ...] = (
    ("back", 8),
    ("front", 12),
)

EQUIPMENT_ACTION_ANIMATIONS: dict[str, str] = {
    "axe": "slash",
    "pickaxe": "slash",
    "hammer": "slash",
    "meat": "walk",
    "stone": "walk",
    "gold": "walk",
    "scythe": "slash",
    "bow": "shoot",
    "bow_great": "shoot",
    "bow_recurve": "shoot",
    "spear": "thrust",
    "dagger": "slash",
    "broadsword": "slash",
    "longsword": "slash",
    "longspear": "thrust",
    "longspear_silver": "thrust",
    "round_shield_brass_slash": "slash",
    "round_shield_brass_thrust": "thrust",
    "round_shield_silver_slash": "slash",
    "round_shield_silver_thrust": "thrust",
    "cane": "spellcast",
    "fishing_rod": "tool_rod",
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
    return DynamicEquipment(
        key,
        action_animation,
        {
            "walk": dynamic_layers_for(key, "walk"),
            action_animation: dynamic_layers_for(key, action_animation),
        },
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
    only ships art for one of its two sheets (e.g. the cane has no spellcast
    pose, the fishing rod has no walk pose), so the other sheet would
    otherwise still get baked and wired up as fully transparent."""
    return any(layer.layers for layer in equipment.layers_by_animation.get(animation, ()))


def required_dynamic_equipment_source_paths() -> list[str]:
    paths: set[str] = set()
    for equipment in DYNAMIC_EQUIPMENT.values():
        for layers in equipment.layers_by_animation.values():
            for layer in layers:
                for spec in layer.layers:
                    paths.add(spec.path)
    return sorted(paths)
