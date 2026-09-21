import { competingTownCenterSites } from '../../lib/buildings/townCenterClaim'
import { getUnitResourceCarryRemaining } from '../../lib/resources/resourceDelivery'
import type { UnitEntity } from '../../types/entities'
import { getBuildingAge, getBuildingConfigForAge } from '../../lib/buildings/buildingAge'
import {
  RESOURCE_GATHER_SWINGS,
  RESOURCE_STOCKPILE_TYPES,
  RESOURCE_STORAGE_NAMES,
  RESOURCE_TYPES,
  TYPE_ACTION,
  UNIT_TYPES,
} from '../../constants/entities'
import { depositChestResources, type ResourceStoreOwner } from '../../lib/resources/playerResourceTotals'
import { getStorageCapacity, storageAcceptsResource, allowsVillagerDeliveries } from '../../lib/resources/storagePolicy'
import { canMineIronResource } from '../../lib/resources/ironMining'
import { isOutsideSpaceId } from '../../lib/mapSpaces'
import { CELL_HEIGHT, CELL_WIDTH, STEP_TIME } from '../../constants/core'
import { NATURAL_RESOURCE_REGROWTH_BY_TYPE } from '../../config/gameplay'
import type { AnimalConfig, BuildingConfig, UnitConfig } from '../../types/config'
import type { ResourceAmount } from '../../types/common'
import type { SaveEntityState, SaveGridPoint, SavePlayerState, SerializedSave } from '../../types/save'
import { distance, entityKey, isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import { savedBuildingsOwnedBy } from '../../serialization/InteriorBuildingSave'
import { resetHarvestedWheat } from '../../lib/resources/wheatGrowth'

export type OfflineWorkRules = {
  abstractVillages?: boolean
  abstractPotential?: ResourceAmount
  planBuildings?: boolean
  dailyFactors?(playerIndex: number, day: number): { workEfficiency: number; arrivalsAllowed: boolean }
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

export function offlineResourceWork(
  player: SavePlayerState,
  unit: SaveEntityState,
  resource: SaveEntityState,
  wheatMatureFrame: number
): string | undefined {
  if (
    resource.isDestroyed ||
    (resource.quantity ?? 0) <= 0 ||
    (!isLiving(resource) && resource.type !== RESOURCE_TYPES.tree) ||
    !targetMatches(unit, resource) ||
    !canMineIronResource({ ...unit, owner: player }, resource) ||
    (resource.type === RESOURCE_TYPES.wheat && (resource.currentFrame ?? wheatMatureFrame) < wheatMatureFrame)
  )
    return undefined
  return RESOURCE_WORK[RESOURCE_STOCKPILE_TYPES[resource.type]]
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

function sumResourceAmount(resources: ResourceAmount | null | undefined): number {
  return Object.values(resources ?? {}).reduce((sum: number, amount) => sum + Math.max(0, Math.floor(amount ?? 0)), 0)
}

// depotFor only guarantees at least 1 unit of room — a bigger request must be clamped or
// depositChestResources rejects it outright (all-or-nothing) and progress stalls forever.
function depotRemainingCapacity(depot: SaveEntityState): number {
  return Math.max(0, getStorageCapacity(depot.type) - sumResourceAmount(depot.inventory?.resources))
}

// Mirrors storageAcceptsResource/getStorageCapacity from the online delivery path (resourceDelivery.ts)
// so a village behaves the same whether the player is standing in it or it's simulated offline.
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
        allowsVillagerDeliveries(building) &&
        isOutsideSpaceId(building.spaceId) &&
        storageAcceptsResource(building.type, resource) &&
        sumResourceAmount(building.inventory?.resources) < getStorageCapacity(building.type) &&
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
    const carried = inventory[resource] ?? 0
    if (!(carried > 0)) continue
    const depot = depotFor(player, resource, unit, spatial)
    const point = depot && spatial.findNear(depot, 6, unit)
    if (!depot || !point) continue
    const amount = Math.min(carried, depotRemainingCapacity(depot))
    if (amount <= 0) continue
    const key = `delivery:${entityKey(depot)}:${resource}`
    if (unit.offlineWork?.target === key) budget += unit.offlineWork.milliseconds
    const milliseconds = travelMs(unit, point, config) + 1000
    if (budget < milliseconds) {
      unit.offlineWork = { target: key, milliseconds: budget }
      return 0
    }
    if (
      !depositChestResources(savedResourceOwner(player, players), { [resource]: amount }, { automaticDelivery: true })
    )
      continue
    inventory[resource] = carried - amount
    if ((inventory[resource] ?? 0) <= 0) delete inventory[resource]
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
      : Boolean(offlineResourceWork(player, unit, resource, rules.wheatMatureFrame)) &&
        (rules.isKnown?.(playerIndex, resource) ?? true)
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
    if (!validTarget(target)) continue
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
    if (!buildingTask && !depot && getUnitResourceCarryRemaining(unit as unknown as UnitEntity) <= 0) {
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
        for (const site of competingTownCenterSites(target, state.players)) {
          site.hitPoints = 0
          site.isDead = true
          site.isDestroyed = true
          spatial.releaseBuilding(site)
          for (const resident of state.players) {
            resident.buildings = resident.buildings?.filter(building => building !== site)
            for (const worker of resident.units ?? []) {
              if (site.label && destinationLabel(worker) === site.label) {
                delete worker.offlineWork
                stopOfflineTask(worker)
              }
              if (site.label && worker.buildQueue)
                worker.buildQueue = worker.buildQueue.filter(label => label !== site.label)
            }
          }
        }
        player.hasBuilt ??= []
        if (!player.hasBuilt.includes(target.type)) player.hasBuilt.push(target.type)
        player.populationMax = (player.populationMax ?? 0) + rules.buildingCapacity(playerIndex, target.type)
        report.buildingsCompleted++
        if (unit.buildQueue) unit.buildQueue = unit.buildQueue.filter(label => label !== target.label)
        delete unit.offlineWork
        stopOfflineTask(unit)
        findMore()
        continue
      }
    } else if (stored) {
      const gatherAmounts = config.gatherAmount as Record<string, number> | undefined
      const gain = Math.max(1, Math.round(gatherAmounts?.[work] ?? 1))
      const swings = RESOURCE_GATHER_SWINGS[stored as keyof typeof RESOURCE_GATHER_SWINGS] ?? 2
      const deliveryPerItem = depot ? (travelMs(target, depot, config) * 2) / 10 : 0
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
      // `depot` above only guarantees at least 1 unit of room, so the gather amount still needs
      // clamping to what's actually left — otherwise a request bigger than the remaining room
      // gets rejected outright and the worker stalls just short of a full storage building.
      const amount = Math.min(
        target.quantity ?? 0,
        Math.floor(budget / itemMs),
        depot ? depotRemainingCapacity(depot) : getUnitResourceCarryRemaining(unit as unknown as UnitEntity)
      )
      if (
        amount > 0 &&
        (!depot ||
          depositChestResources(
            savedResourceOwner(player, state.players),
            { [stored]: amount },
            { automaticDelivery: true }
          ))
      ) {
        if (!depot) {
          unit.inventory ??= {}
          unit.inventory.resources ??= {}
          unit.inventory.resources[stored] = (unit.inventory.resources[stored] ?? 0) + amount
        }
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
