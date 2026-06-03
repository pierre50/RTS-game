import Game from './Game'
import MainMenu from './MainMenu'
import MapConfig from './MapConfig'

export class ScreenManager {
  constructor(app, gamebox) {
    this.app = app
    this.gamebox = gamebox
    this.currentMenuScreen = null
    this.currentGame = null
  }

  start() {
    this.showMainMenu()
  }

  destroyCurrentMenuScreen() {
    if (!this.currentMenuScreen) return
    this.currentMenuScreen.destroy()
    this.currentMenuScreen = null
  }

  destroyCurrentGame() {
    if (!this.currentGame) return
    this.app.stage.removeChild(this.currentGame)
    this.currentGame.destroy()
    this.currentGame = null
  }

  showMainMenu() {
    this.destroyCurrentMenuScreen()
    this.currentMenuScreen = new MainMenu({
      onStart: () => this.showMapConfig(),
      onLoad: save => this.loadGame(save),
    })
  }

  showMapConfig() {
    new MapConfig({
      onPlay: config => this.startGame(config),
    })
  }

  startGame(config) {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentGame()
    this.currentGame = new Game(this.app, this.gamebox, config, () => this.handleQuitGame())
    this.app.stage.addChild(this.currentGame)
  }

  loadGame(save) {
    this.destroyCurrentMenuScreen()
    this.destroyCurrentGame()
    this.currentGame = new Game(this.app, this.gamebox, null, () => this.handleQuitGame())
    this.app.stage.addChild(this.currentGame)
    this.currentGame.load(save)
  }

  handleQuitGame() {
    this.destroyCurrentGame()
    this.showMainMenu()
  }
}
