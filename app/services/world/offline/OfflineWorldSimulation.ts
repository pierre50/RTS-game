import { initializeConstructionProgress } from '../../../lib/economy/constructionMaterials'
import { getBuildingConfigForLevel } from '../../../lib/buildings/buildingLevel'
import { getVacantHomeCount, reconcileHouseholds } from '../../../lib/housing/households'
import { refreshPopulationCapacity } from '../../../lib/buildings/buildingOccupancy'
import { configureVillageNightWatch } from '../../../lib/units/villageNightWatch'
import { isStaticSettlement } from '../../../config/settlementProfiles'
import { startingVillagerInventory } from '../../../lib/economy/startingProvisions'
import { advanceOfflineTrainingRequests } from './OfflineTrainingRequests'
import { consumeVillagerMeals } from '../../../lib/economy/villagerMeals'
import { planOfflineCollectiveWork } from './OfflineCollectiveWork'
import { regrowOfflineResources } from './OfflineWorldResources'
import { planAbstractTraining } from '../distantVillages/AbstractVillageEconomy'
import { planOfflineBuildings, restoreOfflineBuilders } from './OfflineWorldBuildingPlanner'
import { DAY_NIGHT_CONFIG } from '../../../config/gameplay'
import { BUILDING_TYPES, PLAYER_TYPES, UNIT_TYPES } from '../../../constants/entities'
import { expandLegacyFoodAmount, getPlayerResourceTotals } from '../../../lib/resources/playerResourceTotals'
import { restoreOfflineUnitSleepHealth } from '../../../lib/units/unitSleepHealth'
import { getVillagerWorkingMinutes } from '../../../lib/units/villagerSchedule'
import type { SaveEntityState, SerializedSave } from '../../../types/save'
import { calculateVillagerArrivals } from '../VillagerArrivalSystem'
import { completeOfflineTraining } from './OfflineWorldTraining'
import { applyOfflineDailyEvents } from './OfflineWorldEvents'
import { savedBuildingsWithInteriors } from '../../../serialization/InteriorBuildingSave'
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
  /** Shared-map villages leave world events and training to their live owners. */
  runtimeOwnsDailyEvents?: boolean
  /** Shared-map dormant villages still own their population/markets, but not resource growth. */
  runtimeOwnsResourceRenewal?: boolean
  runtimeOwnsTraining?: boolean
  /** Meals must follow work chronologically during shared-map catch-up. */
  runtimeOwnsMeals?: boolean
  /** Active settlements use autonomous priorities, including residents carrying legacy jobs. */
  autonomousResidents?: boolean
  spatialOptions?: ConstructorParameters<typeof OfflineWorldSpatial>[3]
}

const HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
const MINUTE_MS = HOUR_MS / 60
const DAY_MINUTES = DAY_NIGHT_CONFIG.hoursPerDay * 60
const NEW_DAY_MINUTE = DAY_NIGHT_CONFIG.newDayHour * 60

function dayAt(minute: number): number {
  return Math.max(1, Math.floor((minute - NEW_DAY_MINUTE) / DAY_MINUTES) + 1)
}

function dailyPopulation(
  state: SerializedSave,
  day: number,
  spatial: OfflineWorldSpatial,
  options: SimulationOptions,
  report: OfflineWorldReport
): void {
  state.players.forEach((player, playerIndex) => {
    if (isStaticSettlement(player)) return
    if (player.type !== PLAYER_TYPES.human && player.type !== PLAYER_TYPES.ai) return
    reconcileHouseholds(player)
    refreshPopulationCapacity(player)
    const centers = (player.buildings ?? []).filter(
      building => building.type === BUILDING_TYPES.townCenter && building.isBuilt && isLiving(building)
    )
    if (!centers.length) return
    if (options.dailyFactors?.(playerIndex, day).arrivalsAllowed === false) return
    const count = calculateVillagerArrivals({
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
    const arrivals = Math.min(count, getVacantHomeCount(player))
    for (let index = 0; index < arrivals; index++) {
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
        inventory: startingVillagerInventory(),
        inactif: true,
        action: null,
        dest: null,
        path: [],
      }
      player.units.push(unit)
      reconcileHouseholds(player)
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
  for (const [playerIndex, owner] of state.players.entries()) {
    configureVillageNightWatch(owner)
    for (const building of savedBuildingsWithInteriors(owner.buildings ?? [])) {
      if (!building.isBuilt && building.constructionWorkRequired == null) {
        const config = getBuildingConfigForLevel(
          options.buildingConfig(playerIndex, building.type),
          building.buildingLevel ?? 0
        )
        building.totalHitPoints ??= config.totalHitPoints
        building.constructionTime ??= config.constructionTime
      }
      initializeConstructionProgress(building)
    }
  }
  report.elapsedMs = toElapsedMs - fromElapsedMs
  const spatial = new OfflineWorldSpatial(
    options.terrain,
    state,
    (building, index) => Number(options.buildingConfig(index, building.type).size) || 1,
    options.spatialOptions
  )
  // Keep original player indices for configuration lookup, but exclude RPG settlements
  // once rather than reconsidering them at every fifteen-minute catch-up step.
  const economicPlayers = state.players
    .map((player, playerIndex) => ({ player, playerIndex }))
    .filter(({ player }) => !isStaticSettlement(player))
  for (const { player } of economicPlayers) {
    for (const entity of [...savedBuildingsWithInteriors(player.buildings ?? []), ...(player.units ?? [])]) {
      if (entity.inventory?.resources?.food)
        entity.inventory.resources = expandLegacyFoodAmount(entity.inventory.resources)
    }
  }
  let cursor = DAY_NIGHT_CONFIG.startHour * 60 + fromElapsedMs / MINUTE_MS
  const end = DAY_NIGHT_CONFIG.startHour * 60 + toElapsedMs / MINUTE_MS
  if (options.planBuildings && fromElapsedMs === 0)
    planOfflineBuildings(state, dayAt(cursor), options.terrain, options, spatial)
  if (!options.runtimeOwnsTraining) completeOfflineTraining(state, dayAt(cursor), spatial, options, report)
  while (cursor < end) {
    if (options.planBuildings) restoreOfflineBuilders(state)
    const boundary = (Math.floor((cursor - NEW_DAY_MINUTE) / DAY_MINUTES) + 1) * DAY_MINUTES + NEW_DAY_MINUTE
    const next = Math.min(end, cursor + 15, boundary)
    economicPlayers.forEach(({ player, playerIndex }) => {
      if (!options.runtimeOwnsTraining)
        advanceOfflineTrainingRequests(player, playerIndex, dayAt(cursor), cursor, next, MINUTE_MS, spatial, options)
      if (player.type === PLAYER_TYPES.ai || player.type === PLAYER_TYPES.human)
        planOfflineCollectiveWork(player, options.autonomousResidents, {
          resources: [...state.resources, ...(state.animals ?? []).filter(animal => animal.isDead)],
          spatial,
          rules: options,
          playerIndex,
        })
      for (const unit of player.units ?? []) {
        restoreOfflineUnitSleepHealth(unit, cursor, next)
        if (!isOfflineWorker(unit)) continue
        const efficiency = options.dailyFactors?.(playerIndex, dayAt(cursor)).workEfficiency ?? 1
        const milliseconds = getVillagerWorkingMinutes(unit, cursor, next) * MINUTE_MS * efficiency
        // Loaded and detached villages harvest the same finite nodes. Visibility
        // must never turn a depleted deposit into an unlimited regional supply.
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
    if (!(options.runtimeOwnsMeals ?? options.runtimeOwnsDailyEvents)) {
      for (const { player } of economicPlayers)
        for (const unit of player.units ?? []) {
          const meal = consumeVillagerMeals(
            unit,
            cursor,
            next,
            cursor === DAY_NIGHT_CONFIG.startHour * 60 + fromElapsedMs / MINUTE_MS
          )
          report.foodConsumed += meal.consumed
          report.foodShortage += meal.needed - meal.consumed
        }
    }
    // Rest transitions belong to simulation time, not to the caller's catch-up boundaries.
    for (const { player } of economicPlayers)
      for (const unit of player.units ?? [])
        if (isOfflineWorker(unit) && getVillagerWorkingMinutes(unit, next, next + 1) === 0) stopOfflineTask(unit)
    cursor = next
    if (!options.runtimeOwnsTraining) completeOfflineTraining(state, dayAt(cursor), spatial, options, report)
    if (cursor === boundary) {
      if (!options.runtimeOwnsDailyEvents) {
        if (!options.runtimeOwnsResourceRenewal)
          regrowOfflineResources(state, dayAt(cursor), spatial, options.wheatMatureFrame, report)
        applyOfflineDailyEvents(state, dayAt(cursor), spatial, options, report)
        dailyPopulation(state, dayAt(cursor), spatial, options, report)
      }
      if (options.planBuildings) planOfflineBuildings(state, dayAt(cursor), options.terrain, options, spatial)
      if (options.abstractVillages && !options.runtimeOwnsTraining)
        planAbstractTraining(state, dayAt(cursor), options, spatial)
    }
  }
  if (options.planBuildings) restoreOfflineBuilders(state)
  for (const { player } of economicPlayers) {
    Object.assign(player, getPlayerResourceTotals(savedResourceOwner(player, state.players), { includeHero: false }))
    delete player.villagerAssignments
  }
  state.runtime = { ...state.runtime, dayNightElapsedMs: toElapsedMs }
  delete state.runtime.offlineFromElapsedMs
  return report
}
