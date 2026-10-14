import { isGroundResourceType } from '../../../lib/resources/groundResourceRegrowth'
import {
  canDoWorkWithTool,
  getWorkToolTier,
  getEquippedWorkTool,
  workToolFamily,
  workToolUse,
} from '../../../lib/equipment/workTools'
import { getEquipmentRemainingUses, withEquipmentRemainingUses } from '../../../lib/equipment/equipmentCondition'
import { observeEconomyChange, recordEconomyFlow } from '../../../lib/economy/economyTelemetry'
import { refreshPopulationCapacity } from '../../../lib/buildings/buildingOccupancy'
import { reconcileHouseholds } from '../../../lib/housing/households'
import { completeBuildingUpgrade } from '../../../lib/buildings/buildingUpgrade'
import {
  constructionWorkPoints,
  deliverConstructionMaterials,
  constructionMaterialsReady,
  constructionWorkTotal,
  initializeConstructionProgress,
  applyConstructionWork,
  constructionProgress,
} from '../../../lib/economy/constructionMaterials'
import { NATURAL_RESOURCE_REGROWTH_BY_TYPE } from '../../../config/gameplay'
import { RESOURCE_TYPES } from '../../../constants/entities'
import { getBuildingLevel, getBuildingConfigForLevel } from '../../../lib/buildings/buildingLevel'
import { collectiveHarvestBudget } from '../../../lib/economy/collectiveTasks'
import { advanceMaterialConstruction } from '../../../lib/economy/constructionMaterials'
import {
  advanceConstruction,
  getRepairGain,
  advanceRepair,
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
import { type OfflineWorldSpatial } from '../offline/OfflineWorldSpatial'
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
  if (target.constructionPaused) {
    delete unit.offlineWork
    stopOfflineTask(unit)
    return { budget, status: 'skip' }
  }
  deliverConstructionMaterials(target, [unit.inventory?.resources ?? {}])
  if (!constructionMaterialsReady(target)) {
    delete unit.offlineWork
    stopOfflineTask(unit)
    return { budget, status: 'next' }
  }
  if (!canDoWorkWithTool(unit, 'build', target.type)) return { budget, status: 'skip' }
  const buildingConfig = getBuildingConfigForLevel(
    rules.buildingConfig(playerIndex, target.type),
    target.buildingUpgrade?.targetLevel ?? getBuildingLevel(target)
  )
  const constructionTime = target.buildingUpgrade?.constructionTime ?? Number(buildingConfig.constructionTime)
  if (!(constructionTime > 0) || target.isDead || target.isDestroyed || (target.hitPoints ?? 1) <= 0)
    return { budget, status: 'skip' }
  target.totalHitPoints ??= Number(buildingConfig.totalHitPoints)
  target.constructionTime ??= constructionTime
  initializeConstructionProgress(target)
  const repairing = Boolean(target.isBuilt && !target.buildingUpgrade)
  const total = repairing ? target.totalHitPoints : constructionWorkTotal(target)
  const multiplier = getBuildRateXpMultiplier(unit) * (1 + getWorkToolTier(unit) * 0.25)
  const gain = repairing ? getRepairGain(total, constructionTime, multiplier) : multiplier
  if (!(gain > 0)) return { budget, status: 'skip' }
  const before = repairing ? (target.hitPoints ?? 0) : constructionWorkPoints(target)
  const impacts = Math.min(toolWorkRemaining(unit), Math.floor(budget / cycle), Math.ceil((total - before) / gain))
  const requested = repairing
    ? advanceRepair(before, total, constructionTime, multiplier, impacts)
    : advanceConstruction(before, total, multiplier, impacts)
  const next = repairing
    ? requested
    : observeEconomyChange(
        player,
        'construction',
        () => target.constructionMaterials?.consumed ?? {},
        'added',
        () => advanceMaterialConstruction(target, requested)
      )
  if (next > before) wearOfflineTool(unit, Math.ceil((next - before) / gain))
  budget -= impacts * cycle
  if (repairing) target.hitPoints = next
  else applyConstructionWork(target, next)
  if (target.buildingUpgrade) {
    if (completeBuildingUpgrade(target, rules.buildingConfig(playerIndex, target.type))) {
      reconcileHouseholds(player)
      refreshPopulationCapacity(player)
      report.buildingsCompleted++
      if (unit.buildQueue) unit.buildQueue = unit.buildQueue.filter(label => label !== target.label)
      delete unit.offlineWork
      stopOfflineTask(unit)
      return { budget, status: 'next' }
    }
    return { budget, status: 'wait' }
  }
  if (target.isBuilt ? (target.hitPoints ?? 0) >= total : constructionProgress(target) >= 1) {
    target.isBuilt = true
    if (target.type === 'Farm') {
      spatial.releaseBuilding(target)
      player.buildings = player.buildings?.filter(site => site !== target)
      const wheat = sownWheatOptions(target)
      state.resources.push(wheat)
      spatial.reserve(wheat)
      if (unit.buildQueue) unit.buildQueue = unit.buildQueue.filter(label => label !== target.label)
      delete unit.offlineWork
      stopOfflineTask(unit)
      return { budget, status: 'next' }
    }
    player.hasBuilt ??= []
    if (!player.hasBuilt.includes(target.type)) player.hasBuilt.push(target.type)
    refreshPopulationCapacity(player)
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

  const ground = isGroundResourceType(target.type)
  const action = ground
    ? 'forageberry'
    : (unit.action ??
      (
        {
          woodcutter: 'chopwood',
          farmer: 'farm',
          stoneminer: 'minestone',
          goldminer: 'minegold',
          copperminer: 'minecopper',
          tinminer: 'minetin',
          ironminer: 'mineiron',
        } as Record<string, string>
      )[work])
  if (!canDoWorkWithTool(unit, action, target.type)) return { budget, status: 'skip' }
  const family = workToolFamily(getEquippedWorkTool(unit))
  const needsTool = workToolUse(unit, action, target.type) === 'tool'
  const gatherAmounts = config.gatherAmount as Record<string, number> | undefined
  const gain = getWorkGatherAmount(
    gatherAmounts,
    work,
    getGatherXpBonus({ experience: unit.experience, work }) + (needsTool ? getWorkToolTier(unit) : 0),
    family === 'scythe',
    getWorkToolTier(unit)
  )
  const swings = ground ? 1 : getResourceGatherSwings(stored)
  const carry = getUnitResourceGatherCapacity(unit as unknown as UnitEntity)
  if (carry <= 0) return { budget, status: 'skip' }
  const deliveryPerItem = depot ? (travelMs(target, depot, config) * 2) / carry : 0
  const treeHealth = target.hitPoints ?? 0
  if (target.type === RESOURCE_TYPES.tree && treeHealth > 0) {
    const impacts = Math.min(treeHealth, toolWorkRemaining(unit), Math.floor(budget / cycle))
    target.hitPoints = treeHealth - impacts
    wearOfflineTool(unit, impacts)
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
    ground ? 450 : cycle * swings,
    Math.min(gain, carry),
    Math.min(
      harvestableQuantity(unit, target),
      needsTool ? Math.floor(toolWorkRemaining(unit) / swings) * gain : Infinity
    ),
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
    recordEconomyFlow(player, 'gathered', { [stored]: amount })
    report.gathered[stored] = (report.gathered[stored] ?? 0) + amount
    if (needsTool) wearOfflineTool(unit, Math.ceil(amount / gain) * swings)
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
  // Finish the last incomplete batch: a tool with fewer uses than a full harvest
  // still performs its remaining impacts and breaks, without yielding a partial lot.
  const remaining = needsTool ? toolWorkRemaining(unit) : 0
  if (
    remaining > 0 &&
    remaining < swings &&
    budget >= remaining * cycle &&
    harvestableQuantity(unit, target) > 0 &&
    collectiveHarvestBudget(player, unit, stored) > 0 &&
    (depot ? depotRemainingCapacity(depot) : getUnitResourceCarryRemaining(unit as unknown as UnitEntity)) > 0
  ) {
    wearOfflineTool(unit, remaining)
    budget -= remaining * cycle
  }
  return { budget, status: 'wait' }
}

function toolWorkRemaining(unit: SaveEntityState): number {
  const tool = getEquippedWorkTool(unit)
  return tool ? (getEquipmentRemainingUses(tool) ?? 0) : 0
}
function wearOfflineTool(unit: SaveEntityState, impacts: number): void {
  const tool = getEquippedWorkTool(unit)
  if (tool && impacts > 0)
    unit.inventory!.activeWeapons!.tool = withEquipmentRemainingUses(tool, toolWorkRemaining(unit) - impacts)
}
