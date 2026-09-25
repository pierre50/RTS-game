import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import type { MinimapTransform } from './MinimapGeometry'

const DEFAULT_SAMPLES_PER_AXIS = 256
const MAX_SAMPLES_PER_AXIS = 512
const PIXELS_PER_SAMPLE = 2

export type MinimapDisplaySize = { width: number; height: number; pixelRatio: number }

function sampleBudget(transform: MinimapTransform, display?: MinimapDisplaySize): number {
  if (
    !display ||
    !Number.isFinite(display.width) ||
    !Number.isFinite(display.height) ||
    display.width <= 0 ||
    display.height <= 0
  )
    return DEFAULT_SAMPLES_PER_AXIS
  const ratio = Number.isFinite(display.pixelRatio) ? Math.max(1, Math.min(2, display.pixelRatio)) : 1
  // Never request more detail than the backing canvas can represent.
  const pixels = Math.max(
    Math.min(transform.canvasWidth, display.width * ratio),
    Math.min(transform.canvasHeight, display.height * ratio)
  )
  return Math.max(64, Math.min(MAX_SAMPLES_PER_AXIS, Math.ceil(pixels / PIXELS_PER_SAMPLE)))
}

/** Invert the viewport into grid coordinates before selecting a level of detail. */
export function minimapTerrainSampling(transform: MinimapTransform, display?: MinimapDisplaySize) {
  const budget = sampleBudget(transform, display)
  const { factor, offsetX, offsetY, translate, canvasWidth, canvasHeight, size } = transform
  const columns: number[] = []
  const rows: number[] = []
  for (const px of [0, canvasWidth]) {
    for (const py of [0, canvasHeight]) {
      const x = offsetX + (px - 2 * translate) * factor
      const y = offsetY + py * factor
      columns.push(x / CELL_WIDTH + y / CELL_HEIGHT)
      rows.push(y / CELL_HEIGHT - x / CELL_WIDTH)
    }
  }
  const minI = Math.max(0, Math.floor(Math.min(...columns)) - 1)
  const maxI = Math.min(size, Math.ceil(Math.max(...columns)) + 1)
  const minJ = Math.max(0, Math.floor(Math.min(...rows)) - 1)
  const maxJ = Math.min(size, Math.ceil(Math.max(...rows)) + 1)
  let step = Math.max(1, Math.ceil(Math.max(maxI - minI + 1, maxJ - minJ + 1) / budget))
  // Align buckets globally, so incremental discoveries and full redraws agree.
  while (
    Math.floor(maxI / step) - Math.floor(minI / step) + 1 > budget ||
    Math.floor(maxJ / step) - Math.floor(minJ / step) + 1 > budget
  )
    step++
  return { minI: Math.floor(minI / step) * step, maxI, minJ: Math.floor(minJ / step) * step, maxJ, step }
}

export function terrainSampleKey(i: number, j: number, step: number): string {
  return `${step}:${Math.floor(i / step)}:${Math.floor(j / step)}`
}

/** The grid bounding box includes off-canvas corners in an isometric lattice.
 * Reject those buckets before reading a cell from the potentially lazy grid. */
export function minimapSampleIntersectsViewport(
  i: number,
  j: number,
  step: number,
  transform: MinimapTransform
): boolean {
  const centerI = i + (step - 1) / 2
  const centerJ = j + (step - 1) / 2
  const x = (((centerI - centerJ) * CELL_WIDTH) / 2 - transform.offsetX) / transform.factor + 2 * transform.translate
  const y = (((centerI + centerJ) * CELL_HEIGHT) / 2 - transform.offsetY) / transform.factor
  const halfWidth = (CELL_WIDTH * step) / transform.factor / 2 + 1
  // Include the diamond below its origin, including the square layout's half-cell shift.
  const height = (CELL_HEIGHT * step) / transform.factor + 1
  return (
    x + halfWidth >= 0 &&
    x - halfWidth <= transform.canvasWidth &&
    y + height >= 0 &&
    y - height / 2 <= transform.canvasHeight
  )
}
