import { BUILDING_TYPES } from '../../../constants/entities'
import {
  replenishMarketGold,
  resetMarketEquipmentStock,
  MARKET_RESTOCK_INTERVAL_DAYS,
} from '../../../lib/equipment/equipmentMarket'
import { configureVillageNightWatch } from '../../../lib/units/villageNightWatch'
import { DAY_NIGHT_CONFIG } from '../../../config/gameplay'
import { restoreOfflineUnitSleepHealth } from '../../../lib/units/unitSleepHealth'
import { getDeferredVillages } from './DeferredVillageStore'
import { Assets } from 'pixi.js'
import { isStaticSettlement } from '../../../config/settlementProfiles'
import { VILLAGE_ACTIVITY_RADIUS, VILLAGE_PATH_MARGIN } from '../../../config/villageActivity'
import { offlineWorkCycleMs } from '../../../lib/economy/configuredWorkTiming'
import { resourceData } from '../../../serialization/ResourceSaveData'
import { savedResourceOwner } from '../offline/OfflineWorldWork'
import { simulateOfflineWorld } from '../offline/OfflineWorldSimulation'
import { replenishRpgVillage } from '../RpgVillageSupplies'
import type { OfflineTerrainCell } from '../offline/OfflineWorldSpatial'
import type { GameContextLike } from '../../../types/context'
import type { PlayerLike } from '../../../types/player'
import type { RuntimeEntity } from '../../../types/entities'
import type { SaveEntityState, SavePlayerState, SerializedSave } from '../../../types/save'

/** Simulate saved village data against finite local resources, without creating residents. */
export function advanceDeferredVillage(
  context: GameContextLike,
  owner: PlayerLike,
  player: SavePlayerState,
  from: number,
  to: number,
  createResource: (state: SaveEntityState) => void
): void {
  configureVillageNightWatch(player)
  if (isStaticSettlement(player)) {
    const minuteMs = DAY_NIGHT_CONFIG.dayLengthMs / (DAY_NIGHT_CONFIG.hoursPerDay * 60)
    for (const unit of player.units ?? [])
      restoreOfflineUnitSleepHealth(
        unit,
        DAY_NIGHT_CONFIG.startHour * 60 + from / minuteMs,
        DAY_NIGHT_CONFIG.startHour * 60 + to / minuteMs
      )
    const dayAt = (elapsed: number) =>
      Math.max(
        1,
        Math.floor(
          (DAY_NIGHT_CONFIG.startHour + elapsed / minuteMs / 60 - DAY_NIGHT_CONFIG.newDayHour) /
            DAY_NIGHT_CONFIG.hoursPerDay
        ) + 1
      )
    for (let day = dayAt(from) + 1; day <= dayAt(to); day++) {
      for (const market of player.buildings ?? []) {
        if (market.type !== BUILDING_TYPES.market || !market.isBuilt || market.isDead || market.isDestroyed) continue
        replenishMarketGold(market)
        if (day % MARKET_RESTOCK_INTERVAL_DAYS === 0) resetMarketEquipmentStock(market, { civilization: player.civ })
      }
    }
    // The supply helper only reads saved inventories/ownership, never entity methods.
    const supplies = { ...player, ...savedResourceOwner(player), units: player.units ?? [] } as unknown as PlayerLike
    replenishRpgVillage(supplies, context.dayNight?.state.day ?? 1)
    player.rpgRestockDay = supplies.rpgRestockDay
    return
  }
  const terrain: (OfflineTerrainCell | undefined)[][] = []
  const sources = new Map<SaveEntityState, RuntimeEntity>()
  const resources: SaveEntityState[] = [],
    obstacles: SaveEntityState[] = []
  const seen = new Set<object>()
  const deferred = getDeferredVillages(context.map)
  const radius = VILLAGE_ACTIVITY_RADIUS + VILLAGE_PATH_MARGIN
  for (const home of player.buildings ?? []) {
    if (home.spaceId && home.spaceId !== 'outside') continue
    for (let i = Math.max(0, home.i - radius); i <= home.i + radius; i++) {
      terrain[i] ??= []
      for (let j = Math.max(0, home.j - radius); j <= home.j + radius; j++) {
        if (terrain[i][j] || Math.hypot(i - home.i, j - home.j) > radius) continue
        const cell = context.map.grid[i]?.[j]
        if (!cell) continue
        terrain[i][j] = {
          category: deferred?.reservedByOther(owner, cell) ? 'Water' : cell.category,
          z: cell.z,
          inclined: cell.inclined,
          waterBorder: cell.waterBorder,
        }
        const entity = cell.has
        if (!entity || entity.isDestroyed || seen.has(entity)) continue
        seen.add(entity)
        if (entity.family === 'resource') {
          const copy = resourceData(entity)
          resources.push(copy)
          sources.set(copy, entity)
        } else obstacles.push({ i: entity.i, j: entity.j, type: entity.type, label: entity.label })
      }
    }
  }
  const copy = structuredClone(player)
  const state: SerializedSave = {
    camera: { x: 0, y: 0 },
    players: [copy],
    resources,
    animals: obstacles,
    config: { difficulty: context.map.difficulty },
    world: { worldRegionId: context.map.worldRegionId },
  }
  const wheatAssets = Assets.cache.get('config')?.resources?.Wheat?.assets
  const wheat = typeof wheatAssets === 'string' ? Assets.cache.get(wheatAssets) : null
  simulateOfflineWorld(state, {
    fromElapsedMs: from,
    toElapsedMs: to,
    terrain,
    // Natural resources have a shared runtime clock; residents, training and
    // village daily events belong exclusively to this saved state.
    runtimeOwnsResourceRenewal: true,
    abstractVillages: true,
    autonomousResidents: true,
    planBuildings: true,
    spatialOptions: { exactBuildingFootprints: true, accessRadius: radius, traceConnectivity: false },
    unitConfig: (_index, type) => owner.config.units[type] ?? {},
    buildingConfig: (_index, type) => owner.config.buildings[type] ?? {},
    cycleMs: (_index, work, action) => offlineWorkCycleMs(owner.config.units.Villager ?? {}, work, action),
    wheatMatureFrame: Math.max(0, Object.keys(wheat?.textures ?? {}).length - 1),
  })
  for (const [changed, source] of sources) {
    const felled = source.type === 'Tree' && (source.hitPoints ?? 0) > 0 && changed.hitPoints === 0
    source.hitPoints = changed.hitPoints ?? source.hitPoints
    if (felled) (source as RuntimeEntity & { setCuttedTreeTexture?: () => void }).setCuttedTreeTexture?.()
    if (source.type === 'Wheat' && changed.currentFrame === 0 && resourceData(source).currentFrame !== 0) {
      source.quantity = 0
      source.die?.()
    } else {
      source.quantity = changed.quantity
      if (!state.resources.includes(changed)) source.die?.()
    }
  }
  for (const resource of state.resources) if (!sources.has(resource)) createResource(resource)
  Object.assign(player, copy)
}
