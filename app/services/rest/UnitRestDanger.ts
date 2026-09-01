import { ACTION_TYPES, UNIT_TYPES } from '../../constants'
import { evaluateCombatMorale } from '../../lib/combat'
import { findInstancesInSight } from '../../lib/grid/visibility'
import { instanceIsInInsightRange } from '../../lib/units/insightDetection'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import { canUseUnitRest, markUnitRestAlert } from './UnitRestRules'
import { wakeUnit } from './UnitRestLifecycle'

function isVillager(unit: UnitEntity): boolean {
  return unit.type === UNIT_TYPES.villager
}

function isActiveThreat(attacker: RuntimeEntity | null | undefined): attacker is RuntimeEntity {
  return Boolean(attacker && !attacker.isDead && !attacker.isDestroyed)
}

function sameTarget(a: RuntimeEntity | null | undefined, b: RuntimeEntity | null | undefined): boolean {
  if (a === b) return true
  return Boolean(a?.label && b?.label && a.label === b.label)
}

function sameRestAlertGroup(source: UnitEntity, target: UnitEntity): boolean {
  return Boolean(source.owner && target.owner && source.owner === target.owner)
}

function fleeFromDanger(unit: UnitEntity, attacker: RuntimeEntity): void {
  markUnitRestAlert(unit, attacker)
  const fleeingUnit = unit as UnitEntity & { runaway?: (target: RuntimeEntity) => void }
  fleeingUnit.runaway?.(attacker)
}

function canDetectHeroForRestAlert(unit: UnitEntity, hero: UnitEntity | null): hero is UnitEntity {
  if (!hero || hero === unit || hero.isDead || hero.isDestroyed) return false
  if (!unit.owner?.isEnemy?.(hero.owner)) return false
  return instanceIsInInsightRange(unit, hero, unit.sight ?? 7)
}

function getHeroAlertTarget(context: GameContextLike): UnitEntity | null {
  const controlsHero = context.controls?.heroUnit
  if (controlsHero && !controlsHero.isDead && !controlsHero.isDestroyed) return controlsHero

  for (const player of context.players ?? []) {
    for (const unit of player.units ?? []) {
      if (!unit.isDead && !unit.isDestroyed && (unit.type === UNIT_TYPES.hero || unit.controlMode === 'hero')) {
        return unit
      }
    }
  }
  return null
}

export function reactUnitToDanger(unit: UnitEntity, attacker: RuntimeEntity): void {
  markUnitRestAlert(unit, attacker)
  if (evaluateCombatMorale(unit, attacker) === 'flee') {
    fleeFromDanger(unit, attacker)
    return
  }
  unit.detect?.(attacker)
}

export function handleUnitDanger(unit: UnitEntity, attacker: RuntimeEntity | null | undefined): boolean {
  if (!isActiveThreat(attacker)) return false
  const shouldVillagerReact = isVillager(unit) && canUseUnitRest(unit)
  if (unit.shelterState?.reason === 'sleep') {
    markUnitRestAlert(unit, attacker)
    wakeUnit(unit, {
      force: true,
      mode: 'order',
      onComplete: shouldVillagerReact ? () => reactUnitToDanger(unit, attacker) : undefined,
    })
    return shouldVillagerReact
  }
  if (!shouldVillagerReact) return false
  reactUnitToDanger(unit, attacker)
  return true
}

export function handleShelterAttack(building: BuildingEntity, attacker: RuntimeEntity | null | undefined): boolean {
  if (!isActiveThreat(attacker)) return false
  let handled = false

  for (const unit of building.owner?.units ?? []) {
    if (unit.isDead || unit.isDestroyed) continue
    const state = unit.shelterState
    if (state?.shelter !== building) continue
    if (unit.action === ACTION_TYPES.attack && sameTarget(unit.dest as RuntimeEntity | null | undefined, attacker)) {
      markUnitRestAlert(unit, attacker)
      handled = true
      continue
    }

    if (isVillager(unit) && canUseUnitRest(unit)) {
      handled = handleUnitDanger(unit, attacker) || handled
      continue
    }

    markUnitRestAlert(unit, attacker)
    const react = () => unit.detect?.(attacker)
    if (state.reason === 'sleep') {
      wakeUnit(unit, { force: true, mode: 'order', onComplete: react })
    } else {
      react()
    }
    handled = true
  }

  return handled
}

export function findHeroRestAlertTarget(context: GameContextLike, unit: UnitEntity): RuntimeEntity | null {
  const hero = getHeroAlertTarget(context)
  return canDetectHeroForRestAlert(unit, hero) ? hero : null
}

export function findPropagatedRestAlertSleepers(source: UnitEntity): UnitEntity[] {
  return findInstancesInSight<UnitEntity, UnitEntity>(
    source,
    candidate =>
      Boolean(
        candidate !== source &&
          candidate.family === 'unit' &&
          candidate.shelterState?.reason === 'sleep' &&
          sameRestAlertGroup(source, candidate) &&
          canUseUnitRest(candidate)
      ),
    { range: source.sight ?? 7 }
  )
}
