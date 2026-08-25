import { getFreeLandCellAroundInstance, getReliefOffset, teleportRuntimeUnitToCell, updateInstanceVisibility } from '../../lib'
import { refreshUnitEquipmentStats } from '../../lib/equipmentStats'
import { syncHeroResourceLoadState } from '../../lib/resourceCarry'
import {
  addChildWorldToCampaign,
  createInitialCampaignSave,
  enterCampaignWorld,
  getCurrentWorldState,
  returnToParentWorld,
  updateCurrentWorldState,
} from '../../serialization/CampaignSave'
import { serializeGame } from '../../serialization/SaveSerializer'
import { PortalTravelTransition, type PortalRevealPoint } from '../../ui/PortalTravelTransition'
import type { GameContextLike } from '../../types/context'
import type { ResourceEntity, UnitEntity } from '../../types/entities'
import type { Viewport } from '../../types/geometry'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { CampaignSave, GameConfig, SaveEntityState, SerializedSave } from '../../types/save'
import {
  PORTAL_RESOURCE_TYPE,
  applyPortableUnitState,
  configForPortalWorld,
  extractPortalParty,
  heroTravelImageSrc,
  portalWorldId,
  withFogEnabledState,
  worldStateWithCampaignClock,
  type PortalPartyState,
  type PortalWorldConfig,
} from './GameStateHelpers'

type PortalRuntimeMap = RuntimeMap & {
  _flushFogQueue(): void
  mapFog: {
    viewportRenderer: {
      invalidate(): void
      update(viewport: Viewport, force?: boolean): void
    }
  }
  updateRenderChunks(viewport: Viewport): void
}

type PortalHeroInvincibility = {
  hero: UnitEntity
  previousDevInvincible?: boolean
}

export type PortalTravelGame = {
  _campaignSave: CampaignSave | null
  _isRestarting: boolean
  _loadingScreen?: { destroy?(): void } | PortalTravelTransition | null
  _restartSaveData: CampaignSave | null
  context: {
    menu?: (GameContextLike['menu'] & { show?(): void }) | null
    player?: GameContextLike['player'] | null
  }
  _autosaveCampaign(): void
  _bootFromConfig(config: GameConfig, options?: { dayNightElapsedMs?: number | null }): Promise<void>
  _bootFromSave(json: SerializedSave): Promise<void>
  _destroyRuntime(options?: { preserveLoadingScreen?: boolean }): void
  _gameContext(): GameContextLike
  _map(): RuntimeMap & { revealEverything: boolean }
}

function protectPortalHero(hero: UnitEntity | null): PortalHeroInvincibility | null {
  if (!hero) return null
  const previousDevInvincible = hero.devInvincible
  hero.devInvincible = true
  return { hero, previousDevInvincible }
}

function restorePortalHeroProtection(protection: PortalHeroInvincibility | null): void {
  if (!protection) return
  if (protection.previousDevInvincible === undefined) {
    delete protection.hero.devInvincible
  } else {
    protection.hero.devInvincible = protection.previousDevInvincible
  }
}

function getPortalRevealPoint(game: PortalTravelGame, hero: UnitEntity | null): PortalRevealPoint | null {
  if (!hero) return null
  const { controls } = game._gameContext()
  return controls.localToScreen(hero.x - controls.camera.x, hero.y + getReliefOffset(hero) - controls.camera.y)
}

export function configForRuntimePortalWorld(
  game: PortalTravelGame,
  color: 'blue' | 'yellow' | 'red',
  worldId: string,
  now: number
): PortalWorldConfig {
  const { player, map } = game._gameContext()
  return configForPortalWorld({ color, map, now, player, worldId })
}

export function runtimeHeroUnit(game: PortalTravelGame): UnitEntity | null {
  const { player, controls } = game._gameContext()
  return (
    controls.heroUnit ||
    player.units.find(unit => unit.controlMode === 'hero' || unit.type === 'Hero') ||
    player.units.find(unit => unit.isChief) ||
    player.units[0] ||
    null
  )
}

export function removeExistingTravelFollowers(game: PortalTravelGame): void {
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

export function findPortalArrivalCell(game: PortalTravelGame): RuntimeCell | null {
  const { map } = game._gameContext()
  const portal = [...map.resources].find(resource => resource.type === PORTAL_RESOURCE_TYPE)
  if (!portal) return null

  return getFreeLandCellAroundInstance(
    portal,
    map.grid,
    cells => cells[Math.floor(map.random() * cells.length)]
  )
}

export function findPartyFollowerArrivalCell(game: PortalTravelGame, anchor: UnitEntity): RuntimeCell | null {
  const { map } = game._gameContext()
  return getFreeLandCellAroundInstance(
    { i: anchor.i, j: anchor.j, size: 1 },
    map.grid,
    cells => cells[Math.floor(map.random() * cells.length)]
  )
}

export function teleportRuntimeUnit(game: PortalTravelGame, unit: UnitEntity, cell: RuntimeCell): void {
  const { map } = game._gameContext()
  teleportRuntimeUnitToCell(map, unit, cell)
}

export function refreshPortalPartyFog(game: PortalTravelGame, units: UnitEntity[]): void {
  const { map, controls, menu } = game._gameContext()
  if (map.revealEverything) return
  const runtimeMap = map as PortalRuntimeMap
  const viewport = (controls as { cameraController?: { getViewportRect?: () => Viewport } }).cameraController?.getViewportRect?.()

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
  menu.updateResourcesMiniMap?.()
}

export function applyFogStateToCell(game: PortalTravelGame, i: number, j: number): void {
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

export function clearTravelUnitFogViewers(game: PortalTravelGame, units: UnitEntity[]): void {
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

export function resetPlayedFogForFreshWorld(game: PortalTravelGame): void {
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

export function applyPortalPartyToRuntime(
  game: PortalTravelGame,
  party: PortalPartyState,
  arrivalCell: RuntimeCell | null = null,
  { freshWorld = false }: { freshWorld?: boolean } = {}
): void {
  const { player, controls } = game._gameContext()
  const hero = runtimeHeroUnit(game)
  if (!hero) return

  if (freshWorld) resetPlayedFogForFreshWorld(game)
  clearTravelUnitFogViewers(game, [hero, ...player.units.filter(unit => unit !== hero && unit.followingHero)])
  if (party.hero) applyPortableUnitState(hero as Partial<SaveEntityState>, party.hero, { keepAlive: true })
  syncHeroResourceLoadState(hero)
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
      name: followerState.name,
      type: followerState.type,
    })
    if (!follower) continue
    applyPortableUnitState(follower as Partial<SaveEntityState>, followerState, { keepAlive: true })
    follower.followingHero = true
    syncHeroResourceLoadState(follower)
    refreshUnitEquipmentStats(follower)
    travelUnits.push(follower)
  }

  refreshPortalPartyFog(game, travelUnits)
  controls.init?.()
  controls.context?.menu?.updateHeroStatus?.(hero)
  controls.context?.menu?.updatePlayerMiniMapEvt?.(player)
  controls.context?.menu?.updateCameraMiniMap?.()
}

export function applyRuntimePortableUnitState(
  target: Partial<SaveEntityState>,
  source: SaveEntityState,
  options?: { keepAlive?: boolean }
): void {
  applyPortableUnitState(target, source, options)
}

export async function travelThroughPortal(
  game: PortalTravelGame,
  portal: ResourceEntity,
  color: 'blue' | 'yellow' | 'red'
): Promise<void> {
  if (game._isRestarting) return
  game._isRestarting = true
  let departureHeroProtection: PortalHeroInvincibility | null = null
  let arrivalHeroProtection: PortalHeroInvincibility | null = null
  let arrivalRevealPoint: PortalRevealPoint | null = null
  const now = Date.now()
  const currentWorldState = withFogEnabledState(serializeGame(game._gameContext()))
  const party = extractPortalParty(currentWorldState)
  const departureHero = runtimeHeroUnit(game)
  const campaign = game._campaignSave
    ? updateCurrentWorldState(game._campaignSave, currentWorldState, now)
    : createInitialCampaignSave(currentWorldState, { now })
  const currentCampaignWorld = campaign.worlds[campaign.currentWorldId]
  const shouldReturnToParent = Boolean(currentCampaignWorld?.parentWorldId && currentCampaignWorld.color === color)
  const targetWorldId = portalWorldId(game._campaignSave?.currentWorldId, portal, color)
  const existingTarget = campaign.worlds[targetWorldId]
  const portalTransition = new PortalTravelTransition(color, { heroImageSrc: heroTravelImageSrc(game.context.player) })
  game._loadingScreen = portalTransition

  try {
    departureHeroProtection = protectPortalHero(departureHero)
    await portalTransition.playDeparture(getPortalRevealPoint(game, departureHero))
    portalTransition.update('generatingWorld', 0.02)

    if (shouldReturnToParent) {
      const nextCampaign = returnToParentWorld(campaign, now)
      game._campaignSave = structuredClone(nextCampaign)
      game._restartSaveData = structuredClone(nextCampaign)
      const parentState = worldStateWithCampaignClock(
        getCurrentWorldState(nextCampaign),
        game._campaignSave?.clock?.dayNightElapsedMs
      )
      game._destroyRuntime({ preserveLoadingScreen: true })
      await game._bootFromSave(withFogEnabledState(structuredClone(parentState)))
      game._map().revealEverything = false
      applyPortalPartyToRuntime(game, party, findPortalArrivalCell(game))
      const arrivalHero = runtimeHeroUnit(game)
      arrivalHeroProtection = protectPortalHero(arrivalHero)
      arrivalRevealPoint = getPortalRevealPoint(game, arrivalHero)
      const targetState = withFogEnabledState(serializeGame(game._gameContext()))
      const committedCampaign = updateCurrentWorldState(nextCampaign, targetState, now)
      game._campaignSave = structuredClone(committedCampaign)
      game._restartSaveData = structuredClone(committedCampaign)
      game._autosaveCampaign()
    } else if (existingTarget) {
      const nextCampaign = enterCampaignWorld(campaign, targetWorldId, now)
      game._campaignSave = structuredClone(nextCampaign)
      game._restartSaveData = structuredClone(nextCampaign)
      game._destroyRuntime({ preserveLoadingScreen: true })
      await game._bootFromSave(
        withFogEnabledState(
          worldStateWithCampaignClock(structuredClone(existingTarget.state), game._campaignSave?.clock?.dayNightElapsedMs)
        )
      )
      game._map().revealEverything = false
      applyPortalPartyToRuntime(game, party, findPortalArrivalCell(game))
      const arrivalHero = runtimeHeroUnit(game)
      arrivalHeroProtection = protectPortalHero(arrivalHero)
      arrivalRevealPoint = getPortalRevealPoint(game, arrivalHero)
      const targetState = withFogEnabledState(serializeGame(game._gameContext()))
      const committedCampaign = updateCurrentWorldState(nextCampaign, targetState, now)
      game._campaignSave = structuredClone(committedCampaign)
      game._restartSaveData = structuredClone(committedCampaign)
      game._autosaveCampaign()
    } else {
      const parentWorldId = campaign.currentWorldId
      const portalWorld = configForRuntimePortalWorld(game, color, targetWorldId, now)
      game._destroyRuntime({ preserveLoadingScreen: true })
      await game._bootFromConfig(portalWorld.config, { dayNightElapsedMs: campaign.clock?.dayNightElapsedMs })
      game._map().revealEverything = false
      applyPortalPartyToRuntime(game, party, findPortalArrivalCell(game), { freshWorld: true })
      const arrivalHero = runtimeHeroUnit(game)
      arrivalHeroProtection = protectPortalHero(arrivalHero)
      arrivalRevealPoint = getPortalRevealPoint(game, arrivalHero)
      const childState = withFogEnabledState(serializeGame(game._gameContext()))
      const isBanditEncounter = portalWorld.config.portalEncounter === 'bandit'
      const nextCampaign = addChildWorldToCampaign(campaign, childState, {
        color,
        entryPortalId: portal.label || `${portal.i},${portal.j}`,
        factionIds: isBanditEncounter ? [] : [portalWorld.factionId],
        factions: isBanditEncounter ? {} : { [portalWorld.factionId]: portalWorld.faction },
        name: `Monde ${color}`,
        now,
        parentWorldId,
        worldId: targetWorldId,
      })
      game._campaignSave = structuredClone(nextCampaign)
      game._restartSaveData = structuredClone(nextCampaign)
      game._autosaveCampaign()
    }
    game.context.menu?.show?.()
  } finally {
    const loadingScreen = game._loadingScreen
    if (loadingScreen instanceof PortalTravelTransition) await loadingScreen.finish({ revealFrom: arrivalRevealPoint })
    else loadingScreen?.destroy?.()
    restorePortalHeroProtection(arrivalHeroProtection)
    restorePortalHeroProtection(departureHeroProtection)
    game._loadingScreen = null
    game._isRestarting = false
  }
}
