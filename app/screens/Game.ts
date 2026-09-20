import type { Application } from 'pixi.js'
import { Container } from 'pixi.js'
import Map from '../classes/map/Map'
import { cleanupDebugArtifacts } from '../dev-console/actions/shared'
import type { DevConsoleRuntimeContext } from '../dev-console/types'
import { getCaveInteriorBlueprint } from '../lib/buildings/caveBlueprint'
import { canUnitEnterBuildingInterior } from '../lib/buildings/interiorAccess'
import { getBuildingInteriorBlueprintType, getBuildingInteriorEntryCell } from '../lib/buildings/interiors'
import { getKnownBuildings } from '../lib/buildings/knownBuildings'
import { clearAllCombatFeedback } from '../lib/combat/combatFeedback'
import { t } from '../lib/lang'
import {
  MapBlueprintLoadError,
  loadPregeneratedInteriorBlueprint,
  loadPregeneratedWorldMapBlueprint,
  type WorldBlueprintFileCache,
} from '../serialization/MapBlueprintLoader'
import {
  activateBuildingInteriorSpace,
  deactivateBuildingInteriorSpace,
  ensureBuildingInteriorSpace,
  ensureRuntimeBuildingInteriorSpace,
  getBuildingInteriorSpaceForUnit,
  moveHeroPartyIntoBuildingInteriorSpace,
  moveHeroPartyOutOfBuildingInteriorSpace,
  refreshMapSpaceEntityVisibility,
  routeUnitIntoBuildingInteriorSpaceAndMoveBack,
  syncBuildingInteriorShelterOccupants,
  syncBuildingStableInteriorHorses,
  type BuildingInteriorRuntimeSpace,
} from '../services/BuildingInteriorSpaceSystem'
import {
  prepareGameIntroduction,
  showGameIntroduction,
  startGameIntroduction,
} from '../services/introduction/GameIntroduction'
import {
  prepareTutorialOpening,
  restoreTutorialOpening,
  showTutorialOpening,
  startTutorialOpening,
} from '../services/tutorial/TutorialOpening'
import { type RegionEdge } from '../services/world/WorldRegionTravelSystem'
import type { GameContextLike } from '../types/context'
import type { BuildingEntity, UnitEntity, UnitResourceDeliveryReturnTask } from '../types/entities'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { CampaignSave, GameConfig, SaveEntityState, SaveRecord, SerializedSave } from '../types/save'
import { playBuildingInteriorDoorTransition, type BuildingInteriorTransition } from '../ui/BuildingInteriorTransition'
import type { GameLoadingScreen } from '../ui/GameLoadingScreen'
import { loadGameRuntime, startGameRuntime } from './game/GameBootFlow'
import {
  routeInteriorUnitToExit as routeInteriorUnitToExitRuntime,
  synchronizeInteriorOccupantsAfterTimeJump,
  travelIntoBuildingInterior as travelIntoBuildingInteriorRuntime,
  travelOutOfBuildingInterior as travelOutOfBuildingInteriorRuntime,
  type BuildingInteriorSession,
  type BuildingInteriorTravelGame,
} from './game/GameBuildingInteriorTravel'
import { handleGameDefeat } from './game/GameDefeatRecovery'
import { changeGameFactionRelation } from './game/GameFactionRelations'
import { autosaveGame, autosaveGameCampaign, saveGameManually } from './game/GameManualSave'
import { type BlueprintRuntimeMap } from './game/GameMapBlueprintRuntime'
import {
  routeUnitResourceDelivery as routeUnitResourceDeliveryRuntime,
  type ResourceDeliveryGame,
} from './game/GameResourceDelivery'
import { createGameRuntimeContext, createGameUiRuntime, type GameRuntimeContext } from './game/GameRuntimeContext'
import {
  acquireGameWakeLock,
  applyGameZoom,
  attachGameWindowListeners,
  checkGameDefeat,
  handleGameDocumentHidden,
  handleGameDocumentVisible,
  removeGameWindowListeners,
  setGameOrientationBlocked,
  toggleGamePause,
} from './game/GameRuntimeLifecycle'
import { mountGameRuntime } from './game/GameRuntimeMount'
import { applyMapConfig, getGameScreenRect, getMapWorldBounds } from './game/GameStateHelpers'
import { applyRuntimePortableUnitState, runtimeHeroUnit, type TravelPartyGame } from './game/GameTravelParty'
import type { NewGameBootOptions } from './game/GameWorldBoot'
import { bootGameFromConfig, bootGameFromSave, bootGameFromSeedSave } from './game/GameWorldBoot'
import {
  debugTeleportWorldMap as debugTeleportWorldMapRuntime,
  preloadWorldRegion as preloadWorldRegionRuntime,
  travelToWorldRegion as travelToWorldRegionRuntime,
  type WorldMapDebugTeleportTarget,
  type WorldRegionTravelGame,
} from './game/GameWorldRegionTravel'
import { createEmptyRuntimeServices, destroyRuntimeServices, type RuntimeServices } from './game/runtimeServices'

type RuntimeMapInstance = InstanceType<typeof Map> &
  RuntimeMap & {
    destroy(options?: Parameters<Container['destroy']>[0]): void
  }

type MapInstance = RuntimeMapInstance & {
  pregeneratedBlueprintId?: BlueprintRuntimeMap['pregeneratedBlueprintId']
}

type RequiredWorldBlueprintOptions = Parameters<typeof loadPregeneratedWorldMapBlueprint>[0]
type RequiredInteriorBlueprintOptions = Parameters<typeof loadPregeneratedInteriorBlueprint>[0]

export default class Game extends Container {
  _pausedByVisibility: boolean
  _pausedByOrientation: boolean
  _activeBuildingInteriorSpace: BuildingInteriorRuntimeSpace | null
  _buildingInteriorSession: BuildingInteriorSession | null
  _lastSavedRecord: SaveRecord | null
  _restartSaveData: SaveRecord | null
  _campaignSave: CampaignSave | null
  _isRestarting: boolean
  config: GameConfig | null
  onQuit: (() => void) | null
  context: GameRuntimeContext
  _loadingScreen?: GameLoadingScreen | BuildingInteriorTransition | null
  _wakeLock?: WakeLockSentinel | null
  _onVisibilityChange?: () => void
  _onKeydown?: (evt: KeyboardEvent) => void
  _onResize?: () => void
  _onDocumentVisibilityChange?: () => void
  _runtimeServices: RuntimeServices
  _worldRegionBlueprintCache: globalThis.Map<
    string,
    Promise<Awaited<ReturnType<typeof loadPregeneratedWorldMapBlueprint>>>
  >
  _worldBlueprintFileCache: WorldBlueprintFileCache
  _worldRegionTransitioning: boolean

  constructor(
    app: Application,
    gamebox: HTMLElement,
    config: GameConfig | null = null,
    onQuit: (() => void) | null = null
  ) {
    super()
    this._pausedByVisibility = false
    this._pausedByOrientation = false
    this._activeBuildingInteriorSpace = null
    this._buildingInteriorSession = null
    this._lastSavedRecord = null
    this._restartSaveData = null
    this._campaignSave = null
    this._isRestarting = false
    this._runtimeServices = createEmptyRuntimeServices()
    this._worldRegionBlueprintCache = new globalThis.Map()
    this._worldBlueprintFileCache = new globalThis.Map()
    this._worldRegionTransitioning = false
    this.config = config
    this.onQuit = onQuit
    this.context = createGameRuntimeContext(this, app, gamebox) as GameRuntimeContext
    if (config !== null) {
      this.start().catch(error => {
        this._loadingScreen?.destroy()
        console.error('Unable to start game', error)
        this.quit()
      })
    }
  }

  _prepareIntroduction(): Promise<void> {
    return prepareGameIntroduction(this)
  }
  _showIntroduction(): void {
    showGameIntroduction(this)
  }
  _startIntroduction(): void {
    startGameIntroduction(this)
  }
  _prepareTutorial(): Promise<void> {
    return prepareTutorialOpening(this)
  }
  _restoreTutorial(): Promise<void> {
    return restoreTutorialOpening(this)
  }
  _showTutorial(): void {
    showTutorialOpening(this)
  }
  _startTutorial(): void {
    startTutorialOpening(this)
  }

  async start(): Promise<void> {
    await startGameRuntime(this)
  }

  _yieldToBrowser(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()))
  }

  _measure<T>(name: string, callback: () => T): T {
    return this.context.performance?.measure?.(name, callback) ?? callback()
  }

  _gameContext(): GameContextLike {
    const { map, player, controls, menu, scheduler } = this.context
    if (!map || !player || !controls || !menu || !scheduler) {
      throw new Error('Game runtime is not ready')
    }
    return this.context as GameContextLike
  }

  _map(): MapInstance {
    if (!this.context.map) throw new Error('Game map is not ready')
    return this.context.map as MapInstance
  }

  async _updateLoading(messageKey: string, progress: number): Promise<void> {
    this._loadingScreen?.update(messageKey, progress)
    await this._yieldToBrowser()
  }

  async _loadRequiredWorldMapBlueprint(options: RequiredWorldBlueprintOptions) {
    const cacheKey =
      options.worldRegionId && options.worldId
        ? `${options.worldId}:${options.size ?? 144}:${options.playerCiv ?? ''}:${options.worldRegionId}`
        : null
    if (cacheKey) {
      const cached = this._worldRegionBlueprintCache.get(cacheKey)
      if (cached) return cached
    }
    try {
      const promise = loadPregeneratedWorldMapBlueprint(options, this._worldBlueprintFileCache)
      if (cacheKey) this._worldRegionBlueprintCache.set(cacheKey, promise)
      return await promise
    } catch (error) {
      if (cacheKey) this._worldRegionBlueprintCache.delete(cacheKey)
      if (error instanceof MapBlueprintLoadError) {
        console.error(`[world maps] ${error.reason}: ${error.message}`)
        throw new Error(t('mapBlueprintUnavailable'))
      }
      throw error
    }
  }

  async preloadWorldRegion(worldRegionId: string): Promise<void> {
    await preloadWorldRegionRuntime(this as WorldRegionTravelGame, worldRegionId)
  }

  async travelToWorldRegion(worldRegionId: string, edge: RegionEdge): Promise<void> {
    await travelToWorldRegionRuntime(this as WorldRegionTravelGame, worldRegionId, edge)
  }

  async debugTeleportWorldMap({ worldI, worldJ, worldRegionId }: WorldMapDebugTeleportTarget): Promise<void> {
    await debugTeleportWorldMapRuntime(this as WorldRegionTravelGame, { worldI, worldJ, worldRegionId })
  }

  async _loadRequiredInteriorBlueprint(options: RequiredInteriorBlueprintOptions = {}) {
    try {
      return await loadPregeneratedInteriorBlueprint(options)
    } catch (error) {
      if (error instanceof MapBlueprintLoadError) {
        console.error(`[maps] ${error.reason}: ${error.message}`)
        throw new Error(t('mapBlueprintUnavailable'))
      }
      throw error
    }
  }

  async _acquireWakeLock(): Promise<void> {
    return acquireGameWakeLock(this)
  }

  _attachWindowListeners(): void {
    attachGameWindowListeners(this)
  }

  _removeWindowListeners(): void {
    removeGameWindowListeners(this)
  }

  _handleDocumentHidden(): void {
    handleGameDocumentHidden(this)
  }

  _handleDocumentVisible(): void {
    handleGameDocumentVisible(this)
  }

  setOrientationBlocked(blocked: boolean): void {
    setGameOrientationBlocked(this, blocked)
  }

  _applyMapConfig(map: RuntimeMap, config: GameConfig = {}): void {
    applyMapConfig(map, config)
  }

  _resetOverlayDom(): void {
    document.getElementById('pause')?.remove()
    document.getElementById('defeat')?.remove()
  }

  _resetRuntimeState(): void {
    this._pausedByVisibility = false
    this._pausedByOrientation = false
    // The scheduler and runtime callbacks retain this context across world changes.
    Object.assign(this.context, {
      player: null,
      players: [],
      map: null,
      controls: null,
      dayNight: null,
      weather: null,
      tributeRaids: null,
      devConsole: null,
      devConsoleOpen: false,
      paused: false,
      defeat: false,
    })
  }

  _createRuntime(): void {
    const { context } = this
    context.map = new Map(context) as RuntimeMapInstance
  }

  _createUiRuntime(): void {
    createGameUiRuntime(this.context)
  }

  _mountRuntime(dayNightElapsedMs: number | null | undefined = null): void {
    mountGameRuntime(this, dayNightElapsedMs)
  }

  _isBuildingInteriorLayerOpen(): boolean {
    return Boolean(this._activeBuildingInteriorSpace)
  }

  async _openBuildingInteriorLayer(building: BuildingEntity): Promise<void> {
    if (this._activeBuildingInteriorSpace) return
    const context = this._gameContext()
    const hero = this._runtimeHeroUnit()
    const blueprint =
      building.type === 'Cave'
        ? getCaveInteriorBlueprint(building)
        : await this._loadRequiredInteriorBlueprint({
            buildingSize: building.size,
            buildingType: getBuildingInteriorBlueprintType(building),
            random: () => context.map.random(),
          })
    const space = ensureBuildingInteriorSpace(context, building, blueprint)
    syncBuildingInteriorShelterOccupants(context, space)
    await playBuildingInteriorDoorTransition(
      () => {
        if (hero) {
          if (!moveHeroPartyIntoBuildingInteriorSpace(context, hero, space)) {
            deactivateBuildingInteriorSpace(context, space)
            this._activeBuildingInteriorSpace = null
            context.menu?.setHeroInteractionPrompt?.(null)
            context.menu?.updateHeroStatus?.(hero)
            return
          }
        }
        activateBuildingInteriorSpace(context, space)
        this._activeBuildingInteriorSpace = space
        if (hero) {
          context.controls?.focusHeroCamera?.()
          context.controls?.updateVisibleCells?.()
          refreshMapSpaceEntityVisibility(context)
        }
        context.menu?.refreshMiniMap?.()
        context.menu?.setHeroInteractionPrompt?.('heroInteractionExit')
        context.menu?.updateHeroStatus?.(hero)
      },
      {
        blockInput: true,
        beforeReveal: () => {
          this._refreshSceneLighting()
          context.app.render()
        },
      }
    )
  }

  async _closeBuildingInteriorLayer(): Promise<void> {
    const context = this._gameContext()
    const hero = this._runtimeHeroUnit()
    const space = (hero && getBuildingInteriorSpaceForUnit(hero)) || this._activeBuildingInteriorSpace
    if (!space) return
    await playBuildingInteriorDoorTransition(
      () => {
        if (hero) {
          if (!moveHeroPartyOutOfBuildingInteriorSpace(context, hero, space)) return
        } else {
          deactivateBuildingInteriorSpace(context, space)
        }
        this._activeBuildingInteriorSpace = null
        if (hero) {
          context.controls?.focusHeroCamera?.()
          context.controls?.updateVisibleCells?.()
          refreshMapSpaceEntityVisibility(context)
        }
        context.menu?.refreshMiniMap?.()
        context.menu?.setHeroInteractionPrompt?.(null)
        context.menu?.updateHeroStatus?.(hero)
      },
      {
        blockInput: true,
        beforeReveal: () => {
          this._refreshSceneLighting()
          context.app.render()
        },
      }
    )
  }

  _refreshSceneLighting(): void {
    const { lights, weather } = this._runtimeServices
    weather?.refresh()
    lights?.refresh()
  }

  _withBuildingInteriorLayerRuntimeRestored<T>(callback: () => T): T {
    return callback()
  }

  _getScreenRect(): { x: number; y: number; width: number; height: number } {
    return getGameScreenRect(this, this.context.app)
  }

  _getMapWorldBounds(): { x: number; y: number; width: number; height: number } {
    return getMapWorldBounds(this.context.map?.size ?? 0)
  }

  _destroyRuntime({ preserveLoadingScreen = false }: { preserveLoadingScreen?: boolean } = {}): void {
    this._buildingInteriorSession = null
    this._activeBuildingInteriorSpace = null
    if (!preserveLoadingScreen) {
      this._loadingScreen?.destroy()
      this._loadingScreen = null
    }
    this._resetOverlayDom()
    this._removeWindowListeners()
    if (this.context.map) {
      cleanupDebugArtifacts(this.context as DevConsoleRuntimeContext)
    }
    clearAllCombatFeedback()
    this.context.scheduler?.clear?.()
    this.context.performance?.reset?.()
    this._runtimeServices = destroyRuntimeServices(this._runtimeServices, this.context)
    this.context.controls?.destroy({ children: true })
    this.context.devConsole?.destroy()
    this.context.menu?.destroy?.()
    this.context.map?.destroy({ children: true })
    this.removeChildren()
    this._resetRuntimeState()
  }

  async _bootFromConfig(config: GameConfig, options: NewGameBootOptions = {}): Promise<void> {
    await bootGameFromConfig(this, config, options)
    this._restartSaveData = structuredClone(this._campaignSave)
  }

  async _bootFromSeedSave(json: SerializedSave): Promise<void> {
    await bootGameFromSeedSave(this, json)
  }

  async _bootFromSave(json: SerializedSave): Promise<void> {
    await bootGameFromSave(this, json)
    this._lastSavedRecord = structuredClone(this._campaignSave)
  }

  save(): { key: string; name: string } {
    return saveGameManually.call(this)
  }

  autosave(): { key: string; name: string } | null {
    return autosaveGame.call(this)
  }

  _autosaveCampaign(): void {
    autosaveGameCampaign.call(this)
  }

  _changeFactionRelation(factionId: string, delta: number): void {
    return changeGameFactionRelation.call(this, factionId, delta)
  }

  _runtimeHeroUnit(): UnitEntity | null {
    return runtimeHeroUnit(this as TravelPartyGame)
  }

  _applyPortableUnitState(
    target: Partial<SaveEntityState>,
    source: SaveEntityState,
    options?: { keepAlive?: boolean }
  ): void {
    applyRuntimePortableUnitState(target, source, options)
  }

  async travelIntoBuildingInterior(building: BuildingEntity): Promise<void> {
    await travelIntoBuildingInteriorRuntime(this as BuildingInteriorTravelGame, building)
  }

  getBuildingInteriorEntryTargetForCell(cell: RuntimeCell): BuildingEntity | null {
    const context = this._gameContext()
    for (const building of getKnownBuildings(context)) {
      const entryCell = getBuildingInteriorEntryCell(building, context.map.grid)
      if (entryCell !== cell) continue
      return building
    }
    return null
  }

  routeUnitIntoBuildingInterior(unit: UnitEntity, building: BuildingEntity): boolean {
    if (!canUnitEnterBuildingInterior(unit, building)) return false
    const context = this._gameContext()
    const space = ensureRuntimeBuildingInteriorSpace(context, building)
    return space ? routeUnitIntoBuildingInteriorSpaceAndMoveBack(context, unit, space) : false
  }

  async travelOutOfBuildingInterior(): Promise<void> {
    await travelOutOfBuildingInteriorRuntime(this as BuildingInteriorTravelGame)
  }

  async routeUnitResourceDelivery(unit: UnitEntity, building: BuildingEntity): Promise<boolean> {
    return routeUnitResourceDeliveryRuntime(this as ResourceDeliveryGame, unit, building)
  }

  routeInteriorUnitToExit(unit: UnitEntity, returnTask: UnitResourceDeliveryReturnTask | null = null): void {
    routeInteriorUnitToExitRuntime(this as BuildingInteriorTravelGame, unit, returnTask)
  }

  synchronizeBuildingInteriorAfterTimeJump(): void {
    synchronizeInteriorOccupantsAfterTimeJump(this as BuildingInteriorTravelGame)
  }

  syncStableInteriorHorses(building: BuildingEntity): void {
    syncBuildingStableInteriorHorses(this._gameContext(), building)
  }

  async load(json: SaveRecord): Promise<void> {
    await loadGameRuntime(this, json)
  }

  applyZoom(): void {
    applyGameZoom(this)
  }

  quit(): void {
    this._destroyRuntime()
    if (this.onQuit) this.onQuit()
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this._worldRegionBlueprintCache.clear()
    this._worldBlueprintFileCache.clear()
    this._wakeLock?.release()
    document.removeEventListener('visibilitychange', this._onVisibilityChange as EventListener)
    this._destroyRuntime()
    this.context.scheduler?.destroy?.()
    this.context.performance?.destroy?.()
    this.context.scheduler = null
    this.context.performance = null
    super.destroy(options)
  }

  _handleDefeat(): void {
    handleGameDefeat(this)
  }

  checkDefeat(): boolean {
    return checkGameDefeat(this)
  }

  togglePause(pause: boolean, options: { silent?: boolean } = {}): void {
    toggleGamePause(this, pause, options)
  }
}
