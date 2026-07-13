from __future__ import annotations

from config import CIVS, PLAYER_SHORTS, UNIT_LOOKS
from image_pipeline import layer_paths
from jobs import UNIT_JOBS


def required_source_paths() -> list[str]:
    paths: set[str] = set()
    for civ in CIVS.values():
        for unit, look in UNIT_LOOKS.items():
            player_colors = PLAYER_SHORTS.keys() if unit == "villager" else ("neutral",)
            for player_color in player_colors:
                for job in UNIT_JOBS[unit]:
                    sheet_plan = {
                        "walking": ("walk", job.walking_equipment),
                        "action": (job.action_animation, job.action_equipment),
                        "dying": ("hurt", job.hurt_equipment),
                        "corpse": ("hurt", job.hurt_equipment),
                    }
                    for animation, equipment in sheet_plan.values():
                        for layer in layer_paths(look, animation, civ, player_color, equipment):
                            paths.add(layer.path)
    return sorted(paths)
