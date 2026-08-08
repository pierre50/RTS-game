import type { Application } from 'pixi.js'
import { Container, type ContainerChild } from 'pixi.js'
import { sound } from '@pixi/sound'
import { t } from '../lib/lang'
import Map from '../classes/map'
import type { SavedGameData } from '../classes/map/MapGeneration'
import Menu from '../classes/Menu'
import Controls from '../classes/Controls'
import {
  Modal,
  canPlayerStillAct,
  debounce,
  getFreeCellAroundPoint,
  getGaiaAnimals,
  isPlayedHeroDefeated,
} from '../lib'
import { clearAllCombatFeedback } from '../lib/combatFeedback'
import { preloadBakedLpcUnitsForPlayers } from '../lib/lpc'
import { ActionScheduler } from '../lib/ActionScheduler'
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
import { WeatherSystem } from '../services/WeatherSystem'
import { getCameraZoom, getControlActionForKeyboardEvent, getGameSpeed } from '../lib/settings'
import { GameLoadingScreen } from '../ui/GameLoadingScreen'
import { AmbientBirds } from '../services/AmbientBirds'
import { DEFAULT_MAP_TYPE } from '../config/mapTypes'
import { CIVILIZATIONS } from '../config/civilizations'
import { getEnvironmentForCiv } from '../config/environments'
import { cartesianToIsometric, getGroundReliefLevel, getInstanceZIndex } from '../lib/maths'
import { CELL_WIDTH, CELL_HEIGHT, AMBIENT_BIRD_WORLD_ZINDEX, PLAYER_TYPES } from '../constants'
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
import type { ResourceEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { DevConsoleRuntimeContext } from '../dev-console/types'

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
  ambientBirds: AmbientBirds | null
  devConsole: DevConsole | null
  checkVictory: () => boolean
  checkDefeat: () => boolean
}

function saveConfig(config: SerializedSave['config'] | SerializedSave['world'] | undefined): GameConfig {
  return config || {}
}

function hasSerializedGrid(save: SerializedSave): boolean {
  return Array.isArray(save.map)
}

function savedRuntimeState(save: SerializedSave): SavedGameData {
  return save as SavedGameData
}

type PortalPartyState = {
  followers: SaveEntityState[]
  hero: SaveEntityState | null
}

const PORTAL_RESOURCE_TYPE = 'Portal'

function addPausableInstance(instances: Set<RuntimeEntity>, instance: RuntimeEntity | null | undefined): void {
  if (!instance || instance.isDestroyed) return
  if (!instance.pause && !instance.resume) return
  instances.add(instance)
}

function collectPausableInstances(map: RuntimeMapInstance, players: PlayerLike[]): Set<RuntimeEntity> {
  const instances = new Set<RuntimeEntity>()
  for (const animal of getGaiaAnimals(map.gaia)) addPausableInstance(instances, animal)
  for (const player of players) {
    for (const unit of player.units ?? []) addPausableInstance(instances, unit)
    for (const animal of player.animals ?? []) addPausableInstance(instances, animal)
    for (const building of player.buildings ?? []) addPausableInstance(instances, building)
    for (const corpse of player.corpses ?? []) addPausableInstance(instances, corpse)
  }
  for (const row of map.grid ?? []) {
    for (const cell of row ?? []) {
      for (const corpse of cell.corpses ?? []) addPausableInstance(instances, corpse)
    }
  }
  return instances
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
  _loadingScreen?: GameLoadingScreen | null
  _wakeLock?: WakeLockSentinel | null
  _onVisibilityChange?: () => void
  _onKeydown?: (evt: KeyboardEvent) => void
  _onResize?: () => void
  _onDocumentVisibilityChange?: () => void
  _weather?: WeatherSystem | null

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
    this._weather = null
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
      ambientBirds: null,
      devConsole: null,
      devConsoleOpen: false,
      paused: false,
      victory: false,
      defeat: false,
      scheduler: null,
      performance: null,
      save: () => this.save(),
      load: (evt: object) => this.load(evt as SaveRecord),
      pause: () => this.togglePause(true),
      resume: () => {
        if (!this.context.victory && !this.context.defeat) this.togglePause(false)
      },
      restart: () => this.restart(),
      quit: () => this.quit(),
      checkVictory: () => this.checkVictory(),
      checkDefeat: () => this.checkDefeat(),
      applyZoom: () => this.applyZoom(),
      getWorldGraph: () => this._campaignSave?.worldGraph ?? null,
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
      if (this.context.devConsoleOpen) return
      if (getControlActionForKeyboardEvent(evt) === 'pause') {
        if (this.context.victory || this.context.defeat) return
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
    if (!this.context.paused && !this.context.victory && !this.context.defeat) {
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
    if (!this.context.victory && !this.context.defeat) {
      this.togglePause(false, { silent: true })
    }
  }

  setOrientationBlocked(blocked: boolean): void {
    if (blocked) {
      if (!this.context.paused && !this.context.victory && !this.context.defeat) {
        this._pausedByOrientation = true
        this.togglePause(true, { silent: true })
      }
      return
    }

    if (!this._pausedByOrientation) return
    this._pausedByOrientation = false
    if (!this._pausedByVisibility && !this.context.victory && !this.context.defeat) {
      this.togglePause(false, { silent: true })
    }
  }

  _applyMapConfig(map: RuntimeMap, config: GameConfig = {}): void {
    if (config.size) map.size = config.size
    if (Number.isFinite(config.seed)) map.seed = config.seed
    map.mapType = DEFAULT_MAP_TYPE
    const humanCiv = config.players?.find(player => player.isHuman)?.civ ?? config.players?.[0]?.civ
    map.environment = getEnvironmentForCiv(humanCiv)
    if (config.instantMode) map.instantMode = true
    map.humanStartsWithoutBase = Boolean(config.humanStartsWithoutBase)
    if (config.startingAge != null) map.startingAge = Number(config.startingAge)
    if (config.allTechnologies !== undefined) map.allTechnologies = config.allTechnologies
    if (config.revealEverything !== undefined) map.revealEverything = config.revealEverything
    if (config.revealTerrain !== undefined) map.revealTerrain = config.revealTerrain
    if (config.startingResources) map.startingResources = config.startingResources
    if (config.resourceDensity) map.resourceDensity = config.resourceDensity
    if (config.difficulty) map.difficulty = config.difficulty
  }

  _resetOverlayDom(): void {
    document.getElementById('pause')?.remove()
    document.getElementById('victory')?.remove()
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
      ambientBirds: null,
      devConsole: null,
      devConsoleOpen: false,
      paused: false,
      victory: false,
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

  _mountRuntime(): void {
    const { map, controls } = this.context
    if (!map || !controls) return
    this.addChild(map as ContainerChild)
    this._weather = new WeatherSystem(this._gameContext(), map, () => this._getScreenRect())
    ;(window as unknown as { __weatherSystem?: WeatherSystem | null }).__weatherSystem = this._weather
    this.addChild(this._weather.layer)
    this.addChild(controls)
    this.context.ambientBirds = new AmbientBirds(this.context, () => this._getMapWorldBounds())
    this.context.ambientBirds.zIndex = AMBIENT_BIRD_WORLD_ZINDEX
    map.addChild(this.context.ambientBirds)
    this.applyZoom()
    this._attachWindowListeners()
  }

  _getScreenRect(): { x: number; y: number; width: number; height: number } {
    const scaleX = this.scale.x || 1
    const scaleY = this.scale.y || 1
    return {
      x: -this.position.x / scaleX,
      y: -this.position.y / scaleY,
      width: this.context.app.screen.width / scaleX,
      height: this.context.app.screen.height / scaleY,
    }
  }

  _getMapWorldBounds(): { x: number; y: number; width: number; height: number } {
    const size = this.context.map?.size ?? 0
    return {
      x: -(size * CELL_WIDTH) / 2,
      y: 0,
      width: size * CELL_WIDTH,
      height: size * CELL_HEIGHT,
    }
  }

  _destroyRuntime(): void {
    this._loadingScreen?.destroy()
    this._loadingScreen = null
    this._resetOverlayDom()
    this._removeWindowListeners()
    if (this.context.map) {
      cleanupDebugArtifacts(this.context as DevConsoleRuntimeContext)
    }
    this.context.scheduler?.clear?.()
    this.context.performance?.reset?.()
    this._weather?.destroy()
    this._weather = null
    ;(window as unknown as { __weatherSystem?: WeatherSystem | null }).__weatherSystem = null
    this.context.controls?.destroy({ children: true })
    this.context.devConsole?.destroy()
    this.context.menu?.destroy?.()
    this.context.map?.destroy({ children: true })
    this.removeChildren()
    this._resetRuntimeState()
  }

  async _bootFromConfig(config: GameConfig): Promise<void> {
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

    this._mountRuntime()
    this.context.performance?.setPhase?.('runtime')
    this.checkVictory()
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
      // environment isn't itself persisted: it's re-derived from civ (see _applyMapConfig),
      // and civ only survives in `players` (a runtime shape, unlike config.players).
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
    this._mountRuntime()
    this.context.performance?.setPhase?.('runtime')
    this.checkVictory()
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
    this._mountRuntime()
    this.context.performance?.setPhase?.('runtime')
    this.checkVictory()
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

  _portalWorldId(portal: ResourceEntity, color: string): string {
    const currentWorldId = this._campaignSave?.currentWorldId || 'world'
    const portalId = portal.label || `${portal.i}-${portal.j}`
    return `${currentWorldId}-${portalId}-${color}`.replace(/[^a-zA-Z0-9_-]/g, '-')
  }

  _configForPortalWorld(color: 'blue' | 'yellow' | 'red'): GameConfig {
    const { player, map } = this._gameContext()
    return {
      size: map.size,
      mapType: DEFAULT_MAP_TYPE,
      seed: Math.random() * 9999,
      startingAge: map.startingAge,
      allTechnologies: map.allTechnologies,
      revealEverything: map.revealEverything,
      revealTerrain: map.revealTerrain,
      instantMode: map.instantMode,
      humanStartsWithoutBase: true,
      startingResources: map.startingResources,
      resourceDensity: map.resourceDensity,
      difficulty: map.difficulty,
      players: [
        {
          civ: player.civ,
          color: player.color || color,
          gender: player.gender,
          isHuman: true,
          name: player.name,
          team: player.team ?? null,
        },
        {
          civ: this._randomAICiv(),
          color: color === 'red' ? 'yellow' : 'red',
          gender: 'male',
          isHuman: false,
          name: 'IA locale',
          team: null,
        },
      ],
    }
  }

  _randomAICiv(): string {
    return CIVILIZATIONS[Math.floor(Math.random() * CIVILIZATIONS.length)]?.value || 'Greek'
  }

  _extractPortalParty(state: SerializedSave): PortalPartyState {
    const played = state.players.find(player => player.isPlayed)
    const hero = played?.units?.[0] ?? null
    return {
      hero,
      followers: (played?.units || []).filter(unit => unit !== hero && unit.followingHero === true),
    }
  }

  _applyPortableUnitState(target: Partial<SaveEntityState>, source: SaveEntityState): void {
    Object.assign(target, {
      assetAge: source.assetAge,
      assetCiv: source.assetCiv,
      energy: source.energy,
      experience: source.experience,
      followingHero: source.followingHero,
      gender: (source as { gender?: unknown }).gender,
      healthRegenDelay: source.healthRegenDelay,
      healthRegenMultiplier: source.healthRegenMultiplier,
      healthRegenRate: source.healthRegenRate,
      hitPoints: source.hitPoints,
      isChief: source.isChief,
      loading: source.loading,
      loadingType: source.loadingType,
      mountedOnHorse: source.mountedOnHorse,
      name: source.name,
      totalEnergy: source.totalEnergy,
      totalHitPoints: source.totalHitPoints,
    })
  }

  _removeExistingTravelFollowers(): void {
    const { map, player, controls } = this._gameContext()
    const hero = controls.heroUnit || player.units[0]
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

    const startDistance = Math.max(2, Math.ceil(portal.size || 1))
    return getFreeCellAroundPoint(
      portal.i,
      portal.j,
      startDistance,
      map.grid,
      cell => !cell.solid && cell.category !== 'Water' && !cell.border,
      cells => cells[Math.floor(map.random() * cells.length)]
    )
  }

  _teleportRuntimeUnitToCell(unit: UnitEntity, cell: RuntimeCell): void {
    const { map } = this._gameContext()
    const currentCell = unit.currentCell || map.grid[unit.i]?.[unit.j]
    if (currentCell?.has === unit) {
      currentCell.has = null
      currentCell.solid = false
    }
    map.removeFromInstanceBucket(unit)

    const [x, y] = cartesianToIsometric(cell.i, cell.j)
    unit.i = cell.i
    unit.j = cell.j
    unit.x = x
    unit.y = y
    unit.z = cell.z
    unit.zIndex = getInstanceZIndex(unit)
    unit.currentCell = cell
    unit.path = []
    unit.action = null
    cell.place(unit)
    cell.solid = true
    map.addToInstanceBucket(unit)
    unit.applyReliefLift?.(getGroundReliefLevel(cell), true)
  }

  _applyPortalPartyToRuntime(party: PortalPartyState, arrivalCell: RuntimeCell | null = null): void {
    const { map, player, controls } = this._gameContext()
    const hero = controls.heroUnit || player.units[0]
    if (!hero) return

    if (party.hero) this._applyPortableUnitState(hero as Partial<SaveEntityState>, party.hero)
    if (arrivalCell) this._teleportRuntimeUnitToCell(hero, arrivalCell)
    this._removeExistingTravelFollowers()

    for (const followerState of party.followers) {
      const cell =
        getFreeCellAroundPoint(
          hero.i,
          hero.j,
          1,
          map.grid,
          candidate => !candidate.solid && candidate.category !== 'Water'
        ) || map.grid[hero.i]?.[hero.j]
      if (!cell) continue
      const follower = player.createUnit?.({
        i: cell.i,
        j: cell.j,
        name: followerState.name,
        type: followerState.type,
      })
      if (!follower) continue
      this._applyPortableUnitState(follower as Partial<SaveEntityState>, followerState)
      follower.followingHero = true
    }

    controls.init?.()
  }

  async travelThroughPortal(portal: ResourceEntity, color: 'blue' | 'yellow' | 'red'): Promise<void> {
    if (this._isRestarting) return
    this._isRestarting = true
    const now = Date.now()
    const currentWorldState = serializeGame(this._gameContext())
    const party = this._extractPortalParty(currentWorldState)
    const campaign = this._campaignSave
      ? updateCurrentWorldState(this._campaignSave, currentWorldState, now)
      : createInitialCampaignSave(currentWorldState, { now })
    const currentCampaignWorld = campaign.worlds[campaign.currentWorldId]
    const shouldReturnToParent = Boolean(currentCampaignWorld?.parentWorldId && currentCampaignWorld.color === color)
    const targetWorldId = this._portalWorldId(portal, color)
    const existingTarget = campaign.worlds[targetWorldId]
    this._loadingScreen = new GameLoadingScreen()
    this._loadingScreen.update('generatingWorld', 0.02)
    await this._yieldToBrowser()

    try {
      if (shouldReturnToParent) {
        const nextCampaign = returnToParentWorld(campaign, now)
        const parentState = getCurrentWorldState(nextCampaign)
        this._campaignSave = structuredClone(nextCampaign)
        this._restartSaveData = structuredClone(nextCampaign)
        this._destroyRuntime()
        await this._bootFromSave(structuredClone(parentState))
        this._applyPortalPartyToRuntime(party, this._findPortalArrivalCell())
        const targetState = serializeGame(this._gameContext())
        const committedCampaign = updateCurrentWorldState(nextCampaign, targetState, now)
        this._campaignSave = structuredClone(committedCampaign)
        this._restartSaveData = structuredClone(committedCampaign)
        this._autosaveCampaign()
      } else if (existingTarget) {
        const nextCampaign = enterCampaignWorld(campaign, targetWorldId, now)
        this._campaignSave = structuredClone(nextCampaign)
        this._restartSaveData = structuredClone(nextCampaign)
        this._destroyRuntime()
        await this._bootFromSave(structuredClone(existingTarget.state))
        this._applyPortalPartyToRuntime(party, this._findPortalArrivalCell())
        const targetState = serializeGame(this._gameContext())
        const committedCampaign = updateCurrentWorldState(nextCampaign, targetState, now)
        this._campaignSave = structuredClone(committedCampaign)
        this._restartSaveData = structuredClone(committedCampaign)
        this._autosaveCampaign()
      } else {
        const parentWorldId = campaign.currentWorldId
        const nextConfig = this._configForPortalWorld(color)
        this._destroyRuntime()
        await this._bootFromConfig(nextConfig)
        this._applyPortalPartyToRuntime(party, this._findPortalArrivalCell())
        const childState = serializeGame(this._gameContext())
        const nextCampaign = addChildWorldToCampaign(campaign, childState, {
          color,
          entryPortalId: portal.label || `${portal.i},${portal.j}`,
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
      this._loadingScreen?.destroy()
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
      await this._bootFromSave(structuredClone(getCurrentWorldState(this._restartSaveData)))
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
      await this._bootFromSave(structuredClone(getCurrentWorldState(this._restartSaveData!)))
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

  checkVictory(): boolean {
    const { player } = this.context
    if (this.context.victory || !player) return false

    const enemies = player.enemyPlayers?.() ?? []
    if (!enemies.length) return false

    const hasLivingEnemies = enemies.some((enemy: PlayerLike) => canPlayerStillAct(enemy))
    if (hasLivingEnemies) return false

    this.context.victory = true
    clearAllCombatFeedback()
    this.togglePause(true, { silent: true })
    const div = document.createElement('div')
    div.id = 'victory'
    div.className = 'game-overlay'
    div.innerText = t('victory')
    document.body.appendChild(div)
    return true
  }

  checkDefeat(): boolean {
    const { player } = this.context
    if (this.context.defeat || this.context.victory || !player) return false

    if (!isPlayedHeroDefeated(player, this.context.controls?.heroUnit)) return false

    this.context.defeat = true
    clearAllCombatFeedback()
    this.togglePause(true, { silent: true })
    const div = document.createElement('div')
    div.id = 'defeat'
    div.className = 'game-overlay'
    div.innerText = t('defeat')
    document.body.appendChild(div)
    return true
  }

  togglePause(pause: boolean, options: { silent?: boolean } = {}): void {
    if ((this.context.victory || this.context.defeat) && !pause) return
    const { map, players = [] } = this.context
    if (!map) return
    if (pause) {
      document.getElementById('pause')?.remove()
      if (!options.silent && !this.context.victory && !this.context.defeat) {
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
