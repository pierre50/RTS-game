import { regrowOfflineResources } from './OfflineWorldResources'
import { produceAbstractVillage, planAbstractTraining } from './AbstractVillageEconomy'
import { planOfflineBuildings, restoreOfflineBuilders } from './OfflineWorldBuildingPlanner'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { BUILDING_TYPES, PLAYER_TYPES, UNIT_TYPES } from '../../constants/entities'
import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants/consumption'
import {
  expandLegacyFoodAmount,
  getPlayerResourceTotals,
  withdrawChestResources,
} from '../../lib/resources/playerResourceTotals'
import { restoreOfflineUnitSleepHealth } from '../../lib/units/unitSleepHealth'
import { getVillagerSchedule } from '../../lib/units/villagerSchedule'
import type { SaveEntityState, SerializedSave } from '../../types/save'
import { calculateVillagerArrivals } from './VillagerArrivalSystem'
import { completeOfflineTraining } from './OfflineWorldTraining'
import { applyOfflineDailyEvents } from './OfflineWorldEvents'
import { savedBuildingsWithInteriors } from '../../serialization/InteriorBuildingSave'
import { isLiving, OfflineWorldSpatial, type OfflineTerrainCell } from './OfflineWorldSpatial'
import {
  advanceOfflineWorker,
  deliverOfflineInventory,
  isOfflineWorker,
  savedResourceOwner,
  stopOfflineTask,
  type OfflineWorkRules,
  type OfflineWorldReport,
} from './OfflineWorldWork'

type SimulationOptions = OfflineWorkRules & {
  fromElapsedMs: number
  toElapsedMs: number
  terrain: (OfflineTerrainCell | null | undefined)[][]
}

const HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
const MINUTE_MS = HOUR_MS / 60
const DAY_MINUTES = DAY_NIGHT_CONFIG.hoursPerDay * 60
const NEW_DAY_MINUTE = DAY_NIGHT_CONFIG.newDayHour * 60

function dayAt(minute: number): number {
  return Math.max(1, Math.floor((minute - NEW_DAY_MINUTE) / DAY_MINUTES) + 1)
}

function workingMs(unit: SaveEntityState, from: number, to: number): number {
  const { workStartMinute, workEndMinute } = getVillagerSchedule(unit)
  let minutes = 0
  for (let day = Math.floor(from / DAY_MINUTES); day <= Math.floor(to / DAY_MINUTES); day++) {
    minutes += Math.max(
      0,
      Math.min(to, day * DAY_MINUTES + workEndMinute) - Math.max(from, day * DAY_MINUTES + workStartMinute)
    )
  }
  return minutes * MINUTE_MS
}

function dailyPopulation(
  state: SerializedSave,
  day: number,
  spatial: OfflineWorldSpatial,
  options: SimulationOptions,
  report: OfflineWorldReport
): void {
  state.players.forEach((player, playerIndex) => {
    const villagers = (player.units ?? []).filter(
      unit => unit.type === UNIT_TYPES.villager && isLiving(unit) && !unit.followingHero && unit.controlMode !== 'hero'
    ).length
    const owner = savedResourceOwner(player, state.players)
    const needed = villagers * (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0)
    const consumed = Math.min(needed, getPlayerResourceTotals(owner, { includeHero: false }).food)
    if (consumed > 0) withdrawChestResources(owner, { food: consumed }, { includeHero: false })
    report.foodConsumed += consumed
    report.foodShortage += needed - consumed
    if (player.type !== PLAYER_TYPES.human && player.type !== PLAYER_TYPES.ai) return
    const centers = (player.buildings ?? []).filter(
      building => building.type === BUILDING_TYPES.townCenter && building.isBuilt && isLiving(building)
    )
    if (!centers.length) return
    if (options.dailyFactors?.(playerIndex, day).arrivalsAllowed === false) return
    const count = calculateVillagerArrivals({
      foodAvailable: getPlayerResourceTotals(owner, { includeHero: false }).food,
      population: Math.max(
        0,
        (player.population ?? 0) -
          (player.units ?? []).filter(
            unit =>
              isLiving(unit) && (unit.type === UNIT_TYPES.hero || unit.controlMode === 'hero' || unit.followingHero)
          ).length
      ),
      populationMax: player.populationMax ?? 0,
    })
    player.units ??= []
    for (let index = 0; index < count; index++) {
      const center = centers[index % centers.length]
      if (!center) continue
      const point = spatial.findNear(center)
      if (!point) continue
      const worldId = state.world?.worldRegionId ?? state.config?.worldRegionId ?? state.world?.seed ?? 'world'
      const prefix = `offline-villager:${worldId}:${player.label ?? playerIndex}:${day}:${index}`
      let label = prefix
      let suffix = 0
      while (player.units.some(unit => unit.label === label)) label = `${prefix}:${++suffix}`
      const gender = (day + index + playerIndex) % 2 ? 'female' : 'male'
      const config = options.unitConfig(playerIndex, UNIT_TYPES.villager)
      const unit: SaveEntityState = {
        ...point,
        type: UNIT_TYPES.villager,
        label,
        gender,
        appearanceVariants: { gender },
        hitPoints: Number(config.totalHitPoints) || 18,
        totalHitPoints: Number(config.totalHitPoints) || 18,
        inactif: true,
        action: null,
        dest: null,
        path: [],
      }
      player.units.push(unit)
      spatial.reserve(unit)
      player.population = (player.population ?? 0) + 1
      report.arrivals++
    }
  })
}

/** Mutates only the destination save clone, before runtime entities and their daily listeners exist. */
export function simulateOfflineWorld(state: SerializedSave, options: SimulationOptions): OfflineWorldReport {
  const { fromElapsedMs, toElapsedMs } = options
  const report: OfflineWorldReport = {
    elapsedMs: 0,
    gathered: {},
    foodConsumed: 0,
    foodShortage: 0,
    arrivals: 0,
    buildingsCompleted: 0,
    resourcesDepleted: 0,
    resourcesRespawned: 0,
    trainingsCompleted: 0,
    animalsRevived: 0,
    animalsMoved: 0,
    marketsRestocked: 0,
    trapsFilled: 0,
  }
  if (
    !Number.isFinite(fromElapsedMs) ||
    !Number.isFinite(toElapsedMs) ||
    fromElapsedMs < 0 ||
    toElapsedMs <= fromElapsedMs ||
    state.world?.mapType === 'interior' ||
    state.config?.mapType === 'interior'
  )
    return report
  report.elapsedMs = toElapsedMs - fromElapsedMs
  const spatial = new OfflineWorldSpatial(
    options.terrain,
    state,
    (building, index) => Number(options.buildingConfig(index, building.type).size) || 1
  )
  for (const player of state.players) {
    for (const entity of [...savedBuildingsWithInteriors(player.buildings ?? []), ...(player.units ?? [])]) {
      if (entity.inventory?.resources?.food)
        entity.inventory.resources = expandLegacyFoodAmount(entity.inventory.resources)
    }
  }
  let cursor = DAY_NIGHT_CONFIG.startHour * 60 + fromElapsedMs / MINUTE_MS
  const end = DAY_NIGHT_CONFIG.startHour * 60 + toElapsedMs / MINUTE_MS
  if (options.planBuildings && fromElapsedMs === 0)
    planOfflineBuildings(state, dayAt(cursor), options.terrain, options, spatial)
  completeOfflineTraining(state, dayAt(cursor), spatial, options, report)
  while (cursor < end) {
    if (options.planBuildings) restoreOfflineBuilders(state)
    const boundary = (Math.floor((cursor - NEW_DAY_MINUTE) / DAY_MINUTES) + 1) * DAY_MINUTES + NEW_DAY_MINUTE
    const next = Math.min(end, cursor + 15, boundary)
    state.players.forEach((player, playerIndex) => {
      for (const unit of player.units ?? []) {
        restoreOfflineUnitSleepHealth(unit, cursor, next)
        if (!isOfflineWorker(unit)) continue
        const efficiency = options.dailyFactors?.(playerIndex, dayAt(cursor)).workEfficiency ?? 1
        const milliseconds = workingMs(unit, cursor, next) * efficiency
        if (
          options.abstractVillages &&
          player.type === PLAYER_TYPES.ai &&
          unit.autonomousJob !== 'construction' &&
          unit.work !== 'builder'
        ) {
          produceAbstractVillage(state, player, unit, milliseconds, report, options.abstractPotential)
          continue
        }
        if (milliseconds > 0)
          advanceOfflineWorker(state, player, playerIndex, unit, milliseconds, dayAt(cursor), spatial, options, report)
        else
          deliverOfflineInventory(
            player,
            unit,
            (next - cursor) * MINUTE_MS,
            options.unitConfig(playerIndex, unit.type),
            spatial,
            state.players
          )
      }
    })
    cursor = next
    if (cursor === boundary) {
      completeOfflineTraining(state, dayAt(cursor), spatial, options, report)
      regrowOfflineResources(state, dayAt(cursor), spatial, options.wheatMatureFrame, report)
      applyOfflineDailyEvents(state, dayAt(cursor), spatial, options, report)
      dailyPopulation(state, dayAt(cursor), spatial, options, report)
      if (options.planBuildings) planOfflineBuildings(state, dayAt(cursor), options.terrain, options, spatial)
      if (options.abstractVillages) planAbstractTraining(state, dayAt(cursor), options, spatial)
    }
  }
  const minute = end % DAY_MINUTES
  if (options.planBuildings) restoreOfflineBuilders(state)
  for (const player of state.players) {
    for (const unit of player.units ?? []) {
      if (!isOfflineWorker(unit)) continue
      const schedule = getVillagerSchedule(unit)
      if (minute < schedule.workStartMinute || minute >= schedule.workEndMinute) stopOfflineTask(unit)
    }
    Object.assign(player, getPlayerResourceTotals(savedResourceOwner(player, state.players), { includeHero: false }))
    delete player.villagerAssignments
  }
  state.runtime = { ...state.runtime, dayNightElapsedMs: toElapsedMs }
  delete state.runtime.offlineFromElapsedMs
  return report
}
