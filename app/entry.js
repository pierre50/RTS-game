import { Application } from 'pixi.js'
import './styles.css'
import Game from './screens/Game'
import Loader from './screens/Loader'

;(async () => {
  // Create a new PixiJS application
  const app = new Application()

  // Initialize the app with background color and auto-resize
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    background: 0x000000, // black background
    resizeTo: window,
    antialias: false, // faster
    resolution: window.devicePixelRatio || 1,
    autoDensity: true, // adjusts canvas for resolution
    powerPreference: 'high-performance', // GPU hint
  })

  // Append the canvas to your game container
  const gamebox = document.getElementById('game')
  if (!gamebox) {
    console.error('No #game container found')
    return
  }
  gamebox.appendChild(app.canvas)

  // Initialize loader
  const loader = new Loader()
  app.stage.addChild(loader)
  loader.start()

  // Once assets are loaded, remove loader and start game
  loader.onLoaded(() => {
    const game = new Game(app, gamebox)
    app.stage.removeChild(loader)
    app.stage.addChild(game)
  })

  // Optional: global pointermove listener
  app.stage.on('pointermove', event => {
    // event.data.global.x, event.data.global.y
  })
})()
