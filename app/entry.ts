import { Application } from 'pixi.js'
import './styles.css'
import Loader from './screens/Loader'
import { ScreenManager } from './screens/ScreenManager'

// Default V8 stack traces are capped at 10 frames, which hides the actual
// recursive entry point of deep "Maximum call stack size exceeded" errors
// behind whatever happens to be on top of the stack when it overflows.
Error.stackTraceLimit = Infinity

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

  const screenManager = new ScreenManager(app, gamebox)
  screenManager.start()
})()
