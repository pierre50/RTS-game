import { Container, Graphics } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES } from '../../constants'
import { canPlaceBuildingAt } from '../../lib'
import type { UnknownRecord } from '../../types/common'
import type { DevCell, DevConsoleContext, DevEntity, DevMapLike, DebugTickerCallback } from '../types'

export const RESOURCE_NAMES = ['wood', 'food', 'stone', 'gold']
export const DEBUG_SOLID_LAYER = 'debugSolidLayer'
export const DEBUG_PATH_LAYER = 'debugPathLayer'
export const DEBUG_VISION_LAYER = 'debugVisionLayer'
export const DEBUG_GRID_LAYER = 'debugGridLayer'
export const DEBUG_COORDS_LAYER = 'debugCoordsLayer'
export const DEBUG_OVERLAY_Z = 1e9 + 100
const DEBUG_CELL_REFRESH_MS = 180

export function normalizeToggle(value: unknown, currently: boolean): boolean {
  return value === 'on' ? true : value === 'off' ? false : !currently
}

export function normalize(value: unknown): string {
  return String(value || '').toLowerCase()
}

export function findKey(source: Record<string, unknown>, value: unknown): string | undefined {
  const wanted = normalize(value)
  return Object.keys(source).find(key => normalize(key) === wanted)
}

export function getAmount(value: unknown, fallback = 1): number {
  const amount = Number(value ?? fallback)
  return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : fallback
}

export function getSpawnCell(
  context: DevConsoleContext,
  {
    buildingConfig = null,
    cellCondition = null,
  }: { buildingConfig?: UnknownRecord | null; cellCondition?: ((cell: DevCell) => boolean) | null } = {}
): DevCell | null {
  const { map, controls } = context
  const cursorCell = controls?.getCellUnderCursor?.()
  if (!cursorCell) return null
  if (!buildingConfig && (!cellCondition || cellCondition(cursorCell))) return cursorCell
  if (
    buildingConfig &&
    canPlaceBuildingAt(
      map.grid,
      cursorCell.i,
      cursorCell.j,
      buildingConfig as Parameters<typeof canPlaceBuildingAt>[3]
    )
  )
    return cursorCell

  const maxRadius = 8
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let di = -radius; di <= radius; di++) {
      for (let dj = -radius; dj <= radius; dj++) {
        if (Math.abs(di) !== radius && Math.abs(dj) !== radius) continue
        const cell = map.grid[cursorCell.i + di]?.[cursorCell.j + dj]
        if (!cell) continue
        if (buildingConfig) {
          if (
            canPlaceBuildingAt(map.grid, cell.i, cell.j, buildingConfig as Parameters<typeof canPlaceBuildingAt>[3])
          )
            return cell
        } else if (!cellCondition || cellCondition(cell)) {
          return cell
        }
      }
    }
  }
  return null
}

export function getDebugLayer(map: DevMapLike, label: string, zIndex: number): Graphics {
  let layer = map.getChildByLabel?.(label)
  if (!layer) {
    layer = new Graphics()
    layer.label = label
    layer.eventMode = 'none'
    layer.zIndex = zIndex
    map.addChild(layer)
  }
  return layer as Graphics
}

export function getDebugContainer(map: DevMapLike, label: string, zIndex: number): Container {
  let layer = map.getChildByLabel?.(label)
  if (!layer) {
    layer = new Container()
    layer.label = label
    layer.eventMode = 'none'
    layer.zIndex = zIndex
    map.addChild(layer)
  }
  return layer
}

export function getCameraCells(context: DevConsoleContext): Set<DevCell> {
  const { controls, map } = context
  const cells = controls?.cameraController?.visibleCells
  if (cells?.size) return cells
  return new Set([map.grid[Math.floor(map.size / 2)]?.[Math.floor(map.size / 2)]].filter(Boolean) as DevCell[])
}

export function drawCellDiamond(graphics: Graphics, cell: DevCell, color: number, alpha = 0.28): void {
  graphics.poly([
    cell.x - CELL_WIDTH / 2,
    cell.y,
    cell.x,
    cell.y - CELL_HEIGHT / 2,
    cell.x + CELL_WIDTH / 2,
    cell.y,
    cell.x,
    cell.y + CELL_HEIGHT / 2,
  ])
  graphics.fill({ color, alpha })
}

export function drawCellStroke(graphics: Graphics, cell: DevCell, color: number, alpha = 0.95, width = 1): void {
  graphics.poly([
    cell.x - CELL_WIDTH / 2,
    cell.y,
    cell.x,
    cell.y - CELL_HEIGHT / 2,
    cell.x + CELL_WIDTH / 2,
    cell.y,
    cell.x,
    cell.y + CELL_HEIGHT / 2,
  ])
  graphics.closePath()
  graphics.stroke({ color, alpha, width })
}

export function getSolidDebugColor(cell: DevCell): number {
  if (cell.has?.family === FAMILY_TYPES.resource) return 0x33d17a
  if (cell.has?.family === FAMILY_TYPES.building) return 0xffb000
  if (cell.has?.family === FAMILY_TYPES.unit) return 0xff4d4d
  if (cell.has?.family === FAMILY_TYPES.animal) return 0xba7cff
  if (cell.category === 'Water') return 0x35a7ff
  if (cell.border) return 0xffffff
  if (cell.inclined) return 0x8f8f8f
  return 0xff4d4d
}

export function stopDebugTicker(context: DevConsoleContext, tickerName: string): void {
  const { map } = context
  const tickers = map as unknown as Record<string, DebugTickerCallback | null | undefined>
  const ticker = tickers[tickerName]
  if (ticker) {
    context.app?.ticker.remove(ticker)
    tickers[tickerName] = null
  }
}

export function removeDebugLayer(context: DevConsoleContext, layerLabel: string, tickerName: string): void {
  const { map } = context
  stopDebugTicker(context, tickerName)
  const layer = map.getChildByLabel?.(layerLabel)
  if (layer) {
    map.removeChild(layer)
    layer.destroy()
  }
}

export function addDebugTicker(
  context: DevConsoleContext,
  tickerName: string,
  draw: (context: DevConsoleContext) => void
): void {
  const { app, map } = context
  stopDebugTicker(context, tickerName)
  const tickers = map as unknown as Record<string, DebugTickerCallback | null | undefined>
  let elapsed = 0
  tickers[tickerName] = (ticker?: { elapsedMS?: number }) => {
    elapsed += ticker?.elapsedMS ?? 0
    if (elapsed < DEBUG_CELL_REFRESH_MS) return
    elapsed = 0
    draw(context)
  }
  app?.ticker.add(tickers[tickerName] as DebugTickerCallback)
}

export function cleanupDebugArtifacts(context: DevConsoleContext): void {
  const tickerNames = [
    '_debugSolidTicker',
    '_debugPathTicker',
    '_debugVisionTicker',
    '_debugGridTicker',
    '_debugCoordsTicker',
    '_debugPerfTicker',
    '_debugAiInfoTicker',
  ]

  tickerNames.forEach(tickerName => stopDebugTicker(context, tickerName))

  const layerLabels = [DEBUG_SOLID_LAYER, DEBUG_PATH_LAYER, DEBUG_VISION_LAYER, DEBUG_GRID_LAYER, DEBUG_COORDS_LAYER]

  layerLabels.forEach(label => {
    const layer = context.map?.getChildByLabel?.(label)
    if (layer) {
      context.map.removeChild(layer)
      layer.destroy()
    }
  })

  document.getElementById('debug-perf')?.remove()
  document.getElementById('debug-ai-info')?.remove()
}

export function getInstancesByCategory(context: DevConsoleContext, category: string, typeName: string): DevEntity[] | null {
  const { map, player, players } = context
  const wantedType = normalize(typeName)
  const matchesType = (instance: DevEntity) => !wantedType || normalize(instance.type) === wantedType

  switch (category) {
    case 'unit':
    case 'units':
      return player.units.filter(matchesType)
    case 'building':
    case 'buildings':
      return player.buildings.filter(matchesType)
    case 'resource':
    case 'resources':
      return [...map.resources].filter(matchesType)
    case 'enemy':
    case 'enemies':
      return players
        .filter(p => player.isEnemy?.(p))
        .flatMap(p => [...p.units, ...p.buildings])
        .filter(matchesType)
    default:
      return null
  }
}
