import { serializeEconomyPlayer } from '../../serialization/VillageEconomySnapshot'
import { simulateOfflineWorld } from './OfflineWorldSimulation'
import { planOfflineBuildings, restoreOfflineBuilders } from './OfflineWorldBuildingPlanner'
import { offlineWorkCycleMs } from '../../classes/map/generation/MapOfflineWorldSimulation'
import { getBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { ensureOutsideMapSpace, moveEntityToMapSpace } from '../../lib/mapSpaces'
import { VILLAGE_ACTIVITY_RADIUS, VILLAGE_PATH_MARGIN } from '../../config/villageActivity'
import { worldEconomyFactors } from '../../config/worldEconomyBalance'
import { type VillageHome } from '../../lib/units/villageActivity'
import { isUnitSuspended } from '../../lib/units/unitSuspension'
import type { OfflineTerrainCell } from './OfflineWorldSpatial'
import type { OfflineWorkRules } from './OfflineWorldWork'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { SavePlayerState, SerializedSave, SaveEntityState } from '../../types/save'

/** Copies are transaction-local. Runtime entities remain the canonical save/interaction data. */
function capture(context: GameContextLike, owner: PlayerLike, homes: VillageHome[]) {
  const player = serializeEconomyPlayer(owner)
  const suspended = new Set(owner.units.filter(isUnitSuspended).map(unit => unit.label))
  player.units = player.units?.filter(unit => suspended.has(unit.label ?? ''))
  const terrain: (OfflineTerrainCell | undefined)[][] = []
  const obstacles = new Map<object, SaveEntityState>()
  const resources = new Map<object, SaveEntityState>()
  const participants = new Set<object>([...owner.units.filter(isUnitSuspended), ...owner.buildings])
  const radius = VILLAGE_ACTIVITY_RADIUS + VILLAGE_PATH_MARGIN
  for (const home of homes) {
    for (let i = Math.max(0, home.i - radius); i <= home.i + radius; i++) {
      terrain[i] ??= []
      for (let j = Math.max(0, home.j - radius); j <= home.j + radius; j++) {
        if ((i - home.i) ** 2 + (j - home.j) ** 2 > radius ** 2 || terrain[i][j]) continue
        const cell = context.map.grid[i]?.[j]
        if (!cell) continue
        terrain[i][j] = { category: cell.category, z: cell.z, inclined: cell.inclined, waterBorder: cell.waterBorder }
        const entity = cell.has
        if (entity && !participants.has(entity) && !entity.isDestroyed) {
          const collection = entity.family === 'resource' ? resources : obstacles
          collection.set(entity, {
            i: entity.i,
            j: entity.j,
            type: entity.type,
            label: entity.label,
            quantity: entity.quantity,
            hitPoints: entity.hitPoints,
          })
        }
      }
    }
  }
  // Interior chests share ownership, but routing uses their exterior doorway.
  for (const building of player.buildings ?? []) {
    if (!building.spaceId || building.spaceId === 'outside') continue
    const exit = context.map.spaces
      ?.get(building.spaceId)
      ?.portals?.find(p => p.targetSpaceId === 'outside')?.targetCell
    if (exit) Object.assign(building, { i: exit.i, j: exit.j, size: 1, spaceId: undefined })
  }
  for (const unit of player.units ?? []) {
    if (unit.work === 'builder') unit.autonomousJob = 'construction'
  }
  const state: SerializedSave = {
    camera: { x: 0, y: 0 },
    players: [player],
    resources: [...resources.values()],
    animals: [...obstacles.values()],
    config: { difficulty: context.map.difficulty },
    world: { worldRegionId: context.map.worldRegionId },
  }
  return { state, player, terrain }
}

function rules(context: GameContextLike, owner: PlayerLike): OfflineWorkRules {
  const cycle = offlineWorkCycleMs(owner.config?.units?.Villager ?? {}, 'builder')
  return {
    abstractVillages: true,
    // Planning is an explicit daily transaction, never a side effect of saving.
    unitConfig: (_index, type) => owner.config?.units?.[type] ?? {},
    buildingConfig: (_index, type) => owner.config?.buildings?.[type] ?? {},
    buildingCapacity: (_index, type) => {
      const config = owner.config?.buildings?.[type]
      return (
        getBuildingShelterCapacity({ type, shelterCapacity: config?.shelterCapacity ?? 0 }) ||
        Number(config?.increasePopulation) ||
        0
      )
    },
    cycleMs: () => cycle,
    wheatMatureFrame: 0,
    dailyFactors: (_index, day) =>
      worldEconomyFactors(
        context.map.difficulty,
        `${context.map.worldId}:${context.map.worldRegionId}:${owner.factionId ?? owner.label}`,
        day
      ),
  }
}

function commit(context: GameContextLike, owner: PlayerLike, player: SavePlayerState): void {
  // Buildings complete through the normal lifecycle (population, access, visuals).
  for (const copy of player.buildings ?? []) {
    let building = owner.buildings.find(candidate => candidate.label === copy.label)
    if (!building) {
      building = owner.createBuilding({ ...copy, isBuilt: false })
    }
    building.inventory = copy.inventory
    if (copy.hitPoints != null && (building.hitPoints !== copy.hitPoints || (copy.isBuilt && !building.isBuilt))) {
      building.hitPoints = copy.hitPoints
      building.updateHitPoints?.('build')
    }
  }
  Object.assign(owner, {
    abstractProductionRemainder: player.abstractProductionRemainder,
    offlineBuildingPlanDay: player.offlineBuildingPlanDay,
    offlineBuildingDecision: player.offlineBuildingDecision,
  })
  const space = ensureOutsideMapSpace(context.map)
  for (const copy of player.units ?? []) {
    const unit = owner.units.find(candidate => candidate.label === copy.label)
    if (!unit || !isUnitSuspended(unit)) continue
    Object.assign(unit, {
      inventory: copy.inventory,
      offlineWork: copy.offlineWork,
      offlineBuilderJob: copy.offlineBuilderJob,
      hitPoints: copy.hitPoints ?? unit.hitPoints,
      work: copy.work ?? null,
      autonomousJob: copy.autonomousJob ?? null,
      action: null,
      dest: null,
      path: [],
      inactif: true,
      resourceDeliveryState: null,
    })
    unit.buildQueue = copy.buildQueue?.flatMap(label => {
      const building = owner.buildings.find(candidate => candidate.label === label)
      return building ? [building] : []
    })
    const cell = context.map.grid[copy.i]?.[copy.j]
    if (cell && (!cell.has || cell.has === unit) && (unit.i !== copy.i || unit.j !== copy.j))
      moveEntityToMapSpace(context.map, unit, space, cell)
  }
}

export function advanceDistantVillageEconomy(
  context: GameContextLike,
  owner: PlayerLike,
  homes: VillageHome[],
  fromElapsedMs: number,
  toElapsedMs: number
): void {
  if (toElapsedMs <= fromElapsedMs) return
  const { state, player, terrain } = capture(context, owner, homes)
  restoreOfflineBuilders(state)
  simulateOfflineWorld(state, {
    ...rules(context, owner),
    terrain,
    fromElapsedMs,
    toElapsedMs,
    runtimeOwnsDailyEvents: true,
    runtimeOwnsTraining: true,
    spatialOptions: { protectVillageAccess: false, traceConnectivity: false, exactBuildingFootprints: true },
  })
  restoreOfflineBuilders(state)
  commit(context, owner, player)
}

export function planDistantVillageBuildings(context: GameContextLike, owner: PlayerLike, homes: VillageHome[]): void {
  const day = context.dayNight?.state.day ?? 1
  const { state, player, terrain } = capture(context, owner, homes)
  planOfflineBuildings(state, day, terrain, rules(context, owner))
  commit(context, owner, player)
}
