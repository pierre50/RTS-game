import { getBuildingAge, getBuildingConfigForAge } from '../../lib/buildings/buildingAge'
import {
  BUILDING_TYPES,
  FOOD_RESOURCE_NAMES,
  RESOURCE_GATHER_SWINGS,
  RESOURCE_STOCKPILE_TYPES,
  RESOURCE_STORAGE_NAMES,
  RESOURCE_TYPES,
  TYPE_ACTION,
  UNIT_TYPES,
} from '../../constants/entities'
import { depositChestResources, type ResourceStoreOwner } from '../../lib/resources/playerResourceTotals'
import { canOwnerMineMineral } from '../../lib/resources/ironMining'
import { CELL_HEIGHT, CELL_WIDTH, STEP_TIME } from '../../constants/core'
import { NATURAL_RESOURCE_REGROWTH_BY_TYPE } from '../../config/gameplay'
import type { AnimalConfig, BuildingConfig, UnitConfig } from '../../types/config'
import type { ResourceAmount } from '../../types/common'
import type { SaveEntityState, SaveGridPoint, SavePlayerState, SerializedSave } from '../../types/save'
import { distance, entityKey, isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import { savedBuildingsOwnedBy } from '../../serialization/InteriorBuildingSave'
import { resetHarvestedWheat } from '../../lib/resources/wheatGrowth'

export type OfflineWorkRules = {
  animalConfig?(type: string): AnimalConfig
  unitConfig(playerIndex: number, type: string): UnitConfig
  buildingConfig(playerIndex: number, type: string): BuildingConfig
  buildingCapacity(playerIndex: number, type: string): number
  cycleMs(playerIndex: number, work: string): number
  wheatMatureFrame: number
  isKnown?(playerIndex: number, resource: SaveEntityState): boolean
}

export type OfflineWorldReport = {
  elapsedMs: number
  gathered: ResourceAmount
  foodConsumed: number
  foodShortage: number
  arrivals: number
  buildingsCompleted: number
  resourcesDepleted: number
  resourcesRespawned: number
  trainingsCompleted: number
  animalsRevived: number
  animalsMoved: number
  marketsRestocked: number
  trapsFilled: number
}

const RESOURCE_WORK: Record<string, string> = {
  wood: 'woodcutter',
  berry: 'forager',
  wheat: 'farmer',
  herb: 'forager',
  toxicHerb: 'forager',
  fiber: 'forager',
  stone: 'stoneminer',
  gold: 'goldminer',
  copper: 'goldminer',
  iron: 'goldminer',
}
const JOB_RESOURCE: Record<string, string[]> = {
  food: ['berry', 'wheat'],
  wood: ['wood'],
  stone: ['stone'],
  gold: ['gold'],
  copper: ['copper'],
  iron: ['iron'],
}

export function savedResourceOwner(player: SavePlayerState, players: SavePlayerState[] = [player]): ResourceStoreOwner {
  // Stockpile helpers only inspect ownership/type/inventory; saved entities intentionally have no runtime methods.
  return { ...player, buildings: savedBuildingsOwnedBy(player, players) } as unknown as ResourceStoreOwner
}

export function isOfflineWorker(unit: SaveEntityState): boolean {
  return (
    unit.type === UNIT_TYPES.villager &&
    isLiving(unit) &&
    !unit.followingHero &&
    unit.controlMode !== 'hero' &&
    !unit.trainingTargetType &&
    unit.action !== 'train' &&
    unit.action !== 'attack' &&
    unit.action !== 'flee'
  )
}

function targetMatches(unit: SaveEntityState, resource: SaveEntityState): boolean {
  const stored = RESOURCE_STOCKPILE_TYPES[resource.type]
  if (!stored) return false
  if (unit.autonomousJob) return JOB_RESOURCE[unit.autonomousJob]?.includes(stored) ?? false
  if (unit.work === 'goldminer') {
    const mineral = unit.action === 'minecopper' ? 'copper' : unit.action === 'mineiron' ? 'iron' : 'gold'
    return stored === mineral
  }
  return unit.work === RESOURCE_WORK[stored]
}

function destinationLabel(unit: SaveEntityState): string | undefined {
  const dest = unit.dest
  if (typeof dest === 'string') return dest
  if (Array.isArray(dest)) return dest[2]
  return dest?.label
}

function clearMovement(unit: SaveEntityState): void {
  unit.path = []
  unit.realDest = null
  unit.previousDest = null
  unit.blockedGatherApproach = null
  delete unit.currentFrame
  delete unit.currentSheet
  delete unit.loop
}

export function stopOfflineTask(unit: SaveEntityState): void {
  clearMovement(unit)
  unit.dest = null
  unit.action = null
  unit.inactif = true
}

function travelMs(unit: SaveGridPoint, target: SaveGridPoint, config: UnitConfig): number {
  const pixelsPerCell = Math.hypot(CELL_WIDTH / 2, CELL_HEIGHT / 2)
  return ((distance(unit, target) * pixelsPerCell) / Math.max(0.1, Number(config.speed) || 1.5)) * STEP_TIME
}

function depotFor(
  player: SavePlayerState,
  resource: keyof ResourceAmount,
  target: SaveEntityState,
  spatial: OfflineWorldSpatial
): SaveEntityState | undefined {
  return (player.buildings ?? [])
    .filter(
      building =>
        isLiving(building) &&
        building.isBuilt &&
        (building.type === BUILDING_TYPES.townCenter ||
          building.type ===
            (FOOD_RESOURCE_NAMES.includes(resource as 'wheat') ? BUILDING_TYPES.granary : BUILDING_TYPES.storagePit)) &&
        spatial.reachable(target, building)
    )
    .sort((a, b) => distance(a, target) - distance(b, target))[0]
}

export function deliverOfflineInventory(
  player: SavePlayerState,
  unit: SaveEntityState,
  budget: number,
  config: UnitConfig,
  spatial: OfflineWorldSpatial,
  players: SavePlayerState[] = [player]
): number {
  const inventory = unit.inventory?.resources
  if (!inventory) return budget
  for (const resource of RESOURCE_STORAGE_NAMES) {
    const amount = inventory[resource] ?? 0
    if (!(amount > 0)) continue
    const depot = depotFor(player, resource, unit, spatial)
    const point = depot && spatial.findNear(depot, 6, unit)
    if (!depot || !point) continue
    const key = `delivery:${entityKey(depot)}:${resource}`
    if (unit.offlineWork?.target === key) budget += unit.offlineWork.milliseconds
    const milliseconds = travelMs(unit, point, config) + 1000
    if (budget < milliseconds) {
      unit.offlineWork = { target: key, milliseconds: budget }
      return 0
    }
    if (!depositChestResources(savedResourceOwner(player, players), { [resource]: amount })) continue
    delete inventory[resource]
    delete unit.offlineWork
    budget -= milliseconds
    spatial.move(unit, point)
  }
  return budget
}

export function advanceOfflineWorker(
  state: SerializedSave,
  player: SavePlayerState,
  playerIndex: number,
  unit: SaveEntityState,
  milliseconds: number,
  day: number,
  spatial: OfflineWorldSpatial,
  rules: OfflineWorkRules,
  report: OfflineWorldReport
): void {
  const config = rules.unitConfig(playerIndex, unit.type)
  let budget = deliverOfflineInventory(player, unit, milliseconds, config, spatial, state.players)
  if (budget <= 0) return
  if (!unit.autonomousJob && !['builder', ...Object.values(RESOURCE_WORK)].includes(unit.work ?? '')) return
  const buildingTask = unit.autonomousJob === 'construction' || (!unit.autonomousJob && unit.work === 'builder')
  const validTarget = (resource: SaveEntityState) =>
    buildingTask
      ? isLiving(resource) &&
        !resource.isBuilt &&
        (player.buildings ?? []).includes(resource) &&
        (!unit.buildQueue?.length || unit.buildQueue.includes(resource.label ?? ''))
      : !resource.isDestroyed &&
        (resource.quantity ?? 0) > 0 &&
        (isLiving(resource) || resource.type === RESOURCE_TYPES.tree) &&
        targetMatches(unit, resource) &&
        canOwnerMineMineral(player, resource.type ?? '') &&
        (rules.isKnown?.(playerIndex, resource) ?? true) &&
        (resource.type !== RESOURCE_TYPES.wheat ||
          (resource.currentFrame ?? rules.wheatMatureFrame) >= rules.wheatMatureFrame)
  const previousTarget = destinationLabel(unit)
  const candidates = () =>
    (buildingTask ? (player.buildings ?? []) : state.resources).filter(validTarget).sort((a, b) => {
      if (buildingTask && unit.buildQueue?.length)
        return unit.buildQueue.indexOf(a.label ?? '') - unit.buildQueue.indexOf(b.label ?? '')
      if (a.label === previousTarget) return -1
      if (b.label === previousTarget) return 1
      return distance(unit, a) - distance(unit, b)
    })
  const current = spatial.entity(previousTarget)
  let searched = !current || !validTarget(current)
  const targets = current && !searched ? [current] : candidates()
  const findMore = () => {
    if (searched) return
    searched = true
    targets.push(...candidates().filter(target => target !== current))
  }

  for (const target of targets) {
    if (budget <= 0) break
    if (!spatial.reachable(unit, target)) {
      findMore()
      continue
    }
    const point = spatial.findNear(target, buildingTask ? 6 : 1, unit)
    if (!point) {
      findMore()
      continue
    }
    const stored = RESOURCE_STOCKPILE_TYPES[target.type] as keyof ResourceAmount | undefined
    const depot = !buildingTask && stored ? depotFor(player, stored, target, spatial) : undefined
    if (!buildingTask && !depot) {
      findMore()
      continue
    }
    const work = buildingTask ? 'builder' : stored && RESOURCE_WORK[stored]
    if (!work) continue
    const key = `${work}:${entityKey(target)}`
    if (unit.offlineWork?.target === key) budget += unit.offlineWork.milliseconds
    unit.offlineWork = { target: key, milliseconds: 0 }
    const approach = travelMs(unit, point, config)
    if (budget < approach) {
      unit.offlineWork.milliseconds = budget
      return
    }
    budget -= approach
    spatial.move(unit, point)
    clearMovement(unit)
    unit.work = work
    unit.dest = target.label ? [target.i, target.j, target.label] : [target.i, target.j]
    unit.action = buildingTask ? 'build' : TYPE_ACTION[target.type as keyof typeof TYPE_ACTION]
    unit.inactif = false
    const cycle = Math.max(1, rules.cycleMs(playerIndex, work))
    if (buildingTask) {
      const buildingConfig = getBuildingConfigForAge(
        rules.buildingConfig(playerIndex, target.type),
        getBuildingAge(target, player.age ?? 0)
      )
      const total = target.totalHitPoints ?? Number(buildingConfig.totalHitPoints)
      const constructionTime = Number(buildingConfig.constructionTime)
      if (!(total > 0) || !(constructionTime > 0)) continue
      const gain = Math.max(0, Math.round(total / constructionTime))
      if (!gain) continue
      const impacts = Math.min(Math.floor(budget / cycle), Math.ceil((total - (target.hitPoints ?? 1)) / gain))
      target.hitPoints = Math.min(total, (target.hitPoints ?? 1) + impacts * gain)
      budget -= impacts * cycle
      if (target.hitPoints >= total) {
        target.isBuilt = true
        player.populationMax = (player.populationMax ?? 0) + rules.buildingCapacity(playerIndex, target.type)
        report.buildingsCompleted++
        if (unit.buildQueue) unit.buildQueue = unit.buildQueue.filter(label => label !== target.label)
        delete unit.offlineWork
        stopOfflineTask(unit)
        findMore()
        continue
      }
    } else if (stored && depot) {
      const gatherAmounts = config.gatherAmount as Record<string, number> | undefined
      const gain = Math.max(1, Math.round(gatherAmounts?.[work] ?? 1))
      const swings = RESOURCE_GATHER_SWINGS[stored as keyof typeof RESOURCE_GATHER_SWINGS] ?? 2
      const deliveryPerItem = (travelMs(target, depot, config) * 2) / 10
      const itemMs = (cycle * swings) / gain + deliveryPerItem
      const treeHealth = target.hitPoints ?? 0
      if (target.type === RESOURCE_TYPES.tree && treeHealth > 0) {
        const impacts = Math.min(treeHealth, Math.floor(budget / cycle))
        target.hitPoints = treeHealth - impacts
        budget -= impacts * cycle
        if (target.hitPoints > 0) {
          unit.offlineWork.milliseconds = budget
          return
        }
      }
      const amount = Math.min(target.quantity ?? 0, Math.floor(budget / itemMs))
      if (
        amount > 0 &&
        !savedBuildingsOwnedBy(player, state.players).some(
          building =>
            isLiving(building) &&
            (building.type === BUILDING_TYPES.chest ||
              building.type === BUILDING_TYPES.storagePit ||
              (building.type === BUILDING_TYPES.townCenter && building.inventory?.resources))
        )
      ) {
        delete unit.offlineWork
        return
      }
      if (amount > 0 && depositChestResources(savedResourceOwner(player, state.players), { [stored]: amount })) {
        target.quantity = Math.max(0, (target.quantity ?? 0) - amount)
        report.gathered[stored] = (report.gathered[stored] ?? 0) + amount
        budget -= amount * itemMs
        if (target.quantity === 0) {
          if (resetHarvestedWheat(target)) {
            report.resourcesDepleted++
            delete unit.offlineWork
            stopOfflineTask(unit)
            findMore()
            continue
          }
          if (target.type === RESOURCE_TYPES.berrybush) {
            target.totalHitPoints = Math.min(target.totalHitPoints ?? 4, 4)
            target.hitPoints = Math.min(target.hitPoints ?? 4, 4)
            delete unit.offlineWork
            stopOfflineTask(unit)
            findMore()
            continue
          }
          state.resources.splice(state.resources.indexOf(target), 1)
          spatial.release(target)
          report.resourcesDepleted++
          if (target.isNaturalResource && Object.hasOwn(NATURAL_RESOURCE_REGROWTH_BY_TYPE, target.type)) {
            state.naturalResourceRespawnSlots ??= []
            state.naturalResourceRespawnSlots.push({ ...target, depletedDay: day })
          }
          delete unit.offlineWork
          stopOfflineTask(unit)
          findMore()
          continue
        }
      }
    }
    unit.offlineWork.milliseconds = budget
    return
  }
  delete unit.offlineWork
  stopOfflineTask(unit)
}
