from __future__ import annotations

from config import CIVS, PLAYER_SHORTS, UNIT_LOOKS, unit_look_for_civ
from dynamic_equipment import required_dynamic_equipment_source_paths
from image_pipeline import layer_paths
from jobs import UNIT_JOBS


VILLAGER_BODY_ANIMATIONS = ("walk", "hurt", "slash", "thrust", "shoot")


def required_source_paths() -> list[str]:
    paths: set[str] = set()
    for civ_key, civ in CIVS.items():
        for unit in UNIT_LOOKS:
            look = unit_look_for_civ(unit, civ_key)
            player_colors = PLAYER_SHORTS.keys() if unit == "villager" else ("neutral",)
            for player_color in player_colors:
                if unit == "villager":
                    for animation in VILLAGER_BODY_ANIMATIONS:
                        for layer in layer_paths(look, animation, civ, player_color):
                            paths.add(layer.path)
                    continue
                for job in UNIT_JOBS[unit]:
                    sheet_plan = {
                        "walking": ("walk", job.walking_equipment),
                        "action": (job.action_animation, job.action_equipment),
                    }
                    if unit != "villager" or job.key == "default":
                        sheet_plan["dying"] = ("hurt", job.hurt_equipment)
                        sheet_plan["corpse"] = ("hurt", job.hurt_equipment)
                    if job.loaded_equipment:
                        sheet_plan["loaded"] = ("walk", job.loaded_equipment)
                    for animation, _equipment in sheet_plan.values():
                        for layer in layer_paths(look, animation, civ, player_color):
                            paths.add(layer.path)
    paths.update(required_dynamic_equipment_source_paths())
    return sorted(paths)
