import { getReliefLevelAtPoint } from '../lib/terrain/reliefSurface'
import type { UnitAnimation } from './UnitAnimation'

type ReliefMap = Parameters<typeof getReliefLevelAtPoint>[0]
type ReliefCell = NonNullable<Parameters<typeof getReliefLevelAtPoint>[2]>

/** Flat map coordinates and the sampled support height, in terrain levels. */
export type UnitVisualState = {
  id: string
  type: string
  spaceId: string
  cell: { i: number; j: number; z: number }
  position: { x: number; y: number; z: number }
  direction: number
  action: string
  appearanceId: string
  visible: boolean
  selected: boolean
  sortOrder: number
}

export type UnitVisualSource = {
  label: string
  type: string
  spaceId?: string | null
  i: number
  j: number
  x: number
  y: number
  z?: number | null
  currentCell?: ReliefCell | null
  degree?: number
  currentSheet?: string
  visible: boolean
  selected?: boolean
  zIndex?: number
  appearanceVariants?: Record<string, string>
}

export function unitVisualState(
  source: UnitVisualSource,
  map: ReliefMap,
  sampledHeight = getReliefLevelAtPoint(map, source, source.currentCell)
): UnitVisualState {
  return {
    id: source.label,
    type: source.type,
    spaceId: source.spaceId ?? 'outside',
    cell: { i: source.i, j: source.j, z: source.currentCell?.z ?? source.z ?? 0 },
    position: { x: source.x, y: source.y, z: sampledHeight },
    direction: source.degree ?? 0,
    action: source.currentSheet ?? 'standing',
    appearanceId: source.appearanceVariants?.skin ?? source.type,
    visible: source.visible,
    selected: source.selected ?? false,
    sortOrder: source.zIndex ?? 0,
  }
}

export interface UnitViewAdapter extends UnitAnimation {
  mount(state: UnitVisualState): void
  update(state: UnitVisualState): void
  setAction(action: string): void
  isAnimationPlaying(): boolean
  playAnimation(): void
  stopAnimation(): void
  setAnimationLoop(loop: boolean): void
  pause(): void
  resume(): void
  setSelected(selected: boolean): void
  unmount(): void
}
