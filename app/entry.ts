import { Application, TextureStyle } from 'pixi.js'
import './styles.css'
import Loader from './screens/Loader'
import { ScreenManager } from './screens/ScreenManager'
import { DISPLAY_SCALE, getScreenBrightness, onVisualSettingsChange } from './lib/settings'

TextureStyle.defaultOptions.scaleMode = 'nearest'

;(Error as typeof Error & { stackTraceLimit: number }).stackTraceLimit = Infinity

;(async () => {
  const app = new Application()

  await app.init({
    width: Math.round(window.innerWidth * DISPLAY_SCALE),
    height: Math.round(window.innerHeight * DISPLAY_SCALE),
    background: 0x000000,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    powerPreference: 'high-performance',
  })

  window.addEventListener('resize', () => {
    app.renderer.resize(
      Math.round(window.innerWidth * DISPLAY_SCALE),
      Math.round(window.innerHeight * DISPLAY_SCALE)
    )
  })

  const gamebox = document.getElementById('game')
  if (!gamebox) {
    console.error('No #game container found')
    return
  }
  const gameRoot = gamebox

  function applyScreenBrightness(): void {
    gameRoot.style.filter = `brightness(${getScreenBrightness()})`
  }

  applyScreenBrightness()
  onVisualSettingsChange(applyScreenBrightness)
  gameRoot.appendChild(app.canvas)

  app.canvas.style.width = '100%'
  app.canvas.style.height = '100%'

  const loader = new Loader()
  app.stage.addChild(loader)
  await loader.start()
  app.stage.removeChild(loader)

  const screenManager = new ScreenManager(app, gameRoot)
  screenManager.start()
})()
