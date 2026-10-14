import { recoverOfflineGroundTool } from './OfflineGroundRecovery'
import { returnOfflineWorkerForTool } from './OfflineToolReturn'
import { supplyTownTool, supplyTownWeapons } from '../../../lib/units/supplies/townToolSupply'
import { bindEconomyActors, withOfflineEconomyTelemetry } from '../../../lib/economy/economyTelemetry'
import { supplyTownArrows } from '../../../lib/units/supplies/townArrowSupply'
import { initializeNpcArrows, replenishNpcArrows } from '../../../lib/units/combat/unitArrows'
import { reconcileSettlementResidents } from '../../../lib/territory/settlementResidents'
import { initializeConstructionProgress } from '../../../lib/economy/constructionMaterials'
import { getBuildingConfigForLevel } from '../../../lib/buildings/buildingLevel'
import { reconcileHouseholds } from '../../../lib/housing/households'
import { refreshPopulationCapacity } from '../../../lib/buildings/buildingOccupancy'
import { configureVillageNightWatch } from '../../../lib/units/village/villageNightWatch'
import { isStaticSettlement } from '../../../config/world/settlementProfiles'
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
import { getVillagerWorkingMinutes } from '../../../lib/units/village/villagerSchedule'
import type { SaveEntityState, SerializedSave } from '../../../types/save'
import { planVillagerArrivals } from '../../../lib/population/villagerArrivals'
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
    player.units ??= []
    let index = 0
    for (const plan of planVillagerArrivals(player)) {
      for (let arrival = 0; arrival < plan.count; arrival++) {
        index++
        const destination = plan.homes.slice(arrival, arrival + 1).flatMap(({ center, home, bed }) => {
          const point = spatial.findNear(center as SaveEntityState)
          return point ? [{ center, home, bed, point }] : []
        })[0]
        if (!destination) continue
        const { center, home, bed, point } = destination
        const worldId = state.world?.worldRegionId ?? state.config?.worldRegionId ?? state.world?.seed ?? 'world'
        const prefix = `offline-villager:${worldId}:${player.label ?? playerIndex}:${day}:${index}`
        let label = prefix
        let suffix = 0
        while (player.units.some(unit => unit.label === label)) label = `${prefix}:${++suffix}`
        const gender = (day + index + playerIndex) % 2 ? 'female' : 'male'
        const config = options.unitConfig(playerIndex, UNIT_TYPES.villager)
        const unit: SaveEntityState = {
          ...point,
          villageHome: {
            id: `${player.label}:${center.label}`,
            i: center.i ?? point.i,
            j: center.j ?? point.j,
            spaceId: center.spaceId ?? 'outside',
          },
          homeHouseLabel: home.label,
          homeBedLabel: bed,
          type: UNIT_TYPES.villager,
          label,
          gender,
          appearanceVariants: { gender },
          hitPoints: Number(config.totalHitPoints) || 18,
          totalHitPoints: Number(config.totalHitPoints) || 18,
          inventory: startingVillagerInventory(player.units, point),
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
    }
  })
}

/** Mutates only the destination save clone, before runtime entities and their daily listeners exist. */
export function simulateOfflineWorld(state: SerializedSave, options: SimulationOptions): OfflineWorldReport {
  return withOfflineEconomyTelemetry(state.players, options.fromElapsedMs, options.toElapsedMs, () =>
    simulateOfflineWorldSteps(state, options)
  )
}
function simulateOfflineWorldSteps(state: SerializedSave, options: SimulationOptions): OfflineWorldReport {
  const { fromElapsedMs, toElapsedMs } = options
  const report = emptyOfflineReport()
  if (
    !Number.isFinite(fromElapsedMs) ||
    !Number.isFinite(toElapsedMs) ||
    fromElapsedMs < 0 ||
    toElapsedMs <= fromElapsedMs ||
    state.world?.mapType === 'interior' ||
    state.config?.mapType === 'interior'
  )
    return report
  prepareOfflineConstruction(state, options)
  report.elapsedMs = toElapsedMs - fromElapsedMs
  const spatial = new OfflineWorldSpatial(
    options.terrain,
    state,
    (building, index) => Number(options.buildingConfig(index, building.type).size) || 1,
    options.spatialOptions
  )
  // Keep original player indices for configuration lookup, but exclude RPG settlements
  // once rather than reconsidering them at every fifteen-minute catch-up step.
  for (const player of state.players) for (const unit of player.units ?? []) initializeNpcArrows(unit)
  const economicPlayers = state.players
    .map((player, playerIndex) => ({ player, playerIndex }))
    .filter(({ player }) => !isStaticSettlement(player))
  migrateOfflineFood(economicPlayers.map(({ player }) => player))
  let cursor = DAY_NIGHT_CONFIG.startHour * 60 + fromElapsedMs / MINUTE_MS
  const end = DAY_NIGHT_CONFIG.startHour * 60 + toElapsedMs / MINUTE_MS
  if (options.planBuildings && fromElapsedMs === 0)
    planOfflineBuildings(state, dayAt(cursor), options.terrain, options, spatial)
  if (!options.runtimeOwnsTraining) completeOfflineTraining(state, dayAt(cursor), spatial, options, report)
  while (cursor < end) {
    bindEconomyActors(state.players)
    if (options.planBuildings) restoreOfflineBuilders(state)
    const boundary = (Math.floor((cursor - NEW_DAY_MINUTE) / DAY_MINUTES) + 1) * DAY_MINUTES + NEW_DAY_MINUTE
    const next = Math.min(end, cursor + 15, boundary)
    economicPlayers.forEach(({ player, playerIndex }) => {
      reconcileSettlementResidents(player)
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
        replenishNpcArrows(unit, undefined, player)
        supplyTownArrows(unit, player, { hunting: unit.work === 'hunter' })
        supplyTownTool(unit, player)
        supplyTownWeapons(unit, player)
        restoreOfflineUnitSleepHealth(unit, cursor, next)
        const efficiency = options.dailyFactors?.(playerIndex, dayAt(cursor)).workEfficiency ?? 1
        const recovery = recoverOfflineGroundTool(
          state,
          player,
          playerIndex,
          unit,
          getVillagerWorkingMinutes(unit, cursor, next) * MINUTE_MS * efficiency,
          dayAt(cursor),
          spatial,
          options,
          report
        )
        if (recovery.status === 'waiting' || recovery.status === 'blocked') continue
        if (recovery.status === 'ready')
          planOfflineCollectiveWork(player, options.autonomousResidents, {
            resources: [...state.resources, ...(state.animals ?? []).filter(animal => animal.isDead)],
            spatial,
            rules: options,
            playerIndex,
          })
        if (!isOfflineWorker(unit)) {
          if (
            unit.inactif &&
            !unit.action &&
            !unit.dest &&
            unit.villageHome &&
            !unit.isChief &&
            !unit.campPatrolAnchor &&
            !unit.banditCampAnchor
          )
            returnOfflineWorkerForTool(
              player,
              unit,
              (next - cursor) * MINUTE_MS,
              options.unitConfig(playerIndex, unit.type),
              spatial
            )
          continue
        }
        const milliseconds = recovery.remainingMs
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

function prepareOfflineConstruction(state: SerializedSave, options: SimulationOptions): void {
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
}

function migrateOfflineFood(players: SerializedSave['players']): void {
  for (const player of players) {
    for (const entity of [...savedBuildingsWithInteriors(player.buildings ?? []), ...(player.units ?? [])]) {
      if (entity.inventory?.resources?.food)
        entity.inventory.resources = expandLegacyFoodAmount(entity.inventory.resources)
    }
  }
}

function emptyOfflineReport(): OfflineWorldReport {
  return {
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
}
