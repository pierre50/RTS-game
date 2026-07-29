import { Application, type Filter } from 'pixi.js'
import { PixelateFilter } from 'pixi-filters'
import './styles.css'
import Loader from './screens/Loader'
import { ScreenManager } from './screens/ScreenManager'

const DEFAULT_TEST_PIXELATE_SIZE = 0

type PixelateDebugWindow = Window & {
  __pixelateFilter?: PixelateFilter | null
  __setPixelate?: (size?: number | null) => void
}

function getInitialPixelateSize(): number | null {
  const rawSize = new URLSearchParams(window.location.search).get('pixelate')
  if (rawSize === '0' || rawSize === 'false' || rawSize === 'off') return null

  const size = rawSize === null || rawSize === '' ? DEFAULT_TEST_PIXELATE_SIZE : Number(rawSize)
  if (!Number.isFinite(size) || size < 1) return null

  return Math.round(size)
}

function getStageFilters(app: Application): readonly Filter[] {
  const filters = app.stage.filters as Filter | readonly Filter[] | null | undefined
  if (!filters) return []
  if (Array.isArray(filters)) return filters as readonly Filter[]
  return [filters as Filter]
}

function installPixelateTestFilter(app: Application): void {
  const debugWindow = window as PixelateDebugWindow

  debugWindow.__setPixelate = (size = DEFAULT_TEST_PIXELATE_SIZE) => {
    const filters = getStageFilters(app).filter(filter => filter !== debugWindow.__pixelateFilter)
    const pixelSize = size === null ? null : Math.round(size)

    if (pixelSize !== null && Number.isFinite(pixelSize) && pixelSize >= 1) {
      const filter = new PixelateFilter(pixelSize)
      app.stage.filterArea = app.screen
      app.stage.filters = [...filters, filter]
      debugWindow.__pixelateFilter = filter
      console.info(`PixelateFilter enabled: ${pixelSize}px`)
      return
    }

    app.stage.filters = filters.length > 0 ? filters : null
    debugWindow.__pixelateFilter = null
    console.info('PixelateFilter disabled')
  }

  debugWindow.__setPixelate(getInitialPixelateSize())
}

// Default V8 stack traces are capped at 10 frames, which hides the actual
// recursive entry point of deep "Maximum call stack size exceeded" errors
// behind whatever happens to be on top of the stack when it overflows.
;(Error as typeof Error & { stackTraceLimit: number }).stackTraceLimit = Infinity

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

  installPixelateTestFilter(app)

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
