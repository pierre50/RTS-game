import Game from './Game'
import MapEditor from './MapEditor'
import MapEditorConfig from './MapEditorConfig'
import MainMenu from './MainMenu'
import MapConfig from './MapConfig'
import { OrientationGuard } from '../ui/OrientationGuard'

export class ScreenManager {
  constructor(app, gamebox) {
    this.app = app
    this.gamebox = gamebox
    this.currentMenuScreen = null
    this.currentRuntime = null
    this.orientationGuard = new OrientationGuard({
      onChange: blocked => {
        this.currentRuntime?.setOrientationBlocked(blocked)
      },
    })
  }

  start() {
    this.showMainMenu()
  }

  destroyCurrentMenuScreen() {
    if (!this.currentMenuScreen) return
    this.currentMenuScreen.destroy()
    this.currentMenuScreen = null
  }

  destroyCurrentRuntime() {
    if (!this.currentRuntime) return
    this.app.stage.removeChild(this.currentRuntime)
    this.currentRuntime.destroy()
    this.currentRuntime = null
  }

  showMainMenu() {
    this.destroyCurrentMenuScreen()
    this.currentMenuScreen = new MainMenu({
      onStart: () => this.showMapConfig(),
      onMapEditor: () => this.showMapEditorConfig(),
      onLoad: save => this.loadGame(save),
    })
  }

  showMapConfig() {
    new MapConfig({
      onPlay: config => this.startGame(config),
    })
  }

  showMapEditorConfig() {
    new MapEditorConfig({
      onCreate: config => this.showMapEditor(config),
    })
  }

  startGame(config) {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentRuntime()
    this.currentRuntime = new Game(this.app, this.gamebox, config, () => this.handleQuitRuntime())
    this.app.stage.addChild(this.currentRuntime)
    this.currentRuntime.setOrientationBlocked(this.orientationGuard.blocked)
  }

  showMapEditor(config) {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentRuntime()
    this.currentRuntime = new MapEditor(this.app, this.gamebox, config, () => this.handleQuitRuntime())
    this.app.stage.addChild(this.currentRuntime)
    this.currentRuntime.setOrientationBlocked(this.orientationGuard.blocked)
  }

  loadGame(save) {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentRuntime()
    this.currentRuntime = new Game(this.app, this.gamebox, null, () => this.handleQuitRuntime())
    this.app.stage.addChild(this.currentRuntime)
    this.currentRuntime.setOrientationBlocked(this.orientationGuard.blocked)
    this.currentRuntime.load(save)
  }

  handleQuitRuntime() {
    this.destroyCurrentRuntime()
    this.showMainMenu()
  }
}
