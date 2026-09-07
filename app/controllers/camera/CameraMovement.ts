import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import { pointIsBetweenTwoPoint } from '../../lib'

export type CameraDirection = 'left' | 'right' | 'up' | 'down'
export type CameraPoint = { x: number; y: number }
export type CameraDiamondBounds = { A: CameraPoint; B: CameraPoint; D: CameraPoint; C: CameraPoint }

const EDGE_HORIZONTAL_PADDING = 100
const EDGE_VERTICAL_PADDING = 50
const EDGE_DOWN_PADDING = 100
const EDGE_LINE_TOLERANCE = 50

function straightDelta(dir: CameraDirection | string, speed: number): CameraPoint {
  const deltas: Record<CameraDirection, CameraPoint> = {
    left: { x: -speed, y: 0 },
    right: { x: speed, y: 0 },
    up: { x: 0, y: -speed },
    down: { x: 0, y: speed },
  }
  return dir in deltas ? deltas[dir as CameraDirection] : { x: 0, y: 0 }
}

function diagonalY(speed: number): number {
  return speed / (CELL_WIDTH / CELL_HEIGHT)
}

export function getCameraMoveDelta(
  dir: CameraDirection | string,
  speed: number,
  useEdgeSlide: boolean,
  hasLocalBounds: boolean,
  diamond: CameraDiamondBounds,
  cameraCenter: CameraPoint
): CameraPoint {
  if (!useEdgeSlide || hasLocalBounds) return straightDelta(dir, speed)

  const { A, B, C, D } = diamond
  const slopeY = diagonalY(speed)
  if (dir === 'left' && cameraCenter.x - EDGE_HORIZONTAL_PADDING > B.x) {
    if (pointIsBetweenTwoPoint(A, B, cameraCenter, EDGE_LINE_TOLERANCE)) return { x: -speed, y: slopeY }
    if (pointIsBetweenTwoPoint(B, C, cameraCenter, EDGE_LINE_TOLERANCE)) return { x: -speed, y: -slopeY }
    return { x: -speed, y: 0 }
  }
  if (dir === 'right' && cameraCenter.x + EDGE_HORIZONTAL_PADDING < D.x) {
    if (pointIsBetweenTwoPoint(A, D, cameraCenter, EDGE_LINE_TOLERANCE)) return { x: speed, y: slopeY }
    if (pointIsBetweenTwoPoint(D, C, cameraCenter, EDGE_LINE_TOLERANCE)) return { x: speed, y: -slopeY }
    return { x: speed, y: 0 }
  }
  if (dir === 'up' && cameraCenter.y - EDGE_VERTICAL_PADDING > A.y) {
    if (pointIsBetweenTwoPoint(A, B, cameraCenter, EDGE_LINE_TOLERANCE)) return { x: speed, y: -slopeY }
    if (pointIsBetweenTwoPoint(A, D, cameraCenter, EDGE_LINE_TOLERANCE)) return { x: -speed, y: -slopeY }
    return { x: 0, y: -speed }
  }
  if (dir === 'down' && cameraCenter.y + EDGE_VERTICAL_PADDING < C.y) {
    if (pointIsBetweenTwoPoint(D, C, cameraCenter, EDGE_LINE_TOLERANCE)) return { x: -speed, y: slopeY }
    if (pointIsBetweenTwoPoint(B, C, cameraCenter, EDGE_LINE_TOLERANCE)) return { x: speed, y: slopeY }
    if (cameraCenter.y + EDGE_DOWN_PADDING < C.y) return { x: 0, y: speed }
  }

  return { x: 0, y: 0 }
}

export function getMouseCameraDirections(
  mouse: CameraPoint,
  screen: { width: number; height: number },
  edgeDistance: number
): CameraDirection[] {
  const directions: CameraDirection[] = []
  const insideX = mouse.x >= 0 && mouse.x <= screen.width
  const insideY = mouse.y >= 0 && mouse.y <= screen.height
  if (mouse.x >= 0 && mouse.x <= edgeDistance && insideY) directions.push('left')
  else if (mouse.x > screen.width - edgeDistance && mouse.x <= screen.width && insideY) directions.push('right')
  if (insideX && mouse.y >= 0 && mouse.y <= edgeDistance) directions.push('up')
  else if (insideX && mouse.y > screen.height - edgeDistance && mouse.y <= screen.height) directions.push('down')
  return directions
}
