import { Application, TextureStyle } from 'pixi.js'
import './styles.css'
import Loader from './screens/Loader'
import { ScreenManager } from './screens/ScreenManager'
import { DISPLAY_SCALE, getScreenBrightness, onVisualSettingsChange } from './lib/audio/settings'

TextureStyle.defaultOptions.scaleMode = 'nearest'

;(Error as typeof Error & { stackTraceLimit: number }).stackTraceLimit = Infinity

;(async () => {
  const gamebox = document.getElementById('game')
  if (!gamebox) {
    console.error('No #game container found')
    return
  }
  const gameRoot = gamebox

  function getGameViewSize(): { width: number; height: number } {
    const rect = gameRoot.getBoundingClientRect()
    return {
      width: Math.max(1, Math.round(rect.width || window.innerWidth)),
      height: Math.max(1, Math.round(rect.height || window.innerHeight)),
    }
  }

  function applyCanvasLayout(canvas: HTMLCanvasElement, width: number, height: number): void {
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  function resizeRenderer(): void {
    const { width, height } = getGameViewSize()
    app.renderer.resize(
      Math.round(width * DISPLAY_SCALE),
      Math.round(height * DISPLAY_SCALE)
    )
    applyCanvasLayout(app.canvas, width, height)
  }

  const app = new Application()
  const { width, height } = getGameViewSize()

  await app.init({
    width: Math.round(width * DISPLAY_SCALE),
    height: Math.round(height * DISPLAY_SCALE),
    background: 0x000000,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    powerPreference: 'high-performance',
  })

  window.addEventListener('resize', resizeRenderer)
  new ResizeObserver(resizeRenderer).observe(gameRoot)

  function applyScreenBrightness(): void {
    gameRoot.style.filter = `brightness(${getScreenBrightness()})`
  }

  applyScreenBrightness()
  onVisualSettingsChange(applyScreenBrightness)
  gameRoot.appendChild(app.canvas)
  applyCanvasLayout(app.canvas, width, height)

  const loader = new Loader()
  app.stage.addChild(loader)
  await loader.start()
  app.stage.removeChild(loader)

  const screenManager = new ScreenManager(app, gameRoot)
  screenManager.start()
})()
