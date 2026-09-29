import { TYPE_ACTION } from '../../constants/entities'
import { activeConstructionSite } from '../../lib/economy/collectiveTasks'
import { materialAmount } from '../../lib/economy/constructionMaterials'
import { communalStoreBuilding } from '../../lib/economy/constructionStores'
import { withdrawDepotResources } from '../../lib/economy/depotPickup'
import { personalFoodReserve } from '../../lib/economy/villagerProvisions'
import { getUnitResourceCarryRemaining } from '../../lib/resources/resourceDelivery'
import { savedBuildingsOwnedBy } from '../../serialization/InteriorBuildingSave'
import type { UnitEntity } from '../../types/entities'
import type { SaveEntityState, SavePlayerState, SerializedSave } from '../../types/save'
import { distance, entityKey, isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import { buildOffline, gatherOffline } from './work/OfflineWorkImpacts'
import type { OfflineWorkRules, OfflineWorldReport } from './work/OfflineWorkResources'
import {
  clearMovement,
  corpseResource,
  deliverOfflineInventory,
  depotFor,
  destinationLabel,
  offlineResourceWork,
  RESOURCE_WORK,
  stopOfflineTask,
  storedResource,
  travelMs,
} from './work/OfflineWorkResources'
export {
  deliverOfflineInventory,
  isOfflineWorker,
  offlineResourceWork,
  type OfflineWorkRules,
  type OfflineWorldReport,
  savedResourceOwner,
  stopOfflineTask,
  travelMs,
} from './work/OfflineWorkResources'

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
  if (unit.resourceDelivery?.pickup) {
    const delivery = unit.resourceDelivery
    const reference = delivery.building
    const label = typeof reference === 'string' ? reference : Array.isArray(reference) ? reference[2] : undefined
    const depot = player.buildings?.find(building => building.label === label && isLiving(building) && building.isBuilt)
    const point = depot && spatial.reachable(unit, depot) && spatial.findNear(depot, 6, unit)
    if (!depot || !point) {
      delete unit.resourceDelivery
      return
    }
    const key = `pickup:${entityKey(depot)}`
    const budget = milliseconds + (unit.offlineWork?.target === key ? unit.offlineWork.milliseconds : 0)
    const duration = travelMs(unit, point, config) + 1000
    if (budget < duration) {
      unit.offlineWork = { target: key, milliseconds: budget }
      return
    }
    spatial.move(unit, point)
    const stores = savedBuildingsOwnedBy(player, state.players)
    const chest = stores.find(
      store => store.type === 'Chest' && communalStoreBuilding(store, { ...player, buildings: stores }) === depot
    )
    withdrawDepotResources(unit, (chest ?? depot).inventory?.resources ?? {}, delivery.pickup ?? {})
    delete unit.resourceDelivery
    delete unit.offlineWork
    stopOfflineTask(unit)
    return
  }
  let budget =
    unit.collectiveTask === 'construction'
      ? milliseconds
      : deliverOfflineInventory(player, unit, milliseconds, config, spatial, state.players)
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
    (buildingTask
      ? (player.buildings ?? [])
      : [...state.resources, ...(state.animals ?? []).filter(animal => animal.isDead)]
    )
      .filter(validTarget)
      .sort((a, b) => {
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
    const stored = storedResource(unit, target)
    const needsProvisions =
      stored &&
      ['wheat', 'berry', 'meat'].includes(stored) &&
      materialAmount(unit.inventory?.resources ?? {}, 'food') < personalFoodReserve()
    const depot =
      !buildingTask && stored && !needsProvisions && !activeConstructionSite(player, unit)
        ? depotFor(player, stored, unit, spatial)
        : undefined
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
    unit.action = buildingTask
      ? 'build'
      : corpseResource(unit, target)
        ? 'takemeat'
        : TYPE_ACTION[target.type as keyof typeof TYPE_ACTION]
    unit.inactif = false
    const cycle = Math.max(1, rules.cycleMs(playerIndex, work, unit.action ?? undefined))
    if (buildingTask || stored) {
      const step = {
        state,
        player,
        playerIndex,
        unit,
        target,
        day,
        spatial,
        rules,
        report,
        config,
        cycle,
        work,
        depot,
        stored: stored ?? 'wood',
      }
      const result = buildingTask ? buildOffline(step, budget) : gatherOffline(step, budget)
      budget = result.budget
      if (result.status === 'next') findMore()
      if (result.status !== 'wait') continue
    }
    unit.offlineWork.milliseconds = budget
    return
  }
  delete unit.offlineWork
  stopOfflineTask(unit)
}
