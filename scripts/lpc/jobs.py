from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Job:
    key: str
    walking_equipment: str | None = None
    action_animation: str = "slash"
    action_equipment: str | None = None
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
    Job("farmer", walking_equipment="scythe", action_equipment="scythe", hurt_equipment="scythe"),
    Job(
        "hunter",
        walking_equipment="bow",
        action_animation="shoot",
        action_equipment="bow",
        hurt_equipment="bow",
        loaded_equipment="meat",
    ),
    Job("fisher", action_animation="thrust"),
)

CLUBMAN_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="spear", action_animation="thrust", action_equipment="spear", hurt_equipment="spear"),
)

AXEMAN_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="axe", action_animation="slash", action_equipment="axe"),
)

BOWMAN_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="bow", action_animation="shoot", action_equipment="bow", hurt_equipment="bow"),
)

SHORTSWORDMAN_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="dagger", action_animation="slash", action_equipment="dagger", hurt_equipment="dagger"),
)

IMPROVEDBOWMAN_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        walking_equipment="bow_great",
        action_animation="shoot",
        action_equipment="bow_great",
        hurt_equipment="bow_great",
    ),
)

COMPOSITEBOWMAN_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        walking_equipment="bow_recurve",
        action_animation="shoot",
        action_equipment="bow_recurve",
        hurt_equipment="bow_recurve",
    ),
)

BROADSWORDMAN_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        walking_equipment="broadsword",
        action_animation="slash",
        action_equipment="broadsword",
        hurt_equipment="broadsword",
    ),
)

LONGSWORDMAN_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        walking_equipment="longsword",
        action_animation="slash",
        action_equipment="longsword",
        hurt_equipment="longsword",
    ),
)

# The longspear has no hurt-pose art at all, so hurt_equipment is left unset (the
# weapon and shield are simply dropped for that pose, like the axe).
HOPLITE_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        walking_equipment="longspear",
        action_animation="thrust",
        action_equipment="longspear",
    ),
)

# Same as HOPLITE_JOBS, but the silver longspear/shield bundle (see "phalanx" in
# config.py and "longspear_silver" in equipment.py).
PHALANX_JOBS: tuple[Job, ...] = (
    Job(
        "default",
        walking_equipment="longspear_silver",
        action_animation="thrust",
        action_equipment="longspear_silver",
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
    "hoplite": HOPLITE_JOBS,
    "phalanx": PHALANX_JOBS,
    "priest": PRIEST_JOBS,
}
