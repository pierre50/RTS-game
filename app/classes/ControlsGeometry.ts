import { CELL_HEIGHT, CELL_WIDTH } from '../constants'
import { getReliefOffset, isometricToCartesian } from '../lib'
import { getActiveInteractionSpace, getEntityMapPoint, getSpaceLocalPointFromMapPoint } from '../lib/mapSpaces'
import type { AudibleInstanceLike } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { Bounds } from '../types/geometry'
import type { RuntimeCell } from '../types/map'
import type Controls from './Controls'
type PointerPoint = { x: number; y: number }
type AudibleEntity = AudibleInstanceLike & { x: number; y: number }
const POINTER_CELL_PICK_RADIUS = 8
function pointIsInCellDiamond(point: PointerPoint, cell: RuntimeCell): boolean {
  const dx = Math.abs(point.x - cell.x)
  const dy = Math.abs(point.y - cell.y)
  return dx / (CELL_WIDTH / 2) + dy / (CELL_HEIGHT / 2) <= 1
}

export function getHeroCameraCenter(controls: Controls): { x: number; y: number } | null {
  const hero = controls.heroUnit
  if (!hero) return null
  const point = getEntityMapPoint(hero)
  return { x: point.x, y: point.y + getReliefOffset(hero) }
}

export function screenToLocal(controls: Controls, x: number, y: number): { x: number; y: number } {
  const { zoom, offsetX, offsetY } = controls.getViewportMetrics()
  const rect = controls.context.gamebox.getBoundingClientRect()
  const scaleX = controls.context.app.screen.width / rect.width
  const scaleY = controls.context.app.screen.height / rect.height
  const rendererX = (x - rect.left) * scaleX
  const rendererY = (y - rect.top) * scaleY
  return {
    x: (rendererX - offsetX) / zoom,
    y: (rendererY - offsetY) / zoom,
  }
}

export function localToScreen(controls: Controls, x: number, y: number): { x: number; y: number } {
  const { zoom, offsetX, offsetY } = controls.getViewportMetrics()
  const rect = controls.context.gamebox.getBoundingClientRect()
  const scaleX = controls.context.app.screen.width / rect.width
  const scaleY = controls.context.app.screen.height / rect.height
  return {
    x: rect.left + (offsetX + x * zoom) / scaleX,
    y: rect.top + (offsetY + y * zoom) / scaleY,
  }
}

export function getWorldPointUnderCursor(controls: Controls): PointerPoint {
  const {
    context: { map },
  } = controls
  const pointer = controls.screenToLocal(controls.mouse.x, controls.mouse.y)
  const mapPoint = {
    x: pointer.x - map.x,
    y: pointer.y - map.y,
  }
  const space = getActiveInteractionSpace(controls.context)
  return getSpaceLocalPointFromMapPoint(space, mapPoint)
}

export function getMapPointUnderCursor(controls: Controls): PointerPoint {
  const {
    context: { map },
  } = controls
  const pointer = controls.screenToLocal(controls.mouse.x, controls.mouse.y)
  return {
    x: pointer.x - map.x,
    y: pointer.y - map.y,
  }
}

export function getCellUnderCursor(controls: Controls): RuntimeCell | null {
  const {
    context: { map },
  } = controls
  const space = getActiveInteractionSpace(controls.context)
  const pointer = controls.getWorldPointUnderCursor()
  const pos = isometricToCartesian(pointer.x, pointer.y)
  const size = space?.size ?? map.size
  const grid = space?.grid ?? map.grid
  const i = Math.min(Math.max(pos[0], 0), size)
  const j = Math.min(Math.max(pos[1], 0), size)
  const fallbackCell = grid[i]?.[j] || null
  let bestCell: RuntimeCell | null = null
  let bestDistance = Infinity
  for (
    let candidateI = Math.max(0, i - POINTER_CELL_PICK_RADIUS);
    candidateI <= Math.min(size, i + POINTER_CELL_PICK_RADIUS);
    candidateI++
  ) {
    for (
      let candidateJ = Math.max(0, j - POINTER_CELL_PICK_RADIUS);
      candidateJ <= Math.min(size, j + POINTER_CELL_PICK_RADIUS);
      candidateJ++
    ) {
      const cell = grid[candidateI]?.[candidateJ]
      if (!cell || !pointIsInCellDiamond(pointer, cell)) continue
      const distance = Math.abs(pointer.x - cell.x) + Math.abs(pointer.y - cell.y)
      if (distance < bestDistance) {
        bestCell = cell
        bestDistance = distance
      }
    }
  }
  return bestCell || fallbackCell
}

export function instanceInCamera(controls: Controls, instance: { x: number; y: number }, bounds?: Bounds): boolean {
  const point = 'context' in instance ? getEntityMapPoint(instance as UnitEntity) : instance
  return controls.cameraController.instanceInCamera(point, bounds)
}

export function instanceIsAudible(controls: Controls, instance: AudibleEntity): boolean {
  const {
    context: { map },
  } = controls

  if (!controls.instanceInCamera(instance)) return false
  if (map.revealEverything) return true
  if (instance.owner?.isPlayed || instance.owner?.owner?.isPlayed) return true

  return Boolean(instance.visible || instance.owner?.visible || instance.target?.visible)
}

export function init(controls: Controls): void {
  const {
    context: { player, map },
  } = controls

  if (controls.heroController.initFromPlayerStart()) return

  const anchor = player?.buildings?.[0] ?? player?.units?.[0]
  if (anchor) {
    controls.setCamera(anchor.x, anchor.y)
  } else {
    controls.setCamera(map.size / 2, map.size / 2)
  }
}
