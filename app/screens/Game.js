import { Container } from 'pixi.js'
import Map from '../classes/map'
import Menu from '../classes/menu'
import Controls from '../classes/controls'
import { filterObject, debounce } from '../lib'

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
      save: () => this.save(),
      load: evt => this.load(evt),
      pause: () => this.togglePause(true),
      resume: () => this.togglePause(false),
      quit: () => this.quit(),
    }
    this.start()
  }

  start() {
    const { context, config } = this

    context.map = new Map(context)

    if (config.size) context.map.size = config.size
    if (config.devMode) context.map.devMode = true
    if (config.revealEverything !== undefined) context.map.revealEverything = config.revealEverything
    if (config.revealTerrain !== undefined) context.map.revealTerrain = config.revealTerrain
    if (config.startingResources) context.map.startingResources = config.startingResources

    context.controls = new Controls(context)
    context.menu = new Menu(context)

    context.map.generateMap(config.bots != null ? config.bots + 1 : null)

    context.players = context.map.generatePlayers()
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

  static _resourceData(resource) {
    return {
      ...filterObject(resource, ['label', 'i', 'j', 'type', 'isDead', 'quantity', 'isDestroyed', 'size', 'hitPoints']),
      textureName: (resource.textureName || '').split('.')[0],
    }
  }

  static _animalData(animal) {
    return {
      ...filterObject(animal, [
        'label', 'type', 'i', 'j', 'x', 'y', 'z', 'hitPoints', 'path', 'work', 'realDest',
        'zIndex', 'degree', 'action', 'direction', 'currentSheet', 'size', 'inactif',
        'isDead', 'isDestroyed', 'quantity',
      ]),
      currentFrame: animal.sprite?.currentFrame,
      loop: animal.sprite?.loop,
      dest: animal.dest && [animal.dest.i, animal.dest.j, animal.dest?.label],
      previousDest: animal.previousDest && [animal.previousDest.i, animal.previousDest.j, animal.previousDest?.label],
    }
  }

  static _unitData(unit) {
    return {
      ...filterObject(unit, [
        'label', 'type', 'i', 'j', 'x', 'y', 'z', 'hitPoints', 'path', 'work', 'realDest',
        'degree', 'action', 'loading', 'loadingType', 'direction', 'currentSheet', 'size',
        'inactif', 'isDead', 'isDestroyed',
      ]),
      currentFrame: unit.sprite?.currentFrame,
      loop: unit.sprite?.loop,
      dest: unit.dest && [unit.dest.i, unit.dest.j, unit.dest?.label],
      previousDest: unit.previousDest && [unit.previousDest.i, unit.previousDest.j, unit.previousDest?.label],
    }
  }

  static _buildingData(building) {
    return {
      ...filterObject(building, [
        'label', 'i', 'j', 'type', 'queue', 'technology', 'loading',
        'isDead', 'isDestroyed', 'isBuilt', 'hitPoints', 'quantity',
      ]),
      isUsedBy: building.isUsedBy?.label,
    }
  }

  static _playerData(player) {
    return {
      ...filterObject(player, [
        'label', 'age', 'type', 'wood', 'food', 'stone', 'gold', 'civ', 'color',
        'population', 'population_max', 'technologies', 'cellViewed', 'isPlayed', 'hasBuilt',
      ]),
      buildings: player.buildings.map(b => Game._buildingData(b)),
      units: player.units.map(u => Game._unitData(u)),
      corpses: player.corpses.map(c => Game._unitData(c)),
      views: player.views.map(view =>
        view.map(cell => ({
          ...filterObject(cell, ['i', 'j', 'viewed']),
          viewBy: [...(cell.viewBy || [])].map(unit => unit.label),
        }))
      ),
    }
  }

  static _cellData(cell) {
    return {
      ...filterObject(cell, ['z', 'type', 'viewed', 'solid', 'visible', 'category', 'inclined', 'border', 'waterBorder']),
      has: cell.has?.label,
      fogSprites: cell.fogSprites.map(({ textureSheet, colorSheet, colorName }) => ({ textureSheet, colorSheet, colorName })),
    }
  }

  save() {
    const { context } = this
    const json = {
      camera: context.controls.camera,
      config: {
        devMode: context.map.devMode,
        revealEverything: context.map.revealEverything,
        revealTerrain: context.map.revealTerrain,
        startingResources: context.map.startingResources,
      },
      players: context.players.map(p => Game._playerData(p)),
      resources: [...context.map.resources].map(r => Game._resourceData(r)),
      map: context.map.grid.map(line => line.map(cell => Game._cellData(cell))),
      animals: context.map.gaia.units.map(a => Game._animalData(a)),
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json))
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute('href', dataStr)
    downloadAnchorNode.setAttribute('download', `save_${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })}.json`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
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
      div.innerText = 'Pause'
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
