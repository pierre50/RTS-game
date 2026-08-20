from __future__ import annotations

# Compatibility wrapper: dynamic equipment metadata now lives in equipment.py so
# regular and runtime-overlay equipment definitions share one source of truth.
from equipment import (
    DYNAMIC_EQUIPMENT,
    EQUIPMENT_ACTION_ANIMATIONS,
    EQUIPMENT_LAYER_ORDER,
    EXTRA_DYNAMIC_EQUIPMENT,
    DynamicEquipment,
    DynamicLayer,
    LayerSpec,
    active_layer_keys,
    dynamic_equipment_for as equipment,
    dynamic_layers_for,
    has_animation_content,
    required_dynamic_equipment_source_paths,
)
