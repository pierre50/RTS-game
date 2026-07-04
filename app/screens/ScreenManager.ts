import { Application } from 'pixi.js'
import Game from './Game'
import MapEditor from './MapEditor'
import MapEditorConfig from './MapEditorConfig'
import MainMenu from './MainMenu'
import MapConfig from './MapConfig'
import { OrientationGuard } from '../ui/OrientationGuard'
import type { GameConfig, SaveRecord } from '../types/save'

type RuntimeScreen = (Game | MapEditor) & {
  setOrientationBlocked(blocked: boolean): void
}

export class ScreenManager {
  app: Application
  gamebox: HTMLElement
  currentMenuScreen: MainMenu | null
  currentRuntime: RuntimeScreen | null
  orientationGuard: OrientationGuard

  constructor(app: Application, gamebox: HTMLElement) {
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
      onLoad: (save: SaveRecord) => this.loadGame(save),
    })
  }

  showMapConfig(): void {
    new MapConfig({
      onPlay: (config: GameConfig) => this.startGame(config),
    })
  }

  showMapEditorConfig(): void {
    new MapEditorConfig({
      onCreate: (config: GameConfig) => this.showMapEditor(config),
    })
  }

  startGame(config: GameConfig): void {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentRuntime()
    this.currentRuntime = new Game(this.app, this.gamebox, config, () => this.handleQuitRuntime())
    this.app.stage.addChild(this.currentRuntime)
    this.currentRuntime.setOrientationBlocked(this.orientationGuard.blocked)
  }

  showMapEditor(config: GameConfig): void {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentRuntime()
    this.currentRuntime = new MapEditor(this.app, this.gamebox, config, () => this.handleQuitRuntime())
    this.app.stage.addChild(this.currentRuntime)
    this.currentRuntime.setOrientationBlocked(this.orientationGuard.blocked)
  }

  loadGame(save: SaveRecord): void {
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
