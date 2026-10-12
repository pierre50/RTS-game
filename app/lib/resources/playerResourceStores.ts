import { isCommunalResourceStore } from '../economy/constructionStores'
import { getBaseTerritory } from '../territory/baseTerritory'
import { BUILDING_TYPES, UNIT_TYPES } from '../../constants/entities'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import { heroCanCommand } from '../chief'

const RESOURCE_STOCKPILE_BUILDING_TYPES = new Set<string>([BUILDING_TYPES.storagePit, BUILDING_TYPES.granary])

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
  /** Building or resident home whose town owns this transaction; null means no town. */
  settlement?: {
    i: number
    j: number
    spaceId?: string | null
    id?: string
    townCenterId?: string
    owner?: { label?: string } | null
  } | null
}

function isOwnedChest(building: BuildingEntity, player: ResourceStoreOwner): boolean {
  if (!RESOURCE_STOCKPILE_BUILDING_TYPES.has(building.type) && !isCommunalResourceStore(building, player)) return false
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

export function getPlayerResourceStores(
  player: ResourceStoreOwner | null | undefined,
  options: ResourceTotalOptions = {}
): BuildingEntity[] {
  const hero =
    options.includeHero === false
      ? null
      : (options.hero ?? (player?.isPlayed ? player.context?.controls?.heroUnit : null))
  const point = options.settlement !== undefined ? options.settlement : hero
  const scoped = options.settlement !== undefined || Boolean(hero)
  const center =
    player && point && (!point.owner || point.owner.label === player.label)
      ? getBaseTerritory(point, [player])?.center
      : null
  return [...new Set([...getPlayerResourceChests(player), ...getPlayerStartingResourceDepots(player)])].filter(
    store => {
      const territory = player && getBaseTerritory(store, [player])
      return Boolean(territory && (!scoped || territory.center === center))
    }
  )
}

/** Unscoped reports may aggregate a faction; an ambiguous payment must never do so. */
export function resourceTransactionOptions(
  player: ResourceStoreOwner,
  options: ResourceTotalOptions = {}
): ResourceTotalOptions {
  if (options.settlement !== undefined) return options
  const hero =
    options.includeHero === false
      ? null
      : (options.hero ?? (player.isPlayed ? player.context?.controls?.heroUnit : null))
  if (hero) return { ...options, settlement: hero }
  const centers = (player.buildings ?? []).filter(
    center => center.type === BUILDING_TYPES.townCenter && getBaseTerritory(center, [player])?.center === center
  )
  return { ...options, settlement: centers.length === 1 ? centers[0] : null }
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
  if (player?.isPlayed) {
    const active = extraHero ?? player.context?.controls?.heroUnit ?? [...heroes][0]
    return active && heroes.has(active) ? [active] : []
  }
  return [...heroes]
}

export function getPersonalResourceHero(
  player: ResourceStoreOwner | null | undefined,
  options: ResourceTotalOptions = {}
): UnitEntity | null {
  if (!player?.isPlayed || options.includeHero === false) return null
  const hero = options.hero ?? player.context?.controls?.heroUnit ?? getPlayerResourceHeroes(player)[0]
  if (!hero || !isOwnedHero(hero, player)) return null
  const territory = getBaseTerritory(hero, player.context?.players ?? [player])
  const inOwnBase = territory && (territory.owner === player || territory.owner.label === player.label)
  return !heroCanCommand(hero) || !inOwnBase ? hero : null
}

export function isVisibleStorageBuilding(building: BuildingEntity, player: ResourceStoreOwner | PlayerLike): boolean {
  const map = building.context?.map
  if (map?.revealEverything) return true
  const views = (player as PlayerLike).views
  if (!views) return building.visible !== false
  const checkVisible = () => views.isVisible(building.i, building.j)
  return views.withSpace?.(building.spaceId, checkVisible) ?? checkVisible()
}
