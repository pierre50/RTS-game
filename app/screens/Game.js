import { Container } from 'pixi.js'
import Map from '../classes/map'
import Menu from '../classes/menu'
import Controls from '../classes/controls'
import { filterObject } from '../lib'

/**
 * Main Display Object
 * @exports Game
 * @extends Container
 */

export default class Game extends Container {
  constructor(app, gamebox) {
    super()
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
    }
    this.start()
  }

  start() {
    const { context } = this

    context.map = new Map(context)
    context.controls = new Controls(context)
    context.menu = new Menu(context)

    context.map.generateMap()

    context.players = context.map.generatePlayers()
    context.player = context.players[0]
    context.menu.init()
    context.map.placePlayers()
    context.map.stylishMap()
    context.controls.init()

    this.addChild(context.map)
    this.addChild(context.controls)

    window.addEventListener('keydown', evt => {
      if (evt.key === 'p') {
        this.context.paused ? context.resume() : context.pause()
      }
    })
    window.addEventListener('resize', () => {
      if (context.controls) {
        context.controls.updateVisibleCells()
      }
      if (context.menu) {
        context.menu.updateCameraMiniMap()
      }
    })
  }

  save() {
    const cleanContext = context => {
      const resourceData = resource => ({
        ...filterObject(resource, [
          'label',
          'i',
          'j',
          'selected',
          'type',
          'isDead',
          'quantity',
          'isDestroyed',
          'size',
          'hitPoints',
        ]),
        textureName: (resource.textureName || '').split('.')[0],
      })
      const animalData = animal => ({
        ...filterObject(animal, [
          'label',
          'type',
          'i',
          'j',
          'x',
          'y',
          'z',
          'hitPoints',
          'path',
          'work',
          'realDest',
          'path',
          'zIndex',
          'selected',
          'degree',
          'action',
          'direction',
          'currentSheet',
          'size',
          'inactif',
          'isDead',
          'isDestroyed',
          'quantity',
        ]),
        currentFrame: animal.sprite?.currentFrame,
        loop: animal.sprite?.loop,
        dest: animal.dest && [animal.dest.i, animal.dest.i, animal.dest?.label],
        previousDest: animal.previousDest && [animal.previousDest.i, animal.previousDest.i, animal.previousDest?.label],
      })
      const unitData = unit => ({
        ...filterObject(unit, [
          'label',
          'type',
          'i',
          'j',
          'x',
          'y',
          'z',
          'hitPoints',
          'path',
          'work',
          'realDest',
          'path',
          'selected',
          'degree',
          'action',
          'loading',
          'loadingType',
          'direction',
          'currentSheet',
          'size',
          'inactif',
          'isDead',
          'isDestroyed',
        ]),
        currentFrame: unit.sprite?.currentFrame,
        loop: unit.sprite?.loop,
        dest: unit.dest && [unit.dest.i, unit.dest.i, unit.dest?.label],
        previousDest: unit.previousDest && [unit.previousDest.i, unit.previousDest.i, unit.previousDest?.label],
      })
      const buildingData = building => ({
        ...filterObject(building, [
          'label',
          'i',
          'j',
          'type',
          'selected',
          'queue',
          'technology',
          'loading',
          'isDead',
          'isDestroyed',
          'isBuilt',
          'hitPoints',
          'quantity',
        ]),
        isUsedBy: building.isUsedBy?.iname,
      })
      const playerData = player => ({
        ...filterObject(player, [
          'label',
          'age',
          'type',
          'wood',
          'food',
          'stone',
          'gold',
          'civ',
          'color',
          'population',
          'POPULATION_MAX',
          'technologies',
          'cellViewed',
          'isPlayed',
          'hasBuilt',
        ]),
        buildings: player.buildings.map(building => buildingData(building)),
        units: player.units.map(unit => unitData(unit)),
        corpses: player.corpses.map(corpse => unitData(corpse)),
        views: player.views.map(view =>
          view.map(cell => ({
            ...filterObject(cell, ['i', 'j', 'viewed']),
            viewBy: (cell.viewBy || []).map(unit => unit.label),
          }))
        ),
      })
      const cellData = cell => ({
        ...filterObject(cell, [
          'z',
          'type',
          'viewed',
          'solid',
          'visible',
          'category',
          'inclined',
          'border',
          'waterBorder',
        ]),
        has: cell.has?.label,
        fogSprites: cell.fogSprites.map(({ textureSheet, colorSheet, colorName }) => ({
          textureSheet,
          colorSheet,
          colorName,
        })),
      })
      return {
        camera: context.controls.camera,
        players: context.players.map(player => playerData(player)),
        resources: context.map.resources.map(resource => resourceData(resource)),
        map: context.map.grid.map(line => line.map(cell => cellData(cell))),
        animals: context.map.gaia.units.map(animal => animalData(animal)),
      }
    }

    const json = cleanContext(this.context)
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json))
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute('href', dataStr)
    downloadAnchorNode.setAttribute('download', `save_${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })}.json`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  load(json) {
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
    context.controls = new Controls(context)
    context.menu = new Menu(context)

    context.map.generateFromJSON(json)

    this.addChild(context.map)
    this.addChild(context.controls)
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
      for (let j = 0; j < player?.units?.length; j++) {
        pause ? player.units[j].pause() : player.units[j].resume()
      }
      for (let j = 0; j < player?.buildings?.length; j++) {
        pause ? player.buildings[j].pause() : player.buildings[j].resume()
      }
    }
    this.context.paused = pause
  }
}
