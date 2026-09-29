import { ANIMAL_CORPSE_DROPS } from '../../../config/animalGatherLoot'
import { CELL_HEIGHT, CELL_WIDTH, STEP_TIME } from '../../../constants/core'
import {
  RESOURCE_STOCKPILE_TYPES,
  RESOURCE_STORAGE_NAMES,
  RESOURCE_TYPES,
  UNIT_TYPES,
} from '../../../constants/entities'
import { belongsToSettlement, collectiveAnchor } from '../../../lib/economy/collectiveTasks'
import { isOutsideSpaceId } from '../../../lib/mapSpaces'
import { canMineIronResource } from '../../../lib/resources/ironMining'
import { depositChestResources, type ResourceStoreOwner } from '../../../lib/resources/playerResourceTotals'
import { automaticDepositAmount } from '../../../lib/resources/resourceDelivery'
import {
  allowsVillagerDeliveries,
  getStorageCapacity,
  storageAcceptsResource,
} from '../../../lib/resources/storagePolicy'
import { savedBuildingsOwnedBy } from '../../../serialization/InteriorBuildingSave'
import type { ResourceAmount } from '../../../types/common'
import type { AnimalConfig, BuildingConfig, UnitConfig } from '../../../types/config'
import type { UnitEntity } from '../../../types/entities'
import type { SaveEntityState, SaveGridPoint, SavePlayerState } from '../../../types/save'
import { distance, entityKey, isLiving, type OfflineWorldSpatial } from '../OfflineWorldSpatial'

export type OfflineWorkRules = {
  /** Enables detached village recruitment; gathering always consumes real resources. */
  abstractVillages?: boolean
  planBuildings?: boolean
  dailyFactors?(playerIndex: number, day: number): { workEfficiency: number; arrivalsAllowed: boolean }
  animalConfig?(type: string): AnimalConfig
  unitConfig(playerIndex: number, type: string): UnitConfig
  buildingConfig(playerIndex: number, type: string): BuildingConfig
  buildingCapacity(playerIndex: number, type: string): number
  cycleMs(playerIndex: number, work: string, action?: string): number
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

export const RESOURCE_WORK: Record<string, string> = {
  wood: 'woodcutter',
  berry: 'forager',
  wheat: 'farmer',
  meat: 'hunter',
  leather: 'hunter',
  sinew: 'hunter',
  feather: 'hunter',
  herb: 'forager',
  toxicHerb: 'forager',
  fiber: 'forager',
  stone: 'stoneminer',
  gold: 'goldminer',
  copper: 'goldminer',
  iron: 'goldminer',
}

const JOB_RESOURCE: Record<string, string[]> = {
  food: ['berry', 'wheat', 'meat'],
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

export function corpseResource(unit: SaveEntityState, target: SaveEntityState): keyof ResourceAmount | undefined {
  if (!target.isDead || !Object.hasOwn(ANIMAL_CORPSE_DROPS, target.type)) return undefined
  const resource = ['meat', 'leather', 'sinew', 'feather'].includes(unit.collectiveTask ?? '')
    ? (unit.collectiveTask as keyof ResourceAmount)
    : 'meat'
  return resource
}

export function storedResource(unit: SaveEntityState, target: SaveEntityState): keyof ResourceAmount | undefined {
  return corpseResource(unit, target) ?? RESOURCE_STOCKPILE_TYPES[target.type]
}

export function harvestableQuantity(unit: SaveEntityState, target: SaveEntityState): number {
  const corpse = corpseResource(unit, target)
  return corpse
    ? (target.inventory?.resources?.[corpse] ?? (corpse === 'meat' ? (target.quantity ?? 0) : 0))
    : (target.quantity ?? 0)
}

function targetMatches(unit: SaveEntityState, resource: SaveEntityState): boolean {
  const stored = storedResource(unit, resource)
  if (!stored) return false
  if (
    ['fiber', 'herb', 'toxicHerb', 'wheat', 'berry', 'meat', 'leather', 'sinew', 'feather'].includes(
      unit.collectiveTask ?? ''
    )
  )
    return stored === unit.collectiveTask
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
    harvestableQuantity(unit, resource) <= 0 ||
    (!isLiving(resource) && resource.type !== RESOURCE_TYPES.tree && !corpseResource(unit, resource)) ||
    !targetMatches(unit, resource) ||
    !canMineIronResource({ ...unit, owner: player }, resource) ||
    (resource.type === RESOURCE_TYPES.wheat && (resource.currentFrame ?? wheatMatureFrame) < wheatMatureFrame)
  )
    return undefined
  return RESOURCE_WORK[storedResource(unit, resource) ?? '']
}

export function destinationLabel(unit: SaveEntityState): string | undefined {
  const dest = unit.dest
  if (typeof dest === 'string') return dest
  if (Array.isArray(dest)) return dest[2]
  return dest?.label
}

export function clearMovement(unit: SaveEntityState): void {
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

export function travelMs(unit: SaveGridPoint, target: SaveGridPoint, config: UnitConfig): number {
  const pixelsPerCell = Math.hypot(CELL_WIDTH / 2, CELL_HEIGHT / 2)
  return ((distance(unit, target) * pixelsPerCell) / Math.max(0.1, Number(config.speed) || 1.5)) * STEP_TIME
}

function sumResourceAmount(resources: ResourceAmount | null | undefined): number {
  return Object.values(resources ?? {}).reduce((sum: number, amount) => sum + Math.max(0, Math.floor(amount ?? 0)), 0)
}

// depotFor only guarantees at least 1 unit of room — a bigger request must be clamped or
// depositChestResources rejects it outright (all-or-nothing) and progress stalls forever.
export function depotRemainingCapacity(depot: SaveEntityState): number {
  return Math.max(0, getStorageCapacity(depot.type) - sumResourceAmount(depot.inventory?.resources))
}

// Mirrors storageAcceptsResource/getStorageCapacity from the online delivery path (resourceDelivery.ts)
// so a village behaves the same whether the player is standing in it or it's simulated offline.
export function depotFor(
  player: SavePlayerState,
  resource: keyof ResourceAmount,
  target: SaveEntityState,
  spatial: OfflineWorldSpatial
): SaveEntityState | undefined {
  return (player.buildings ?? [])
    .filter(
      building =>
        isLiving(building) &&
        belongsToSettlement(player, collectiveAnchor(player, target), building) &&
        building.isBuilt &&
        allowsVillagerDeliveries(building) &&
        isOutsideSpaceId(building.spaceId) &&
        storageAcceptsResource(building.type, resource) &&
        sumResourceAmount(building.inventory?.resources) < getStorageCapacity(building.type) &&
        spatial.reachable(target, building)
    )
    .sort((a, b) => distance(a, target) - distance(b, target))[0]
}

export function localDeliveryOwner(
  player: SavePlayerState,
  depot: SaveEntityState,
  players: SavePlayerState[]
): ResourceStoreOwner {
  const owner = savedResourceOwner(player, players)
  return { ...owner, buildings: owner.buildings?.filter(building => belongsToSettlement(player, depot, building)) }
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
    const carried = automaticDepositAmount({ ...unit, owner: player } as unknown as UnitEntity, resource)
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
      !depositChestResources(
        localDeliveryOwner(player, depot, players),
        { [resource]: amount },
        { automaticDelivery: true }
      )
    )
      continue
    inventory[resource] = (inventory[resource] ?? 0) - amount
    if ((inventory[resource] ?? 0) <= 0) delete inventory[resource]
    delete unit.offlineWork
    budget -= milliseconds
    spatial.move(unit, point)
  }
  return budget
}
