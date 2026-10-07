import { ACTION_TYPES } from '../../../constants'
import type { UnitEntity } from '../../../types/entities'
import { drainEnergyAmount, ensureUnitEnergy, getActionEnergyCost } from '../unitEnergy'

const SPRINT_SPEED_FACTOR = 1.6
const SPRINT_ENERGY_PER_SECOND = 2
const SPRINT_ATTACK_MULTIPLIER = 1.35
const ATTACK_SURCHARGE = 2
const MIN_RUN_MS = 300
const MIN_RUN_DISTANCE = 24
const MOMENTUM_GRACE_MS = 120
const NPC_RESTART_DELAY_MS = 1800

type SprintState = { requested: boolean; duration: number; distance: number; lastMoveAt: number; restartAt: number }
const states = new WeakMap<UnitEntity, SprintState>()
function stateFor(unit: UnitEntity): SprintState {
  let state = states.get(unit)
  if (!state) {
    state = { requested: false, duration: 0, distance: 0, lastMoveAt: -Infinity, restartAt: 0 }
    states.set(unit, state)
  }
  return state
}
function now(unit: UnitEntity): number {
  return unit.context?.scheduler?.elapsedMs ?? 0
}

export function stopUnitSprint(unit: UnitEntity): void {
  const state = stateFor(unit)
  state.requested = false
  state.duration = 0
  state.distance = 0
  state.lastMoveAt = -Infinity
  state.restartAt = now(unit) + NPC_RESTART_DELAY_MS
}

export function toggleHeroSprint(unit: UnitEntity): void {
  const state = stateFor(unit)
  if (state.requested) stopUnitSprint(unit)
  else {
    ensureUnitEnergy(unit)
    state.requested = !unit.isDead && !unit.isDestroyed && !unit.mountedOnHorse && (unit.energy ?? 0) > 0
  }
}

/** Returns a speed factor; only confirmed position changes earn momentum and spend energy. */
export function getSprintMoveFactor(unit: UnitEntity, moving: boolean, npc = false): number {
  const state = stateFor(unit)
  if (state.duration > 0 && now(unit) - state.lastMoveAt > MOMENTUM_GRACE_MS) stopUnitSprint(unit)
  if (
    !moving ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.mountedOnHorse ||
    unit.isCrouching ||
    unit.actionLocked ||
    unit.heroDefenseActive ||
    unit.heroPowerChargeStart != null ||
    unit.waitingForEnergyAction ||
    (unit.requestedMoveSpeedFactor ?? 1) < 1
  ) {
    stopUnitSprint(unit)
    return 1
  }
  if (!npc && !state.requested) return 1
  if (npc && (unit.controlMode === 'hero' || unit.context?.controls?.heroUnit === unit)) return 1
  ensureUnitEnergy(unit)
  if (npc) {
    const target = unit.dest
    if (
      unit.action !== ACTION_TYPES.attack ||
      !target ||
      !('family' in target) ||
      target.isDead ||
      target.isDestroyed ||
      unit.combatMode === 'recover' ||
      unit.combatMode === 'flee'
    ) {
      stopUnitSprint(unit)
      return 1
    }
    const reserve = getActionEnergyCost(unit, ACTION_TYPES.attack) * 2 + ATTACK_SURCHARGE
    if ((unit.energy ?? 0) <= reserve + SPRINT_ENERGY_PER_SECOND * 0.1) {
      stopUnitSprint(unit)
      return 1
    }
    if (!state.requested) {
      if (
        now(unit) < state.restartAt ||
        Math.hypot(target.i - unit.i, target.j - unit.j) < 3 ||
        (unit.energy ?? 0) < reserve + SPRINT_ENERGY_PER_SECOND
      )
        return 1
      state.requested = true
    }
  }
  if ((unit.energy ?? 0) <= 0) {
    stopUnitSprint(unit)
    return 1
  }
  return state.requested ? SPRINT_SPEED_FACTOR : 1
}

export function recordSprintMovement(unit: UnitEntity, distance: number, elapsedMs: number, factor: number): void {
  const state = stateFor(unit)
  if (factor <= 1 || distance <= 0.01) {
    state.duration = 0
    state.distance = 0
    state.lastMoveAt = -Infinity
    return
  }
  const elapsed = Math.max(0, elapsedMs)
  if (now(unit) - state.lastMoveAt > MOMENTUM_GRACE_MS) {
    state.duration = 0
    state.distance = 0
  }
  state.duration += elapsed
  state.distance += distance
  state.lastMoveAt = now(unit)
  drainEnergyAmount(unit, (SPRINT_ENERGY_PER_SECOND * elapsed) / 1000)
  if ((unit.energy ?? 0) <= 0) stopUnitSprint(unit)
}

/** Pay once at attack initiation, then consume the run even if the strike misses. */
export function takeSprintAttackMultiplier(unit: UnitEntity): number {
  const state = stateFor(unit)
  const qualifies =
    state.duration >= MIN_RUN_MS &&
    state.distance >= MIN_RUN_DISTANCE &&
    now(unit) - state.lastMoveAt <= MOMENTUM_GRACE_MS &&
    !unit.isDead &&
    !unit.isDestroyed &&
    !unit.heroDefenseActive &&
    !unit.mountedOnHorse &&
    !unit.isCrouching &&
    (unit.energy ?? 0) >= getActionEnergyCost(unit, ACTION_TYPES.attack) + ATTACK_SURCHARGE
  stopUnitSprint(unit)
  if (!qualifies) return 1
  drainEnergyAmount(unit, ATTACK_SURCHARGE)
  return SPRINT_ATTACK_MULTIPLIER
}
