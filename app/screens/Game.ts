import type { Application } from 'pixi.js'
import { Container, type ContainerChild } from 'pixi.js'
import { t } from '../lib/lang'
import Map from '../classes/map/Map'
import { getReliefOffset } from '../lib'
import { clearAllCombatFeedback } from '../lib/combat/combatFeedback'
import { adjustFactionRelation } from '../lib/combat/factions'
import { getBuildingInteriorBlueprintType, getBuildingInteriorEntryCell } from '../lib/buildings/interiors'
import { canUnitEnterBuildingInterior } from '../lib/buildings/interiorAccess'
import { getKnownBuildings } from '../lib/buildings/knownBuildings'
import { getEntityMapPoint } from '../lib/mapSpaces'
import { autosaveRecord, buildSaveRecord, saveRecord as saveRecordToStorage } from '../serialization/SaveStorage'
import { createInitialCampaignSave, isCampaignSave } from '../serialization/CampaignSave'
import {
  MapBlueprintLoadError,
  loadPregeneratedInteriorBlueprint,
  loadPregeneratedMapBlueprint,
} from '../serialization/MapBlueprintLoader'
import { cleanupDebugArtifacts } from '../dev-console/actions/shared'
import {
  addRuntimeServiceLayers,
  createEmptyRuntimeServices,
  createRuntimeServices,
  destroyRuntimeServices,
  type RuntimeServices,
} from './game/runtimeServices'
import {
  applyMapConfig,
  ensureCampaignPlayerRoster,
  getGameScreenRect,
  getMapWorldBounds,
  type PortalPartyState,
  type PortalWorldConfig,
} from './game/GameStateHelpers'
import {
  applyFogStateToCell,
  applyPortalPartyToRuntime,
  applyRuntimePortableUnitState,
  clearTravelUnitFogViewers,
  configForRuntimePortalWorld,
  findPartyFollowerArrivalCell,
  findPortalArrivalCell,
  refreshPortalPartyFog,
  removeExistingTravelFollowers,
  resetPlayedFogForFreshWorld,
  runtimeHeroUnit,
  teleportRuntimeUnit,
  travelThroughPortal as travelThroughPortalRuntime,
  type PortalTravelGame,
} from './game/GamePortalTravel'
import {
  buildBuildingInteriorSessionSaveRecord,
  routeInteriorUnitToExit as routeInteriorUnitToExitRuntime,
  synchronizeInteriorOccupantsAfterTimeJump,
  travelIntoBuildingInterior as travelIntoBuildingInteriorRuntime,
  travelOutOfBuildingInterior as travelOutOfBuildingInteriorRuntime,
  type BuildingInteriorSession,
  type BuildingInteriorTravelGame,
} from './game/GameBuildingInteriorTravel'
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
import { loadGameRuntime, restartGameRuntime, startGameRuntime } from './game/GameBootFlow'
import { type BlueprintRuntimeMap } from './game/GameMapBlueprintRuntime'
import { bootGameFromConfig, bootGameFromSave, bootGameFromSeedSave } from './game/GameWorldBoot'
import { createGameRuntimeContext, createGameUiRuntime, type GameRuntimeContext } from './game/GameRuntimeContext'
import {
  routeUnitResourceDelivery as routeUnitResourceDeliveryRuntime,
  type ResourceDeliveryGame,
} from './game/GameResourceDelivery'
import type { GameLoadingScreen } from '../ui/GameLoadingScreen'
import { playBuildingInteriorDoorTransition, type BuildingInteriorTransition } from '../ui/BuildingInteriorTransition'
import type { PortalRevealPoint, PortalTravelTransition } from '../ui/PortalTravelTransition'
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
import type { GameContextLike } from '../types/context'
import type { CampaignSave, GameConfig, SaveEntityState, SaveRecord, SerializedSave } from '../types/save'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { BuildingEntity, ResourceEntity, UnitEntity, UnitResourceDeliveryReturnTask } from '../types/entities'
import type { DevConsoleRuntimeContext } from '../dev-console/types'

type RuntimeMapInstance = InstanceType<typeof Map> &
  RuntimeMap & {
    destroy(options?: Parameters<Container['destroy']>[0]): void
  }

type MapInstance = RuntimeMapInstance & {
  pregeneratedBlueprintId?: BlueprintRuntimeMap['pregeneratedBlueprintId']
}

type RequiredBlueprintOptions = Parameters<typeof loadPregeneratedMapBlueprint>[0]
type RequiredInteriorBlueprintOptions = Parameters<typeof loadPregeneratedInteriorBlueprint>[0]

export default class Game extends Container {
  _pausedByVisibility: boolean
  _pausedByOrientation: boolean
  _activeBuildingInteriorSpace: BuildingInteriorRuntimeSpace | null
  _buildingInteriorSession: BuildingInteriorSession | null
  _restartSaveData: SaveRecord | null
  _campaignSave: CampaignSave | null
  _isRestarting: boolean
  config: GameConfig | null
  onQuit: (() => void) | null
  context: GameRuntimeContext
  _loadingScreen?: GameLoadingScreen | PortalTravelTransition | BuildingInteriorTransition | null
  _wakeLock?: WakeLockSentinel | null
  _onVisibilityChange?: () => void
  _onKeydown?: (evt: KeyboardEvent) => void
  _onResize?: () => void
  _onDocumentVisibilityChange?: () => void
  _runtimeServices: RuntimeServices

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
    this._restartSaveData = null
    this._campaignSave = null
    this._isRestarting = false
    this._runtimeServices = createEmptyRuntimeServices()
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

  _getHeroRevealPoint(): PortalRevealPoint | null {
    const { controls } = this.context
    const hero = this._runtimeHeroUnit()
    if (!controls || !hero) return null
    const point = getEntityMapPoint(hero)
    return controls.localToScreen(point.x - controls.camera.x, point.y + getReliefOffset(hero) - controls.camera.y)
  }

  async _updateLoading(messageKey: string, progress: number): Promise<void> {
    this._loadingScreen?.update(messageKey, progress)
    await this._yieldToBrowser()
  }

  async _loadRequiredMapBlueprint(options: RequiredBlueprintOptions = {}) {
    try {
      return await loadPregeneratedMapBlueprint(options)
    } catch (error) {
      if (error instanceof MapBlueprintLoadError) {
        console.error(`[maps] ${error.reason}: ${error.message}`)
        throw new Error(t('mapBlueprintUnavailable'))
      }
      throw error
    }
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
    this.context = {
      ...this.context,
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
    }
  }

  _createRuntime(): void {
    const { context } = this
    context.map = new Map(context) as RuntimeMapInstance
  }

  _createUiRuntime(): void {
    createGameUiRuntime(this.context)
  }

  _mountRuntime(dayNightElapsedMs: number | null | undefined = null): void {
    const { map, controls } = this.context
    if (!map || !controls) return
    this.addChild(map as unknown as ContainerChild)
    this._runtimeServices = createRuntimeServices(
      this._gameContext(),
      map,
      () => this._getScreenRect(),
      dayNightElapsedMs
    )
    addRuntimeServiceLayers(this, this._runtimeServices)
    this.addChild(controls)
    this.applyZoom()
    this._attachWindowListeners()
  }

  _isBuildingInteriorLayerOpen(): boolean {
    return Boolean(this._activeBuildingInteriorSpace)
  }

  async _openBuildingInteriorLayer(building: BuildingEntity): Promise<void> {
    if (this._activeBuildingInteriorSpace) return
    const context = this._gameContext()
    const hero = this._runtimeHeroUnit()
    const blueprint = await this._loadRequiredInteriorBlueprint({
      buildingSize: building.size,
      buildingType: getBuildingInteriorBlueprintType(building),
      random: () => context.map.random(),
    })
    const space = ensureBuildingInteriorSpace(context, building, blueprint)
    syncBuildingInteriorShelterOccupants(context, space)
    await playBuildingInteriorDoorTransition(() => {
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
        const point = getEntityMapPoint(hero)
        context.controls?.setCamera?.(point.x, point.y)
        context.controls?.updateVisibleCells?.()
        refreshMapSpaceEntityVisibility(context)
      }
      context.menu?.refreshMiniMap?.()
      context.menu?.setHeroInteractionPrompt?.('heroInteractionExit')
      context.menu?.updateHeroStatus?.(hero)
    })
  }

  async _closeBuildingInteriorLayer(): Promise<void> {
    const context = this._gameContext()
    const hero = this._runtimeHeroUnit()
    const space = (hero && getBuildingInteriorSpaceForUnit(hero)) || this._activeBuildingInteriorSpace
    if (!space) return
    await playBuildingInteriorDoorTransition(() => {
      if (hero) {
        if (!moveHeroPartyOutOfBuildingInteriorSpace(context, hero, space)) return
      } else {
        deactivateBuildingInteriorSpace(context, space)
      }
      this._activeBuildingInteriorSpace = null
      if (hero) {
        const point = getEntityMapPoint(hero)
        context.controls?.setCamera?.(point.x, point.y)
        context.controls?.updateVisibleCells?.()
        refreshMapSpaceEntityVisibility(context)
      }
      context.menu?.refreshMiniMap?.()
      context.menu?.setHeroInteractionPrompt?.(null)
      context.menu?.updateHeroStatus?.(hero)
    })
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

  async _bootFromConfig(config: GameConfig, options: { dayNightElapsedMs?: number | null } = {}): Promise<void> {
    await bootGameFromConfig(this, config, options)
    this._restartSaveData = structuredClone(this._campaignSave)
  }

  async _bootFromSeedSave(json: SerializedSave): Promise<void> {
    await bootGameFromSeedSave(this, json)
  }

  async _bootFromSave(json: SerializedSave): Promise<void> {
    await bootGameFromSave(this, json)
  }

  save(): { key: string; name: string } {
    return this._withBuildingInteriorLayerRuntimeRestored(() => {
      const buildingInteriorRecord = buildBuildingInteriorSessionSaveRecord(this as BuildingInteriorTravelGame)
      if (buildingInteriorRecord) {
        this._restartSaveData = structuredClone(buildingInteriorRecord)
        return saveRecordToStorage(buildingInteriorRecord)
      }
      const record = buildSaveRecord(this._gameContext(), this._campaignSave)
      this._campaignSave = ensureCampaignPlayerRoster(
        isCampaignSave(record) ? structuredClone(record) : createInitialCampaignSave(record)
      )
      this._restartSaveData = structuredClone(this._campaignSave)
      return saveRecordToStorage(this._campaignSave)
    })
  }

  autosave(): { key: string; name: string } | null {
    return this._withBuildingInteriorLayerRuntimeRestored(() => {
      const buildingInteriorRecord = buildBuildingInteriorSessionSaveRecord(this as BuildingInteriorTravelGame)
      if (buildingInteriorRecord) {
        this._restartSaveData = structuredClone(buildingInteriorRecord)
        return autosaveRecord(buildingInteriorRecord, t('autosave'))
      }
      const record = buildSaveRecord(this._gameContext(), this._campaignSave)
      this._campaignSave = ensureCampaignPlayerRoster(
        isCampaignSave(record) ? structuredClone(record) : createInitialCampaignSave(record)
      )
      this._restartSaveData = structuredClone(this._campaignSave)
      return autosaveRecord(this._campaignSave, t('autosave'))
    })
  }

  _autosaveCampaign(): void {
    this._withBuildingInteriorLayerRuntimeRestored(() => {
      const buildingInteriorRecord = buildBuildingInteriorSessionSaveRecord(this as BuildingInteriorTravelGame)
      const campaign = buildingInteriorRecord ?? this._campaignSave
      if (!campaign) return
      autosaveRecord(campaign, t('autosave'))
    })
  }

  _changeFactionRelation(factionId: string, delta: number): void {
    const campaign = this._campaignSave
    const faction = campaign?.factions?.[factionId]
    if (!campaign || !faction) return
    this._campaignSave = {
      ...campaign,
      factions: {
        ...(campaign.factions ?? {}),
        [factionId]: adjustFactionRelation(faction, delta, Date.now()),
      },
    }
    this._restartSaveData = structuredClone(this._campaignSave)
  }

  _configForPortalWorld(color: 'blue' | 'yellow' | 'red', worldId: string, now: number): PortalWorldConfig {
    return configForRuntimePortalWorld(this as PortalTravelGame, color, worldId, now)
  }

  _runtimeHeroUnit(): UnitEntity | null {
    return runtimeHeroUnit(this as PortalTravelGame)
  }

  _removeExistingTravelFollowers(): void {
    removeExistingTravelFollowers(this as PortalTravelGame)
  }

  _findPortalArrivalCell(): RuntimeCell | null {
    return findPortalArrivalCell(this as PortalTravelGame)
  }

  _findPartyFollowerArrivalCell(anchor: UnitEntity): RuntimeCell | null {
    return findPartyFollowerArrivalCell(this as PortalTravelGame, anchor)
  }

  _teleportRuntimeUnitToCell(unit: UnitEntity, cell: RuntimeCell): void {
    teleportRuntimeUnit(this as PortalTravelGame, unit, cell)
  }

  _refreshPortalPartyFog(units: UnitEntity[]): void {
    refreshPortalPartyFog(this as PortalTravelGame, units)
  }

  _applyFogStateToCell(i: number, j: number): void {
    applyFogStateToCell(this as PortalTravelGame, i, j)
  }

  _clearTravelUnitFogViewers(units: UnitEntity[]): void {
    clearTravelUnitFogViewers(this as PortalTravelGame, units)
  }

  _resetPlayedFogForFreshWorld(): void {
    resetPlayedFogForFreshWorld(this as PortalTravelGame)
  }

  _applyPortalPartyToRuntime(
    party: PortalPartyState,
    arrivalCell: RuntimeCell | null = null,
    { freshWorld = false }: { freshWorld?: boolean } = {}
  ): void {
    applyPortalPartyToRuntime(this as PortalTravelGame, party, arrivalCell, { freshWorld })
  }

  _applyPortableUnitState(
    target: Partial<SaveEntityState>,
    source: SaveEntityState,
    options?: { keepAlive?: boolean }
  ): void {
    applyRuntimePortableUnitState(target, source, options)
  }

  async travelThroughPortal(portal: ResourceEntity, color: 'blue' | 'yellow' | 'red'): Promise<void> {
    await travelThroughPortalRuntime(this as PortalTravelGame, portal, color)
  }

  async travelIntoBuildingInterior(building: BuildingEntity): Promise<void> { await travelIntoBuildingInteriorRuntime(this as BuildingInteriorTravelGame, building) }

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

  async travelOutOfBuildingInterior(): Promise<void> { await travelOutOfBuildingInteriorRuntime(this as BuildingInteriorTravelGame) }

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

  async restart(): Promise<void> {
    await restartGameRuntime(this)
  }

  quit(): void {
    this._destroyRuntime()
    if (this.onQuit) this.onQuit()
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this._wakeLock?.release()
    document.removeEventListener('visibilitychange', this._onVisibilityChange as EventListener)
    this._destroyRuntime()
    this.context.scheduler?.destroy?.()
    this.context.performance?.destroy?.()
    this.context.scheduler = null
    this.context.performance = null
    super.destroy(options)
  }

  checkDefeat(): boolean {
    return checkGameDefeat(this)
  }

  togglePause(pause: boolean, options: { silent?: boolean } = {}): void {
    toggleGamePause(this, pause, options)
  }
}
