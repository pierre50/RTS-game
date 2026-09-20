import { BUILDING_TYPES, UNIT_TYPES } from '../../constants'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import { heroCanCommand } from '../chief'

const RESOURCE_STOCKPILE_BUILDING_TYPES = new Set<string>([
  BUILDING_TYPES.chest,
  BUILDING_TYPES.storagePit,
  BUILDING_TYPES.granary,
])

export type ResourceStoreOwner = {
  isPlayed?: boolean
  context?: GameContextLike
  buildings?: BuildingEntity[]
  label?: string
  units?: UnitEntity[]
}

export type ResourceTotalOptions = {
  includeHero?: boolean
  hero?: UnitEntity | null
  visibleOnly?: boolean
}

function isOwnedChest(building: BuildingEntity, player: ResourceStoreOwner): boolean {
  if (!RESOURCE_STOCKPILE_BUILDING_TYPES.has(building.type)) return false
  if (building.isDead || building.isDestroyed) return false
  if (!building.owner) return true
  return building.owner === player || building.owner.label === player.label
}

function getPlayerResourceChests(player: ResourceStoreOwner | null | undefined): BuildingEntity[] {
  if (!player) return []
  return (player.buildings ?? []).filter(building => isOwnedChest(building, player))
}

function isOwnedStartingResourceDepot(building: BuildingEntity, player: ResourceStoreOwner): boolean {
  if (building.type !== BUILDING_TYPES.townCenter) return false
  if (building.isDead || building.isDestroyed) return false
  if (!building.inventory?.resources) return false
  if (!building.owner) return true
  return building.owner === player || building.owner.label === player.label
}

function getPlayerStartingResourceDepots(player: ResourceStoreOwner | null | undefined): BuildingEntity[] {
  if (!player) return []
  return (player.buildings ?? []).filter(building => isOwnedStartingResourceDepot(building, player))
}

export function getPlayerResourceStores(player: ResourceStoreOwner | null | undefined): BuildingEntity[] {
  return [...new Set([...getPlayerResourceChests(player), ...getPlayerStartingResourceDepots(player)])]
}

function isOwnedHero(unit: UnitEntity, player: ResourceStoreOwner): boolean {
  if (unit.type !== UNIT_TYPES.hero) return false
  if (unit.isDead || unit.isDestroyed) return false
  if (!unit.owner) return true
  return unit.owner === player || unit.owner.label === player.label
}

export function getPlayerResourceHeroes(
  player: ResourceStoreOwner | null | undefined,
  extraHero?: UnitEntity | null
): UnitEntity[] {
  if (!player && !extraHero) return []
  const heroes = new Set<UnitEntity>()
  if (player) {
    for (const unit of player.units ?? []) {
      if (isOwnedHero(unit, player)) heroes.add(unit)
    }
  }
  if (extraHero && (!player || isOwnedHero(extraHero, player))) heroes.add(extraHero)
  return [...heroes]
}

export function getPersonalResourceHero(
  player: ResourceStoreOwner | null | undefined,
  options: ResourceTotalOptions = {}
): UnitEntity | null {
  if (!player?.isPlayed || options.includeHero === false) return null
  const hero = options.hero ?? player.context?.controls?.heroUnit ?? getPlayerResourceHeroes(player)[0]
  return hero && isOwnedHero(hero, player) && !heroCanCommand(hero) ? hero : null
}

export function isVisibleStorageBuilding(building: BuildingEntity, player: ResourceStoreOwner | PlayerLike): boolean {
  const map = building.context?.map
  if (map?.revealEverything) return true
  const views = (player as PlayerLike).views
  if (!views) return building.visible !== false
  const checkVisible = () => views.isVisible(building.i, building.j)
  return views.withSpace?.(building.spaceId, checkVisible) ?? checkVisible()
}
