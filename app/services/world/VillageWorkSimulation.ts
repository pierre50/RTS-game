import { simulateOfflineWorld } from './OfflineWorldSimulation'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import { Assets } from 'pixi.js'
import { VILLAGE_ACTIVITY_RADIUS, VILLAGE_PATH_MARGIN } from '../../config/villageActivity'
import { offlineWorkCycleMs } from '../../lib/economy/configuredWorkTiming'
import { ensureOutsideMapSpace, moveEntityToMapSpace } from '../../lib/mapSpaces'
import { withinVillageActivity, type VillageHome } from '../../lib/units/villageActivity'
import { playerSeesTarget } from '../../lib/units/playerTargetKnowledge'
import { OfflineWorldSpatial, type OfflineTerrainCell } from './OfflineWorldSpatial'
import { advanceOfflineWorker, type OfflineWorldReport } from './OfflineWorldWork'
import type { GameContextLike } from '../../types/context'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { SaveEntityState, SavePlayerState, SerializedSave } from '../../types/save'

const FIELDS = [
  'label',
  'type',
  'i',
  'j',
  'size',
  'hitPoints',
  'totalHitPoints',
  'quantity',
  'totalQuantity',
  'currentFrame',
  'isDead',
  'isDestroyed',
  'isBuilt',
  'villagerDeliveriesBlocked',
  'inventory',
  'equipment',
  'experience',
  'work',
  'autonomousJob',
  'offlineWork',
  'age',
  'isNaturalResource',
  'controlMode',
  'action',
  'dailySchedule',
  'followingHero',
  'trainingTargetType',
  'offlineBuilderJob',
] as const

function snapshot(entity: RuntimeEntity): SaveEntityState {
  const result: Record<string, unknown> = {}
  for (const field of FIELDS) {
    const value = (entity as unknown as Record<string, unknown>)[field]
    if (value !== undefined) result[field] = structuredClone(value)
  }
  const animated = entity as RuntimeEntity & { sprite?: { currentFrame?: number }; currentFrame?: number }
  const frame = animated.sprite?.currentFrame ?? animated.currentFrame
  if (frame != null) result.currentFrame = frame
  const unit = entity as UnitEntity
  if (unit.dest) result.dest = [unit.dest.i, unit.dest.j, 'label' in unit.dest ? unit.dest.label : undefined]
  if (unit.buildQueue) result.buildQueue = unit.buildQueue.map(building => building.label)
  return result as SaveEntityState
}

/** A bounded snapshot of real terrain, nodes and stores. Never runs daily events or abstract production. */
export function advanceVillageWork(
  context: GameContextLike,
  home: VillageHome,
  owner: PlayerLike,
  units: UnitEntity[],
  milliseconds: number,
  fromElapsedMs?: number
): void {
  if (milliseconds <= 0 || !units.length) return
  const terrain: (OfflineTerrainCell | undefined)[][] = []
  const sources = new Map<SaveEntityState, RuntimeEntity>()
  const resources: SaveEntityState[] = []
  const seen = new Set<RuntimeEntity>()
  const radius = VILLAGE_ACTIVITY_RADIUS + VILLAGE_PATH_MARGIN
  for (let i = Math.max(0, home.i - radius); i <= home.i + radius; i++) {
    terrain[i] = []
    for (let j = Math.max(0, home.j - radius); j <= home.j + radius; j++) {
      if (Math.hypot(i - home.i, j - home.j) > radius) continue
      const cell = context.map.grid[i]?.[j]
      if (!cell) continue
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
  const copies = units.map(snapshot)
  const local = (entity: RuntimeEntity) => {
    const point =
      getEntitySpaceId(entity) === 'outside'
        ? entity
        : context.map.spaces?.get(getEntitySpaceId(entity))?.portals?.find(p => p.targetSpaceId === 'outside')
            ?.targetCell
    return Boolean(point && Math.hypot(point.i - home.i, point.j - home.j) <= VILLAGE_ACTIVITY_RADIUS)
  }
  const buildings = (owner.buildings ?? []).filter(
    b => !b.isDead && !b.isDestroyed && local(b) && withinVillageActivity(units[0], b)
  )
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
    age: owner.age,
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
    buildingCapacity: () => 0,
    cycleMs: (_index: number, work: string, action?: string) =>
      offlineWorkCycleMs(owner.config?.units?.Villager ?? {}, work, action),
    wheatMatureFrame: Math.max(0, Object.keys(wheat?.textures ?? {}).length - 1),
    isKnown: (_index: number, resource: SaveEntityState) => {
      const source = sources.get(resource)
      return Boolean(
        source &&
          local(source) &&
          withinVillageActivity(units[0], source) &&
          (context.map.revealEverything || owner.views?.isViewed(source.i, source.j) || playerSeesTarget(owner, source))
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
  // Commit synchronously: no live callbacks can interleave with this transaction.
  for (const [copy, source] of sources) {
    const felled = source.type === 'Tree' && (source.hitPoints ?? 0) > 0 && copy.hitPoints === 0
    source.hitPoints = copy.hitPoints ?? source.hitPoints
    if (felled) (source as RuntimeEntity & { setCuttedTreeTexture?: () => void }).setCuttedTreeTexture?.()
    if (source.type === 'Wheat' && copy.currentFrame === 0 && snapshot(source).currentFrame !== 0) {
      source.quantity = 0
      source.die?.()
    } else {
      source.quantity = copy.quantity
      if (!resources.includes(copy)) source.die?.()
    }
  }
  savedBuildings.forEach((copy, index) => {
    const building = buildings[index]
    building.inventory = copy.inventory
    if (
      fromElapsedMs != null &&
      copy.hitPoints != null &&
      (copy.hitPoints !== building.hitPoints || (copy.isBuilt && !building.isBuilt))
    ) {
      building.hitPoints = copy.hitPoints
      building.updateHitPoints?.('build')
    }
  })
  const space = ensureOutsideMapSpace(context.map)
  copies.forEach((copy, index) => {
    const unit = units[index]
    unit.inventory = copy.inventory
    unit.offlineWork = copy.offlineWork
    if (fromElapsedMs != null) {
      unit.hitPoints = copy.hitPoints ?? unit.hitPoints
      unit.work = copy.work ?? null
      unit.action = copy.action ?? null
      unit.inactif = copy.inactif ?? !copy.action
      Object.assign(unit, { offlineBuilderJob: copy.offlineBuilderJob })
      unit.buildQueue = copy.buildQueue?.flatMap(label => buildings.filter(building => building.label === label))
      const label = Array.isArray(copy.dest) ? copy.dest[2] : undefined
      unit.dest = label
        ? ([...sources.values(), ...buildings].find(entity => entity.label === label && !entity.isDestroyed) ?? null)
        : null
      unit.path = []
    }
    const cell = context.map.grid[copy.i]?.[copy.j]
    if (cell && (!cell.has || cell.has === unit) && (unit.i !== copy.i || unit.j !== copy.j))
      moveEntityToMapSpace(context.map, unit, space, cell)
  })
}
