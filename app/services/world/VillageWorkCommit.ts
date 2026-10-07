import { ensureOutsideMapSpace, moveEntityToMapSpace, getEntitySpaceId } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { SaveEntityState } from '../../types/save'

export function commitVillageWork(
  context: GameContextLike,
  sources: Map<SaveEntityState, RuntimeEntity>,
  resources: SaveEntityState[],
  savedBuildings: SaveEntityState[],
  buildings: PlayerLike['buildings'],
  copies: SaveEntityState[],
  units: UnitEntity[],
  fromElapsedMs?: number,
  sleeping = false
): void {
  // Commit synchronously: no live callbacks can interleave with this transaction.
  for (const [copy, source] of sources) {
    const felled = source.type === 'Tree' && (source.hitPoints ?? 0) > 0 && copy.hitPoints === 0
    source.hitPoints = copy.hitPoints ?? source.hitPoints
    if (felled) (source as RuntimeEntity & { setCuttedTreeTexture?: () => void }).setCuttedTreeTexture?.()
    if (source.type === 'Wheat' && copy.currentFrame === 0 && snapshotVillageEntity(source).currentFrame !== 0) {
      source.quantity = 0
      source.die?.()
    } else {
      source.quantity = copy.quantity
      if (!resources.includes(copy)) source.die?.()
    }
  }
  savedBuildings.forEach((copy, index) => {
    const building = buildings[index]
    building.inventory = copy.inventory
    const progressChanged = building.constructionProgress !== copy.constructionProgress
    building.constructionWorkRequired = copy.constructionWorkRequired
    building.constructionProgress = copy.constructionProgress
    building.constructionMaterials = copy.constructionMaterials
    if (building.buildingUpgrade) {
      if (copy.buildingUpgrade) building.buildingUpgrade = copy.buildingUpgrade
      else if (copy.buildingLevel === building.buildingUpgrade.targetLevel)
        building.buildingUpgrade.constructionProgress = 1
      building.updateHitPoints?.('build')
    }
    if (
      fromElapsedMs != null &&
      copy.hitPoints != null &&
      (progressChanged || copy.hitPoints !== building.hitPoints || (copy.isBuilt && !building.isBuilt))
    ) {
      building.hitPoints = copy.hitPoints
      building.updateHitPoints?.('build')
    }
  })
  const space = ensureOutsideMapSpace(context.map)
  copies.forEach((copy, index) => {
    const unit = units[index]
    unit.inventory = copy.inventory
    unit.lastMealAt = copy.lastMealAt
    unit.collectiveTask = copy.collectiveTask
    unit.collectiveHome = copy.collectiveHome
    // A bounded snapshot can run out of local work while the full map still has supplies.
    // Hand the search back to the live dispatcher instead of sleeping indefinitely.
    if (fromElapsedMs != null && !copy.autonomousJob && unit.autonomousJob) unit.autonomyBlockedJob = unit.autonomousJob
    unit.autonomousJob = copy.autonomousJob
    unit.offlineWork = copy.offlineWork
    if (unit.resourceDeliveryState?.pickup || copy.resourceDelivery?.pickup) {
      const oldTask = unit.resourceDeliveryState?.taskId
      if (oldTask != null) context.scheduler?.remove(oldTask)
      const ref = copy.resourceDelivery?.building
      const label = typeof ref === 'string' ? ref : Array.isArray(ref) ? ref[2] : undefined
      const building = buildings.find(building => building.label === label)
      unit.resourceDeliveryState =
        building && copy.resourceDelivery?.pickup
          ? { building, phase: 'toBuilding', pickup: { ...copy.resourceDelivery.pickup } }
          : null
    }

    if (fromElapsedMs != null) {
      unit.hitPoints = copy.hitPoints ?? unit.hitPoints
      unit.work = copy.work ?? null
      unit.action = copy.action ?? null
      unit.inactif = copy.inactif ?? !copy.action
      Object.assign(unit, { offlineBuilderJob: copy.offlineBuilderJob })
      unit.buildQueue = copy.buildQueue?.flatMap(label => buildings.filter(building => building.label === label))
      const label = Array.isArray(copy.dest) ? copy.dest[2] : undefined
      unit.dest = label
        ? ([...sources.values(), ...buildings].find(entity => entity.label === label && !entity.isDestroyed) ?? null)
        : null
      unit.path = []
    }
    if (sleeping && getEntitySpaceId(unit) !== 'outside') return
    const cell = context.map.grid[copy.i]?.[copy.j]
    if (cell && (!cell.has || cell.has === unit) && (unit.i !== copy.i || unit.j !== copy.j))
      moveEntityToMapSpace(context.map, unit, space, cell)
  })
}

const FIELDS = [
  'label',
  'type',
  'i',
  'j',
  'size',
  'hitPoints',
  'totalHitPoints',
  'quantity',
  'totalQuantity',
  'currentFrame',
  'isDead',
  'isDestroyed',
  'isBuilt',
  'isChief',
  'inactif',
  'villageHome',
  'buildingLevel',
  'constructionWorkRequired',
  'constructionTime',
  'constructionProgress',
  'constructionMaterials',
  'buildingUpgrade',
  'reservePolicy',
  'inventory',
  'equipment',
  'experience',
  'work',
  'autonomousJob',
  'collectiveTask',
  'collectiveHome',
  'offlineWork',

  'isNaturalResource',
  'controlMode',
  'action',
  'dailySchedule',
  'lastMealAt',
  'followingHero',
  'trainingTargetType',
  'offlineBuilderJob',
] as const

export function snapshotVillageEntity(entity: RuntimeEntity): SaveEntityState {
  const result: Record<string, unknown> = {}
  for (const field of FIELDS) {
    const value = (entity as unknown as Record<string, unknown>)[field]
    if (value !== undefined) result[field] = structuredClone(value)
  }
  const animated = entity as RuntimeEntity & { sprite?: { currentFrame?: number }; currentFrame?: number }
  const frame = animated.sprite?.currentFrame ?? animated.currentFrame
  if (frame != null) result.currentFrame = frame
  const unit = entity as UnitEntity
  if (unit.resourceDeliveryState?.pickup && unit.resourceDeliveryState.building) {
    const building = unit.resourceDeliveryState.building
    result.resourceDelivery = {
      building: [building.i, building.j, building.label],
      pickup: { ...unit.resourceDeliveryState.pickup },
    }
  }
  if (unit.dest) result.dest = [unit.dest.i, unit.dest.j, 'label' in unit.dest ? unit.dest.label : undefined]
  if (unit.buildQueue) result.buildQueue = unit.buildQueue.map(building => building.label)
  return result as SaveEntityState
}
