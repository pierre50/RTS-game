import { Container } from 'pixi.js'
import Map from '../classes/map'
import Menu from '../classes/menu'
import Controls from '../classes/controls'

/**
 * Main Display Object
 * @exports Game
 * @extends Container
 */

export default class Game extends Container {
  constructor(app) {
    super()

    this.app = app
    this.start()
  }

  start() {
    const context = {
      app: this.app,
      menu: null,
      player: null,
      players: [],
      map: null,
      controls: null,
    }

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

    window.addEventListener('resize', () => {
      if (context.controls) {
        context.controls.clearInstancesOnScreen()
        context.controls.displayInstancesOnScreen()
      }
      if (context.menu) {
        context.menu.updateCameraMiniMap()
      }
    })
  }
}
