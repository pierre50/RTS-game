from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Job:
    key: str
    walking_equipment: str | None = None
    action_animation: str = "slash"
    action_equipment: str | None = None
    # No equipment in equipment.py currently ships "hurt"-pose art, so setting this is always a
    # no-op today (equipment_layers() falls through to an empty Equipment()) — left in the dataclass
    # for whenever hurt-pose art is added, but no current job should pass it.
    hurt_equipment: str | None = None
    loaded_equipment: str | None = None


VILLAGER_JOBS: tuple[Job, ...] = (
    Job("default"),
    Job("attacker"),
    Job("forager"),
    Job("woodcutter", walking_equipment="axe", action_equipment="axe"),
    Job("stoneminer", walking_equipment="pickaxe", action_equipment="pickaxe", loaded_equipment="stone"),
    Job("goldminer", walking_equipment="pickaxe", action_equipment="pickaxe", loaded_equipment="gold"),
    Job("builder", walking_equipment="hammer", action_equipment="hammer"),
    Job("farmer", walking_equipment="scythe", action_equipment="scythe"),
    Job(
        "hunter",
        action_animation="shoot",
        loaded_equipment="meat",
    ),
)

CLUBMAN_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="halberd", action_animation="slash", action_equipment="halberd"),
)

# Same halberd as "clubman" (see UNIT_EQUIPMENT[UNIT_TYPES.chief] in equipment.ts).
CHIEF_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="halberd", action_animation="slash", action_equipment="halberd"),
)

AXEMAN_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="axe", action_animation="slash", action_equipment="axe"),
)

BOWMAN_JOBS: tuple[Job, ...] = (Job("default", action_animation="shoot"),)

SHORTSWORDMAN_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="dagger", action_animation="slash", action_equipment="dagger"),
)

IMPROVEDBOWMAN_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        action_animation="shoot",
    ),
)

COMPOSITEBOWMAN_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        action_animation="shoot",
    ),
)

BROADSWORDMAN_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        walking_equipment="broadsword",
        action_animation="slash",
        action_equipment="broadsword",
    ),
)

LONGSWORDMAN_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        walking_equipment="longsword",
        action_animation="slash",
        action_equipment="longsword",
    ),
)

# The cane has no spellcast-pose art, so action_equipment is left unset — the
# priest's hands perform the cast gesture unarmed; the cane only shows while walking.
PRIEST_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="cane", action_animation="spellcast"),
)

UNIT_JOBS: dict[str, tuple[Job, ...]] = {
    "villager": VILLAGER_JOBS,
    "clubman": CLUBMAN_JOBS,
    "axeman": AXEMAN_JOBS,
    "bowman": BOWMAN_JOBS,
    "shortswordman": SHORTSWORDMAN_JOBS,
    "improvedbowman": IMPROVEDBOWMAN_JOBS,
    "compositebowman": COMPOSITEBOWMAN_JOBS,
    "broadswordman": BROADSWORDMAN_JOBS,
    "longswordman": LONGSWORDMAN_JOBS,
    "priest": PRIEST_JOBS,
    "chief": CHIEF_JOBS,
}
