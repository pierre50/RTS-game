import { Container } from 'pixi.js'
import { t } from '../lib/lang'
import Map from '../classes/map'
import Menu from '../classes/menu'
import Controls from '../classes/controls'
import { debounce } from '../lib'
import { ActionScheduler } from '../lib/ActionScheduler'
import { serializeGame } from '../serialization/SaveSerializer'

/**
 * Main Display Object
 * @exports Game
 * @extends Container
 */

export default class Game extends Container {
  constructor(app, gamebox, config = {}, onQuit = null) {
    super()
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
      paused: false,
      scheduler: null,
      save: () => this.save(),
      load: evt => this.load(evt),
      pause: () => this.togglePause(true),
      resume: () => this.togglePause(false),
      quit: () => this.quit(),
    }
    this.context.scheduler = new ActionScheduler(app, () => this.context.paused)
    this.start()
  }

  start() {
    const { context, config } = this

    context.map = new Map(context)

    if (config.size) context.map.size = config.size
    if (config.mapType) context.map.mapType = config.mapType
    if (config.devMode) context.map.devMode = true
    if (config.revealEverything !== undefined) context.map.revealEverything = config.revealEverything
    if (config.revealTerrain !== undefined) context.map.revealTerrain = config.revealTerrain
    if (config.startingResources) context.map.startingResources = config.startingResources
    if (config.difficulty) context.map.difficulty = config.difficulty

    context.controls = new Controls(context)
    context.menu = new Menu(context)

    const posCount = config.players ? config.players.length : config.bots != null ? config.bots + 1 : null
    context.map.generateMap(posCount)

    context.players = context.map.generatePlayers(config.players || null)
    context.player = context.players[0]
    context.menu.init()
    context.map.placePlayers()
    context.map.stylishMap()
    context.controls.init()

    this.addChild(context.map)
    this.addChild(context.controls)

    this._attachWindowListeners()
  }

  _attachWindowListeners() {
    this._onKeydown = evt => {
      if (evt.key === 'p') {
        this.context.paused ? this.context.resume() : this.context.pause()
      }
    }
    this._onResize = debounce(() => {
      if (this.context.controls) this.context.controls.updateVisibleCells()
      if (this.context.menu) this.context.menu.updateCameraMiniMap()
    }, 100)
    window.addEventListener('keydown', this._onKeydown)
    window.addEventListener('resize', this._onResize)
  }

  _removeWindowListeners() {
    window.removeEventListener('keydown', this._onKeydown)
    window.removeEventListener('resize', this._onResize)
  }

  save() {
    const data = serializeGame(this.context)

    const workerBlob = new Blob(['self.onmessage=({data})=>self.postMessage(JSON.stringify(data))'], {
      type: 'application/javascript',
    })
    const workerUrl = URL.createObjectURL(workerBlob)
    const worker = new Worker(workerUrl)
    URL.revokeObjectURL(workerUrl)

    worker.onmessage = ({ data: json }) => {
      worker.terminate()
      const blobUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `save_${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    }

    worker.postMessage(data)
  }

  load(json) {
    document.getElementById('pause')?.remove()
    this._removeWindowListeners()
    this.context.controls.destroy()
    this.context.menu.destroy()
    this.removeChildren()
    this.context = {
      ...this.context,
      player: null,
      players: [],
      map: null,
      controls: null,
      paused: false,
    }
    const { context } = this

    context.map = new Map(context)

    if (json.config) {
      if (json.config.devMode) context.map.devMode = true
      if (json.config.revealEverything !== undefined) context.map.revealEverything = json.config.revealEverything
      if (json.config.revealTerrain !== undefined) context.map.revealTerrain = json.config.revealTerrain
      if (json.config.startingResources) context.map.startingResources = json.config.startingResources
    }

    context.controls = new Controls(context)
    context.menu = new Menu(context)

    context.map.generateFromJSON(json)

    this.addChild(context.map)
    this.addChild(context.controls)

    this._attachWindowListeners()
  }

  quit() {
    document.getElementById('pause')?.remove()
    this._removeWindowListeners()
    this.context.controls.destroy()
    this.context.menu.destroy()
    this.removeChildren()
    if (this.onQuit) this.onQuit()
  }

  togglePause(pause) {
    const { map, players } = this.context
    if (pause) {
      const div = document.createElement('div')
      div.id = 'pause'
      div.innerText = t('pause')
      document.body.appendChild(div)
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
