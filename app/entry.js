import { Application } from 'pixi.js'
import './styles.css'
import Game from './screens/Game'
import Loader from './screens/Loader'
import MainMenu from './screens/MainMenu'
import MapConfig from './screens/MapConfig'

;(async () => {
  const app = new Application()

  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    background: 0x000000,
    resizeTo: window,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    powerPreference: 'high-performance',
  })

  const gamebox = document.getElementById('game')
  if (!gamebox) {
    console.error('No #game container found')
    return
  }
  gamebox.appendChild(app.canvas)

  const loader = new Loader()
  app.stage.addChild(loader)
  await loader.start()
  app.stage.removeChild(loader)

  let currentGame = null

  const quitGame = () => {
    if (currentGame) {
      app.stage.removeChild(currentGame)
      currentGame = null
    }
    showMainMenu()
  }

  const startGame = config => {
    currentGame = new Game(app, gamebox, config, quitGame)
    app.stage.addChild(currentGame)
  }

  const loadGame = json => {
    currentGame = new Game(app, gamebox, {}, quitGame)
    app.stage.addChild(currentGame)
    currentGame.load(json)
  }

  const showMapConfig = () => {
    const mapConfig = new MapConfig(
      config => {
        mapConfig.destroy()
        startGame(config)
      },
      () => {
        mapConfig.destroy()
        showMainMenu()
      }
    )
  }

  const showMainMenu = () => {
    const mainMenu = new MainMenu(
      () => {
        mainMenu.destroy()
        showMapConfig()
      },
      json => {
        mainMenu.destroy()
        loadGame(json)
      }
    )
  }

  showMainMenu()
})()
