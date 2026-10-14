import { VILLAGE_ACTIVITY_RADIUS, VILLAGE_PATH_MARGIN } from '../config/villageActivity'
import { isStaticSettlement } from '../config/world/settlementProfiles'
import { getEntitySpaceId } from '../lib/mapSpaces'
import { campDistance } from '../lib/units/camps/campBehavior'
import { setUnitSuspension } from '../lib/units/unitSuspension'
import { withinVillageActivity, type VillageHome } from '../lib/units/village/villageActivity'
import { villageWorkNeedsLiveSearch } from '../lib/units/village/villageSupplyTrips'
import { shouldVillagerWork } from '../lib/units/village/villagerSchedule'
import type { GameContextLike } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { VillageObservation } from './world/VillageObservation'

export type Village = { home: VillageHome; owner: PlayerLike; units: UnitEntity[]; simplified: boolean; since: number }

const GATHER_ACTIONS = new Set([
  'chopwood',
  'forageberry',
  'farm',
  'minestone',
  'minegold',
  'minecopper',
  'minetin',
  'mineiron',
])
const GATHER_JOBS = ['food', 'wood', 'stone', 'gold', 'copper', 'tin', 'iron']
const GATHER_WORKS = ['woodcutter', 'forager', 'farmer', 'stoneminer', 'goldminer']

export function activeTownCenters(owner: PlayerLike) {
  return (owner.buildings ?? []).filter(
    b =>
      b.type === 'TownCenter' &&
      b.isBuilt !== false &&
      !b.isDead &&
      !b.isDestroyed &&
      getEntitySpaceId(b) === 'outside'
  )
}

export function villageResidentsChanged(village: Village, next: UnitEntity[]): boolean {
  return next.length !== village.units.length || next.some(unit => !village.units.includes(unit))
}

function isVillagerBusyElsewhere(unit: UnitEntity): boolean {
  return Boolean(
    unit.shelterState ||
      unit.spacePortalState ||
      unit.resourceDeliveryState ||
      unit.trainingTargetType ||
      unit.pendingOrder ||
      unit.combatMode ||
      unit.waitingForEnergyAction ||
      unit.actionLocked
  )
}

function isVillagerAbstractable(unit: UnitEntity): boolean {
  return (
    getEntitySpaceId(unit) === 'outside' &&
    !villageWorkNeedsLiveSearch(unit) &&
    !isVillagerBusyElsewhere(unit) &&
    shouldVillagerWork(unit) &&
    (!unit.action || GATHER_ACTIONS.has(unit.action)) &&
    withinVillageActivity(unit, unit) &&
    (!unit.dest || withinVillageActivity(unit, unit.dest)) &&
    (GATHER_JOBS.includes(unit.autonomousJob ?? '') || GATHER_WORKS.includes(unit.work ?? ''))
  )
}

/** Whether every resident can be suspended into the abstract village-work simulation. */
export function isVillageSimulationSupported(village: Village): boolean {
  // Static settlements are owned exclusively by DistantVillageSystem. Never
  // fall back to the legacy per-village economic suspension for their workers.
  if (isStaticSettlement(village.owner)) return false
  return (
    village.units.some(unit => unit.type === 'Villager') &&
    village.units.every(unit =>
      unit.type !== 'Villager' ? !unit.action && !unit.spacePortalState : isVillagerAbstractable(unit)
    )
  )
}

export function villageWorkerCount(village: Village): number {
  return village.units.filter(unit => unit.type === 'Villager').length
}

export function reportAbstractVillageState(context: GameContextLike, village: Village): void {
  context.performance?.markEvent?.('village.state', {
    village: village.home.id,
    civilization: village.owner.civ ?? '',
    abstract: true,
    simplified: true,
    observed: false,
    units: village.units.length,
  })
}

export function reportVillageState(
  context: GameContextLike,
  village: Village,
  observation: VillageObservation | undefined,
  supported: boolean
): void {
  context.performance?.markEvent?.('village.state', {
    village: village.home.id,
    civilization: village.owner.civ ?? '',
    simplified: village.simplified,
    observed: observation?.reason !== 'distant',
    observationReason: observation?.reason ?? 'unknown',
    observer: observation?.actor ?? '',
    observerDistance: observation?.distance ?? -1,
    supported,
    units: village.units.length,
    activities: [...new Set(village.units.map(unit => unit.action ?? 'idle'))].join(','),
  })
}

/** Freezes every villager of the village so the abstract simulation owns their time. */
export function suspendVillageWorkers(village: Village, wake: () => void): void {
  for (const unit of village.units) {
    if (unit.type !== 'Villager') continue
    setUnitSuspension(unit, { reason: 'distant-work', wake })
    unit.stopInterval?.()
    unit.stopTimeout?.()
    unit.path = []
    unit.gatherProgressState = null
    unit.sprite?.stop?.()
    if (unit.sprite) {
      delete unit.sprite.onFrameChange
      delete unit.sprite.onLoop
      delete unit.sprite.onComplete
    }
  }
}

export function villageUnitNeedsLeash(unit: UnitEntity): boolean {
  return (
    unit.action === 'attack' ||
    unit.campBehavior?.phase === 'pursue' ||
    unit.campBehavior?.phase === 'return' ||
    campDistance(unit) > VILLAGE_ACTIVITY_RADIUS + VILLAGE_PATH_MARGIN
  )
}
