import type { Application } from 'pixi.js'
import { Container, type ContainerChild } from 'pixi.js'
import { sound } from '@pixi/sound'
import { t } from '../lib/lang'
import Map from '../classes/map'
import Menu from '../classes/Menu'
import Controls from '../classes/Controls'
import {
  Modal,
  debounce,
  getFreeLandCellAroundInstance,
  isPlayedHeroDefeated,
  teleportRuntimeUnitToCell,
  updateInstanceVisibility,
} from '../lib'
import { clearAllCombatFeedback } from '../lib/combatFeedback'
import { refreshUnitEquipmentStats } from '../lib/equipmentStats'
import { adjustFactionRelation } from '../lib/factions'
import { preloadBakedLpcUnitsForPlayers } from '../lib/lpc'
import { ActionScheduler } from '../lib/ActionScheduler'
import { syncHeroResourceLoadState } from '../lib/resourceCarry'
import { stopAllUiSounds } from '../lib/uiSound'
import { validateSaveData } from '../serialization/SaveValidator'
import { autosaveRecord, buildSaveRecord, saveRecord as saveRecordToStorage } from '../serialization/SaveStorage'
import { serializeGame } from '../serialization/SaveSerializer'
import {
  addChildWorldToCampaign,
  createInitialCampaignSave,
  enterCampaignWorld,
  getCurrentWorldState,
  isCampaignSave,
  returnToParentWorld,
  updateCurrentWorldState,
} from '../serialization/CampaignSave'
import { loadPregeneratedMapBlueprint } from '../serialization/MapBlueprintLoader'
import { DevConsole } from '../dev-console/DevConsole'
import { cleanupDebugArtifacts } from '../dev-console/actions/shared'
import { PerformanceMonitor } from '../services/PerformanceMonitor'
import {
  addRuntimeServiceLayers,
  createEmptyRuntimeServices,
  createRuntimeServices,
  destroyRuntimeServices,
  type RuntimeServices,
} from './game/runtimeServices'
import { collectPausableInstances } from './game/pausableRuntime'
import {
  PORTAL_RESOURCE_TYPE,
  applyMapConfig,
  applyPortableUnitState,
  configForPortalWorld,
  extractPortalParty,
  getGameScreenRect,
  getMapWorldBounds,
  hasSerializedGrid,
  heroTravelImageSrc,
  saveConfig,
  savedRuntimeState,
  portalWorldId,
  withFogEnabledState,
  worldStateWithCampaignClock,
  type PortalPartyState,
  type PortalWorldConfig,
} from './game/GameStateHelpers'
import { getCameraZoom, getControlActionForKeyboardEvent, getGameSpeed } from '../lib/settings'
import { GameLoadingScreen } from '../ui/GameLoadingScreen'
import { PortalTravelTransition } from '../ui/PortalTravelTransition'
import { PLAYER_TYPES } from '../constants'
import type { GameContextLike, SchedulerLike, PerformanceMonitorLike } from '../types/context'
import type {
  CampaignSave,
  GameConfig,
  PlayerSetupConfig,
  SaveEntityState,
  SaveRecord,
  SerializedSave,
} from '../types/save'
import type { PlayerLike } from '../types/player'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { ResourceEntity, UnitEntity } from '../types/entities'
import type { DevConsoleRuntimeContext } from '../dev-console/types'
import type { Viewport } from '../types/geometry'

type RuntimeMapInstance = InstanceType<typeof Map> &
  RuntimeMap & {
    destroy(options?: Parameters<Container['destroy']>[0]): void
  }

type MapInstance = RuntimeMapInstance & {
  pregeneratedBlueprintId?: string | number | null
  generationTimings?: Record<string, number>
  blueprintDestroyMs?: number
  blueprintCellCreationMs?: number
  blueprintFillWaterGapsMs?: number
  blueprintNormalizeWaterMs?: number
  blueprintInitialWaterBorderMs?: number
  blueprintResourceLoadMs?: number
}

type GameRuntimeContext = Omit<
  GameContextLike,
  'map' | 'player' | 'controls' | 'menu' | 'scheduler' | 'performance'
> & {
  map: RuntimeMapInstance | null
  player: PlayerLike | null
  players: PlayerLike[]
  controls: Controls | null
  menu: Menu | null
  scheduler: SchedulerLike | null
  performance: PerformanceMonitorLike | null
  devConsole: DevConsole | null
  checkDefeat: () => boolean
}

/**
 * Main Display Object
 * @exports Game
 * @extends Container
 */

export default class Game extends Container {
  _pausedByVisibility: boolean
  _pausedByOrientation: boolean
  _restartSaveData: SaveRecord | null
  _campaignSave: CampaignSave | null
  _isRestarting: boolean
  config: GameConfig | null
  onQuit: (() => void) | null
  context: GameRuntimeContext
  _loadingScreen?: GameLoadingScreen | PortalTravelTransition | null
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
    this._restartSaveData = null
    this._campaignSave = null
    this._isRestarting = false
    this._runtimeServices = createEmptyRuntimeServices()
    this.config = config
    this.onQuit = onQuit
    this.context = {
      app,
      gamebox,
      menu: null,
      player: null,
      players: [],
      map: null,
      controls: null,
      dayNight: null,
      weather: null,
      tributeRaids: null,
      villagerShelter: null,
      devConsole: null,
      devConsoleOpen: false,
      paused: false,
      defeat: false,
      scheduler: null,
      performance: null,
      save: () => this.save(),
      load: (evt: object) => this.load(evt as SaveRecord),
      pause: () => this.togglePause(true),
      resume: () => {
        if (!this.context.defeat) this.togglePause(false)
      },
      restart: () => this.restart(),
      quit: () => this.quit(),
      checkDefeat: () => this.checkDefeat(),
      applyZoom: () => this.applyZoom(),
      getWorldGraph: () => this._campaignSave?.worldGraph ?? null,
      getCampaignFactions: () => this._campaignSave?.factions ?? null,
      changeFactionRelation: (factionId: string, delta: number) => this._changeFactionRelation(factionId, delta),
      getCurrentWorldId: () => this._campaignSave?.currentWorldId ?? null,
      travelThroughPortal: (portal: ResourceEntity, color: 'blue' | 'yellow' | 'red') => {
        this.travelThroughPortal(portal, color).catch(error => {
          console.error('Unable to travel through portal', error)
          this.context.menu?.showMessage(t('corruptSave'))
        })
      },
    }
    this.context.performance = new PerformanceMonitor(app)
    this.context.scheduler = new ActionScheduler(
      app,
      () => this.context.paused ?? false,
      () => this.context.performance ?? null
    )
    ;(window as unknown as { __debugContext?: unknown }).__debugContext = this.context // TEMP-VERIFY-DEBUG
    if (config !== null) {
      this.start().catch(error => {
        this._loadingScreen?.destroy()
        console.error('Unable to start game', error)
        this.quit()
      })
    }
  }

  async start(): Promise<void> {
    this._acquireWakeLock()
    const speed = getGameSpeed()
    this.context.app.ticker.speed = speed
    if (this.context.scheduler) this.context.scheduler.timeScale = speed
    this._loadingScreen = new GameLoadingScreen()
    this._loadingScreen.update('generatingWorld', 0.02)
    await this._yieldToBrowser()
    let booted = false
    try {
      await this._bootFromConfig(this.config!)
      booted = true
    } finally {
      this._loadingScreen?.destroy()
      this._loadingScreen = null
      if (booted) this.context.menu?.show?.()
    }
  }

  _yieldToBrowser(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()))
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

  async _acquireWakeLock(): Promise<void> {
    if (!navigator.wakeLock) return
    try {
      this._wakeLock = await navigator.wakeLock.request('screen')
      document.addEventListener(
        'visibilitychange',
        (this._onVisibilityChange = async () => {
          if (this._wakeLock && document.visibilityState === 'visible') {
            this._wakeLock = await navigator.wakeLock.request('screen').catch(() => null)
          }
        })
      )
    } catch {
      // silently ignored — wake lock is a hint, not a requirement
    }
  }

  _attachWindowListeners(): void {
    this._onKeydown = evt => {
      if (evt.defaultPrevented) return
      if (this.context.devConsoleOpen) return
      if (evt.key === 'Escape') {
        if (this.context.defeat) return
        if (document.querySelector('.modal')) return
        evt.preventDefault()
        this.context.menu?.pauseMenu?.open()
        return
      }
      if (getControlActionForKeyboardEvent(evt) === 'pause') {
        if (this.context.defeat) return
        if (document.querySelector('.modal')) return
        this.context.paused ? this.context.resume() : this.context.pause()
      }
    }
    this._onResize = debounce(() => {
      this.applyZoom()
      if (this.context.controls) this.context.controls.updateVisibleCells?.()
      if (this.context.menu) this.context.menu.updateCameraMiniMap?.()
    }, 100)
    this._onDocumentVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this._handleDocumentHidden()
        return
      }
      this._handleDocumentVisible()
    }
    window.addEventListener('keydown', this._onKeydown)
    window.addEventListener('resize', this._onResize)
    document.addEventListener('visibilitychange', this._onDocumentVisibilityChange)
  }

  _removeWindowListeners(): void {
    window.removeEventListener('keydown', this._onKeydown as EventListener)
    window.removeEventListener('resize', this._onResize as EventListener)
    document.removeEventListener('visibilitychange', this._onDocumentVisibilityChange as EventListener)
  }

  _handleDocumentHidden(): void {
    if (!this.context.paused && !this.context.defeat) {
      this._pausedByVisibility = true
      this.togglePause(true, { silent: true })
    }
    sound.stopAll()
    stopAllUiSounds()
  }

  _handleDocumentVisible(): void {
    if (!this._pausedByVisibility) return
    if (this._pausedByOrientation) return
    this._pausedByVisibility = false
    if (!this.context.defeat) {
      this.togglePause(false, { silent: true })
    }
  }

  setOrientationBlocked(blocked: boolean): void {
    if (blocked) {
      if (!this.context.paused && !this.context.defeat) {
        this._pausedByOrientation = true
        this.togglePause(true, { silent: true })
      }
      return
    }

    if (!this._pausedByOrientation) return
    this._pausedByOrientation = false
    if (!this._pausedByVisibility && !this.context.defeat) {
      this.togglePause(false, { silent: true })
    }
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
    const { context } = this
    const gameContext = context as GameContextLike
    context.controls = new Controls(gameContext)
    context.menu = new Menu(gameContext)
    context.devConsole = new DevConsole(context as DevConsoleRuntimeContext)
    ;(window as unknown as { __debugContext?: unknown }).__debugContext = context
  }

  _mountRuntime(dayNightElapsedMs: number | null | undefined = null): void {
    const { map, controls } = this.context
    if (!map || !controls) return
    this.addChild(map as ContainerChild)
    this._runtimeServices = createRuntimeServices(this._gameContext(), map, () => this._getScreenRect(), dayNightElapsedMs)
    addRuntimeServiceLayers(this, this._runtimeServices)
    this.addChild(controls)
    this.applyZoom()
    this._attachWindowListeners()
  }

  _getScreenRect(): { x: number; y: number; width: number; height: number } {
    return getGameScreenRect(this, this.context.app)
  }

  _getMapWorldBounds(): { x: number; y: number; width: number; height: number } {
    return getMapWorldBounds(this.context.map?.size ?? 0)
  }

  _destroyRuntime({ preserveLoadingScreen = false }: { preserveLoadingScreen?: boolean } = {}): void {
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
    this.context.performance?.setPhase?.('load')
    this._createRuntime()
    const map = this._map()
    this._applyMapConfig(map, config)
    this._createUiRuntime()

    const mapGenerationStartedAt = performance.now()
    const blueprint = await loadPregeneratedMapBlueprint({
      size: map.size,
      environment: map.environment,
    })
    if (blueprint) {
      await map.generateFromBlueprint(blueprint, {
        onProgress: (messageKey: string, progress: number) => this._updateLoading(messageKey, progress),
      })
      map.pregeneratedBlueprintId = blueprint.id
      console.info(`[maps] Loaded pregenerated blueprint: ${blueprint.id}`)
    } else {
      await map.generateMapAsync(null, 0, {
        onProgress: (messageKey: string, progress: number) => this._updateLoading(messageKey, progress),
      })
      map.pregeneratedBlueprintId = null
    }
    map.generationTimings = {
      terrainAndSpawns: performance.now() - mapGenerationStartedAt,
      ...(blueprint?.timings || {}),
      blueprintDestroy: map.blueprintDestroyMs || 0,
      blueprintCellCreation: map.blueprintCellCreationMs || 0,
      blueprintFillWaterGaps: map.blueprintFillWaterGapsMs || 0,
      blueprintNormalizeWater: map.blueprintNormalizeWaterMs || 0,
      blueprintInitialWaterBorder: map.blueprintInitialWaterBorderMs || 0,
      blueprintResources: map.blueprintResourceLoadMs || 0,
    }
    await this._updateLoading('generatingPlayers', 0.2)
    this.context.players = map.generatePlayers(
      (config.players as Array<Partial<PlayerLike> & PlayerSetupConfig>) || null
    )
    this.context.player = this.context.players[0]
    this.context.menu?.init?.()
    await preloadBakedLpcUnitsForPlayers(this.context.players)
    await map.stylishMap({
      onProgress: (messageKey: string, progress: number) => this._updateLoading(messageKey, progress),
    })
    await this._updateLoading('finalizingWorld', 0.96)
    this.context.controls?.init?.()
    ;(window as unknown as { __debugContext?: unknown }).__debugContext = this.context

    this._mountRuntime(options.dayNightElapsedMs)
    this.context.performance?.setPhase?.('runtime')
    this._campaignSave = createInitialCampaignSave(serializeGame(this._gameContext()))
    this._restartSaveData = structuredClone(this._campaignSave)
    this._autosaveCampaign()
  }

  async _bootFromSeedSave(json: SerializedSave): Promise<void> {
    this.context.performance?.setPhase?.('load')
    this._createRuntime()
    const map = this._map()
    const world = saveConfig(json.world)
    const savedConfig = saveConfig(json.config)
    const savedPlayers = Array.isArray(json.players) ? json.players : []
    const seedConfig = {
      ...savedConfig,
      seed: world.seed ?? savedConfig.seed,
      size: world.size ?? savedConfig.size,
      environment: world.environment ?? savedConfig.environment,
      players: savedPlayers.map(player => ({
        civ: player.civ,
        gender: player.gender,
        isHuman: player.isPlayed && player.type === PLAYER_TYPES.human,
      })),
    }
    this._applyMapConfig(map, seedConfig)
    this._createUiRuntime()
    const positionsCount =
      Number.isFinite(world.positionsCount) && Number(world.positionsCount) > 0
        ? Number(world.positionsCount)
        : savedPlayers.length || null

    const blueprintId = world.pregeneratedBlueprintId
    const blueprint = blueprintId
      ? await loadPregeneratedMapBlueprint({
          size: map.size,
          id: String(blueprintId),
        })
      : null
    if (blueprint) {
      await map.generateFromBlueprint(blueprint, {
        onProgress: (messageKey: string, progress: number) => this._updateLoading(messageKey, progress),
      })
      map.pregeneratedBlueprintId = blueprint.id
    } else {
      if (blueprintId) console.warn(`[maps] Unable to reload pregenerated blueprint: ${blueprintId}`)
      await map.generateMapAsync(positionsCount, 0, {
        onProgress: (messageKey: string, progress: number) => this._updateLoading(messageKey, progress),
      })
      map.pregeneratedBlueprintId = null
    }
    await map.prepareTerrainForSavedState({
      onProgress: (messageKey: string, progress: number) => this._updateLoading(messageKey, progress),
    })
    map.mapGeneration.applySavedStateToGeneratedMap(savedRuntimeState(json))
    this.context.controls?.init?.()
    this._mountRuntime(json.runtime?.dayNightElapsedMs)
    this.context.performance?.setPhase?.('runtime')
  }

  async _bootFromSave(json: SerializedSave): Promise<void> {
    this.context.performance?.setPhase?.('load')
    if (!hasSerializedGrid(json)) {
      await this._bootFromSeedSave(json)
      return
    }
    this._createRuntime()
    const map = this._map()
    const savedMap = json.map
    map.size = Math.max(0, (savedMap?.length || 1) - 1)
    this._applyMapConfig(map, saveConfig(json.config))
    this._createUiRuntime()
    map.generateFromJSON(savedRuntimeState(json))
    this.context.controls?.init?.()
    this._mountRuntime(json.runtime?.dayNightElapsedMs)
    this.context.performance?.setPhase?.('runtime')
  }

  save(): { key: string; name: string } {
    const record = buildSaveRecord(this._gameContext(), this._campaignSave)
    this._campaignSave = isCampaignSave(record) ? structuredClone(record) : createInitialCampaignSave(record)
    this._restartSaveData = structuredClone(this._campaignSave)
    return saveRecordToStorage(this._campaignSave)
  }

  _autosaveCampaign(): void {
    if (!this._campaignSave) return
    autosaveRecord(this._campaignSave, t('autosave'))
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
    const { player, map } = this._gameContext()
    return configForPortalWorld({ color, map, now, player, worldId })
  }

  _runtimeHeroUnit(): UnitEntity | null {
    const { player, controls } = this._gameContext()
    return (
      controls.heroUnit ||
      player.units.find(unit => unit.controlMode === 'hero' || unit.type === 'Hero') ||
      player.units.find(unit => unit.isChief) ||
      player.units[0] ||
      null
    )
  }

  _removeExistingTravelFollowers(): void {
    const { map, player } = this._gameContext()
    const hero = this._runtimeHeroUnit()
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

  _findPortalArrivalCell(): RuntimeCell | null {
    const { map } = this._gameContext()
    const portal = [...map.resources].find(resource => resource.type === PORTAL_RESOURCE_TYPE)
    if (!portal) return null

    return getFreeLandCellAroundInstance(
      portal,
      map.grid,
      cells => cells[Math.floor(map.random() * cells.length)]
    )
  }

  _findPartyFollowerArrivalCell(anchor: UnitEntity): RuntimeCell | null {
    const { map } = this._gameContext()
    return getFreeLandCellAroundInstance(
      { i: anchor.i, j: anchor.j, size: 1 },
      map.grid,
      cells => cells[Math.floor(map.random() * cells.length)]
    )
  }

  _teleportRuntimeUnitToCell(unit: UnitEntity, cell: RuntimeCell): void {
    const { map } = this._gameContext()
    teleportRuntimeUnitToCell(map, unit, cell)
  }

  _refreshPortalPartyFog(units: UnitEntity[]): void {
    const { map, controls, menu } = this._gameContext()
    if (map.revealEverything) return
    const runtimeMap = map as RuntimeMapInstance
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

  _applyFogStateToCell(i: number, j: number): void {
    const { map, player } = this._gameContext()
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

  _clearTravelUnitFogViewers(units: UnitEntity[]): void {
    const { player } = this._gameContext()
    const changed = new Set<number>()
    for (const unit of units) {
      for (const index of player.views.removeViewerEverywhere(unit)) changed.add(index)
      unit.visibleCells = new Set()
    }
    for (const index of changed) {
      const [i, j] = player.views.coordinates(index)
      this._applyFogStateToCell(i, j)
    }
  }

  _resetPlayedFogForFreshWorld(): void {
    const { map, player, menu } = this._gameContext()
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

  _applyPortalPartyToRuntime(
    party: PortalPartyState,
    arrivalCell: RuntimeCell | null = null,
    { freshWorld = false }: { freshWorld?: boolean } = {}
  ): void {
    const { player, controls } = this._gameContext()
    const hero = this._runtimeHeroUnit()
    if (!hero) return

    if (freshWorld) this._resetPlayedFogForFreshWorld()
    this._clearTravelUnitFogViewers([hero, ...player.units.filter(unit => unit !== hero && unit.followingHero)])
    if (party.hero) applyPortableUnitState(hero as Partial<SaveEntityState>, party.hero, { keepAlive: true })
    syncHeroResourceLoadState(hero)
    refreshUnitEquipmentStats(hero)
    if (arrivalCell) this._teleportRuntimeUnitToCell(hero, arrivalCell)
    this._removeExistingTravelFollowers()

    const travelUnits: UnitEntity[] = [hero]
    for (const followerState of party.followers) {
      const cell = this._findPartyFollowerArrivalCell(hero)
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

    this._refreshPortalPartyFog(travelUnits)
    controls.init?.()
    controls.context?.menu?.updateHeroStatus?.(hero)
    controls.context?.menu?.updatePlayerMiniMapEvt?.(player)
    controls.context?.menu?.updateCameraMiniMap?.()
  }

  _applyPortableUnitState(
    target: Partial<SaveEntityState>,
    source: SaveEntityState,
    options?: { keepAlive?: boolean }
  ): void {
    applyPortableUnitState(target, source, options)
  }

  async travelThroughPortal(portal: ResourceEntity, color: 'blue' | 'yellow' | 'red'): Promise<void> {
    if (this._isRestarting) return
    this._isRestarting = true
    const now = Date.now()
    const currentWorldState = withFogEnabledState(serializeGame(this._gameContext()))
    const party = extractPortalParty(currentWorldState)
    const campaign = this._campaignSave
      ? updateCurrentWorldState(this._campaignSave, currentWorldState, now)
      : createInitialCampaignSave(currentWorldState, { now })
    const currentCampaignWorld = campaign.worlds[campaign.currentWorldId]
    const shouldReturnToParent = Boolean(currentCampaignWorld?.parentWorldId && currentCampaignWorld.color === color)
    const targetWorldId = portalWorldId(this._campaignSave?.currentWorldId, portal, color)
    const existingTarget = campaign.worlds[targetWorldId]
    const portalTransition = new PortalTravelTransition(color, { heroImageSrc: heroTravelImageSrc(this.context.player) })
    this._loadingScreen = portalTransition
    portalTransition.update('generatingWorld', 0.02)
    await portalTransition.waitForFlash()

    try {
      if (shouldReturnToParent) {
        const nextCampaign = returnToParentWorld(campaign, now)
        this._campaignSave = structuredClone(nextCampaign)
        this._restartSaveData = structuredClone(nextCampaign)
        const parentState = worldStateWithCampaignClock(
          getCurrentWorldState(nextCampaign),
          this._campaignSave?.clock?.dayNightElapsedMs
        )
        this._destroyRuntime({ preserveLoadingScreen: true })
        await this._bootFromSave(withFogEnabledState(structuredClone(parentState)))
        this._map().revealEverything = false
        this._applyPortalPartyToRuntime(party, this._findPortalArrivalCell())
        const targetState = withFogEnabledState(serializeGame(this._gameContext()))
        const committedCampaign = updateCurrentWorldState(nextCampaign, targetState, now)
        this._campaignSave = structuredClone(committedCampaign)
        this._restartSaveData = structuredClone(committedCampaign)
        this._autosaveCampaign()
      } else if (existingTarget) {
        const nextCampaign = enterCampaignWorld(campaign, targetWorldId, now)
        this._campaignSave = structuredClone(nextCampaign)
        this._restartSaveData = structuredClone(nextCampaign)
        this._destroyRuntime({ preserveLoadingScreen: true })
        await this._bootFromSave(
          withFogEnabledState(
            worldStateWithCampaignClock(structuredClone(existingTarget.state), this._campaignSave?.clock?.dayNightElapsedMs)
          )
        )
        this._map().revealEverything = false
        this._applyPortalPartyToRuntime(party, this._findPortalArrivalCell())
        const targetState = withFogEnabledState(serializeGame(this._gameContext()))
        const committedCampaign = updateCurrentWorldState(nextCampaign, targetState, now)
        this._campaignSave = structuredClone(committedCampaign)
        this._restartSaveData = structuredClone(committedCampaign)
        this._autosaveCampaign()
      } else {
        const parentWorldId = campaign.currentWorldId
        const portalWorld = this._configForPortalWorld(color, targetWorldId, now)
        this._destroyRuntime({ preserveLoadingScreen: true })
        await this._bootFromConfig(portalWorld.config, { dayNightElapsedMs: campaign.clock?.dayNightElapsedMs })
        this._map().revealEverything = false
        this._applyPortalPartyToRuntime(party, this._findPortalArrivalCell(), { freshWorld: true })
        const childState = withFogEnabledState(serializeGame(this._gameContext()))
        const nextCampaign = addChildWorldToCampaign(campaign, childState, {
          color,
          entryPortalId: portal.label || `${portal.i},${portal.j}`,
          factionIds: [portalWorld.factionId],
          factions: { [portalWorld.factionId]: portalWorld.faction },
          name: `Monde ${color}`,
          now,
          parentWorldId,
          worldId: targetWorldId,
        })
        this._campaignSave = structuredClone(nextCampaign)
        this._restartSaveData = structuredClone(nextCampaign)
        this._autosaveCampaign()
      }
      this.context.menu?.show?.()
    } finally {
      const loadingScreen = this._loadingScreen as GameLoadingScreen | PortalTravelTransition | null | undefined
      if (loadingScreen instanceof PortalTravelTransition) await loadingScreen.finish()
      else loadingScreen?.destroy()
      this._loadingScreen = null
      this._isRestarting = false
    }
  }

  async load(json: SaveRecord): Promise<void> {
    let booted = false
    try {
      const saveData = validateSaveData(json)
      this._campaignSave = isCampaignSave(saveData)
        ? structuredClone(saveData)
        : createInitialCampaignSave(structuredClone(saveData))
      this._restartSaveData = structuredClone(this._campaignSave)
      this._destroyRuntime()
      const speed = getGameSpeed()
      this.context.app.ticker.speed = speed
      if (this.context.scheduler) this.context.scheduler.timeScale = speed
      this._loadingScreen = new GameLoadingScreen()
      this._loadingScreen.update('generatingTerrain', 0.02)
      await this._yieldToBrowser()
      await this._bootFromSave(
        worldStateWithCampaignClock(
          structuredClone(getCurrentWorldState(this._restartSaveData)),
          this._campaignSave?.clock?.dayNightElapsedMs
        )
      )
      booted = true
    } catch (error) {
      const message = error instanceof Error ? error.message : t('corruptSave')
      this.quit()
      const content = document.createElement('div')
      content.className = 'modal-menu'
      const paragraph = document.createElement('p')
      paragraph.className = 'save-list-confirm-message'
      paragraph.textContent = message
      content.appendChild(paragraph)
      new Modal({ title: t('invalidSaveFile'), content })
    } finally {
      this._loadingScreen?.destroy()
      this._loadingScreen = null
      if (booted) this.context.menu?.show?.()
    }
  }

  applyZoom(): void {
    const zoom = getCameraZoom()
    this.scale.set(zoom)
    this.position.set(
      (this.context.app.screen.width * (1 - zoom)) / 2,
      (this.context.app.screen.height * (1 - zoom)) / 2
    )
  }

  async restart(): Promise<void> {
    if (this._isRestarting || !this._restartSaveData) return
    this._isRestarting = true
    this._destroyRuntime()
    const speed = getGameSpeed()
    this.context.app.ticker.speed = speed
    if (this.context.scheduler) this.context.scheduler.timeScale = speed
    this._loadingScreen = new GameLoadingScreen()
    this._loadingScreen.update('generatingTerrain', 0.02)
    await this._yieldToBrowser()
    let booted = false
    try {
      await this._bootFromSave(
        worldStateWithCampaignClock(
          structuredClone(getCurrentWorldState(this._restartSaveData!)),
          this._campaignSave?.clock?.dayNightElapsedMs
        )
      )
      booted = true
    } finally {
      this._loadingScreen?.destroy()
      this._loadingScreen = null
      if (booted) this.context.menu?.show?.()
      this._isRestarting = false
    }
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
    const { player } = this.context
    if (this.context.defeat || !player) return false

    if (!isPlayedHeroDefeated(player, this.context.controls?.heroUnit)) return false

    this.context.defeat = true
    clearAllCombatFeedback()
    const div = document.createElement('div')
    div.id = 'defeat'
    div.className = 'game-overlay'
    div.innerText = t('defeat')
    document.body.appendChild(div)
    return true
  }

  togglePause(pause: boolean, options: { silent?: boolean } = {}): void {
    if (this.context.defeat && !pause) return
    const { map, players = [] } = this.context
    if (!map) return
    if (pause) {
      document.getElementById('pause')?.remove()
      if (!options.silent && !this.context.defeat) {
        const div = document.createElement('div')
        div.id = 'pause'
        div.className = 'game-overlay'
        div.innerText = t('pause')
        document.body.appendChild(div)
      }
    } else {
      document.getElementById('pause')?.remove()
    }
    for (const instance of collectPausableInstances(map, players)) {
      pause ? instance.pause?.() : instance.resume?.()
    }
    this.context.paused = pause
  }
}
