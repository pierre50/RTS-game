import type { Graphics } from 'pixi.js'
import {
  COLOR_GOLD,
  COMM_INDICATOR_FILL_ALPHA,
  COMM_INDICATOR_STROKE_ALPHA,
  COMM_INDICATOR_STROKE_WIDTH,
} from '../../constants'
import { cartesianToIsometric, drawRoundedIsoShape, getRoundedIsoShapePoints } from '../../lib'
import type { RuntimeCell } from '../../types/map'

export const INTERACTION_CELL_MARKER_PULSE_MS = 1400
export const INTERACTION_CELL_MARKER_Z_INDEX = -0.25

export function interactionCellPulse(elapsedMs: number): number {
  return (Math.sin((elapsedMs / INTERACTION_CELL_MARKER_PULSE_MS) * Math.PI * 2) + 1) / 2
}

export function drawInteractionCellMarker(layer: Graphics, cell: RuntimeCell, pulse: number): void {
  const [fallbackX, fallbackY] = cartesianToIsometric(cell.i, cell.j)
  const x = Number.isFinite(cell.x) ? cell.x : fallbackX
  const y = Number.isFinite(cell.y) ? cell.y : fallbackY
  drawRoundedIsoShape(
    layer,
    getRoundedIsoShapePoints({
      x,
      y,
      factor: 1,
    })
  )
  layer.fill({ color: COLOR_GOLD, alpha: COMM_INDICATOR_FILL_ALPHA + pulse * 0.08 })
  layer.stroke({
    color: COLOR_GOLD,
    width: COMM_INDICATOR_STROKE_WIDTH + 1,
    alpha: Math.min(1, COMM_INDICATOR_STROKE_ALPHA + pulse * 0.2),
  })
}
