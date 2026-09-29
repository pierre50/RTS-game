import { activeConstructionSite } from '../../lib/economy/collectiveConstruction'
import { automaticDepositAmount } from '../../lib/resources/resourceDelivery'
import { isFoodReserveResource } from '../../lib/economy/depotReserves'
import { materialAmount } from '../../lib/economy/constructionMaterials'
import { personalFoodReserve } from '../../lib/economy/villagerProvisions'
import { getUnitResourceCarryRemaining } from '../../lib/resources/resourceDelivery'
import type { UnitEntity } from '../../types/entities'
import {
  collectiveAnchor,
  belongsToSettlement,
  settlementPopulation,
  settlementStockGoals,
  collectiveHarvestBudget,
} from '../../lib/economy/collectiveTasks'
import { collectiveNeeds } from '../../lib/economy/collectiveNeeds'
import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import { getTrainingDurationDays } from '../../lib/training/trainingRules'
import { ABSTRACT_VILLAGE_PRODUCTION } from '../../config/worldEconomyBalance'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { MAX_INFANTRY_BY_AGE, MAX_ARCHER_BY_AGE, AI_DIFFICULTIES } from '../../ai/config'
import { AI_BUILDING_TRAINING_CAPACITY, AI_ABSTRACT_DAILY_RECRUITS } from '../../ai/config'
import { BUILDING_TYPES, UNIT_TYPES } from '../../constants'
import { getVillagerSchedule } from '../../lib/units/villagerSchedule'
import { depositChestResources } from '../../lib/resources/playerResourceTotals'
import {
  isOfflineWorker,
  savedResourceOwner,
  stopOfflineTask,
  type OfflineWorkRules,
  type OfflineWorldReport,
} from './OfflineWorldWork'
import { isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import type { SaveEntityState, SavePlayerState, SerializedSave } from '../../types/save'
import type { ResourceAmount } from '../../types/common'

/** Regional output deliberately does not consume individual visible resource nodes. */
export function produceAbstractVillage(
  state: SerializedSave,
  player: SavePlayerState,
  unit: SaveEntityState,
  milliseconds: number,
  report: OfflineWorldReport,
  potential: ResourceAmount = {},
  _rules?: OfflineWorkRules,
  _playerIndex = 0
): void {
  if (!player.buildings?.some(b => b.type === BUILDING_TYPES.townCenter && b.isBuilt && isLiving(b))) return
  const anchor = collectiveAnchor(player, unit)
  const allStores = savedResourceOwner(player, state.players)
  const owner = {
    ...allStores,
    buildings: allStores.buildings?.filter(building => belongsToSettlement(player, anchor, building)),
  }
  const population = settlementPopulation(player, anchor)
  for (const [key, amount] of Object.entries(unit.inventory?.resources ?? {})) {
    const transferable = automaticDepositAmount(
      { ...unit, owner: player } as unknown as UnitEntity,
      key as keyof ResourceAmount
    )
    if (transferable > 0 && depositChestResources(owner, { [key]: transferable }, { automaticDelivery: true }))
      unit.inventory!.resources![key as keyof ResourceAmount] = amount - transferable
  }
  stopOfflineTask(unit)
  delete unit.offlineWork
  if (milliseconds <= 0) return
  const schedule = getVillagerSchedule(unit)
  const workdayMs = ((schedule.workEndMinute - schedule.workStartMinute) * DAY_NIGHT_CONFIG.dayLengthMs) / (24 * 60)
  const site = activeConstructionSite(player, unit)
  const projects = settlementStockGoals(player, anchor, site)
  const remainder = player.abstractProductionRemainder ?? {}
  const next = { ...remainder }
  const output: ResourceAmount = {}
  let remainingMs = milliseconds
  const needs = collectiveNeeds(population, projects, getPlayerResourceTotals(owner, { includeHero: false }))
  if (unit.collectiveTask === 'food') {
    const food = needs.find(need => need.resource === 'food')!
    food.missing = Math.max(
      food.missing,
      personalFoodReserve() - materialAmount(unit.inventory?.resources ?? {}, 'food')
    )
  }
  for (const need of needs) {
    const resource = need.resource
    need.missing = collectiveHarvestBudget(
      player,
      unit.collectiveTask ? unit : { ...unit, collectiveTask: resource },
      resource,
      Boolean(site)
    )
    if (unit.collectiveTask && unit.collectiveTask !== resource) continue
    const remainderKey = `${anchor.i},${anchor.j}:${resource}`
    const dailyRate =
      ABSTRACT_VILLAGE_PRODUCTION[
        (isFoodReserveResource(resource) ? 'food' : resource) as keyof typeof ABSTRACT_VILLAGE_PRODUCTION
      ] ?? 0
    const rate = (dailyRate * (potential[resource] ?? 1)) / workdayMs
    if (need.missing <= 0) {
      next[remainderKey] = 0
      continue
    }
    if (remainingMs <= 0 || rate <= 0) continue
    const fraction = Math.min(remainder[remainderKey] ?? 0, need.missing)
    const spent = Math.min(remainingMs, Math.max(0, need.missing - fraction) / rate)
    const amount = Math.min(need.missing, Math.round((fraction + spent * rate) * 1e6) / 1e6)
    let whole = Math.floor(amount)
    unit.inventory ??= {}
    const bag = (unit.inventory.resources ??= {})
    const provisions =
      resource === 'food' || isFoodReserveResource(resource)
        ? Math.min(
            whole,
            Math.max(0, personalFoodReserve() - materialAmount(bag, 'food')),
            getUnitResourceCarryRemaining(unit as unknown as UnitEntity)
          )
        : 0
    if (provisions > 0) {
      const food = isFoodReserveResource(resource) ? resource : 'wheat'
      bag[food] = (bag[food] ?? 0) + provisions
    }
    const toStore = whole - provisions
    if (toStore > 0 && (site || !depositChestResources(owner, { [resource]: toStore }, { automaticDelivery: true }))) {
      const carriedAmount = Math.min(toStore, getUnitResourceCarryRemaining(unit as unknown as UnitEntity))
      const carried = resource === 'food' ? 'wheat' : resource
      bag[carried] = (bag[carried] ?? 0) + carriedAmount
      whole = provisions + carriedAmount
    }
    output[resource] = whole
    next[remainderKey] = Math.round((amount - Math.floor(amount)) * 1e6) / 1e6
    remainingMs -= spent
  }
  player.abstractProductionRemainder = next
  for (const [resource, count] of Object.entries(output))
    report.gathered[resource as keyof ResourceAmount] = (report.gathered[resource as keyof ResourceAmount] ?? 0) + count
}

export function planAbstractTraining(
  state: SerializedSave,
  day: number,
  rules: OfflineWorkRules,
  spatial: OfflineWorldSpatial
): void {
  state.players.forEach((player, index) => {
    if (player.type !== 'AI' || player.aiState?.phase !== 'military_build') return
    const workers = (player.units ?? []).filter(isOfflineWorker)
    const difficulty =
      AI_DIFFICULTIES[state.config?.difficulty as keyof typeof AI_DIFFICULTIES] ?? AI_DIFFICULTIES.medium
    const reserveWorkers = Math.max(4, Math.ceil(difficulty.econToMilVillagers * 0.6))
    const age = Math.min(2, player.age ?? 0) as 0 | 1 | 2
    let budget = Math.min(AI_ABSTRACT_DAILY_RECRUITS, workers.length - reserveWorkers)
    for (const [type, buildingType, cap] of [
      [UNIT_TYPES.infantry, BUILDING_TYPES.barracks, MAX_INFANTRY_BY_AGE[age]],
      [UNIT_TYPES.bowman, BUILDING_TYPES.archeryRange, MAX_ARCHER_BY_AGE[age]],
    ] as const) {
      const config = rules.unitConfig(index, type)
      const queued = (player.buildings ?? [])
        .flatMap(b => b.trainingQueue ?? [])
        .filter(entry => entry.type === type).length
      let need =
        cap -
        queued -
        (player.units ?? []).filter(u => isLiving(u) && (u.type === type || u.trainingTargetType === type)).length
      for (const worker of workers) {
        if (budget <= 0 || need <= 0) break
        if (worker.autonomousJob === 'construction' || worker.work === 'builder' || !player.units?.includes(worker))
          continue
        const building = player.buildings?.find(
          b =>
            b.type === buildingType &&
            b.isBuilt &&
            isLiving(b) &&
            (b.trainingQueue?.length ?? 0) < AI_BUILDING_TRAINING_CAPACITY
        )
        if (!building || !worker.label) continue
        const trainee = {
          type: worker.type,
          label: worker.label,
          i: worker.i,
          j: worker.j,
          ...(worker.name !== undefined ? { name: worker.name } : {}),
          gender: worker.gender,
          appearanceVariants: worker.appearanceVariants,
          ...(worker.inventory !== undefined ? { inventory: structuredClone(worker.inventory) } : {}),
        }
        building.trainingQueue ??= []
        building.trainingQueue.push({
          type,
          trainee,
          cost: {},
          loading: 0,
          trainingStartedDay: day,
          trainingCompleteDay: day + getTrainingDurationDays(config),
        })
        building.queue = building.trainingQueue.map(entry => entry.type)
        building.loading = building.trainingQueue[0].loading
        building.trainingStartedDay = building.trainingQueue[0].trainingStartedDay
        building.trainingCompleteDay = building.trainingQueue[0].trainingCompleteDay
        spatial.release(worker)
        player.units.splice(player.units.indexOf(worker), 1)
        budget--
        need--
      }
    }
  })
}
