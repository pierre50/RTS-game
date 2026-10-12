import { returnOfflineWorkerForTool } from './OfflineToolReturn'
import { gatherOffline } from '../work/OfflineWorkImpacts'
import {
  constructionToolPreparation,
  equipOwnedTool,
  ownsUsableTool,
  toolActivityAnchor,
} from '../../../lib/units/supplies/toolPreparation'
import { groundToolPlan } from '../../../lib/units/supplies/groundToolRecovery'
import { supplyTownTool } from '../../../lib/units/supplies/townToolSupply'
import { getUnitResourceCapacityRemaining } from '../../../lib/resources/resourceDelivery'
import { VILLAGE_ACTIVITY_RADIUS } from '../../../config/villageActivity'
import { recordEconomyFlow } from '../../../lib/economy/economyTelemetry'
import type { UnitEntity } from '../../../types/entities'
import type { SaveEntityState, SavePlayerState, SerializedSave } from '../../../types/save'
import { entityKey, isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import {
  deliverOfflineInventory,
  travelMs,
  stopOfflineTask,
  type OfflineWorkRules,
  type OfflineWorldReport,
} from '../work/OfflineWorkResources'

/** Saved travel/collection budget pays for every finite ground item, including short catch-up windows. */
export function recoverOfflineGroundTool(
  state: SerializedSave,
  player: SavePlayerState,
  playerIndex: number,
  unit: SaveEntityState,
  milliseconds: number,
  day: number,
  spatial: OfflineWorldSpatial,
  rules: OfflineWorkRules,
  report: OfflineWorldReport
): { status: 'inactive' | 'ready' | 'waiting' | 'blocked'; remainingMs: number } {
  const home = toolActivityAnchor(unit, player)
  if (
    !home ||
    !groundToolPlan(unit, player) ||
    unit.isChief ||
    unit.campPatrolAnchor ||
    unit.banditCampAnchor ||
    unit.followingHero ||
    (unit.action &&
      !['chopwood', 'minestone', 'minegold', 'minecopper', 'minetin', 'mineiron', 'build', 'farm'].includes(
        unit.action
      )) ||
    milliseconds <= 0
  )
    return { status: 'inactive', remainingMs: milliseconds }
  if (constructionToolPreparation(unit, player)) unit.collectiveHome = { i: home.i, j: home.j, spaceId: home.spaceId }
  let budget = milliseconds
  const area = { ...home, radius: VILLAGE_ACTIVITY_RADIUS }
  const config = rules.unitConfig(playerIndex, unit.type)
  while (true) {
    if (supplyTownTool(unit, player)) {
      delete unit.offlineWork
      stopOfflineTask(unit)
      if (!groundToolPlan(unit, player)) {
        unit.work = null
        return { status: 'ready', remainingMs: budget }
      }
      continue
    }
    const plan = groundToolPlan(unit, player)
    if (!plan) return { status: 'ready', remainingMs: budget }
    const missing = plan.missing
    if (
      missing.length &&
      missing.every(material => getUnitResourceCapacityRemaining(unit as unknown as UnitEntity, material) < 1)
    ) {
      const remaining = deliverOfflineInventory(player, unit, budget, config, spatial, state.players)
      if (remaining === budget) return { status: 'blocked', remainingMs: budget }
      budget = remaining
      if (budget <= 0) return { status: 'waiting', remainingMs: 0 }
      continue
    }
    const available = (resource: SaveEntityState) =>
      isLiving(resource) &&
      (resource.quantity ?? 0) > 0 &&
      (resource.spaceId ?? 'outside') === (unit.spaceId ?? 'outside') &&
      rules.isKnown?.(playerIndex, resource) !== false
    const previous = unit.offlineWork?.target
    const ordered = (targets: SaveEntityState[]) =>
      targets.sort(
        (a, b) =>
          Number(`ground-tool:${entityKey(b)}` === previous) - Number(`ground-tool:${entityKey(a)}` === previous)
      )
    const ground = spatial.nearestResources(
      unit,
      area,
      resource =>
        available(resource) &&
        ((resource.type === 'GroundWood' &&
          missing.includes('wood') &&
          getUnitResourceCapacityRemaining(unit as unknown as UnitEntity, 'wood') >= 1) ||
          (resource.type === 'GroundStone' &&
            missing.includes('stone') &&
            getUnitResourceCapacityRemaining(unit as unknown as UnitEntity, 'stone') >= 1))
    )
    let approach = spatial.resourceApproach(unit, ordered(ground), area)
    if (!approach) {
      const natural = spatial.nearestResources(
        unit,
        area,
        resource =>
          available(resource) &&
          ((resource.type === 'Tree' && missing.includes('wood') && ownsUsableTool(unit, 'axe')) ||
            (resource.type === 'Stone' && missing.includes('stone') && ownsUsableTool(unit, 'pickaxe')))
      )
      approach = spatial.resourceApproach(unit, ordered(natural), area)
    }
    if (!approach) {
      return recoverToolAtHome(player, unit, budget, config, spatial)
    }
    const { target, point, steps } = approach
    const key = `ground-tool:${entityKey(target)}`
    if (unit.offlineWork?.target === key) budget += unit.offlineWork.milliseconds
    const cost = travelMs({ i: 0, j: 0 }, { i: steps, j: 0 }, config)
    if (budget < cost) {
      unit.offlineWork = { target: key, milliseconds: budget }
      return { status: 'waiting', remainingMs: 0 }
    }
    budget -= cost
    delete unit.offlineWork
    spatial.move(unit, point)
    stopOfflineTask(unit)
    if (target.type === 'Tree' || target.type === 'Stone') {
      const wood = target.type === 'Tree'
      equipOwnedTool(unit, wood ? 'axe' : 'pickaxe')
      const work = wood ? 'woodcutter' : 'stoneminer'
      unit.action = wood ? 'chopwood' : 'minestone'
      unit.offlineWork = { target: key, milliseconds: 0 }
      const result = gatherOffline(
        {
          state,
          player,
          playerIndex,
          unit,
          target,
          day,
          spatial,
          rules,
          report,
          config: rules.unitConfig(playerIndex, unit.type),
          cycle: Math.max(1, rules.cycleMs(playerIndex, work, unit.action)),
          work,
          depot: undefined,
          stored: wood ? 'wood' : 'stone',
        },
        budget
      )
      stopOfflineTask(unit)
      budget = result.budget
      delete unit.offlineWork
      const nextPlan = groundToolPlan(unit, player)
      if (!nextPlan || nextPlan.ready || !nextPlan.missing.includes(wood ? 'wood' : 'stone')) continue
      if (result.status === 'wait') {
        unit.offlineWork = { target: key, milliseconds: budget }
        return { status: 'waiting', remainingMs: 0 }
      }
      if (result.status === 'skip') return { status: 'blocked', remainingMs: budget }
      continue
    }
    const material = target.type === 'GroundWood' ? 'wood' : 'stone'
    unit.inventory ??= {}
    unit.inventory.resources ??= {}
    unit.inventory.resources[material] = (unit.inventory.resources[material] ?? 0) + 1
    recordEconomyFlow(unit, 'gathered', { [material]: 1 })
    report.gathered[material] = (report.gathered[material] ?? 0) + 1
    target.quantity = (target.quantity ?? 0) - 1
    if (target.quantity === 0) {
      state.resources.splice(state.resources.indexOf(target), 1)
      spatial.release(target)
      report.resourcesDepleted++
      if (target.isNaturalResource) {
        state.naturalResourceRespawnSlots ??= []
        state.naturalResourceRespawnSlots.push({ ...target, depletedDay: day })
      }
    }
  }
}

function recoverToolAtHome(
  player: SavePlayerState,
  unit: SaveEntityState,
  budget: number,
  config: ReturnType<OfflineWorkRules['unitConfig']>,
  spatial: OfflineWorldSpatial
): { status: 'ready' | 'waiting' | 'blocked'; remainingMs: number } {
  // No reachable ingredients: a broken tool can still be replaced at home.
  // Keep the return budget between short catch-up windows.
  if (!unit.offlineWork?.target.startsWith('tool-return:')) delete unit.offlineWork
  returnOfflineWorkerForTool(player, unit, budget, config, spatial)
  if (!groundToolPlan(unit, player)) return { status: 'ready', remainingMs: 0 }
  return { status: unit.offlineWork?.target.startsWith('tool-return:') ? 'waiting' : 'blocked', remainingMs: 0 }
}
