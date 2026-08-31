import { Assets, Graphics, TilingSprite, type Texture, type Ticker } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH, getEnvironmentTerrainParams } from '../../constants'
import { getTextureByFrame } from '../../lib'
import type { Bounds } from '../../types/geometry'
import type { MapContext } from './Map'

type WaterOverlayTicker = {
  add: (tick: (ticker: Ticker) => void) => void
  remove: (tick: (ticker: Ticker) => void) => void
}

export type WaterBorderSurface = { sprite: { texture: Texture; destroyed?: boolean }; frames: Texture[] }

type WaterOverlayHost = {
  addChild(child: Graphics | TilingSprite): void
  context: MapContext
  environment?: string
  grid: unknown[][]
  mapType?: string
  size: number
  waterBackground: Graphics | null
  waterBorderSurfaces: Set<WaterBorderSurface>
  waterOverlay: TilingSprite | null
  waterOverlayElapsed: number
  waterOverlayFrame: number
  waterOverlayPaused: boolean
  waterOverlayTick: ((ticker: Ticker) => void) | null
}

const WATER_OVERLAY_SHEET = 'water-surface-filter'
const WATER_OVERLAY_FRAME_COUNT = 4
const WATER_OVERLAY_FRAME_SPEED = 1 / 17
const WATER_OVERLAY_ALPHA = 0.32
const WATER_OVERLAY_MARGIN = CELL_WIDTH * 2
const INTERIOR_BACKGROUND_COLOR = 0x000000
const WATER_BACKGROUND_Z_INDEX = -3
const WATER_OVERLAY_Z_INDEX = -2.5

function getWaterOverlayFrames(): Texture[] {
  if (!Assets.cache.has(WATER_OVERLAY_SHEET)) return []
  return Array.from({ length: WATER_OVERLAY_FRAME_COUNT }, (_, index) =>
    getTextureByFrame(WATER_OVERLAY_SHEET, index, Assets)
  )
}

function getPingPongFrameIndex(frame: number, frameCount: number): number {
  if (frameCount <= 1) return 0
  const cycleLength = (frameCount - 1) * 2
  const cycleFrame = frame % cycleLength
  return cycleFrame < frameCount ? cycleFrame : cycleLength - cycleFrame
}

export function getWaterOverlayBounds(map: Pick<WaterOverlayHost, 'size'>): Bounds {
  const mapWidth = (map.size + 1) * CELL_WIDTH
  const mapHeight = (map.size + 1) * CELL_HEIGHT + CELL_HEIGHT
  return {
    minX: -mapWidth / 2 - WATER_OVERLAY_MARGIN,
    minY: -WATER_OVERLAY_MARGIN,
    width: mapWidth + WATER_OVERLAY_MARGIN * 2,
    height: mapHeight + WATER_OVERLAY_MARGIN * 2,
  }
}

export function updateWaterOverlay(map: WaterOverlayHost): void {
  if (!map.grid.length || map.size <= 0) return
  if (isInteriorMap(map)) {
    if (!map.waterBackground) createInteriorBackground(map)
    return
  }
  if (!map.waterOverlay || !map.waterBackground) createWaterOverlay(map)
}

export function createWaterOverlay(map: WaterOverlayHost): void {
  if (isInteriorMap(map)) {
    createInteriorBackground(map)
    return
  }
  const frames = getWaterOverlayFrames()
  if (!frames.length || map.waterOverlay) return
  const bounds = getWaterOverlayBounds(map)
  const background = createBackgroundGraphics(bounds, getEnvironmentTerrainParams(map.environment).waterBackgroundColor)

  const overlay = new TilingSprite({ texture: frames[0], width: bounds.width, height: bounds.height })
  overlay.label = 'waterOverlayFilter'
  overlay.position.set(bounds.minX, bounds.minY)
  overlay.alpha = WATER_OVERLAY_ALPHA
  overlay.eventMode = 'none'
  overlay.zIndex = WATER_OVERLAY_Z_INDEX

  map.addChild(background)
  map.addChild(overlay)
  map.waterBackground = background
  map.waterOverlay = overlay
  ensureWaterAnimationTicker(map)
}

function isInteriorMap(map: Pick<WaterOverlayHost, 'mapType'>): boolean {
  return map.mapType === 'interior'
}

function createInteriorBackground(map: WaterOverlayHost): void {
  if (map.waterBackground) return
  const bounds = getWaterOverlayBounds(map)
  const background = createBackgroundGraphics(bounds, INTERIOR_BACKGROUND_COLOR)
  background.label = 'interiorBackground'
  map.addChild(background)
  map.waterBackground = background
}

function createBackgroundGraphics(bounds: Bounds, color: number): Graphics {
  const background = new Graphics()
  background.label = 'waterBackground'
  background.eventMode = 'none'
  background.zIndex = WATER_BACKGROUND_Z_INDEX
  background.rect(bounds.minX, bounds.minY, bounds.width, bounds.height)
  background.fill({ color })
  return background
}

export function ensureWaterAnimationTicker(map: WaterOverlayHost): void {
  if (map.waterOverlayTick) return
  const ticker = map.context.app?.ticker as WaterOverlayTicker | undefined
  if (!ticker) return
  const tick = (ticker: Ticker) => {
    const update = () => {
      if (map.waterOverlayPaused) return
      const frames = getWaterOverlayFrames()
      const borderFrameCount = Math.max(0, ...Array.from(map.waterBorderSurfaces, surface => surface.frames.length))
      const frameCount = Math.max(frames.length, borderFrameCount)
      if (!frameCount) return
      map.waterOverlayElapsed += ticker.deltaTime * WATER_OVERLAY_FRAME_SPEED
      if (map.waterOverlayElapsed < 1) return

      map.waterOverlayElapsed %= 1
      map.waterOverlayFrame += 1
      if (map.waterOverlay?.parent && frames.length) {
        map.waterOverlay.texture = frames[map.waterOverlayFrame % frames.length]
      }
      updateWaterBorderSurfaces(map)
    }
    map.context.performance?.measure?.('water.update', update) ?? update()
  }
  ticker.add(tick)
  map.waterOverlayTick = tick
}

export function registerWaterBorderSurface(
  map: WaterOverlayHost,
  sprite: { texture: Texture; destroyed?: boolean },
  frames: Texture[],
  initialFrame: number = 0
): () => void {
  if (!frames.length) return () => {}
  const surface = { sprite, frames }
  sprite.texture = frames[initialFrame % frames.length]
  map.waterBorderSurfaces.add(surface)
  ensureWaterAnimationTicker(map)
  return () => {
    map.waterBorderSurfaces.delete(surface)
  }
}

export function destroyWaterOverlay(map: WaterOverlayHost): void {
  const ticker = map.context.app?.ticker as WaterOverlayTicker | undefined
  if (ticker && map.waterOverlayTick) ticker.remove(map.waterOverlayTick)
  map.waterOverlayTick = null
  map.waterOverlay = null
  map.waterBorderSurfaces.clear()
  map.waterBackground = null
}

function updateWaterBorderSurfaces(map: WaterOverlayHost): void {
  for (const surface of map.waterBorderSurfaces) {
    if (surface.sprite.destroyed) continue
    surface.sprite.texture = surface.frames[getPingPongFrameIndex(map.waterOverlayFrame, surface.frames.length)]
  }
}
