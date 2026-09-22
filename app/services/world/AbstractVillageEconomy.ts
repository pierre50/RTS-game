import { needsStoragePit } from '../../lib/grid/storagePitPlacement'
import { ABSTRACT_VILLAGE_PRODUCTION } from '../../config/worldEconomyBalance'
import { villageBuildingNeeds, villageConstructionReserve } from '../../ai/AIDevelopmentPolicy'
import { getBuildingConfigForAge } from '../../lib/buildings/buildingAge'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import {
  VILLAGE_TARGET_PERCENTAGE_BY_AGE,
  MAX_INFANTRY_BY_AGE,
  MAX_ARCHER_BY_AGE,
  AI_DIFFICULTIES,
} from '../../ai/config'
import { AI_BUILDING_TRAINING_CAPACITY, AI_ABSTRACT_DAILY_RECRUITS } from '../../ai/config'
import { getUnitTrainingCost } from '../../lib/training/unitTrainingCost'
import { BUILDING_TYPES, UNIT_TYPES, DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants'
import { getVillagerSchedule } from '../../lib/units/villagerSchedule'
import {
  depositChestResources,
  getMissingPlayerResources,
  withdrawChestResources,
} from '../../lib/resources/playerResourceTotals'
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
  potential: ResourceAmount = {}
): void {
  if (!player.buildings?.some(b => b.type === BUILDING_TYPES.townCenter && b.isBuilt && isLiving(b))) return
  const owner = savedResourceOwner(player, state.players)
  if (unit.inventory?.resources && depositChestResources(owner, unit.inventory.resources, { automaticDelivery: true }))
    unit.inventory.resources = {}
  stopOfflineTask(unit)
  delete unit.offlineWork
  if (milliseconds <= 0) return
  const schedule = getVillagerSchedule(unit)
  const workdayMs = ((schedule.workEndMinute - schedule.workStartMinute) * DAY_NIGHT_CONFIG.dayLengthMs) / (24 * 60)
  const weights = VILLAGE_TARGET_PERCENTAGE_BY_AGE[Math.min(2, player.age ?? 0) as 0 | 1 | 2]
  const remainder = player.abstractProductionRemainder ?? {}
  const next = { ...remainder }
  const output: ResourceAmount = {}
  for (const [resource, dailyRate] of Object.entries(ABSTRACT_VILLAGE_PRODUCTION)) {
    const weight = resource in weights ? weights[resource as keyof typeof weights] / 100 : 1
    const regionalFactor = potential[resource as keyof ResourceAmount] ?? 1
    const amount =
      Math.round(
        ((remainder[resource] ?? 0) + (dailyRate * weight * regionalFactor * milliseconds) / workdayMs) * 1e6
      ) / 1e6
    const whole = Math.floor(amount)
    output[resource as keyof ResourceAmount] = whole
    next[resource] = Math.round((amount - whole) * 1e6) / 1e6
  }
  if (!depositChestResources(owner, output, { automaticDelivery: true })) return
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
      if (!config.cost) continue
      const cost = getUnitTrainingCost({ age: player.age, config: { units: { [type]: config } } }, type)
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
        const owner = savedResourceOwner(player, state.players)
        const foodReserve = workers.length * (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0) * 2
        const needs = villageBuildingNeeds({
          population: player.population ?? 0,
          populationMax: player.populationMax ?? 0,
          age,
          phase: player.aiState.phase,
          desiredBarracks: 1,
          buildings: player.buildings ?? [],
          storagePitNeeded: needsStoragePit(state.resources, player.buildings ?? []),
        })
        const reserve = villageConstructionReserve(
          needs,
          type => getBuildingConfigForAge(rules.buildingConfig(index, type), age).cost ?? {}
        )
        const required = { ...cost, food: (cost.food ?? 0) + foodReserve }
        for (const [resource, amount] of Object.entries(reserve)) {
          const key = resource as keyof ResourceAmount
          required[key] = (required[key] ?? 0) + amount
        }
        if (Object.keys(getMissingPlayerResources(owner, required, { includeHero: false })).length) break
        if (!withdrawChestResources(owner, cost, { includeHero: false })) break
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
          cost: { ...cost },
          loading: 0,
          trainingStartedDay: day,
          trainingCompleteDay: day + Math.max(1, Math.ceil(config.trainingDays ?? 1)),
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
