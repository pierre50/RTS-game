import { isCampPaused } from '../../lib/units/campActivity'
import { syncUnitSittingPose } from '../../lib/units/unitSittingPose'
import { createReservedPassageCellLookup } from '../../lib/buildings/passageCells'
import { isDistantOwner } from '../../lib/units/villageActivity'
import { isUnitSuspended } from '../../lib/units/unitSuspension'
import { setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { getEntityCell } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import { getRestReturnTask, sleepOutside, wakeUnit } from './UnitRestLifecycle'
import { canUseUnitRest } from './UnitRestRules'
import { isVillager, shouldRouteUnitToInteriorExit } from './UnitRestStateTransitions'
import { keepSleepingOutsideVisual } from './UnitSleepVisuals'
export type RestUnitBuckets = {
  livingUnits: UnitEntity[]
  restUnits: UnitEntity[]
  villagers: UnitEntity[]
}

export function wakeRestingUnitAtExit(context: GameContextLike, unit: UnitEntity): void {
  const routeToInteriorExit = shouldRouteUnitToInteriorExit(context, unit)
  const returnTask = routeToInteriorExit ? getRestReturnTask(unit) : null
  wakeUnit(
    unit,
    routeToInteriorExit
      ? {
          mode: 'order',
          onComplete: () => context.routeInteriorUnitToExit?.(unit, returnTask),
        }
      : undefined
  )
}

export function updateOutsideSleepVisuals(context: GameContextLike, units: UnitEntity[]): void {
  const passages = createReservedPassageCellLookup(context)
  for (const unit of units) {
    syncUnitSittingPose(unit)
    if (unit.shelterState?.status !== 'outside') continue
    if (unit.sleepVisualState !== 'sleeping') continue
    if (passages.has(getEntityCell(unit, context.map))) {
      sleepOutside(unit)
      continue
    }
    keepSleepingOutsideVisual(unit)
    setUnitOverheadIndicator(unit, 'sleep')
  }
}

export function collectRestUnits(context: GameContextLike): RestUnitBuckets {
  const buckets: RestUnitBuckets = {
    livingUnits: [],
    restUnits: [],
    villagers: [],
  }
  for (const player of context.players ?? []) {
    for (const unit of player.units ?? []) {
      if (isCampPaused(unit)) continue
      if (unit.isDead || unit.isDestroyed || ((player.isPlayed || isDistantOwner(player)) && isUnitSuspended(unit)))
        continue
      buckets.livingUnits.push(unit)
      if (isVillager(unit)) buckets.villagers.push(unit)
      if (canUseUnitRest(unit) || unit.shelterState) buckets.restUnits.push(unit)
    }
  }
  return buckets
}
