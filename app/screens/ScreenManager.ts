import { Application } from 'pixi.js'
import Game from './Game'
import MapEditor from './MapEditor'
import MapEditorConfig from './MapEditorConfig'
import MainMenu from './MainMenu'
import MapConfig from './MapConfig'
import { OrientationGuard } from '../ui/OrientationGuard'

type AnyRecord = Record<string, any>

export class ScreenManager {
  app: Application
  gamebox: AnyRecord
  currentMenuScreen: any
  currentRuntime: any
  orientationGuard: OrientationGuard

  constructor(app: Application, gamebox: AnyRecord) {
    this.app = app
    this.gamebox = gamebox
    this.currentMenuScreen = null
    this.currentRuntime = null
    this.orientationGuard = new OrientationGuard({
      onChange: (blocked: boolean) => {
        this.currentRuntime?.setOrientationBlocked(blocked)
      },
    })
  }

  start(): void {
    this.showMainMenu()
  }

  destroyCurrentMenuScreen(): void {
    if (!this.currentMenuScreen) return
    this.currentMenuScreen.destroy()
    this.currentMenuScreen = null
  }

  destroyCurrentRuntime(): void {
    if (!this.currentRuntime) return
    this.app.stage.removeChild(this.currentRuntime)
    this.currentRuntime.destroy()
    this.currentRuntime = null
  }

  showMainMenu(): void {
    this.destroyCurrentMenuScreen()
    this.currentMenuScreen = new MainMenu({
      onStart: () => this.showMapConfig(),
      onMapEditor: () => this.showMapEditorConfig(),
      onLoad: (save: AnyRecord) => this.loadGame(save),
    })
  }

  showMapConfig(): void {
    new MapConfig({
      onPlay: (config: AnyRecord) => this.startGame(config),
    })
  }

  showMapEditorConfig(): void {
    new MapEditorConfig({
      onCreate: (config: AnyRecord) => this.showMapEditor(config),
    })
  }

  startGame(config: AnyRecord): void {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentRuntime()
    this.currentRuntime = new Game(this.app, this.gamebox, config, () => this.handleQuitRuntime())
    this.app.stage.addChild(this.currentRuntime)
    this.currentRuntime.setOrientationBlocked(this.orientationGuard.blocked)
  }

  showMapEditor(config: AnyRecord): void {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentRuntime()
    this.currentRuntime = new MapEditor(this.app, this.gamebox, config, () => this.handleQuitRuntime())
    this.app.stage.addChild(this.currentRuntime)
    this.currentRuntime.setOrientationBlocked(this.orientationGuard.blocked)
  }

  loadGame(save: AnyRecord): void {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentRuntime()
    this.currentRuntime = new Game(this.app, this.gamebox, null, () => this.handleQuitRuntime())
    this.app.stage.addChild(this.currentRuntime)
    this.currentRuntime.setOrientationBlocked(this.orientationGuard.blocked)
    this.currentRuntime.load(save)
  }

  handleQuitRuntime(): void {
    this.destroyCurrentRuntime()
    this.showMainMenu()
  }
}
