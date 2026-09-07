import {
  getFreeLandCellAroundInstance,
  teleportRuntimeUnitToCell,
  updateInstanceVisibility,
} from '../../lib'
import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { Viewport } from '../../types/geometry'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { SaveEntityState, SerializedSave } from '../../types/save'
import { applyPortableUnitState } from './GameStateHelpers'
import type { HeroEquippedItem } from '../../types/heroTools'

export type TravelPartyState = {
  followers: SaveEntityState[]
  hero: SaveEntityState | null
}

type TravelRuntimeMap = RuntimeMap & {
  _flushFogQueue(): void
  mapFog: {
    viewportRenderer: {
      invalidate(): void
      update(viewport: Viewport, force?: boolean): void
    }
  }
  updateRenderChunks(viewport: Viewport): void
}

export type TravelPartyGame = {
  _gameContext(): GameContextLike
}

export function extractTravelParty(state: SerializedSave): TravelPartyState {
  const played = state.players.find(player => player.isPlayed)
  const hero = played?.units?.find(unit => unit.controlMode === 'hero' || unit.type === 'Hero' || unit.isChief) ?? null
  return {
    hero,
    followers: (played?.units || []).filter(
      unit => unit !== hero && unit.followingHero === true && !unit.isDead && !unit.isDestroyed
    ),
  }
}

export function runtimeHeroUnit(game: TravelPartyGame): UnitEntity | null {
  const { player, controls } = game._gameContext()
  return (
    controls.heroUnit ||
    player.units.find(unit => unit.controlMode === 'hero' || unit.type === 'Hero') ||
    player.units.find(unit => unit.isChief) ||
    player.units[0] ||
    null
  )
}

function removeExistingTravelFollowers(game: TravelPartyGame): void {
  const { map, player } = game._gameContext()
  const hero = runtimeHeroUnit(game)
  const followers = player.units.filter(unit => unit !== hero && unit.followingHero)
  for (const follower of followers) {
    follower.path = []
    follower.action = null
    follower.isDestroyed = true
    const currentCell = follower.currentCell || map.grid[follower.i]?.[follower.j]
    if (currentCell?.has === follower) {
      currentCell.has = null
      currentCell.solid = false
    }
    map.removeFromInstanceBucket(follower)
    map.removeChild(follower)
    follower.destroy?.({ children: true, texture: false, textureSource: false })
  }
  player.units = player.units.filter(unit => !followers.includes(unit))
}

function findPartyFollowerArrivalCell(game: TravelPartyGame, anchor: UnitEntity): RuntimeCell | null {
  const { map } = game._gameContext()
  return getFreeLandCellAroundInstance(
    { i: anchor.i, j: anchor.j, size: 1 },
    map.grid,
    cells => cells[Math.floor(map.random() * cells.length)],
    createNonReservedPassageCellCondition(game._gameContext())
  )
}

export function teleportRuntimeUnit(game: TravelPartyGame, unit: UnitEntity, cell: RuntimeCell): void {
  const { map } = game._gameContext()
  teleportRuntimeUnitToCell(map, unit, cell)
}

export function refreshTravelPartyFog(game: TravelPartyGame, units: UnitEntity[]): void {
  const { map, controls, menu } = game._gameContext()
  if (map.revealEverything) return
  const runtimeMap = map as TravelRuntimeMap
  const viewport = (
    controls as { cameraController?: { getViewportRect?: () => Viewport } }
  ).cameraController?.getViewportRect?.()

  for (const unit of units) {
    unit.visibleCells = unit.visibleCells ?? new Set()
    updateInstanceVisibility(unit)
  }

  runtimeMap._flushFogQueue()
  if (viewport) {
    runtimeMap.mapFog.viewportRenderer.invalidate()
    runtimeMap.mapFog.viewportRenderer.update(viewport, true)
    runtimeMap.updateRenderChunks(viewport)
  }
  if (menu.isMiniMapActive?.() !== false) menu.updateResourcesMiniMap?.()
}

function applyFogStateToCell(game: TravelPartyGame, i: number, j: number): void {
  const { map, player } = game._gameContext()
  const cell = map.grid[i]?.[j]
  if (!cell) return
  cell.viewBy = new Set(player.views.getViewers(i, j))
  if (map.revealEverything) {
    cell.removeFog()
  } else if (player.views.isVisible(i, j)) {
    cell.removeFog()
  } else {
    cell.setFog()
  }
}

function clearTravelUnitFogViewers(game: TravelPartyGame, units: UnitEntity[]): void {
  const { player } = game._gameContext()
  const changed = new Set<number>()
  for (const unit of units) {
    for (const index of player.views.removeViewerEverywhere(unit)) changed.add(index)
    unit.visibleCells = new Set()
  }
  for (const index of changed) {
    const [i, j] = player.views.coordinates(index)
    applyFogStateToCell(game, i, j)
  }
}

function resetPlayedFogForFreshWorld(game: TravelPartyGame): void {
  const { map, player, menu } = game._gameContext()
  player.views.clearVisibility()
  player.views.clearExploration()
  player.cellViewed = 0
  for (const row of map.grid) {
    for (const cell of row) {
      cell.viewBy = new Set()
      if (!map.revealEverything) cell.setFog()
    }
  }
  menu.rebuildTerrainMiniMapFromViews?.()
}

export function applyTravelPartyToRuntime(
  game: TravelPartyGame,
  party: TravelPartyState,
  arrivalCell: RuntimeCell | null = null,
  { equippedItem = null, freshWorld = false }: { equippedItem?: HeroEquippedItem | null; freshWorld?: boolean } = {}
): void {
  const { player, controls } = game._gameContext()
  const hero = runtimeHeroUnit(game)
  if (!hero) return

  if (freshWorld) resetPlayedFogForFreshWorld(game)
  clearTravelUnitFogViewers(game, [hero, ...player.units.filter(unit => unit !== hero && unit.followingHero)])
  if (party.hero) applyPortableUnitState(hero as Partial<SaveEntityState>, party.hero, { keepAlive: true })
  refreshUnitEquipmentStats(hero)
  if (arrivalCell) teleportRuntimeUnit(game, hero, arrivalCell)
  removeExistingTravelFollowers(game)

  const travelUnits: UnitEntity[] = [hero]
  for (const followerState of party.followers) {
    const cell = findPartyFollowerArrivalCell(game, hero)
    if (!cell) continue
    const follower = player.createUnit?.({
      i: cell.i,
      j: cell.j,
      appearanceVariants: followerState.appearanceVariants
        ? { ...followerState.appearanceVariants }
        : followerState.gender
          ? { gender: followerState.gender }
          : undefined,
      gender: followerState.gender,
      label: followerState.label,
      name: followerState.name,
      type: followerState.type,
    })
    if (!follower) continue
    applyPortableUnitState(follower as Partial<SaveEntityState>, followerState, { keepAlive: true })
    follower.followingHero = true
    refreshUnitEquipmentStats(follower)
    travelUnits.push(follower)
  }

  refreshTravelPartyFog(game, travelUnits)
  controls.init?.()
  if (equippedItem) controls.setEquippedItem?.(equippedItem)
  controls.context?.menu?.updateHeroStatus?.(hero)
  if (controls.context?.menu?.isMiniMapActive?.() !== false) {
    controls.context?.menu?.updatePlayerMiniMapEvt?.(player)
    controls.context?.menu?.updateCameraMiniMap?.()
  }
}

export function applyRuntimePortableUnitState(
  target: Partial<SaveEntityState>,
  source: SaveEntityState,
  options?: { keepAlive?: boolean }
): void {
  applyPortableUnitState(target, source, options)
}
