import { Application, Container, type ContainerChild } from 'pixi.js'
import { sound } from '@pixi/sound'
import { t } from '../lib/lang'
import Map from '../classes/map'
import Menu from '../classes/menu'
import Controls from '../classes/controls'
import { Modal, canPlayerStillAct, debounce, isPlayerEliminated } from '../lib'
import { ActionScheduler } from '../lib/ActionScheduler'
import { stopAllUiSounds } from '../lib/uiSound'
import { validateSaveData } from '../serialization/SaveValidator'
import { save as saveToStorage } from '../serialization/SaveStorage'
import { serializeGame } from '../serialization/SaveSerializer'
import { loadPregeneratedMapBlueprint } from '../serialization/MapBlueprintLoader'
import { DevConsole } from '../dev-console/DevConsole'
import { cleanupDebugArtifacts } from '../dev-console/actions/shared'
import { PerformanceMonitor } from '../services/PerformanceMonitor'
import { getCameraZoom, getGameSpeed } from '../lib/settings'
import { GameLoadingScreen } from '../ui/GameLoadingScreen'
import { AmbientBirds } from '../services/AmbientBirds'
import { CELL_WIDTH, CELL_HEIGHT, AMBIENT_BIRD_WORLD_ZINDEX } from '../constants'
import type { GameContextLike, SchedulerLike, PerformanceMonitorLike } from '../types/context'
import type { GameConfig, PlayerSetupConfig, SaveCellState, SerializedSave } from '../types/save'
import type { PlayerLike } from '../types/player'
import type { RuntimeMap } from '../types/map'

type MapInstance = InstanceType<typeof Map> & {
  pregeneratedBlueprintId?: string | number | null
  generationTimings?: Record<string, number>
  blueprintDestroyMs?: number
  blueprintCellCreationMs?: number
  blueprintFillWaterGapsMs?: number
  blueprintNormalizeWaterMs?: number
  blueprintInitialWaterBorderMs?: number
  blueprintResourceLoadMs?: number
}

interface GameRuntimeContext extends GameContextLike {
  scheduler: SchedulerLike
  performance: PerformanceMonitorLike
  ambientBirds: AmbientBirds | null
  devConsole: DevConsole | null
  checkVictory: () => boolean
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
  _restartSaveData: SerializedSave | null
  config: GameConfig | null
  onQuit: (() => void) | null
  context: GameRuntimeContext
  _loadingScreen?: GameLoadingScreen | null
  _wakeLock?: WakeLockSentinel | null
  _onVisibilityChange?: () => void
  _onKeydown?: (evt: KeyboardEvent) => void
  _onResize?: () => void
  _onDocumentVisibilityChange?: () => void

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
      load: (evt: unknown) => this.load(evt as SerializedSave),
      pause: () => this.togglePause(true),
      resume: () => {
        if (!this.context.victory && !this.context.defeat) this.togglePause(false)
      },
      restart: () => this.restart(),
      quit: () => this.quit(),
      checkVictory: () => this.checkVictory(),
      checkDefeat: () => this.checkDefeat(),
      applyZoom: () => this.applyZoom(),
    } as unknown as GameRuntimeContext
    this.context.performance = new PerformanceMonitor(app)
    this.context.scheduler = new ActionScheduler(
      app,
      () => this.context.paused ?? false,
      () => this.context.performance ?? null
    )
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
    this.context.scheduler.timeScale = speed
    this._loadingScreen = new GameLoadingScreen()
    this._loadingScreen.update('generatingWorld', 0.02)
    await this._yieldToBrowser()
    try {
      await this._bootFromConfig(this.config!)
    } finally {
      this._loadingScreen?.destroy()
      this._loadingScreen = null
    }
  }

  _yieldToBrowser(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()))
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
      if (evt.key.toLowerCase() === 'p') {
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
    if (config.mapType) map.mapType = config.mapType
    if (config.instantMode) map.instantMode = true
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
    } as unknown as GameRuntimeContext
  }

  _createRuntime(): void {
    const { context } = this
    context.map = new Map(context) as unknown as RuntimeMap
  }

  _createUiRuntime(): void {
    const { context } = this
    context.controls = new Controls(context)
    context.menu = new Menu(context)
    context.devConsole = new DevConsole(context as unknown as ConstructorParameters<typeof DevConsole>[0])
  }

  _mountRuntime(): void {
    this.addChild(this.context.map as unknown as ContainerChild)
    this.addChild(this.context.controls)
    this.context.ambientBirds = new AmbientBirds(this.context, () => this._getMapWorldBounds())
    this.context.ambientBirds.zIndex = AMBIENT_BIRD_WORLD_ZINDEX
    ;(this.context.map as unknown as Container).addChild(this.context.ambientBirds)
    this.applyZoom()
    this._attachWindowListeners()
  }

  _getMapWorldBounds(): { x: number; y: number; width: number; height: number } {
    const { size } = this.context.map
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
      cleanupDebugArtifacts(this.context as unknown as Parameters<typeof cleanupDebugArtifacts>[0])
    }
    this.context.scheduler?.clear?.()
    this.context.performance?.reset?.()
    this.context.controls?.destroy({ children: true })
    this.context.devConsole?.destroy()
    this.context.menu?.destroy?.()
    ;(this.context.map as unknown as Container | null)?.destroy({ children: true })
    this.removeChildren()
    this._resetRuntimeState()
  }

  async _bootFromConfig(config: GameConfig): Promise<void> {
    this.context.performance?.setPhase?.('load')
    this._createRuntime()
    const map = this.context.map as unknown as MapInstance
    this._applyMapConfig(this.context.map, config)
    this._createUiRuntime()

    const posCount = config.players ? config.players.length : config.bots != null ? Number(config.bots) + 1 : null
    const mapGenerationStartedAt = performance.now()
    const blueprint = await loadPregeneratedMapBlueprint({
      size: map.size,
      mapType: map.mapType || 'plain',
      positionsCount: posCount ?? undefined,
    })
    if (blueprint) {
      await map.generateFromBlueprint(blueprint, {
        onProgress: (messageKey: string, progress: number) => this._updateLoading(messageKey, progress),
      })
      map.pregeneratedBlueprintId = blueprint.id
      console.info(`[maps] Loaded pregenerated blueprint: ${blueprint.id}`)
    } else {
      await map.generateMapAsync(posCount, 0, {
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
    this.context.players = map.generatePlayers((config.players as Array<Partial<PlayerLike> & PlayerSetupConfig>) || null)
    this.context.player = this.context.players[0]
    this.context.menu.init?.()
    await map.stylishMap({
      onProgress: (messageKey: string, progress: number) => this._updateLoading(messageKey, progress),
    })
    await this._updateLoading('finalizingWorld', 0.96)
    this.context.controls.init?.()

    this._mountRuntime()
    this.context.performance?.setPhase?.('runtime')
    this.checkVictory()
    this._restartSaveData = structuredClone(serializeGame(this.context)) as SerializedSave
  }

  async _bootFromSeedSave(json: SerializedSave): Promise<void> {
    this.context.performance?.setPhase?.('load')
    this._createRuntime()
    const map = this.context.map as unknown as MapInstance
    const world = (json.world || {}) as GameConfig
    const savedConfig = (json.config || {}) as GameConfig
    const seedConfig = {
      ...savedConfig,
      seed: world.seed ?? savedConfig.seed,
      size: world.size ?? savedConfig.size,
      mapType: world.mapType ?? savedConfig.mapType,
    }
    this._applyMapConfig(this.context.map, seedConfig)
    this._createUiRuntime()

    const savedPlayers = Array.isArray(json.players) ? json.players : []
    const positionsCount =
      Number.isFinite(world.positionsCount) && Number(world.positionsCount) > 0
        ? Number(world.positionsCount)
        : savedPlayers.length || null

    const blueprintId = world.pregeneratedBlueprintId
    const blueprint = blueprintId
      ? await loadPregeneratedMapBlueprint({ size: map.size, mapType: map.mapType || 'plain', id: String(blueprintId) })
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
    map.mapGeneration.applySavedStateToGeneratedMap(json as SerializedSave & { map: SaveCellState[][] })
    this._mountRuntime()
    this.context.performance?.setPhase?.('runtime')
    this.checkVictory()
  }

  async _bootFromSave(json: SerializedSave): Promise<void> {
    this.context.performance?.setPhase?.('load')
    if (!Array.isArray(json.map)) {
      await this._bootFromSeedSave(json)
      return
    }
    this._createRuntime()
    const map = this.context.map as unknown as MapInstance
    const savedMap = json.map as unknown[] | undefined
    map.size = Math.max(0, (savedMap?.length || 1) - 1)
    this._applyMapConfig(this.context.map, (json.config as GameConfig) || {})
    this._createUiRuntime()
    map.generateFromJSON(json as SerializedSave & { map: SaveCellState[][] })
    this._mountRuntime()
    this.context.performance?.setPhase?.('runtime')
    this.checkVictory()
  }

  save(): { key: string; name: string } {
    return saveToStorage(this.context)
  }

  async load(json: SerializedSave): Promise<void> {
    try {
      validateSaveData(json)
      this._restartSaveData = structuredClone(json)
      this._destroyRuntime()
      const speed = getGameSpeed()
      this.context.app.ticker.speed = speed
      this.context.scheduler.timeScale = speed
      this._loadingScreen = new GameLoadingScreen()
      this._loadingScreen.update('generatingTerrain', 0.02)
      await this._yieldToBrowser()
      await this._bootFromSave(structuredClone(this._restartSaveData))
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
    this._destroyRuntime()
    const speed = getGameSpeed()
    this.context.app.ticker.speed = speed
    this.context.scheduler.timeScale = speed
    this._loadingScreen = new GameLoadingScreen()
    this._loadingScreen.update('generatingTerrain', 0.02)
    await this._yieldToBrowser()
    try {
      await this._bootFromSave(structuredClone(this._restartSaveData!))
    } finally {
      this._loadingScreen?.destroy()
      this._loadingScreen = null
    }
  }

  quit(): void {
    this._destroyRuntime()
    if (this.onQuit) this.onQuit()
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this._wakeLock?.release()
    document.removeEventListener('visibilitychange', this._onVisibilityChange as EventListener)
    this._destroyRuntime()
    this.context.scheduler?.destroy?.()
    this.context.performance?.destroy?.()
    ;(this.context as unknown as { scheduler: SchedulerLike | null; performance: PerformanceMonitorLike | null }).scheduler = null
    ;(this.context as unknown as { scheduler: SchedulerLike | null; performance: PerformanceMonitorLike | null }).performance = null
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

    if (!isPlayerEliminated(player)) return false

    this.context.defeat = true
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
    const gaiaUnits = map.gaia?.units ?? []
    for (let i = 0; i < gaiaUnits.length; i++) {
      pause ? gaiaUnits[i].pause?.() : gaiaUnits[i].resume?.()
    }
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      for (let j = 0; j < player.units.length; j++) {
        pause ? player.units[j].pause?.() : player.units[j].resume?.()
      }
      for (let j = 0; j < player.buildings.length; j++) {
        pause ? player.buildings[j].pause?.() : player.buildings[j].resume?.()
      }
    }
    this.context.paused = pause
  }
}
