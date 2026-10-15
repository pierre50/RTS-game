import { getReliefLevelAtPoint } from '../lib/terrain/reliefSurface'

type ReliefMap = Parameters<typeof getReliefLevelAtPoint>[0]
type ReliefCell = NonNullable<Parameters<typeof getReliefLevelAtPoint>[2]>

/** Map coordinates and support height are simulation state, including offscreen animals. */
export type AnimalVisualState = {
  id: string
  type: string
  spaceId: string
  cell: { i: number; j: number; z: number }
  position: { x: number; y: number; z: number }
  altitude: number
  direction: number
  action: string
  visible: boolean
  sortOrder: number
}

export type AnimalVisualSource = {
  label: string
  type: string
  spaceId?: string | null
  i: number
  j: number
  x: number
  y: number
  z?: number | null
  currentCell?: ReliefCell | null
  altitude: number
  degree?: number
  currentSheet?: string
  visible: boolean
  zIndex?: number
}

export function animalVisualState(source: AnimalVisualSource, map: ReliefMap): AnimalVisualState {
  return {
    id: source.label,
    type: source.type,
    spaceId: source.spaceId ?? 'outside',
    cell: { i: source.i, j: source.j, z: source.currentCell?.z ?? source.z ?? 0 },
    position: { x: source.x, y: source.y, z: getReliefLevelAtPoint(map, source, source.currentCell) },
    altitude: source.altitude,
    direction: source.degree ?? 0,
    action: source.currentSheet ?? 'standing',
    visible: source.visible,
    sortOrder: source.zIndex ?? 0,
  }
}
