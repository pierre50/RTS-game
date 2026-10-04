import { isStaticSettlement } from '../../../config/settlementProfiles'
import { serializeEconomyPlayer } from '../../../serialization/VillageEconomySnapshot'
import { advanceVillageWork } from '../VillageWorkSimulation'
import { planOfflineBuildings } from '../offline/OfflineWorldBuildingPlanner'
import { offlineWorkCycleMs } from '../../../lib/economy/configuredWorkTiming'
import { VILLAGE_ACTIVITY_RADIUS, VILLAGE_PATH_MARGIN } from '../../../config/villageActivity'
import { worldEconomyFactors } from '../../../config/worldEconomyBalance'
import { type VillageHome } from '../../../lib/units/village/villageActivity'
import { isUnitSuspended } from '../../../lib/units/unitSuspension'
import type { OfflineTerrainCell } from '../offline/OfflineWorldSpatial'
import type { OfflineWorkRules } from '../offline/OfflineWorldWork'
import type { GameContextLike } from '../../../types/context'
import type { UnitEntity } from '../../../types/entities'
import type { PlayerLike } from '../../../types/player'
import type { SavePlayerState, SerializedSave, SaveEntityState } from '../../../types/save'

/** Copies are transaction-local. Runtime entities remain the canonical save/interaction data. */
function capture(
  context: GameContextLike,
  owner: PlayerLike,
  homes: VillageHome[],
  units = owner.units.filter(isUnitSuspended)
) {
  const player = serializeEconomyPlayer(owner)
  const suspended = new Set(units.map(unit => unit.label))
  player.units = player.units?.filter(unit => suspended.has(unit.label ?? ''))
  const terrain: (OfflineTerrainCell | undefined)[][] = []
  const obstacles = new Map<object, SaveEntityState>()
  const resources = new Map<object, SaveEntityState>()
  const participants = new Set<object>([...units, ...owner.buildings])
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
  const cycles = new Map<string, number>()
  return {
    abstractVillages: true,
    // Planning is an explicit daily transaction, never a side effect of saving.
    unitConfig: (_index, type) => owner.config?.units?.[type] ?? {},
    buildingConfig: (_index, type) => owner.config?.buildings?.[type] ?? {},
    cycleMs: (_index, work, action) => {
      const key = `${work}:${action ?? ''}`
      if (!cycles.has(key)) cycles.set(key, offlineWorkCycleMs(owner.config?.units?.Villager ?? {}, work, action))
      return cycles.get(key)!
    },
    wheatMatureFrame: 0,
    dailyFactors: (_index, day) =>
      worldEconomyFactors(
        context.map.difficulty,
        `${context.map.worldId}:${context.map.worldRegionId}:${owner.factionId ?? owner.label}`,
        day
      ),
  }
}

/** Planning only adds projects. The shared work simulation owns stocks and workers. */
function commitPlan(owner: PlayerLike, player: SavePlayerState): void {
  for (const copy of player.buildings ?? []) {
    if (!owner.buildings.some(building => building.label === copy.label))
      owner.createBuilding({ ...copy, isBuilt: false })
  }
  Object.assign(owner, {
    offlineBuildingPlanDay: player.offlineBuildingPlanDay,
    offlineBuildingDecision: player.offlineBuildingDecision,
  })
}

export function advanceDistantVillageEconomy(
  context: GameContextLike,
  owner: PlayerLike,
  homes: VillageHome[],
  fromElapsedMs: number,
  toElapsedMs: number
): void {
  if (isStaticSettlement(owner) || toElapsedMs <= fromElapsedMs) return
  advanceVillageWork(
    context,
    homes,
    owner,
    owner.units.filter(isUnitSuspended),
    toElapsedMs - fromElapsedMs,
    fromElapsedMs
  )
}

export function planDistantVillageBuildings(
  context: GameContextLike,
  owner: PlayerLike,
  homes: VillageHome[],
  units?: UnitEntity[]
): void {
  if (isStaticSettlement(owner) || owner.isPlayed || owner.type !== 'AI') return
  const day = context.dayNight?.state.day ?? 1
  const { state, player, terrain } = capture(context, owner, homes, units)
  planOfflineBuildings(state, day, terrain, rules(context, owner))
  commitPlan(owner, player)
}
