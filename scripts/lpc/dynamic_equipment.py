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
            "hurt": dynamic_layers_for(key, "hurt"),
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
            "hurt": (
                DynamicLayer("back", 8, (LayerSpec("quiver/hurt/quiver.png"),)),
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


def required_dynamic_equipment_source_paths() -> list[str]:
    paths: set[str] = set()
    for equipment in DYNAMIC_EQUIPMENT.values():
        for layers in equipment.layers_by_animation.values():
            for layer in layers:
                for spec in layer.layers:
                    paths.add(spec.path)
    return sorted(paths)
