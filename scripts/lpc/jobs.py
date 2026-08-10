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
    Job("woodcutter", walking_equipment="axe_ceramic", action_equipment="axe_ceramic"),
    Job("stoneminer", walking_equipment="pickaxe_ceramic", action_equipment="pickaxe_ceramic", loaded_equipment="stone"),
    Job("goldminer", walking_equipment="pickaxe_ceramic", action_equipment="pickaxe_ceramic", loaded_equipment="gold"),
    Job("builder", walking_equipment="hammer_ceramic", action_equipment="hammer_ceramic"),
    Job("farmer", walking_equipment="scythe_ceramic", action_equipment="scythe_ceramic"),
    Job(
        "hunter",
        action_animation="shoot",
        loaded_equipment="meat",
    ),
)

INFANTRY_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="sword_ceramic", action_animation="slash", action_equipment="sword_ceramic"),
)

CHIEF_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="sword_ceramic", action_animation="slash", action_equipment="sword_ceramic"),
)

# The cane has no spellcast-pose art, so action_equipment is left unset — the
# priest's hands perform the cast gesture unarmed; the cane only shows while walking.
PRIEST_JOBS: tuple[Job, ...] = (
    Job("default", walking_equipment="cane", action_animation="spellcast"),
)

UNIT_JOBS: dict[str, tuple[Job, ...]] = {
    "villager": VILLAGER_JOBS,
    "infantry": INFANTRY_JOBS,
    "infantry_nohair": INFANTRY_JOBS,
    "priest": PRIEST_JOBS,
    "chief": CHIEF_JOBS,
}
