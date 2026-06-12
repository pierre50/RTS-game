import { Container } from 'pixi.js'
import { sound } from '@pixi/sound'
import { t } from '../lib/lang'
import Map from '../classes/map'
import Menu from '../classes/menu'
import Controls from '../classes/controls'
import { canPlayerStillAct, debounce, isPlayerEliminated } from '../lib'
import { ActionScheduler } from '../lib/ActionScheduler'
import { stopAllUiSounds } from '../lib/uiSound'
import { validateSaveData } from '../serialization/SaveValidator'
import { save as saveToStorage } from '../serialization/SaveStorage'
import { DevConsole } from '../dev-console/DevConsole'
import { cleanupDebugArtifacts } from '../dev-console/actions/shared'
import { getCameraZoom, getGameSpeed } from '../lib/settings'
import { GameLoadingScreen } from '../ui/GameLoadingScreen'

/**
 * Main Display Object
 * @exports Game
 * @extends Container
 */

export default class Game extends Container {
  constructor(app, gamebox, config = null, onQuit = null) {
    super()
    this._pausedByVisibility = false
    this._pausedByOrientation = false
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
      devConsole: null,
      devConsoleOpen: false,
      paused: false,
      victory: false,
      defeat: false,
      scheduler: null,
      save: () => this.save(),
      load: evt => this.load(evt),
      pause: () => this.togglePause(true),
      resume: () => {
        if (!this.context.victory && !this.context.defeat) this.togglePause(false)
      },
      restart: () => this.restart(),
      quit: () => this.quit(),
      checkVictory: () => this.checkVictory(),
      checkDefeat: () => this.checkDefeat(),
      applyZoom: () => this.applyZoom(),
    }
    this.context.scheduler = new ActionScheduler(app, () => this.context.paused)
    if (config !== null) {
      this.start().catch(error => {
        this._loadingScreen?.destroy()
        console.error('Unable to start game', error)
        this.quit()
      })
    }
  }

  async start() {
    this._acquireWakeLock()
    const speed = getGameSpeed()
    this.context.app.ticker.speed = speed
    this.context.scheduler.timeScale = speed
    this._loadingScreen = new GameLoadingScreen()
    this._loadingScreen.update('generatingTerrain', 0.02)
    await this._yieldToBrowser()
    try {
      await this._bootFromConfig(this.config)
    } finally {
      this._loadingScreen?.destroy()
      this._loadingScreen = null
    }
  }

  _yieldToBrowser() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()))
  }

  async _updateLoading(messageKey, progress) {
    this._loadingScreen?.update(messageKey, progress)
    await this._yieldToBrowser()
  }

  async _acquireWakeLock() {
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

  _attachWindowListeners() {
    this._onKeydown = evt => {
      if (this.context.devConsoleOpen) return
      if (evt.key === 'p') {
        if (this.context.victory || this.context.defeat) return
        this.context.paused ? this.context.resume() : this.context.pause()
      }
    }
    this._onResize = debounce(() => {
      this.applyZoom()
      if (this.context.controls) this.context.controls.updateVisibleCells()
      if (this.context.menu) this.context.menu.updateCameraMiniMap()
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

  _removeWindowListeners() {
    window.removeEventListener('keydown', this._onKeydown)
    window.removeEventListener('resize', this._onResize)
    document.removeEventListener('visibilitychange', this._onDocumentVisibilityChange)
  }

  _handleDocumentHidden() {
    if (!this.context.paused && !this.context.victory && !this.context.defeat) {
      this._pausedByVisibility = true
      this.togglePause(true, { silent: true })
    }
    sound.stopAll()
    stopAllUiSounds()
  }

  _handleDocumentVisible() {
    if (!this._pausedByVisibility) return
    if (this._pausedByOrientation) return
    this._pausedByVisibility = false
    if (!this.context.victory && !this.context.defeat) {
      this.togglePause(false, { silent: true })
    }
  }

  setOrientationBlocked(blocked) {
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

  _applyMapConfig(map, config = {}) {
    if (config.size) map.size = config.size
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

  _resetOverlayDom() {
    document.getElementById('pause')?.remove()
    document.getElementById('victory')?.remove()
    document.getElementById('defeat')?.remove()
  }

  _resetRuntimeState() {
    this._pausedByVisibility = false
    this._pausedByOrientation = false
    this.context = {
      ...this.context,
      player: null,
      players: [],
      map: null,
      controls: null,
      devConsole: null,
      devConsoleOpen: false,
      paused: false,
      victory: false,
      defeat: false,
    }
  }

  _createRuntime() {
    const { context } = this
    context.map = new Map(context)
  }

  _createUiRuntime() {
    const { context } = this
    context.controls = new Controls(context)
    context.menu = new Menu(context)
    context.devConsole = new DevConsole(context)
  }

  _mountRuntime() {
    this.addChild(this.context.map)
    this.addChild(this.context.controls)
    this.applyZoom()
    this._attachWindowListeners()
  }

  _destroyRuntime() {
    this._loadingScreen?.destroy()
    this._loadingScreen = null
    this._resetOverlayDom()
    this._removeWindowListeners()
    if (this.context.map) {
      cleanupDebugArtifacts(this.context)
    }
    this.context.scheduler?.clear()
    this.context.controls?.destroy({ children: true })
    this.context.devConsole?.destroy()
    this.context.menu?.destroy()
    this.context.map?.destroy({ children: true })
    this.removeChildren()
    this._resetRuntimeState()
  }

  async _bootFromConfig(config) {
    this._createRuntime()
    this._applyMapConfig(this.context.map, config)
    if (this._restartSeed != null) {
      this.context.map.seed = this._restartSeed
      this._restartSeed = null
    }
    this._createUiRuntime()

    const posCount = config.players ? config.players.length : config.bots != null ? config.bots + 1 : null
    const mapGenerationStartedAt = performance.now()
    this.context.map.generateMap(posCount)
    this.context.map.generationTimings = {
      terrainAndSpawns: performance.now() - mapGenerationStartedAt,
    }
    await this._updateLoading('generatingPlayers', 0.2)
    this.context.players = this.context.map.generatePlayers(config.players || null)
    this.context.player = this.context.players[0]
    this.context.menu.init()
    await this.context.map.stylishMap({
      onProgress: (messageKey, progress) => this._updateLoading(messageKey, progress),
    })
    await this._updateLoading('finalizingWorld', 0.96)
    this.context.controls.init()

    this._mountRuntime()
    this.checkVictory()
  }

  _bootFromSave(json) {
    this._createRuntime()
    this.context.map.size = Math.max(0, (json.map?.length || 1) - 1)
    this._applyMapConfig(this.context.map, json.config)
    this._createUiRuntime()
    this.context.map.generateFromJSON(json)
    this._mountRuntime()
    this.checkVictory()
  }

  save() {
    return saveToStorage(this.context)
  }

  load(json) {
    validateSaveData(json)
    this._destroyRuntime()
    const speed = getGameSpeed()
    this.context.app.ticker.speed = speed
    this.context.scheduler.timeScale = speed
    this._bootFromSave(json)
  }

  applyZoom() {
    const zoom = getCameraZoom()
    this.scale.set(zoom)
    this.position.set(
      (this.context.app.screen.width * (1 - zoom)) / 2,
      (this.context.app.screen.height * (1 - zoom)) / 2
    )
  }

  async restart() {
    this._restartSeed = this.context.map?.seed
    this._destroyRuntime()
    const speed = getGameSpeed()
    this.context.app.ticker.speed = speed
    this.context.scheduler.timeScale = speed
    this._loadingScreen = new GameLoadingScreen()
    this._loadingScreen.update('generatingTerrain', 0.02)
    await this._yieldToBrowser()
    try {
      await this._bootFromConfig(this.config)
    } finally {
      this._loadingScreen?.destroy()
      this._loadingScreen = null
    }
  }

  quit() {
    this._destroyRuntime()
    if (this.onQuit) this.onQuit()
  }

  destroy(options) {
    this._wakeLock?.release()
    document.removeEventListener('visibilitychange', this._onVisibilityChange)
    this._destroyRuntime()
    this.context.scheduler?.destroy()
    this.context.scheduler = null
    super.destroy(options)
  }

  checkVictory() {
    const { player } = this.context
    if (this.context.victory || !player) return

    const enemies = player.enemyPlayers()
    if (!enemies.length) return

    const hasLivingEnemies = enemies.some(enemy => canPlayerStillAct(enemy))
    if (hasLivingEnemies) return

    this.context.victory = true
    this.togglePause(true, { silent: true })
    const div = document.createElement('div')
    div.id = 'victory'
    div.className = 'game-overlay'
    div.innerText = t('victory')
    document.body.appendChild(div)
  }

  checkDefeat() {
    const { player } = this.context
    if (this.context.defeat || this.context.victory || !player) return

    if (!isPlayerEliminated(player)) return

    this.context.defeat = true
    this.togglePause(true, { silent: true })
    const div = document.createElement('div')
    div.id = 'defeat'
    div.className = 'game-overlay'
    div.innerText = t('defeat')
    document.body.appendChild(div)
  }

  togglePause(pause, options = {}) {
    if ((this.context.victory || this.context.defeat) && !pause) return
    const { map, players } = this.context
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
    for (let i = 0; i < map.gaia.units.length; i++) {
      pause ? map.gaia.units[i].pause() : map.gaia.units[i].resume()
    }
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      for (let j = 0; j < player.units.length; j++) {
        pause ? player.units[j].pause() : player.units[j].resume()
      }
      for (let j = 0; j < player.buildings.length; j++) {
        pause ? player.buildings[j].pause() : player.buildings[j].resume()
      }
    }
    this.context.paused = pause
  }
}
