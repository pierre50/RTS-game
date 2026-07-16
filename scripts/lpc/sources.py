from __future__ import annotations

from config import CIVS, PLAYER_SHORTS, UNIT_LOOKS, unit_look_for_civ
from image_pipeline import layer_paths
from jobs import UNIT_JOBS


def required_source_paths() -> list[str]:
    paths: set[str] = set()
    for civ_key, civ in CIVS.items():
        for unit in UNIT_LOOKS:
            look = unit_look_for_civ(unit, civ_key)
            player_colors = PLAYER_SHORTS.keys() if unit == "villager" else ("neutral",)
            for player_color in player_colors:
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
                    for animation, equipment in sheet_plan.values():
                        for layer in layer_paths(look, animation, civ, player_color, equipment):
                            paths.add(layer.path)
    return sorted(paths)
