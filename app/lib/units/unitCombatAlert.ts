import { ACTION_TYPES, UNIT_TYPES } from '../../constants'
import { sameMapSpace } from '../mapSpaces'
import { isBanditUnitType } from '../combat/bandits'
import { canCampPursue } from './camps/campBehavior'
import { instanceIsInInsightRange } from './insightDetection'
import { canAutoReactToAttack } from './unitControl'
import { clearUnitAttacker, rememberUnitAttacker } from './unitRetaliation'
import { unitSuspensionReason } from './unitSuspension'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

const militaryTypes = new Set<string>([UNIT_TYPES.infantry, UNIT_TYPES.bowman, UNIT_TYPES.chief, UNIT_TYPES.scout])
const announcedTargets = new WeakMap<UnitEntity, RuntimeEntity>()
type Alert = { unit: UnitEntity; target: RuntimeEntity }
type Wave = { queue: Alert[]; visited: Set<UnitEntity>; candidates: Set<UnitEntity> }
const waves = new WeakMap<object, Wave>()

export function clearUnitCombatAlert(unit: UnitEntity): void {
  announcedTargets.delete(unit)
}

function areAllies(unit: UnitEntity, other: UnitEntity): boolean {
  const a = unit.owner
  const b = other.owner
  if (!a || !b) return false
  return Boolean(
    a === b ||
      (a.label && a.label === b.label) ||
      (a.team != null && a.team === b.team) ||
      (a.factionId && a.factionId === b.factionId)
  )
}

function canAssist(unit: UnitEntity): boolean {
  const suspension = unitSuspensionReason(unit)
  return Boolean(
    (militaryTypes.has(unit.type) || isBanditUnitType(unit.type)) &&
      !unit.isDead &&
      !unit.isDestroyed &&
      (unit.hitPoints ?? 0) > 0 &&
      canAutoReactToAttack(unit) &&
      unit.action !== ACTION_TYPES.attack &&
      !unit.actionLocked &&
      !unit.pendingOrder &&
      !unit.spacePortalState &&
      unit.combatMode !== 'flee' &&
      unit.combatMode !== 'recover' &&
      suspension !== 'road-travel' &&
      suspension !== 'distant-work'
  )
}

/** Broadcast only accepted combat orders; nested orders join one iterative wave. */
export function alertUnitCombatAllies(unit: UnitEntity): void {
  const target = unit.dest
  const context = unit.context
  if (
    !context ||
    context.editor ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.action !== ACTION_TYPES.attack ||
    !target ||
    !('family' in target) ||
    target.isDead ||
    target.isDestroyed ||
    !sameMapSpace(unit, target) ||
    !canCampPursue(unit, target) ||
    announcedTargets.get(unit) === target
  )
    return
  announcedTargets.set(unit, target)
  const active = waves.get(context)
  if (active) {
    active.queue.push({ unit, target })
    return
  }
  const candidates = new Set<UnitEntity>()
  for (const player of context.players ?? [])
    for (const ally of player.units ?? []) if (canAssist(ally)) candidates.add(ally)
  for (const ally of unit.owner?.units ?? []) if (canAssist(ally)) candidates.add(ally)
  const wave: Wave = { queue: [{ unit, target }], visited: new Set(), candidates }
  waves.set(context, wave)
  try {
    for (let index = 0; index < wave.queue.length; index++) {
      const alert = wave.queue[index]
      if (wave.visited.has(alert.unit)) continue
      wave.visited.add(alert.unit)
      wave.candidates.delete(alert.unit)
      for (const ally of wave.candidates) {
        if (
          !canAssist(ally) ||
          !areAllies(ally, alert.unit) ||
          !sameMapSpace(ally, alert.unit) ||
          !instanceIsInInsightRange(ally, alert.unit) ||
          !canCampPursue(ally, alert.target) ||
          !ally.sendToEvt
        )
          continue
        // Share this threat with the responding unit, never the faction's vision.
        rememberUnitAttacker(ally, alert.target)
        if (!ally.getActionCondition?.(alert.target, ACTION_TYPES.attack)) {
          clearUnitAttacker(ally)
          continue
        }
        wave.candidates.delete(ally)
        ally.sendToEvt(alert.target, ACTION_TYPES.attack)
        if (ally.dest === alert.target && ally.action === ACTION_TYPES.attack) alertUnitCombatAllies(ally)
        else clearUnitAttacker(ally)
      }
    }
  } finally {
    waves.delete(context)
  }
}
