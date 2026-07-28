import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, RESOURCE_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity, VillagerAutonomyJob } from '../types/entities'

function isAliveEntity(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(entity && !entity.isDead && !entity.isDestroyed && (entity.hitPoints ?? 1) > 0)
}

function isUsableResource(entity: RuntimeEntity | null | undefined): entity is ResourceEntity {
  return Boolean(isAliveEntity(entity) && entity.family === FAMILY_TYPES.resource && (entity.quantity ?? 1) > 0)
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

function isKnownToUnit(unit: UnitEntity, entity: RuntimeEntity): boolean {
  return Boolean(
    unit.context?.map?.revealEverything || unit.owner?.views?.isViewed(entity.i, entity.j) || entity.visible
  )
}

function exploreForAutonomy(unit: UnitEntity, job: VillagerAutonomyJob): boolean {
  const started = unit.explore?.() ?? false
  if (started) unit.autonomousJob = job
  return started
}

function knownResources(unit: UnitEntity, type: string): RuntimeEntity[] {
  const owner = unit.owner
  const resources = unit.context?.map?.resources ?? new Set<ResourceEntity>()
  const foundedByType: Record<string, Set<RuntimeEntity> | undefined> = {
    [RESOURCE_TYPES.tree]: owner?.foundedTrees,
    [RESOURCE_TYPES.berrybush]: owner?.foundedBerrybushs,
    [RESOURCE_TYPES.stone]: owner?.foundedStones,
    [RESOURCE_TYPES.gold]: owner?.foundedGolds,
  }
  const founded = foundedByType[type]
  const source = founded?.size ? [...founded] : [...resources].filter(resource => isKnownToUnit(unit, resource))
  return source.filter(resource => resource.type === type && isUsableResource(resource))
}

function knownFoodTargets(unit: UnitEntity): RuntimeEntity[] {
  const resources = unit.context?.map?.resources ?? new Set<ResourceEntity>()
  const foundedBerries = unit.owner?.foundedBerrybushs
  const berries = foundedBerries?.size
    ? [...foundedBerries]
    : [...resources].filter(resource => isKnownToUnit(unit, resource) && resource.type === RESOURCE_TYPES.berrybush)
  const foundedFish = unit.owner?.foundedFish
  const fish = foundedFish?.size
    ? [...foundedFish]
    : [...resources].filter(
        resource =>
          isKnownToUnit(unit, resource) && (resource.category === 'Fish' || resource.type === RESOURCE_TYPES.salmon)
      )
  const farms = (unit.owner?.buildings ?? []).filter(
    building =>
      building.type === BUILDING_TYPES.farm &&
      building.isBuilt &&
      !building.isUsedBy &&
      (building.quantity ?? 1) > 0 &&
      unit.getActionCondition?.(building, ACTION_TYPES.farm)
  )
  return [...berries.filter(isUsableResource), ...fish.filter(isUsableResource), ...farms]
}

function knownConstructionTargets(unit: UnitEntity): BuildingEntity[] {
  return (unit.owner?.buildings ?? []).filter(
    building => isAliveEntity(building) && !building.isBuilt && unit.getActionCondition?.(building, ACTION_TYPES.build)
  )
}

export function getAutonomyJobForWork(work: string | null | undefined): VillagerAutonomyJob | null {
  if (work === WORK_TYPES.woodcutter) return 'wood'
  if (work === WORK_TYPES.stoneminer) return 'stone'
  if (work === WORK_TYPES.goldminer) return 'gold'
  if (work === WORK_TYPES.builder) return 'construction'
  if (
    work === WORK_TYPES.forager ||
    work === WORK_TYPES.farmer ||
    work === WORK_TYPES.fisher ||
    work === WORK_TYPES.hunter
  ) {
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

  if (job === 'food') {
    const target = closest(unit, knownFoodTargets(unit))
    if (!target) return exploreForAutonomy(unit, job)
    if (target.family === FAMILY_TYPES.building) unit.sendToFarm?.(target)
    else if (target.category === 'Fish') unit.sendToFish?.(target)
    else unit.sendToBerrybush?.(target)
    return true
  }

  if (job === 'construction') {
    const target = closest(unit, knownConstructionTargets(unit))
    if (!target) return exploreForAutonomy(unit, job)
    unit.sendToBuilding?.(target)
    return true
  }

  const resourceTypeByJob: Record<Exclude<VillagerAutonomyJob, 'food' | 'construction'>, string> = {
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
}

export function resumeVillagerAutonomy(unit: UnitEntity): boolean {
  if (!unit.autonomousJob || unit.type !== UNIT_TYPES.villager || unit.lookingAtHero || unit.followingHero) return false
  return assignVillagerAutonomy(unit, unit.autonomousJob)
}
