import { Graphics } from 'pixi.js'
import { COLOR_GREEN, LABEL_TYPES } from '../../constants'

const ISO_FOOTPRINT_HALF_WIDTH = 32
const ISO_FOOTPRINT_HALF_HEIGHT = 16
const ISO_FOOTPRINT_CORNER_RATIO = 0.22
const ISO_FOOTPRINT_CURVE_STEPS = 6

export type SelectableInstance = {
  addChildAt: (child: Graphics, index: number) => void
  removeChild: (child: Graphics) => void
  reliefLift?: number
  selectionFactor?: number
  size?: number
}

export type IsoShapePoint = { x: number; y: number }

export type IsoShapeOptions = {
  x?: number
  y?: number
  factor?: number
}

export type IsoSelectionOptions = IsoShapeOptions & {
  color?: number
  label?: string
  zIndex?: number
  width?: number
}

export function getRoundedIsoShapePoints({ x = 0, y = 0, factor = 1 }: IsoShapeOptions = {}): IsoShapePoint[] {
  const safeFactor = Math.max(0.1, factor)
  const radiusX = ISO_FOOTPRINT_HALF_WIDTH * safeFactor
  const radiusY = ISO_FOOTPRINT_HALF_HEIGHT * safeFactor
  const vertices = [
    { x, y: y - radiusY },
    { x: x + radiusX, y },
    { x, y: y + radiusY },
    { x: x - radiusX, y },
  ]
  const points: IsoShapePoint[] = []

  for (let index = 0; index < vertices.length; index++) {
    const previous = vertices[(index + vertices.length - 1) % vertices.length]
    const vertex = vertices[index]
    const next = vertices[(index + 1) % vertices.length]
    const start = {
      x: vertex.x + (previous.x - vertex.x) * ISO_FOOTPRINT_CORNER_RATIO,
      y: vertex.y + (previous.y - vertex.y) * ISO_FOOTPRINT_CORNER_RATIO,
    }
    const end = {
      x: vertex.x + (next.x - vertex.x) * ISO_FOOTPRINT_CORNER_RATIO,
      y: vertex.y + (next.y - vertex.y) * ISO_FOOTPRINT_CORNER_RATIO,
    }

    if (index === 0) points.push(start)
    for (let step = 1; step <= ISO_FOOTPRINT_CURVE_STEPS; step++) {
      const t = step / ISO_FOOTPRINT_CURVE_STEPS
      const inv = 1 - t
      points.push({
        x: inv * inv * start.x + 2 * inv * t * vertex.x + t * t * end.x,
        y: inv * inv * start.y + 2 * inv * t * vertex.y + t * t * end.y,
      })
    }
  }

  return points
}

export function drawRoundedIsoShape(
  layer: { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void },
  points: IsoShapePoint[]
): void {
  points.forEach((point, index) => {
    if (index === 0) layer.moveTo(point.x, point.y)
    else layer.lineTo(point.x, point.y)
  })
  layer.closePath()
}

export function createIsoSelectionMarker({
  color = COLOR_GREEN,
  factor = 1,
  label = LABEL_TYPES.selection,
  width = 1,
  zIndex = 3,
}: IsoSelectionOptions = {}): Graphics {
  const marker = new Graphics()
  marker.label = label
  marker.zIndex = zIndex
  drawRoundedIsoShape(marker, getRoundedIsoShapePoints({ factor }))
  marker.stroke({ color, width })
  return marker
}

export function drawInstanceBlinkingSelection(instance: SelectableInstance): void {
  const selectionFactor = instance.selectionFactor ?? instance.size ?? 1
  const selection = createIsoSelectionMarker({ factor: selectionFactor })
  selection.position.y = instance.reliefLift ?? 0
  instance.addChildAt(selection, 0)

  const blink = (alpha: number, duration: number): Promise<void> =>
    new Promise(resolve => {
      selection.alpha = alpha
      setTimeout(resolve, duration)
    })

  const blinkSequence = async () => {
    await blink(1, 500)
    await blink(0, 300)
    await blink(1, 300)
    await blink(0, 300)
    await blink(1, 300)
    instance.removeChild(selection)
  }

  blinkSequence()
}
