import { commitVillageWork, snapshotVillageEntity as snapshot } from './VillageWorkCommit'
import { notifyVillageWorkChanged } from '../../lib/units/village/villageWorkEvents'
import { simulateOfflineWorld } from './offline/OfflineWorldSimulation'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import { Assets } from 'pixi.js'
import { VILLAGE_ACTIVITY_RADIUS, VILLAGE_PATH_MARGIN } from '../../config/villageActivity'
import { offlineWorkCycleMs } from '../../lib/economy/configuredWorkTiming'
import { withinVillageActivity, type VillageHome } from '../../lib/units/village/villageActivity'
import { knowsEconomicTarget, playerSeesTarget } from '../../lib/units/playerTargetKnowledge'
import { OfflineWorldSpatial, type OfflineTerrainCell } from './offline/OfflineWorldSpatial'
import { advanceOfflineWorker, type OfflineWorldReport } from './offline/OfflineWorldWork'
import type { GameContextLike } from '../../types/context'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { SaveEntityState, SavePlayerState, SerializedSave } from '../../types/save'

/** A bounded snapshot of real terrain, nodes and stores. Never runs daily events or abstract production. */
export function advanceVillageWork(
  context: GameContextLike,
  home: VillageHome | VillageHome[],
  owner: PlayerLike,
  units: UnitEntity[],
  milliseconds: number,
  fromElapsedMs?: number,
  sleeping = false
): void {
  if (milliseconds <= 0 || !units.length) return
  const homes = Array.isArray(home) ? home : [home]
  const terrain: (OfflineTerrainCell | undefined)[][] = []
  const sources = new Map<SaveEntityState, RuntimeEntity>()
  const resources: SaveEntityState[] = []
  const seen = new Set<RuntimeEntity>()
  const radius = VILLAGE_ACTIVITY_RADIUS + VILLAGE_PATH_MARGIN
  for (const home of homes) {
    for (let i = Math.max(0, home.i - radius); i <= home.i + radius; i++) {
      terrain[i] ??= []
      for (let j = Math.max(0, home.j - radius); j <= home.j + radius; j++) {
        if (Math.hypot(i - home.i, j - home.j) > radius) continue
        const cell = context.map.grid[i]?.[j]
        if (!cell || terrain[i][j]) continue
        terrain[i][j] = { category: cell.category, z: cell.z, inclined: cell.inclined, waterBorder: cell.waterBorder }
        const entity = cell.has
        if (!entity || seen.has(entity)) continue
        seen.add(entity)
        if (entity.family !== 'resource') continue
        const copy = snapshot(entity)
        sources.set(copy, entity)
        resources.push(copy)
      }
    }
  }
  const copies = units.map(unit => {
    const copy = snapshot(unit)
    // Room coordinates are local. Use the doorway for coarse work, retaining
    // the live shelter/space until the rest system reconciles at wake-up.
    if (sleeping && getEntitySpaceId(unit) !== 'outside') {
      const exit = context.map.spaces
        ?.get(getEntitySpaceId(unit))
        ?.portals?.find(p => p.targetSpaceId === 'outside')?.targetCell
      if (exit) {
        copy.i = exit.i
        copy.j = exit.j
      }
    }
    return copy
  })
  const local = (entity: RuntimeEntity) => {
    const point =
      getEntitySpaceId(entity) === 'outside'
        ? entity
        : context.map.spaces?.get(getEntitySpaceId(entity))?.portals?.find(p => p.targetSpaceId === 'outside')
            ?.targetCell
    return Boolean(
      point && homes.some(home => Math.hypot(point.i - home.i, point.j - home.j) <= VILLAGE_ACTIVITY_RADIUS)
    )
  }
  const buildings = (owner.buildings ?? []).filter(b => !b.isDead && !b.isDestroyed && local(b))
  const savedBuildings = buildings.map(building => {
    const copy = snapshot(building)
    if (building.spaceId && building.spaceId !== 'outside') {
      const exit = context.map.spaces
        ?.get(building.spaceId)
        ?.portals?.find(p => p.targetSpaceId === 'outside')?.targetCell
      if (exit) {
        copy.i = exit.i
        copy.j = exit.j
        copy.size = 1
      }
    }
    return copy
  })
  const player: SavePlayerState = {
    type: owner.type,
    label: owner.label,
    civ: owner.civ,

    forgeUpgrades: owner.forgeUpgrades,
    units: copies,
    buildings: savedBuildings,
  }
  const state: SerializedSave = { camera: { x: 0, y: 0 }, players: [player], resources, animals: [] }
  // Other occupants remain obstacles; never move or produce for another village.
  const participants = new Set<RuntimeEntity>([...units, ...buildings])
  const obstacles = [...seen].filter(e => e.family !== 'resource' && !participants.has(e))
  state.animals = obstacles.map(snapshot)
  const report: OfflineWorldReport = {
    elapsedMs: milliseconds,
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
  const wheatAssets = Assets.cache.get('config')?.resources?.Wheat?.assets
  const wheat = typeof wheatAssets === 'string' ? Assets.cache.get(wheatAssets) : null
  const rules = {
    unitConfig: (_index: number, type: string) => owner.config?.units?.[type] ?? {},
    buildingConfig: (_index: number, type: string) => owner.config?.buildings?.[type] ?? {},
    cycleMs: (_index: number, work: string, action?: string) =>
      offlineWorkCycleMs(owner.config?.units?.Villager ?? {}, work, action),
    wheatMatureFrame: Math.max(0, Object.keys(wheat?.textures ?? {}).length - 1),
    isKnown: (_index: number, resource: SaveEntityState) => {
      const source = sources.get(resource)
      return Boolean(
        source &&
          local(source) &&
          units.some(unit => withinVillageActivity(unit, source)) &&
          (context.map.revealEverything ||
            units.some(unit => knowsEconomicTarget(owner, source, unit)) ||
            owner.views?.isViewed(source.i, source.j) ||
            playerSeesTarget(owner, source))
      )
    },
  }
  if (fromElapsedMs != null) {
    simulateOfflineWorld(state, {
      ...rules,
      terrain,
      fromElapsedMs,
      toElapsedMs: fromElapsedMs + milliseconds,
      runtimeOwnsDailyEvents: true,
      runtimeOwnsMeals: false,
      autonomousResidents: true,
      runtimeOwnsTraining: true,
      spatialOptions: { protectVillageAccess: false, traceConnectivity: true, exactBuildingFootprints: true },
    })
  } else {
    const spatial = new OfflineWorldSpatial(terrain, state, () => 1, {
      protectVillageAccess: false,
      traceConnectivity: false,
      exactBuildingFootprints: true,
    })
    for (const copy of copies) advanceOfflineWorker(state, player, 0, copy, milliseconds, 0, spatial, rules, report)
  }
  commitVillageWork(context, sources, resources, savedBuildings, buildings, copies, units, fromElapsedMs, sleeping)
  notifyVillageWorkChanged(owner)
}
