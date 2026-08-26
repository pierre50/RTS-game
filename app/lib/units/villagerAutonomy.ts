import { ACTION_TYPES, FAMILY_TYPES, RESOURCE_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { isWheatMature } from '../combat'
import { getGaiaAnimals } from '../playerState'
import { getNearestAvailableStableForUnit } from '../horses/horseCapture'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity, VillagerAutonomyJob } from '../../types/entities'

function isAliveEntity(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(entity && !entity.isDead && !entity.isDestroyed && (entity.hitPoints ?? 1) > 0)
}

function isUsableResource(entity: RuntimeEntity | null | undefined): entity is ResourceEntity {
  return Boolean(isAliveEntity(entity) && entity.family === FAMILY_TYPES.resource && (entity.quantity ?? 1) > 0)
}

function isUsableAnimalCarcass(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(
    entity &&
      entity.family === FAMILY_TYPES.animal &&
      entity.isDead &&
      !entity.isDestroyed &&
      (entity.quantity ?? 0) > 0
  )
}

function isCapturableHorse(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(
    entity &&
      entity.family === FAMILY_TYPES.animal &&
      entity.type === 'Horse' &&
      !entity.isDead &&
      !entity.isDestroyed &&
      !(entity as { isLassoed?: boolean }).isLassoed
  )
}

function distance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

function closest<T extends RuntimeEntity>(unit: UnitEntity, candidates: Iterable<T>): T | null {
  let best: T | null = null
  let bestDist = Infinity
  for (const candidate of candidates) {
    const dist = distance(unit, candidate)
    if (dist < bestDist) {
      best = candidate
      bestDist = dist
    }
  }
  return best
}

function sameTarget(a: RuntimeEntity | null | undefined, b: RuntimeEntity | null | undefined): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return Boolean(a.label && b.label && a.label === b.label)
}

function targetWorkerLoad(unit: UnitEntity, target: RuntimeEntity, work: string, action: string): number {
  const workers = unit.owner?.units ?? []
  let load = 0
  for (const worker of workers) {
    if (worker === unit || worker.isDead || worker.isDestroyed) continue
    if (worker.type !== UNIT_TYPES.villager || worker.work !== work || worker.action !== action) continue
    if (sameTarget(worker.dest as RuntimeEntity | null | undefined, target)) load++
  }
  return load
}

function isFoodTargetAvailable(unit: UnitEntity, target: RuntimeEntity): boolean {
  if (target.family === FAMILY_TYPES.resource && target.type === RESOURCE_TYPES.wheat) {
    return isWheatMature(target) && targetWorkerLoad(unit, target, WORK_TYPES.farmer, ACTION_TYPES.farm) < 1
  }
  return true
}

function isKnownToUnit(unit: UnitEntity, entity: RuntimeEntity): boolean {
  return Boolean(
    unit.context?.map?.revealEverything || unit.owner?.views?.isViewed(entity.i, entity.j) || entity.visible
  )
}

function exploreForAutonomy(unit: UnitEntity, job: VillagerAutonomyJob): boolean {
  const started = unit.explore?.() ?? false
  if (started) unit.autonomousJob = job
  else clearVillagerAutonomy(unit)
  return started
}

function knownResources(unit: UnitEntity, type: string): RuntimeEntity[] {
  const owner = unit.owner
  const resources = unit.context?.map?.resources ?? new Set<ResourceEntity>()
  const founded = owner?.foundedResources?.[type]
  const source = founded?.size ? [...founded] : [...resources].filter(resource => isKnownToUnit(unit, resource))
  return source.filter(resource => resource.type === type && isUsableResource(resource))
}

function knownFoodTargets(unit: UnitEntity): RuntimeEntity[] {
  const resources = unit.context?.map?.resources ?? new Set<ResourceEntity>()
  const foundedBerries = unit.owner?.foundedResources?.[RESOURCE_TYPES.berrybush] ?? unit.owner?.foundedBerrybushs
  const berries = foundedBerries?.size
    ? [...foundedBerries]
    : [...resources].filter(resource => isKnownToUnit(unit, resource) && resource.type === RESOURCE_TYPES.berrybush)
  const foundedWheat = unit.owner?.foundedResources?.[RESOURCE_TYPES.wheat] ?? unit.owner?.foundedWheats
  const wheat = foundedWheat?.size
    ? [...foundedWheat]
    : [...resources].filter(resource => isKnownToUnit(unit, resource) && resource.type === RESOURCE_TYPES.wheat)
  const foundedCarcasses = unit.owner?.foundedDeadAnimals
  const carcasses = foundedCarcasses?.size
    ? [...foundedCarcasses]
    : getGaiaAnimals(unit.context?.map?.gaia).filter(animal => isKnownToUnit(unit, animal))
  return [
    ...berries.filter(isUsableResource),
    ...wheat.filter(isUsableResource),
    ...carcasses.filter(isUsableAnimalCarcass),
  ].filter(target => isFoodTargetAvailable(unit, target))
}

function knownConstructionTargets(unit: UnitEntity): BuildingEntity[] {
  return (unit.owner?.buildings ?? []).filter(
    building =>
      building.owner === unit.owner &&
      isAliveEntity(building) &&
      !building.isBuilt &&
      unit.getActionCondition?.(building, ACTION_TYPES.build)
  )
}

function knownCapturableHorses(unit: UnitEntity): RuntimeEntity[] {
  const foundedHorses = unit.owner?.foundedAnimals
  const source = foundedHorses?.size
    ? [...foundedHorses]
    : [...getGaiaAnimals(unit.context?.map?.gaia)].filter(animal => isKnownToUnit(unit, animal))

  return source.filter(isCapturableHorse)
}

export function hasVillagerAutonomyTarget(unit: UnitEntity, job: VillagerAutonomyJob): boolean {
  if (unit.type !== UNIT_TYPES.villager || unit.isDead || unit.isDestroyed) return false
  if (job === 'construction') return knownConstructionTargets(unit).length > 0
  if (job === 'food') return knownFoodTargets(unit).length > 0
  if (job === 'horseCapture') {
    const horses = knownCapturableHorses(unit)
    return (
      horses.length > 0 && horses.some(horse => Boolean(getNearestAvailableStableForUnit(unit, horse, { maxDistance: null })))
    )
  }

  const resourceTypeByJob: Record<Exclude<VillagerAutonomyJob, 'food' | 'construction' | 'horseCapture'>, string> = {
    wood: RESOURCE_TYPES.tree,
    stone: RESOURCE_TYPES.stone,
    gold: RESOURCE_TYPES.gold,
  }
  return knownResources(unit, resourceTypeByJob[job]).length > 0
}

export function getAutonomyJobForWork(work: string | null | undefined): VillagerAutonomyJob | null {
  if (work === WORK_TYPES.woodcutter) return 'wood'
  if (work === WORK_TYPES.stoneminer) return 'stone'
  if (work === WORK_TYPES.goldminer) return 'gold'
  if (work === WORK_TYPES.builder) return 'construction'
  if (work === WORK_TYPES.horseCapture) return 'horseCapture'
  if (work === WORK_TYPES.forager || work === WORK_TYPES.farmer || work === WORK_TYPES.hunter) {
    return 'food'
  }
  return null
}

export function clearVillagerAutonomy(unit: UnitEntity): void {
  if (unit.type !== UNIT_TYPES.villager) return
  unit.autonomousJob = null
}

export function setVillagerAutonomy(unit: UnitEntity, job: VillagerAutonomyJob | null): void {
  if (unit.type !== UNIT_TYPES.villager) return
  unit.autonomousJob = job
}

export function assignVillagerAutonomy(unit: UnitEntity, job: VillagerAutonomyJob): boolean {
  if (unit.type !== UNIT_TYPES.villager || unit.isDead || unit.isDestroyed) return false
  setVillagerAutonomy(unit, job)

  unit.assigningAutonomousJob = true
  try {
    if (job === 'food') {
      const target = closest(unit, knownFoodTargets(unit))
      if (!target) return exploreForAutonomy(unit, job)
      if (target.family === FAMILY_TYPES.animal) unit.sendToTakeMeat?.(target)
      else if (target.type === RESOURCE_TYPES.wheat) unit.sendToFarm?.(target)
      else unit.sendToBerrybush?.(target)
      return true
    }

    if (job === 'horseCapture') {
      const target = closest(unit, knownCapturableHorses(unit))
      if (!target) return exploreForAutonomy(unit, job)
      if (!getNearestAvailableStableForUnit(unit, target)) return false
      unit.sendToCaptureHorse?.(target)
      return true
    }

    if (job === 'construction') {
      const target = closest(unit, knownConstructionTargets(unit))
      if (!target) {
        clearVillagerAutonomy(unit)
        return false
      }
      unit.sendToBuilding?.(target)
      return true
    }

    const resourceTypeByJob: Record<Exclude<VillagerAutonomyJob, 'food' | 'construction' | 'horseCapture'>, string> = {
      wood: RESOURCE_TYPES.tree,
      stone: RESOURCE_TYPES.stone,
      gold: RESOURCE_TYPES.gold,
    }
    const target = closest(unit, knownResources(unit, resourceTypeByJob[job]))
    if (!target) return exploreForAutonomy(unit, job)
    if (job === 'wood') unit.sendToTree?.(target)
    if (job === 'stone') unit.sendToStone?.(target)
    if (job === 'gold') unit.sendToGold?.(target)
    return true
  } finally {
    unit.assigningAutonomousJob = false
  }
}

export function resumeVillagerAutonomy(unit: UnitEntity): boolean {
  if (
    !unit.autonomousJob ||
    unit.type !== UNIT_TYPES.villager ||
    unit.shelterState ||
    unit.lookingAtHero ||
    unit.followingHero ||
    unit.assigningAutonomousJob
  ) {
    return false
  }
  return assignVillagerAutonomy(unit, unit.autonomousJob)
}
