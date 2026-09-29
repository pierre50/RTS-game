import { NATURAL_RESOURCE_REGROWTH_BY_TYPE } from '../../../config/gameplay'
import { RESOURCE_TYPES } from '../../../constants/entities'
import { getBuildingAge, getBuildingConfigForAge } from '../../../lib/buildings/buildingAge'
import { collectiveHarvestBudget } from '../../../lib/economy/collectiveTasks'
import { advanceMaterialConstruction } from '../../../lib/economy/constructionMaterials'
import {
  advanceConstruction,
  getConstructionGain,
  getResourceGatherSwings,
  getWorkGatherAmount,
  harvestWithinBudget,
} from '../../../lib/economy/workRules'
import { depositChestResources } from '../../../lib/resources/playerResourceTotals'
import { getUnitResourceCarryRemaining, getUnitResourceGatherCapacity } from '../../../lib/resources/resourceDelivery'
import { resetHarvestedWheat } from '../../../lib/resources/wheatGrowth'
import { sownWheatOptions } from '../../../lib/resources/wheatSowing'
import { getBuildRateXpMultiplier, getGatherXpBonus } from '../../../lib/units/unitExperience'
import type { ResourceAmount } from '../../../types/common'
import type { UnitConfig } from '../../../types/config'
import type { UnitEntity } from '../../../types/entities'
import type { SaveEntityState, SavePlayerState, SerializedSave } from '../../../types/save'
import { type OfflineWorldSpatial } from '.././OfflineWorldSpatial'
import type { OfflineWorkRules, OfflineWorldReport } from './OfflineWorkResources'
import {
  corpseResource,
  depotRemainingCapacity,
  harvestableQuantity,
  localDeliveryOwner,
  stopOfflineTask,
  travelMs,
} from './OfflineWorkResources'

type WorkStep = {
  state: SerializedSave
  player: SavePlayerState
  playerIndex: number
  unit: SaveEntityState
  target: SaveEntityState
  day: number
  spatial: OfflineWorldSpatial
  rules: OfflineWorkRules
  report: OfflineWorldReport
  config: UnitConfig
  cycle: number
  work: string
  depot?: SaveEntityState
  stored: keyof ResourceAmount
}
type StepResult = { budget: number; status: 'wait' | 'skip' | 'next' }
export function buildOffline(step: WorkStep, budget: number): StepResult {
  const { state, player, playerIndex, unit, target, spatial, rules, report, cycle } = step
  const buildingConfig = getBuildingConfigForAge(
    rules.buildingConfig(playerIndex, target.type),
    getBuildingAge(target, player.age ?? 0)
  )
  const total = target.totalHitPoints ?? Number(buildingConfig.totalHitPoints)
  const constructionTime = Number(buildingConfig.constructionTime)
  if (!(total > 0) || !(constructionTime > 0)) return { budget, status: 'skip' }
  const multiplier = getBuildRateXpMultiplier(unit)
  const gain = getConstructionGain(total, constructionTime, multiplier)
  if (!gain) return { budget, status: 'skip' }
  const impacts = Math.min(Math.floor(budget / cycle), Math.ceil((total - (target.hitPoints ?? 1)) / gain))
  target.totalHitPoints = total
  target.hitPoints = advanceMaterialConstruction(
    target,
    advanceConstruction(target.hitPoints ?? 1, total, constructionTime, multiplier, impacts),
    [unit.inventory?.resources ?? {}]
  )
  budget -= impacts * cycle
  if (target.hitPoints >= total) {
    target.isBuilt = true
    if (target.type === 'Farm') {
      spatial.releaseBuilding(target)
      player.buildings = player.buildings?.filter(site => site !== target)
      const wheat = sownWheatOptions(target)
      state.resources.push(wheat)
      spatial.reserve(wheat)
      player.completedObjectives ??= []
      if (!player.completedObjectives.includes('createWheatField')) player.completedObjectives.push('createWheatField')
      if (unit.buildQueue) unit.buildQueue = unit.buildQueue.filter(label => label !== target.label)
      delete unit.offlineWork
      stopOfflineTask(unit)
      return { budget, status: 'next' }
    }
    player.hasBuilt ??= []
    if (!player.hasBuilt.includes(target.type)) player.hasBuilt.push(target.type)
    player.populationMax = (player.populationMax ?? 0) + rules.buildingCapacity(playerIndex, target.type)
    report.buildingsCompleted++
    if (unit.buildQueue) unit.buildQueue = unit.buildQueue.filter(label => label !== target.label)
    delete unit.offlineWork
    stopOfflineTask(unit)
    return { budget, status: 'next' }
  }

  return { budget, status: 'wait' }
}
export function gatherOffline(step: WorkStep, budget: number): StepResult {
  const { state, player, unit, target, day, spatial, report, config, cycle, work, depot, stored } = step

  const gatherAmounts = config.gatherAmount as Record<string, number> | undefined
  const gain = getWorkGatherAmount(gatherAmounts, work, getGatherXpBonus({ experience: unit.experience, work }))
  const swings = getResourceGatherSwings(stored)
  const carry = getUnitResourceGatherCapacity(unit as unknown as UnitEntity)
  if (carry <= 0) return { budget, status: 'skip' }
  const deliveryPerItem = depot ? (travelMs(target, depot, config) * 2) / carry : 0
  const treeHealth = target.hitPoints ?? 0
  if (target.type === RESOURCE_TYPES.tree && treeHealth > 0) {
    const impacts = Math.min(treeHealth, Math.floor(budget / cycle))
    target.hitPoints = treeHealth - impacts
    budget -= impacts * cycle
    if (target.hitPoints > 0) {
      if (unit.offlineWork) unit.offlineWork.milliseconds = budget
      return { budget, status: 'wait' }
    }
  }
  // `depot` above only guarantees at least 1 unit of room, so the gather amount still needs
  // clamping to what's actually left — otherwise a request bigger than the remaining room
  // gets rejected outright and the worker stalls just short of a full storage building.
  const harvest = harvestWithinBudget(
    budget,
    cycle * swings,
    Math.min(gain, carry),
    harvestableQuantity(unit, target),
    Math.min(
      collectiveHarvestBudget(player, unit, stored),
      depot ? depotRemainingCapacity(depot) : getUnitResourceCarryRemaining(unit as unknown as UnitEntity)
    ),
    deliveryPerItem
  )
  const amount = harvest.amount
  if (
    amount > 0 &&
    (!depot ||
      depositChestResources(
        localDeliveryOwner(player, depot, state.players),
        { [stored]: amount },
        { automaticDelivery: true }
      ))
  ) {
    if (!depot) {
      unit.inventory ??= {}
      unit.inventory.resources ??= {}
      unit.inventory.resources[stored] = (unit.inventory.resources[stored] ?? 0) + amount
    }
    if (corpseResource(unit, target)) {
      target.inventory ??= { resources: { meat: target.quantity ?? 0 } }
      target.inventory.resources ??= {}
      target.inventory.resources[stored] = Math.max(0, harvestableQuantity(unit, target) - amount)
      target.quantity = target.inventory.resources.meat ?? 0
    } else target.quantity = Math.max(0, (target.quantity ?? 0) - amount)
    report.gathered[stored] = (report.gathered[stored] ?? 0) + amount
    budget -= harvest.milliseconds
    if (corpseResource(unit, target) && harvestableQuantity(unit, target) === 0) {
      delete unit.offlineWork
      stopOfflineTask(unit)
      return { budget, status: 'next' }
    }
    if (target.quantity === 0) {
      if (resetHarvestedWheat(target)) {
        report.resourcesDepleted++
        delete unit.offlineWork
        stopOfflineTask(unit)
        return { budget, status: 'next' }
      }
      if (target.type === RESOURCE_TYPES.berrybush) {
        target.totalHitPoints = Math.min(target.totalHitPoints ?? 4, 4)
        target.hitPoints = Math.min(target.hitPoints ?? 4, 4)
        delete unit.offlineWork
        stopOfflineTask(unit)
        return { budget, status: 'next' }
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
      return { budget, status: 'next' }
    }
  }
  return { budget, status: 'wait' }
}
